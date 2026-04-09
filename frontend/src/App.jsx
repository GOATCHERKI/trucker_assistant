import { useMemo, useState } from 'react';
import MapView from './components/MapView';
import TruckForm from './components/TruckForm';
import WarningsPanel from './components/WarningsPanel';
import { fetchSafeRoute } from './services/api';
import { transformWarnings } from './utils/warningTransformer';
import './App.css';

function App() {
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [selectionMode, setSelectionMode] = useState('start');

  const [truck, setTruck] = useState({
    height: 4,
    weight: 18,
  });

  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [unsafePoints, setUnsafePoints] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [focusedWarningId, setFocusedWarningId] = useState(null);
  const [routeMeta, setRouteMeta] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const unsafeMarkers = useMemo(
    () =>
      unsafePoints.map((position, index) => {
        const warning = warnings.length ? warnings[index % warnings.length] : null;
        const shortMessage = warning
          ? warning.type === 'height'
            ? `Low bridge: ${warning.maxValue}m`
            : `Weight limit: ${warning.maxValue}t`
          : 'Unsafe segment';

        return {
          id: `point-${index}`,
          position,
          type: warning?.type ?? 'unknown',
          shortMessage,
          message: warning?.message ?? 'Potential restriction near this route point.',
        };
      }),
    [unsafePoints, warnings],
  );

  const panelWarnings = useMemo(
    () =>
      unsafeMarkers.map((marker) => ({
        id: marker.id,
        type: marker.type,
        message: marker.message,
      })),
    [unsafeMarkers],
  );

  const selectionHint = useMemo(() => {
    if (selectionMode === 'start') {
      return 'Click on map to set the start point.';
    }

    return 'Click on map to set the destination point.';
  }, [selectionMode]);

  function handleMapClick(latlng) {
    if (selectionMode === 'start') {
      setStart([latlng.lat, latlng.lng]);
      setSelectionMode('end');
      return;
    }

    setEnd([latlng.lat, latlng.lng]);
    setSelectionMode('start');
  }

  function clearRoute() {
    setRouteCoordinates([]);
    setUnsafePoints([]);
    setWarnings([]);
    setFocusedWarningId(null);
    setRouteMeta(null);
    setError('');
  }

  function handleWarningSelect(warning) {
    setFocusedWarningId(warning?.id ?? null);
  }

  async function handleRouteRequest(event) {
    event.preventDefault();
    setError('');

    if (!start || !end) {
      setError('Please select both start and destination points on the map.');
      return;
    }

    setLoading(true);
    try {
      const result = await fetchSafeRoute({
        start: { lat: start[0], lon: start[1] },
        end: { lat: end[0], lon: end[1] },
        truck,
      });

      const mappedRoute = (result.route.geometry.coordinates || []).map(([lon, lat]) => [lat, lon]);
      setRouteCoordinates(mappedRoute);

      const uniqueUnsafePoints = [];
      const seen = new Set();

      for (const point of result.safety.unsafePoints || []) {
        const key = `${point[0].toFixed(5)}-${point[1].toFixed(5)}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueUnsafePoints.push(point);
        }
      }

      setUnsafePoints(uniqueUnsafePoints);
      setWarnings(transformWarnings(result.safety.warnings || []));
      setFocusedWarningId(null);
      setRouteMeta({
        distanceMeters: result.route.distanceMeters,
        durationSeconds: result.route.durationSeconds,
        roadsAnalyzed: result.metadata.roadsAnalyzed,
      });
    } catch (requestError) {
      setError(requestError.message || 'Failed to calculate route.');
      setRouteCoordinates([]);
      setUnsafePoints([]);
      setWarnings([]);
      setFocusedWarningId(null);
      setRouteMeta(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid" style={{ gridTemplateColumns: 'minmax(340px, 420px) 1fr' }}>
      <aside className="border-r border-slate-200 p-[1.4rem] flex flex-col gap-4 bg-white/86 backdrop-blur-sm overflow-y-auto">
        <header>
          <p className="font-mono text-xs tracking-widest uppercase text-teal-700 mb-1.5">Truck-Safe Navigation MVP</p>
          <h1 className="text-2xl lg:text-3xl leading-tight m-0">Route Around Restrictions</h1>
          <p className="text-slate-500 my-1 mb-2.5">Plan routes using OSRM, then validate against OSM maxheight and maxweight limits.</p>
        </header>

        <section className="bg-white border border-slate-300 rounded-2xl p-2.5 shadow-md">
          <h2 className="mb-2.5 text-lg m-0">Map Input</h2>
          <div className="grid grid-cols-2 gap-2 mb-2.5">
            <button type="button" className={`border-none rounded-xl px-3.5 py-2.5 font-semibold text-sm cursor-pointer transition-all duration-150 ${selectionMode === 'start' ? 'bg-orange-400 text-gray-900' : 'bg-slate-200 text-slate-900'}`} onClick={() => setSelectionMode('start')}>
              Set Start
            </button>
            <button type="button" className={`border-none rounded-xl px-3.5 py-2.5 font-semibold text-sm cursor-pointer transition-all duration-150 ${selectionMode === 'end' ? 'bg-orange-400 text-gray-900' : 'bg-slate-200 text-slate-900'}`} onClick={() => setSelectionMode('end')}>
              Set Destination
            </button>
          </div>
          <p className="text-slate-500 my-1 mb-2.5">{selectionHint}</p>
          <p>Start: {start ? `${start[0].toFixed(5)}, ${start[1].toFixed(5)}` : '-'}</p>
          <p>End: {end ? `${end[0].toFixed(5)}, ${end[1].toFixed(5)}` : '-'}</p>
          <button type="button" className="bg-transparent border border-slate-300 text-gray-700 rounded-xl px-3.5 py-2.5 font-semibold text-sm cursor-pointer" onClick={clearRoute}>
            Clear Route Output
          </button>
        </section>

        <section className="bg-white border border-slate-300 rounded-2xl p-2.5 shadow-md">
          <h2 className="mb-2.5 text-lg m-0">Truck Specs</h2>
          <TruckForm truck={truck} onTruckChange={setTruck} onSubmit={handleRouteRequest} loading={loading} />
        </section>

        {error && <p className="border border-red-300 bg-red-50 text-red-900 rounded-xl px-2.5 py-2 m-0">{error}</p>}

        <WarningsPanel
          warnings={panelWarnings}
          onSelectWarning={handleWarningSelect}
        />
      </aside>

      <main className="relative min-h-screen">
        <MapView
          start={start}
          end={end}
          routeCoordinates={routeCoordinates}
          unsafeMarkers={unsafeMarkers}
          focusedMarkerId={focusedWarningId}
          onMapClick={handleMapClick}
        />
      </main>
    </div>
  );
}

export default App;
