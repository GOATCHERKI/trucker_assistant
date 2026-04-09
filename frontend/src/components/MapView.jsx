import { useEffect } from 'react';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';

const DEFAULT_CENTER = [51.505, -0.09];
const DEFAULT_ZOOM = 11;

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(event) {
      onMapClick(event.latlng);
    },
  });

  return null;
}

function RouteViewport({ start, end, routeCoordinates }) {
  const map = useMap();

  useEffect(() => {
    if (routeCoordinates.length > 1) {
      map.fitBounds(routeCoordinates, { padding: [30, 30] });
      return;
    }

    if (start && end) {
      map.fitBounds([start, end], { padding: [40, 40] });
    }
  }, [map, start, end, routeCoordinates]);

  return null;
}

function MapView({ start, end, routeCoordinates, unsafePoints, onMapClick }) {
  return (
    <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} className="w-full h-screen">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapClickHandler onMapClick={onMapClick} />
      <RouteViewport start={start} end={end} routeCoordinates={routeCoordinates} />

      {start && <Marker position={start} />}
      {end && <Marker position={end} />}
      {routeCoordinates.length > 1 && <Polyline positions={routeCoordinates} pathOptions={{ color: '#0e7490', weight: 5 }} />}
      {unsafePoints.map((point, index) => (
        <CircleMarker key={`${point[0]}-${point[1]}-${index}`} center={point} radius={7} pathOptions={{ color: '#b91c1c', fillColor: '#ef4444', fillOpacity: 0.8 }} />
      ))}
    </MapContainer>
  );
}

export default MapView;
