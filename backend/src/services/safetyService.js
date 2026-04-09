const { parseRestrictionValue } = require("../utils/constraintParser");
const { isPointNearGeometry, toLatLon } = require("../utils/geo");

const NEARBY_THRESHOLD_METERS = 75;
const MAX_CRITICAL_ISSUES = 5;

function toDisplayNumber(value) {
  if (!Number.isFinite(value)) {
    return "unknown";
  }

  return Number(value.toFixed(2)).toString();
}

function toViolationMessage(type, limit, truckValue) {
  if (type === "height") {
    return `Low bridge: max ${toDisplayNumber(limit)}m, truck is ${toDisplayNumber(truckValue)}m`;
  }

  return `Weight restriction: max ${toDisplayNumber(limit)}t, truck is ${toDisplayNumber(truckValue)}t`;
}

function toViolationScore(violation) {
  if (!Number.isFinite(violation.actual) || !Number.isFinite(violation.limit)) {
    return 0;
  }

  const gap = violation.actual - violation.limit;
  if (violation.limit <= 0) {
    return gap;
  }

  return gap / violation.limit;
}

function buildSummary(violations) {
  return violations.reduce(
    (summary, violation) => {
      if (violation.type === "height") {
        summary.lowBridgeCount += 1;
      }

      if (violation.type === "weight") {
        summary.weightRestrictionCount += 1;
      }

      return summary;
    },
    {
      lowBridgeCount: 0,
      weightRestrictionCount: 0,
    },
  );
}

function buildCriticalIssues(violations) {
  return [...violations]
    .sort((a, b) => toViolationScore(b) - toViolationScore(a))
    .slice(0, MAX_CRITICAL_ISSUES)
    .map((violation) => ({
      type: violation.type,
      limit: violation.limit,
      truckValue: violation.actual,
      message: toViolationMessage(
        violation.type,
        violation.limit,
        violation.actual,
      ),
    }));
}

function toRiskLevel(totalViolations) {
  if (totalViolations < 3) {
    return "LOW";
  }

  if (totalViolations <= 10) {
    return "MEDIUM";
  }

  return "HIGH";
}

function buildRecommendation(isSafe, riskLevel) {
  if (isSafe) {
    return "This route appears suitable for this truck based on current map restrictions.";
  }

  if (riskLevel === "HIGH") {
    return "This route is not suitable for this truck. Choose an alternative route.";
  }

  if (riskLevel === "MEDIUM") {
    return "This route has multiple truck restrictions. Consider an alternative route.";
  }

  return "This route has truck restrictions. Review the critical issues before proceeding.";
}

function evaluateRoadLimitViolations(road, truck) {
  const violations = [];

  const maxHeight = parseRestrictionValue(road.maxheight);
  const maxWeight = parseRestrictionValue(road.maxweight);

  if (maxHeight !== null && truck.height > maxHeight) {
    violations.push({
      type: "height",
      limit: maxHeight,
      actual: truck.height,
      roadId: road.id,
    });
  }

  if (maxWeight !== null && truck.weight > maxWeight) {
    violations.push({
      type: "weight",
      limit: maxWeight,
      actual: truck.weight,
      roadId: road.id,
    });
  }

  return violations;
}

function evaluateRouteSafety({ routeCoordinatesLonLat, roads, truck }) {
  const allViolations = [];
  const unsafePoints = [];
  const warningKeys = new Set();
  const routeCoordinates = Array.isArray(routeCoordinatesLonLat)
    ? routeCoordinatesLonLat
    : [];
  const constrainedRoads = Array.isArray(roads) ? roads : [];

  for (const road of constrainedRoads) {
    const violations = evaluateRoadLimitViolations(road, truck);
    if (!violations.length || !road.geometry.length) {
      continue;
    }

    for (const coordinate of routeCoordinates) {
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
        allViolations.push(violation);
      }

      break;
    }
  }

  const summary = buildSummary(allViolations);
  const totalViolations =
    summary.lowBridgeCount + summary.weightRestrictionCount;
  const riskLevel = toRiskLevel(totalViolations);
  const isSafe = totalViolations === 0;

  return {
    riskLevel,
    summary,
    criticalIssues: buildCriticalIssues(allViolations),
    isSafe,
    recommendation: buildRecommendation(isSafe, riskLevel),
    unsafePoints,
  };
}

module.exports = {
  evaluateRouteSafety,
};
