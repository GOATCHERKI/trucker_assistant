function toLatLon(lonLat) {
  return [lonLat[1], lonLat[0]];
}

function toLonLat(latLon) {
  return [latLon[1], latLon[0]];
}

function haversineMeters(a, b) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000;

  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);

  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function isPointNearGeometry(pointLatLon, geometryLatLon, thresholdMeters) {
  for (const node of geometryLatLon) {
    if (haversineMeters(pointLatLon, node) <= thresholdMeters) {
      return true;
    }
  }

  return false;
}

function getBoundingBoxFromRoute(routeCoordinatesLonLat, padding = 0.01) {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  for (const [lon, lat] of routeCoordinatesLonLat) {
    minLon = Math.min(minLon, lon);
    minLat = Math.min(minLat, lat);
    maxLon = Math.max(maxLon, lon);
    maxLat = Math.max(maxLat, lat);
  }

  return [
    minLon - padding,
    minLat - padding,
    maxLon + padding,
    maxLat + padding,
  ];
}

module.exports = {
  toLatLon,
  toLonLat,
  haversineMeters,
  isPointNearGeometry,
  getBoundingBoxFromRoute,
};
