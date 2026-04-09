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

function buildOverpassQuery([minLon, minLat, maxLon, maxLat]) {
  return `
    [out:json][timeout:25];
    (
      way["highway"]["maxheight"](${minLat},${minLon},${maxLat},${maxLon});
      way["highway"]["maxweight"](${minLat},${minLon},${maxLat},${maxLon});
    );
    (._;>;);
    out body;
  `;
}

function mapOverpassToRoads(elements) {
  const nodeMap = new Map();

  for (const element of elements) {
    if (element.type === "node") {
      nodeMap.set(element.id, [element.lat, element.lon]);
    }
  }

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

    const geometry = (element.nodes || [])
      .map((nodeId) => nodeMap.get(nodeId))
      .filter(Boolean);

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
  for (const url of ALL_OVERPASS_URLS) {
    try {
      const response = await axios.post(url, query, {
        headers: {
          "Content-Type": "text/plain",
        },
        timeout: 30000, // 30 second timeout per attempt
      });
      return mapOverpassToRoads(response.data.elements || []);
    } catch (error) {
      lastError = error;
      const status = error.response?.status;
      // Retry on 5xx errors (server errors), timeouts, or network errors
      // Don't retry on 4xx errors (client errors, which won't change with a retry)
      if (status && status < 500) {
        throw error; // No point retrying 4xx errors
      }
      // Log and continue to next URL
      console.warn(
        `Overpass API failed at ${url}: ${status || error.message}. Trying next URL...`,
      );
    }
  }

  // All URLs failed
  throw new Error(
    `All Overpass API servers failed. Last error: ${lastError?.message}`,
  );
}

async function getRoadConstraintsForRoute(routeCoordinatesLonLat) {
  const bbox = getBoundingBoxFromRoute(routeCoordinatesLonLat, 0.01);
  return getRoadsInBbox(bbox);
}

module.exports = {
  getRoadsInBbox,
  getRoadConstraintsForRoute,
};
