const { getRoute } = require("../services/routingService");
const { getRoadConstraintsForRoute } = require("../services/osmService");
const { evaluateRouteSafety } = require("../services/safetyService");

function isValidCoordinate(point) {
  return (
    point &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lon) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lon >= -180 &&
    point.lon <= 180
  );
}

function validatePayload(body) {
  const { start, end, truck } = body || {};

  if (!isValidCoordinate(start) || !isValidCoordinate(end)) {
    return "Start and end coordinates are required and must be valid lat/lon values.";
  }

  if (
    !truck ||
    !Number.isFinite(truck.height) ||
    !Number.isFinite(truck.weight)
  ) {
    return "Truck specs are required and must contain numeric height and weight.";
  }

  if (truck.height <= 0 || truck.weight <= 0) {
    return "Truck height and weight must be greater than zero.";
  }

  return null;
}

async function getSafeRoute(req, res, next) {
  try {
    const validationError = validatePayload(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const { start, end, truck } = req.body;

    const route = await getRoute(start, end);
    const routeCoordinatesLonLat = route.geometry.coordinates;
    const roads = await getRoadConstraintsForRoute(routeCoordinatesLonLat);

    const safety = evaluateRouteSafety({
      routeCoordinatesLonLat,
      roads,
      truck,
    });

    return res.json({
      distance: route.distance,
      eta: route.duration,
      riskLevel: safety.riskLevel,
      summary: safety.summary,
      criticalIssues: safety.criticalIssues,
      isSafe: safety.isSafe,
      recommendation: safety.recommendation,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getSafeRoute,
};
