const axios = require("axios");
const { haversineMeters } = require("../utils/geo");

const OSRM_BASE_URL =
  process.env.OSRM_BASE_URL || "https://router.project-osrm.org";

const DETOUR_SHIFT_DEGREES = Number(process.env.DETOUR_SHIFT_DEGREES) || 0.003;
const DETOUR_MIN_POINT_SPACING_METERS =
  Number(process.env.DETOUR_MIN_POINT_SPACING_METERS) || 400;
const DETOUR_MAX_WAYPOINTS = Math.max(
  1,
  Math.min(2, Number(process.env.DETOUR_MAX_WAYPOINTS) || 2),
);

function clampLat(lat) {
  return Math.max(-90, Math.min(90, lat));
}

function clampLon(lon) {
  return Math.max(-180, Math.min(180, lon));
}

function buildRouteRequestCoordinates(points) {
  return points.map((point) => `${point.lon},${point.lat}`).join(";");
}

function isValidUnsafePoint(point) {
  return (
    Array.isArray(point) &&
    point.length === 2 &&
    Number.isFinite(point[0]) &&
    Number.isFinite(point[1])
  );
}

function selectKeyUnsafePoints(unsafePoints) {
  const selected = [];
  const seen = new Set();

  for (const point of unsafePoints || []) {
    if (!isValidUnsafePoint(point)) {
      continue;
    }

    const key = `${point[0].toFixed(5)}-${point[1].toFixed(5)}`;
    if (seen.has(key)) {
      continue;
    }

    const tooCloseToSelected = selected.some(
      (selectedPoint) =>
        haversineMeters(point, selectedPoint) < DETOUR_MIN_POINT_SPACING_METERS,
    );

    if (tooCloseToSelected) {
      continue;
    }

    seen.add(key);
    selected.push(point);

    if (selected.length >= DETOUR_MAX_WAYPOINTS) {
      break;
    }
  }

  return selected;
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
  const coordinates = buildRouteRequestCoordinates([start, end]);
  const response = await requestOsrmRoute(coordinates);

  if (!response.data.routes || !response.data.routes.length) {
    const error = new Error("No route found from OSRM");
    error.status = 404;
    throw error;
  }

  return response.data.routes[0];
}

function createDetourWaypoints(unsafePoints) {
  const keyUnsafePoints = selectKeyUnsafePoints(unsafePoints);

  return keyUnsafePoints.map(([lat, lon], index) => {
    const shiftLat =
      index % 2 === 0 ? DETOUR_SHIFT_DEGREES : -DETOUR_SHIFT_DEGREES;
    const shiftLon =
      index % 2 === 0 ? -DETOUR_SHIFT_DEGREES : DETOUR_SHIFT_DEGREES;
    const shifted = {
      lat: clampLat(lat + shiftLat),
      lon: clampLon(lon + shiftLon),
    };
    return shifted;
  });
}

async function getRouteWithWaypoints(start, end, waypoints = []) {
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
  createDetourWaypoints,
};
