import { useEffect, useMemo, useRef, useState } from 'react';
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
import MapLegend from './MapLegend';

const DEFAULT_CENTER = [51.505, -0.09];
const DEFAULT_ZOOM = 11;
const UNSAFE_SEGMENT_THRESHOLD_METERS = 90;

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(event) {
      onMapClick(event.latlng);
    },
  });

  return null;
}

function RouteViewport({ start, end, fastestRouteCoordinates, safeRouteCoordinates, showFastestRoute, showSafeRoute }) {
  const map = useMap();

  useEffect(() => {
    const activeRouteCoordinates = [
      ...(showFastestRoute ? fastestRouteCoordinates : []),
      ...(showSafeRoute ? safeRouteCoordinates : []),
    ];

    if (activeRouteCoordinates.length > 1) {
      map.fitBounds(activeRouteCoordinates, { padding: [30, 30] });
      return;
    }

    if (start && end) {
      map.fitBounds([start, end], { padding: [40, 40] });
    }
  }, [
    map,
    start,
    end,
    fastestRouteCoordinates,
    safeRouteCoordinates,
    showFastestRoute,
    showSafeRoute,
  ]);

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

function getMarkerPopupIcon(type) {
  if (type === 'height') {
    return '🚫';
  }

  if (type === 'weight') {
    return '⚠️';
  }

  return '❗';
}

function toProjectedPoint([lat, lon], referenceLat) {
  const latRad = (referenceLat * Math.PI) / 180;
  const metersPerDegLat = 111320;
  const metersPerDegLon = 111320 * Math.cos(latRad);

  return {
    x: lon * metersPerDegLon,
    y: lat * metersPerDegLat,
  };
}

function pointToSegmentDistanceMeters(point, segmentStart, segmentEnd) {
  const referenceLat = (segmentStart[0] + segmentEnd[0]) / 2;
  const p = toProjectedPoint(point, referenceLat);
  const a = toProjectedPoint(segmentStart, referenceLat);
  const b = toProjectedPoint(segmentEnd, referenceLat);

  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const abLengthSquared = abX * abX + abY * abY;

  if (!abLengthSquared) {
    const dx = p.x - a.x;
    const dy = p.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abX + (p.y - a.y) * abY) / abLengthSquared));
  const closestX = a.x + t * abX;
  const closestY = a.y + t * abY;
  const dx = p.x - closestX;
  const dy = p.y - closestY;

  return Math.sqrt(dx * dx + dy * dy);
}

function MapView({ start, end, fastestRouteCoordinates, safeRouteCoordinates, unsafeMarkers, focusedMarkerId, onMapClick, onWarningPopupClose }) {
  const markerRefs = useRef({});
  const [showFastestRoute, setShowFastestRoute] = useState(true);
  const [showSafeRoute, setShowSafeRoute] = useState(true);

  const unsafePoints = useMemo(
    () => unsafeMarkers.map((marker) => marker.position),
    [unsafeMarkers],
  );

  const fastestRouteSegments = useMemo(() => {
    if (fastestRouteCoordinates.length < 2) {
      return [];
    }

    return fastestRouteCoordinates.slice(0, -1).map((startPoint, index) => {
      const endPoint = fastestRouteCoordinates[index + 1];
      const isUnsafe = unsafePoints.some(
        (unsafePoint) =>
          pointToSegmentDistanceMeters(unsafePoint, startPoint, endPoint) <=
          UNSAFE_SEGMENT_THRESHOLD_METERS,
      );

      return {
        id: `fastest-segment-${index}`,
        positions: [startPoint, endPoint],
        isUnsafe,
      };
    });
  }, [fastestRouteCoordinates, unsafePoints]);

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
      <RouteViewport
        start={start}
        end={end}
        fastestRouteCoordinates={fastestRouteCoordinates}
        safeRouteCoordinates={safeRouteCoordinates}
        showFastestRoute={showFastestRoute}
        showSafeRoute={showSafeRoute}
      />
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
      {showFastestRoute &&
        fastestRouteSegments.map((segment) => (
          <Polyline
            key={segment.id}
            positions={segment.positions}
            pathOptions={{
              color: segment.isUnsafe ? '#dc2626' : 'blue',
              weight: segment.isUnsafe ? 7 : 6,
              opacity: segment.isUnsafe ? 0.95 : 0.85,
            }}
          />
        ))}
      {showSafeRoute && safeRouteCoordinates.length > 1 && (
        <Polyline
          positions={safeRouteCoordinates}
          pathOptions={{ color: 'green', weight: 5, opacity: 0.75, dashArray: '10 8' }}
        />
      )}
      {unsafeMarkers.map((marker) => (
        <Marker
          key={marker.id}
          position={marker.position}
          icon={unsafeIcon}
          eventHandlers={{
            popupclose: () => onWarningPopupClose?.(marker.id),
          }}
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
              <p className="font-semibold mb-1">
                <span className="mr-1" aria-hidden="true">{getMarkerPopupIcon(marker.type)}</span>
                Constraint Warning
              </p>
              <p>{marker.message}</p>
            </div>
          </Popup>
        </Marker>
      ))}

      <MapLegend
        showFastestRoute={showFastestRoute}
        showSafeRoute={showSafeRoute}
        onToggleFastestRoute={setShowFastestRoute}
        onToggleSafeRoute={setShowSafeRoute}
        safeRouteAvailable={safeRouteCoordinates.length > 1}
      />
    </MapContainer>
  );
}

export default MapView;
