const {
  getRoute,
  getRouteWithWaypoints,
  createDetourWaypoints,
} = require("../services/routingService");
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
  const { start, end, truck, unsafePoints } = body || {};

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

  if (
    unsafePoints !== undefined &&
    (!Array.isArray(unsafePoints) ||
      unsafePoints.some(
        (point) =>
          !Array.isArray(point) ||
          point.length !== 2 ||
          !Number.isFinite(point[0]) ||
          !Number.isFinite(point[1]),
      ))
  ) {
    return "unsafePoints must be an array of [lat, lon] numeric pairs.";
  }

  return null;
}

async function getSafeRoute(req, res, next) {
  try {
    const validationError = validatePayload(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const { start, end, truck, unsafePoints: inputUnsafePoints } = req.body;

    const route = await getRoute(start, end);
    const routeCoordinatesLonLat = route.geometry.coordinates;
    const roads = await getRoadConstraintsForRoute(routeCoordinatesLonLat);

    const safety = evaluateRouteSafety({
      routeCoordinatesLonLat,
      roads,
      truck,
    });

    const fastestRoute = route;
    let responseRoute = route;
    let safeRoute = null;
    let routeLabel = "original_route";
    let alternative = null;

    const rerouteUnsafePoints =
      Array.isArray(inputUnsafePoints) && inputUnsafePoints.length
        ? inputUnsafePoints
        : safety.unsafePoints;

    if (rerouteUnsafePoints.length) {
      const detourWaypoints = createDetourWaypoints(rerouteUnsafePoints);

      if (detourWaypoints.length) {
        try {
          const alternativeRoute = await getRouteWithWaypoints(
            start,
            end,
            detourWaypoints,
          );

          responseRoute = alternativeRoute;
          safeRoute = alternativeRoute;
          routeLabel = "safe_alternative_route";
          alternative = {
            applied: true,
            waypointsUsed: detourWaypoints.length,
            detourWaypoints,
          };
        } catch (rerouteError) {
          alternative = {
            applied: false,
            reason: rerouteError.message,
            waypointsUsed: detourWaypoints.length,
            detourWaypoints,
          };
        }
      }
    }

    return res.json({
      route: {
        distanceMeters: responseRoute.distance,
        durationSeconds: responseRoute.duration,
        geometry: responseRoute.geometry,
      },
      routes: {
        fastest: {
          distanceMeters: fastestRoute.distance,
          durationSeconds: fastestRoute.duration,
          geometry: fastestRoute.geometry,
        },
        safe: safeRoute
          ? {
              distanceMeters: safeRoute.distance,
              durationSeconds: safeRoute.duration,
              geometry: safeRoute.geometry,
            }
          : null,
      },
      safety,
      metadata: {
        roadsAnalyzed: roads.length,
        routeLabel,
        alternative,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getSafeRoute,
};
