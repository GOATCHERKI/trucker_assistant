const axios = require("axios");
const { haversineMeters } = require("../utils/geo");

const OSRM_BASE_URL =
  process.env.OSRM_BASE_URL || "https://router.project-osrm.org";

const DETOUR_SHIFT_DEGREES = Number(process.env.DETOUR_SHIFT_DEGREES) || 0.008;
const DETOUR_MIN_POINT_SPACING_METERS =
  Number(process.env.DETOUR_MIN_POINT_SPACING_METERS) || 400;
const DETOUR_MAX_WAYPOINTS = Math.max(
  1,
  Number(process.env.DETOUR_MAX_WAYPOINTS) || 2,
);
const DETOUR_MIN_ROUTE_INDEX_GAP =
  Number(process.env.DETOUR_MIN_ROUTE_INDEX_GAP) || 20;

function clampLat(lat) {
  return Math.max(-90, Math.min(90, lat));
}

function clampLon(lon) {
  return Math.max(-180, Math.min(180, lon));
}

// points: Array<{ lat, lon }> -> OSRM coordinate string "lon,lat;lon,lat"
function buildRouteRequestCoordinates(points) {
  return points.map((point) => `${point.lon},${point.lat}`).join(";");
}

// point: [lat, lon]
function isValidUnsafePoint(point) {
  return (
    Array.isArray(point) &&
    point.length === 2 &&
    Number.isFinite(point[0]) &&
    Number.isFinite(point[1])
  );
}

// [lon, lat] (GeoJSON) -> [lat, lon]
function toLatLonFromLonLat([lon, lat]) {
  return [lat, lon];
}

// pointLatLon: [lat, lon], routeCoordinatesLonLat: Array<[lon, lat]>
function findClosestRouteIndex(pointLatLon, routeCoordinatesLonLat) {
  let bestIndex = -1;
  let bestDistance = Infinity;

  for (let index = 0; index < routeCoordinatesLonLat.length; index += 1) {
    const routePoint = toLatLonFromLonLat(routeCoordinatesLonLat[index]);
    const distance = haversineMeters(pointLatLon, routePoint);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return { bestIndex, bestDistance };
}

// unsafePoints: Array<[lat, lon]>, routeCoordinatesLonLat: Array<[lon, lat]>
function selectKeyUnsafePoints(unsafePoints, routeCoordinatesLonLat) {
  const candidates = [];
  const seen = new Set();

  for (const point of unsafePoints || []) {
    if (!isValidUnsafePoint(point)) {
      continue;
    }

    const key = `${point[0].toFixed(5)}-${point[1].toFixed(5)}`;
    if (seen.has(key)) {
      continue;
    }

    const { bestIndex, bestDistance } = findClosestRouteIndex(
      point,
      routeCoordinatesLonLat,
    );

    if (bestIndex < 0) {
      continue;
    }

    seen.add(key);
    candidates.push({
      point,
      routeIndex: bestIndex,
      distanceToRoute: bestDistance,
    });
  }

  candidates.sort((a, b) => a.routeIndex - b.routeIndex);

  const selected = [];
  for (const candidate of candidates) {
    const tooCloseToSelected = selected.some(
      (selectedCandidate) =>
        Math.abs(candidate.routeIndex - selectedCandidate.routeIndex) <
          DETOUR_MIN_ROUTE_INDEX_GAP &&
        haversineMeters(candidate.point, selectedCandidate.point) <
          DETOUR_MIN_POINT_SPACING_METERS,
    );

    if (tooCloseToSelected) {
      continue;
    }

    selected.push(candidate);

    if (selected.length >= DETOUR_MAX_WAYPOINTS) {
      break;
    }
  }

  return selected;
}

// routeCoordinatesLonLat: Array<[lon, lat]>
function getRouteDirectionVector(routeCoordinatesLonLat, routeIndex) {
  const previous = routeCoordinatesLonLat[Math.max(0, routeIndex - 1)];
  const next =
    routeCoordinatesLonLat[
      Math.min(routeCoordinatesLonLat.length - 1, routeIndex + 1)
    ];

  if (!previous || !next) {
    return { dLat: 0, dLon: 0 };
  }

  const [prevLon, prevLat] = previous;
  const [nextLon, nextLat] = next;

  return {
    dLat: nextLat - prevLat,
    dLon: nextLon - prevLon,
  };
}

function requestOsrmRoute(coordinates) {
  const url = `${OSRM_BASE_URL}/route/v1/driving/${coordinates}`;

  return axios.get(url, {
    params: {
      overview: "full",
      geometries: "geojson",
      steps: false,
    },
  });
}

async function getRoute(start, end) {
  // start/end: { lat, lon }
  const coordinates = buildRouteRequestCoordinates([start, end]);
  const response = await requestOsrmRoute(coordinates);

  if (!response.data.routes || !response.data.routes.length) {
    const error = new Error("No route found from OSRM");
    error.status = 404;
    throw error;
  }

  return response.data.routes[0];
}

/**
 * Computes a single perpendicular waypoint for one unsafe point.
 * unsafePoint: [lat, lon], routeCoordinatesLonLat: Array<[lon, lat]>
 * Returns { lat, lon } or null if the point is invalid or not on the route.
 */
function createDetourWaypoint(unsafePoint, routeCoordinatesLonLat) {
  if (!routeCoordinatesLonLat.length || !isValidUnsafePoint(unsafePoint)) {
    return null;
  }

  const { bestIndex } = findClosestRouteIndex(
    unsafePoint,
    routeCoordinatesLonLat,
  );

  if (bestIndex < 0) {
    return null;
  }

  const [lat, lon] = unsafePoint;
  const { dLat, dLon } = getRouteDirectionVector(
    routeCoordinatesLonLat,
    bestIndex,
  );

  const magnitude = Math.sqrt(dLat * dLat + dLon * dLon) || 1;
  const normalLat = -dLon / magnitude;
  const normalLon = dLat / magnitude;

  return {
    lat: clampLat(lat + normalLat * DETOUR_SHIFT_DEGREES),
    lon: clampLon(lon + normalLon * DETOUR_SHIFT_DEGREES),
  };
}

/**
 * Legacy batch helper — kept for compatibility.
 * unsafePoints: Array<[lat, lon]>, routeCoordinatesLonLat: Array<[lon, lat]>
 * Internally delegates to createDetourWaypoint for each selected point.
 */
function createDetourWaypoints(unsafePoints, routeCoordinatesLonLat = []) {
  if (!routeCoordinatesLonLat.length) {
    return [];
  }

  const keyUnsafePoints = selectKeyUnsafePoints(
    unsafePoints,
    routeCoordinatesLonLat,
  );

  return keyUnsafePoints
    .map(({ point }, index) => {
      const waypoint = createDetourWaypoint(point, routeCoordinatesLonLat);
      if (!waypoint) return null;
      // Alternate sides for consecutive waypoints to avoid zigzag
      const side = index % 2 === 0 ? 1 : -1;
      return {
        lat: clampLat(waypoint.lat + (waypoint.lat - point[0]) * (side - 1)),
        lon: clampLon(waypoint.lon + (waypoint.lon - point[1]) * (side - 1)),
      };
    })
    .filter(Boolean);
}

async function getRouteWithWaypoints(start, end, waypoints = []) {
  // start/end/waypoints: { lat, lon }; OSRM returns geometry.coordinates as [lon, lat]
  const points = [start, ...waypoints, end];
  const coordinates = buildRouteRequestCoordinates(points);
  const response = await requestOsrmRoute(coordinates);

  if (!response.data.routes || !response.data.routes.length) {
    const error = new Error("No route found from OSRM");
    error.status = 404;
    throw error;
  }

  return response.data.routes[0];
}

module.exports = {
  getRoute,
  getRouteWithWaypoints,
  createDetourWaypoint,
  createDetourWaypoints,
};
