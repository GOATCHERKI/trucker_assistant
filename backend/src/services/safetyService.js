const { parseRestrictionValue } = require("../utils/constraintParser");
const { isPointNearGeometry, toLatLon } = require("../utils/geo");

const NEARBY_THRESHOLD_METERS = 75;

function evaluateRoadLimitViolations(road, truck) {
  const violations = [];

  const maxHeight = parseRestrictionValue(road.maxheight);
  const maxWeight = parseRestrictionValue(road.maxweight);

  if (maxHeight !== null && truck.height > maxHeight) {
    violations.push({
      type: "height",
      limit: maxHeight,
      actual: truck.height,
      message: `Low bridge ahead on road ${road.id}: truck height ${truck.height}m exceeds max ${maxHeight}m.`,
    });
  }

  if (maxWeight !== null && truck.weight > maxWeight) {
    violations.push({
      type: "weight",
      limit: maxWeight,
      actual: truck.weight,
      message: `Weight restriction exceeded on road ${road.id}: truck weight ${truck.weight}t exceeds max ${maxWeight}t.`,
    });
  }

  return violations;
}

// geometry: Array<[lon, lat]> (GeoJSON) OR Array<{ lat, lon }>
// returns: [lat, lon]
function getRoadMidpoint(geometry) {
  if (!geometry.length) return null;
  const mid = geometry[Math.floor(geometry.length / 2)];
  if (Array.isArray(mid)) {
    return [mid[1], mid[0]]; // [lat, lon]
  }
  return [mid.lat, mid.lon];
}

// routeCoordinatesLonLat: Array<[lon, lat]> (GeoJSON)
// safety.warnings[].roadMidpoint: [lat, lon] road center for detour logic
// safety.unsafePoints: Array<[lat, lon]> route-matched points aligned by warning index
function evaluateRouteSafety({ routeCoordinatesLonLat, roads, truck }) {
  const warnings = [];
  const unsafePoints = [];
  const warningKeys = new Set();

  for (const road of roads) {
    const violations = evaluateRoadLimitViolations(road, truck);
    if (!violations.length || !road.geometry.length) {
      continue;
    }

    const roadGeometryLatLon = road.geometry.map((node) =>
      Array.isArray(node) ? toLatLon(node) : [node.lat, node.lon],
    );

    for (const coordinate of routeCoordinatesLonLat) {
      const routePointLatLon = toLatLon(coordinate);

      if (
        !isPointNearGeometry(
          routePointLatLon,
          roadGeometryLatLon,
          NEARBY_THRESHOLD_METERS,
        )
      ) {
        continue;
      }

      for (const violation of violations) {
        const key = `${road.id}-${violation.type}`;
        if (warningKeys.has(key)) {
          continue;
        }

        warningKeys.add(key);
        warnings.push({
          roadId: road.id,
          // roadMidpoint is consumed by the controller to attempt a per-issue detour.
          // We use the road's own geometry midpoint (not the route point near it) so
          // that the perpendicular shift in createDetourWaypoint lands off the road.
          roadMidpoint: getRoadMidpoint(road.geometry),
          ...violation,
        });

        // Keep one unsafe point per warning in the same order.
        // point: [lat, lon] on the actual route polyline.
        unsafePoints.push(routePointLatLon);
      }

      break;
    }
  }

  return {
    isSafe: warnings.length === 0,
    warnings,
    unsafePoints,
  };
}

module.exports = {
  evaluateRouteSafety,
};
