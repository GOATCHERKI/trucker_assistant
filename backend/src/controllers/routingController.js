const {
  getRoute,
  getRouteWithWaypoints,
  createDetourWaypoint,
} = require("../services/routingService");
const { getRoadConstraintsForRoute } = require("../services/osmService");
const { evaluateRouteSafety } = require("../services/safetyService");

const MAX_ALTERNATIVE_DISTANCE_FACTOR =
  Number(process.env.MAX_ALTERNATIVE_DISTANCE_FACTOR) || 1.45;

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

/**
 * Tries to find a detour waypoint for a single unsafe point and validates that
 * the resulting route is not excessively longer than the fastest route.
 *
 * Returns:
 *   { solved: true,  waypoint, route }   — detour found and within distance limit
 *   { solved: false, reason }            — no viable detour
 */
async function tryDetourForPoint(
  unsafePoint,
  start,
  end,
  fastestRoute,
  routeCoordinatesLonLat,
) {
  const waypoint = createDetourWaypoint(unsafePoint, routeCoordinatesLonLat);

  if (!waypoint) {
    return {
      solved: false,
      reason: "Could not compute a detour waypoint for this location.",
    };
  }

  try {
    const detourRoute = await getRouteWithWaypoints(start, end, [waypoint]);

    if (
      detourRoute.distance >
      fastestRoute.distance * MAX_ALTERNATIVE_DISTANCE_FACTOR
    ) {
      return {
        solved: false,
        reason: `Detour is too long (>${MAX_ALTERNATIVE_DISTANCE_FACTOR}x the fastest route). No practical alternative road exists near this restriction.`,
        waypoint,
      };
    }

    return { solved: true, waypoint, route: detourRoute };
  } catch (err) {
    console.error("[tryDetourForPoint] OSRM error:", err.message, {
      waypoint,
      start,
      end,
    });
    return {
      solved: false,
      reason: `No routable path found through the detour waypoint: ${err.message}`,
      waypoint,
    };
  }
}

async function getSafeRoute(req, res, next) {
  try {
    const validationError = validatePayload(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const { start, end, truck, unsafePoints: inputUnsafePoints } = req.body;

    const fastestRoute = await getRoute(start, end);
    const routeCoordinatesLonLat = fastestRoute.geometry.coordinates;
    const roads = await getRoadConstraintsForRoute(routeCoordinatesLonLat);

    const safety = evaluateRouteSafety({
      routeCoordinatesLonLat,
      roads,
      truck,
    });

    // If the caller supplied explicit unsafePoints use those; otherwise derive
    // one entry per warning from the safety analysis.
    const issuePoints =
      Array.isArray(inputUnsafePoints) && inputUnsafePoints.length
        ? inputUnsafePoints.map((pt) => ({ roadId: null, roadMidpoint: pt }))
        : safety.warnings.filter((w) => w.roadMidpoint);

    // ── Per-issue detour attempts ──────────────────────────────────────────
    // We resolve every issue independently and then build a combined route
    // from all waypoints that individually produced a valid detour.

    const issueResults = await Promise.all(
      issuePoints.map(async (issue) => {
        const result = await tryDetourForPoint(
          issue.roadMidpoint,
          start,
          end,
          fastestRoute,
          routeCoordinatesLonLat,
        );
        return {
          roadId: issue.roadId ?? null,
          type: issue.type ?? null,
          message: issue.message ?? null,
          roadMidpoint: issue.roadMidpoint,
          ...result,
        };
      }),
    );

    // ── Build combined safe route from all solved waypoints ───────────────
    const solvedWaypoints = issueResults
      .filter((r) => r.solved)
      .map((r) => r.waypoint);

    let safeRoute = null;
    let routeLabel = "original_route";
    let responseRoute = fastestRoute;
    let combinedRouteError = null;

    if (solvedWaypoints.length > 0) {
      try {
        const combined = await getRouteWithWaypoints(
          start,
          end,
          solvedWaypoints,
        );

        if (
          combined.distance <=
          fastestRoute.distance * MAX_ALTERNATIVE_DISTANCE_FACTOR
        ) {
          safeRoute = combined;
          responseRoute = combined;
          routeLabel = "safe_alternative_route";
        } else {
          // Combined route is too long even though individual detours were ok —
          // fall back to the single-issue route that is shortest.
          const bestSingle = issueResults
            .filter((r) => r.solved)
            .sort((a, b) => a.route.distance - b.route.distance)[0];

          safeRoute = bestSingle.route;
          responseRoute = bestSingle.route;
          routeLabel = "safe_alternative_route";
          combinedRouteError =
            "Combined waypoint route exceeded distance limit; using best single-issue detour instead.";
        }
      } catch (err) {
        console.error("[getSafeRoute] Combined route failed:", err.message);
        combinedRouteError = `Combined waypoint route failed: ${err.message}`;

        // Fall back to best individual detour
        const bestSingle = issueResults
          .filter((r) => r.solved)
          .sort((a, b) => a.route.distance - b.route.distance)[0];

        if (bestSingle) {
          safeRoute = bestSingle.route;
          responseRoute = bestSingle.route;
          routeLabel = "safe_alternative_route";
        }
      }
    }

    // Strip the internal roadMidpoint from warnings before sending to client
    const clientWarnings = safety.warnings.map(
      ({ roadMidpoint, ...rest }) => rest,
    );

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
      safety: {
        ...safety,
        warnings: clientWarnings,
      },
      metadata: {
        roadsAnalyzed: roads.length,
        routeLabel,
        combinedRouteError: combinedRouteError ?? undefined,
        // Per-issue detour outcomes — one entry per unsafe road
        issueResults: issueResults.map(
          ({
            roadId,
            type,
            message,
            roadMidpoint,
            solved,
            reason,
            waypoint,
          }) => ({
            roadId,
            type,
            message,
            roadMidpoint,
            solved,
            ...(solved ? { waypoint } : { reason }),
          }),
        ),
      },
    });
  } catch (error) {
    console.error("[getSafeRoute] Unhandled error:", error);
    return next(error);
  }
}

module.exports = {
  getSafeRoute,
};
