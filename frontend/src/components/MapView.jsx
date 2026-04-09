import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import {
  MapContainer,
  Marker,
  Popup,
  Polyline,
  TileLayer,
  Tooltip,
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

function FocusOnUnsafeMarker({ focusedMarker }) {
  const map = useMap();

  useEffect(() => {
    if (!focusedMarker?.position) {
      return;
    }

    map.flyTo(focusedMarker.position, Math.max(map.getZoom(), 14), {
      duration: 0.6,
    });
  }, [focusedMarker, map]);

  return null;
}

function MapView({ start, end, routeCoordinates, unsafeMarkers, focusedMarkerId, onMapClick }) {
  const markerRefs = useRef({});

  const startIcon = useMemo(
    () =>
      new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      }),
    [],
  );

  const endIcon = useMemo(
    () =>
      new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      }),
    [],
  );

  const unsafeIcon = useMemo(
    () =>
      new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      }),
    [],
  );

  const focusedMarker = useMemo(
    () => unsafeMarkers.find((marker) => marker.id === focusedMarkerId) || null,
    [unsafeMarkers, focusedMarkerId],
  );

  useEffect(() => {
    if (!focusedMarkerId) {
      return;
    }

    const markerRef = markerRefs.current[focusedMarkerId];
    if (markerRef) {
      markerRef.openPopup();
    }
  }, [focusedMarkerId]);

  return (
    <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} className="w-full h-screen">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapClickHandler onMapClick={onMapClick} />
      <RouteViewport start={start} end={end} routeCoordinates={routeCoordinates} />
      <FocusOnUnsafeMarker focusedMarker={focusedMarker} />

      {start && (
        <Marker position={start} icon={startIcon}>
          <Tooltip direction="top" offset={[0, -30]} opacity={0.95}>
            Start
          </Tooltip>
        </Marker>
      )}
      {end && (
        <Marker position={end} icon={endIcon}>
          <Tooltip direction="top" offset={[0, -30]} opacity={0.95}>
            Destination
          </Tooltip>
        </Marker>
      )}
      {routeCoordinates.length > 1 && <Polyline positions={routeCoordinates} pathOptions={{ color: '#0e7490', weight: 5 }} />}
      {unsafeMarkers.map((marker) => (
        <Marker
          key={marker.id}
          position={marker.position}
          icon={unsafeIcon}
          ref={(ref) => {
            if (ref) {
              markerRefs.current[marker.id] = ref;
            }
          }}
        >
          <Tooltip direction="top" offset={[0, -30]} opacity={0.95}>
            {marker.shortMessage}
          </Tooltip>
          <Popup>
            <div className="text-sm">
              <p className="font-semibold mb-1">Constraint Warning</p>
              <p>{marker.message}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

export default MapView;
