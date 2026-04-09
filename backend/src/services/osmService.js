const axios = require("axios");
const { getBoundingBoxFromRoute } = require("../utils/geo");

const OVERPASS_URL =
  process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";

// Parse fallback URLs from env (comma-separated)
const OVERPASS_FALLBACK_URLS = process.env.OVERPASS_FALLBACK_URLS
  ? process.env.OVERPASS_FALLBACK_URLS.split(",").map((url) => url.trim())
  : [];

// All URLs to attempt (primary first, then fallbacks)
const ALL_OVERPASS_URLS = [OVERPASS_URL, ...OVERPASS_FALLBACK_URLS];
const OVERPASS_TIMEOUT_MS = Number(process.env.OVERPASS_TIMEOUT_MS) || 15000;
const OVERPASS_MAX_RETRIES = Number(process.env.OVERPASS_MAX_RETRIES) || 2;

function buildOverpassQuery([minLon, minLat, maxLon, maxLat]) {
  return `
    [out:json][timeout:25];
    (
      way["highway"]["maxheight"](${minLat},${minLon},${maxLat},${maxLon});
      way["highway"]["maxweight"](${minLat},${minLon},${maxLat},${maxLon});
    );
    out tags geom;
  `;
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

    const geometry = (element.geometry || []).map((point) => [point.lat, point.lon]);

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
        return mapOverpassToRoads(response.data.elements || []);
      } catch (error) {
        lastError = error;
        const status = error.response?.status;
        // Don't retry 4xx client-side errors on other mirrors.
        if (status && status < 500) {
          throw error;
        }

        console.warn(
          `Overpass API failed at ${url} (attempt ${attempt}/${OVERPASS_MAX_RETRIES}): ${status || error.message}`,
        );
      }
    }
  }

  // Degrade gracefully instead of failing route calculation entirely.
  console.error(
    `All Overpass API servers failed after ${OVERPASS_MAX_RETRIES} attempt(s). Returning empty constraints. Last error: ${lastError?.message}`,
  );

  return [];
}

async function getRoadConstraintsForRoute(routeCoordinatesLonLat) {
  const bbox = getBoundingBoxFromRoute(routeCoordinatesLonLat, 0.01);
  return getRoadsInBbox(bbox);
}

module.exports = {
  getRoadsInBbox,
  getRoadConstraintsForRoute,
};
