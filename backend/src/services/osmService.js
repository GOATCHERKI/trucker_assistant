const axios = require("axios");
const { getBoundingBoxFromRoute } = require("../utils/geo");

const OVERPASS_URL =
  process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";

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

  const response = await axios.post(OVERPASS_URL, query, {
    headers: {
      "Content-Type": "text/plain",
    },
  });

  return mapOverpassToRoads(response.data.elements || []);
}

async function getRoadConstraintsForRoute(routeCoordinatesLonLat) {
  const bbox = getBoundingBoxFromRoute(routeCoordinatesLonLat, 0.01);
  return getRoadsInBbox(bbox);
}

module.exports = {
  getRoadsInBbox,
  getRoadConstraintsForRoute,
};
