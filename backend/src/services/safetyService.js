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

function evaluateRouteSafety({ routeCoordinatesLonLat, roads, truck }) {
  const warnings = [];
  const unsafePoints = [];
  const warningKeys = new Set();

  for (const road of roads) {
    const violations = evaluateRoadLimitViolations(road, truck);
    if (!violations.length || !road.geometry.length) {
      continue;
    }

    for (const coordinate of routeCoordinatesLonLat) {
      const routePointLatLon = toLatLon(coordinate);

      if (
        !isPointNearGeometry(
          routePointLatLon,
          road.geometry,
          NEARBY_THRESHOLD_METERS,
        )
      ) {
        continue;
      }

      unsafePoints.push(routePointLatLon);

      for (const violation of violations) {
        const key = `${road.id}-${violation.type}`;
        if (warningKeys.has(key)) {
          continue;
        }

        warningKeys.add(key);
        warnings.push({
          roadId: road.id,
          ...violation,
        });
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
