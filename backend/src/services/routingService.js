const axios = require("axios");

const OSRM_BASE_URL =
  process.env.OSRM_BASE_URL || "https://router.project-osrm.org";

async function getRoute(start, end) {
  const coordinates = `${start.lon},${start.lat};${end.lon},${end.lat}`;
  const url = `${OSRM_BASE_URL}/route/v1/driving/${coordinates}`;

  const response = await axios.get(url, {
    params: {
      overview: "full",
      geometries: "geojson",
      steps: false,
    },
  });

  if (!response.data.routes || !response.data.routes.length) {
    const error = new Error("No route found from OSRM");
    error.status = 404;
    throw error;
  }

  return response.data.routes[0];
}

module.exports = {
  getRoute,
};
