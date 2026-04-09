const { getRoadsInBbox } = require("../services/osmService");

function parseBbox(rawBbox) {
  if (!rawBbox) {
    return null;
  }

  const values = rawBbox.split(",").map((value) => Number(value));
  if (values.length !== 4 || values.some((value) => Number.isNaN(value))) {
    return null;
  }

  return values;
}

async function getRoadsByBbox(req, res, next) {
  try {
    const bbox = parseBbox(req.query.bbox);

    if (!bbox) {
      return res.status(400).json({
        error: "Invalid bbox. Expected format: minLon,minLat,maxLon,maxLat",
      });
    }

    const roads = await getRoadsInBbox(bbox);
    return res.json({
      count: roads.length,
      roads,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getRoadsByBbox,
};
