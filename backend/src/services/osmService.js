const axios = require("axios");
const { getBoundingBoxFromRoute } = require("../utils/geo");

const OVERPASS_URL =
  process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";

// Parse fallback URLs from env (comma-separated)
const OVERPASS_FALLBACK_URLS = process.env.OVERPASS_FALLBACK_URLS
  ? process.env.OVERPASS_FALLBACK_URLS.split(",").map((url) => url.trim())
  : [];

// All URLs to attempt (primary first, then fallbacks)
const ALL_OVERPASS_URLS = [...new Set([OVERPASS_URL, ...OVERPASS_FALLBACK_URLS])];
const OVERPASS_TIMEOUT_MS = Number(process.env.OVERPASS_TIMEOUT_MS) || 15000;
const OVERPASS_MAX_RETRIES = Number(process.env.OVERPASS_MAX_RETRIES) || 2;
const OVERPASS_QUERY_TIMEOUT_SECONDS =
  Number(process.env.OVERPASS_QUERY_TIMEOUT_SECONDS) || 12;
const OVERPASS_BBOX_PADDING = Number(process.env.OVERPASS_BBOX_PADDING) || 0.003;
const OVERPASS_MAX_BBOX_SPAN_DEGREES =
  Number(process.env.OVERPASS_MAX_BBOX_SPAN_DEGREES) || 0.2;
const OVERPASS_FAILURE_COOLDOWN_MS =
  Number(process.env.OVERPASS_FAILURE_COOLDOWN_MS) || 120000;
const OVERPASS_RATE_LIMIT_COOLDOWN_MS =
  Number(process.env.OVERPASS_RATE_LIMIT_COOLDOWN_MS) || 300000;

let overpassCooldownUntil = 0;

function buildOverpassQuery([minLon, minLat, maxLon, maxLat]) {
  return `
    [out:json][timeout:${OVERPASS_QUERY_TIMEOUT_SECONDS}];
    (
      way["highway"]["maxheight"](${minLat},${minLon},${maxLat},${maxLon});
      way["highway"]["maxweight"](${minLat},${minLon},${maxLat},${maxLon});
    );
    out tags geom;
  `;
}

function isBboxTooLarge([minLon, minLat, maxLon, maxLat]) {
  const latSpan = Math.abs(maxLat - minLat);
  const lonSpan = Math.abs(maxLon - minLon);

  return (
    latSpan > OVERPASS_MAX_BBOX_SPAN_DEGREES ||
    lonSpan > OVERPASS_MAX_BBOX_SPAN_DEGREES
  );
}

function mapOverpassToRoads(elements) {
  const roads = [];
  for (const element of elements) {
    if (element.type !== "way") {
      continue;
    }

    const tags = element.tags || {};
    const hasLimit = tags.maxheight || tags.maxweight;
    if (!hasLimit) {
      continue;
    }

    // geometry: Array<[lon, lat]> (GeoJSON), preserved for downstream consistency
    const geometry = (element.geometry || []).map((point) => [
      point.lon,
      point.lat,
    ]);

    roads.push({
      id: element.id,
      tags,
      maxheight: tags.maxheight || null,
      maxweight: tags.maxweight || null,
      geometry,
    });
  }

  return roads;
}

async function getRoadsInBbox(bbox) {
  if (Date.now() < overpassCooldownUntil) {
    return [];
  }

  if (isBboxTooLarge(bbox)) {
    console.warn(
      `Skipping Overpass query due to large bbox span. max span allowed: ${OVERPASS_MAX_BBOX_SPAN_DEGREES}`,
      { bbox },
    );
    return [];
  }

  const query = buildOverpassQuery(bbox);

  let lastError;
  for (let attempt = 1; attempt <= OVERPASS_MAX_RETRIES; attempt += 1) {
    for (const url of ALL_OVERPASS_URLS) {
      try {
        const response = await axios.post(url, query, {
          headers: {
            "Content-Type": "text/plain",
          },
          timeout: OVERPASS_TIMEOUT_MS,
        });
        overpassCooldownUntil = 0;
        return mapOverpassToRoads(response.data.elements || []);
      } catch (error) {
        lastError = error;
        const status = error.response?.status;

        if (status === 429) {
          overpassCooldownUntil = Date.now() + OVERPASS_RATE_LIMIT_COOLDOWN_MS;
          console.warn(
            `Overpass API rate-limited at ${url}. Entering cooldown for ${Math.round(OVERPASS_RATE_LIMIT_COOLDOWN_MS / 1000)}s.`,
          );
          continue;
        }

        // For non-rate-limit 4xx responses, don't crash the request.
        if (status && status >= 400 && status < 500) {
          console.warn(
            `Overpass API client error at ${url}: ${status}. Skipping constraints for this request.`,
          );
          continue;
        }

        console.warn(
          `Overpass API failed at ${url} (attempt ${attempt}/${OVERPASS_MAX_RETRIES}): ${status || error.message}`,
        );
      }
    }
  }

  // Degrade gracefully instead of failing route calculation entirely.
  overpassCooldownUntil = Math.max(
    overpassCooldownUntil,
    Date.now() + OVERPASS_FAILURE_COOLDOWN_MS,
  );
  console.error(
    `All Overpass API servers failed after ${OVERPASS_MAX_RETRIES} attempt(s). Returning empty constraints. Last error: ${lastError?.message}`,
  );

  return [];
}

async function getRoadConstraintsForRoute(routeCoordinatesLonLat) {
  const bbox = getBoundingBoxFromRoute(routeCoordinatesLonLat, OVERPASS_BBOX_PADDING);
  return getRoadsInBbox(bbox);
}

module.exports = {
  getRoadsInBbox,
  getRoadConstraintsForRoute,
};
