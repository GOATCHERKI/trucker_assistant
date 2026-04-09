function LegendRow({ colorClass, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block w-3 h-3 rounded-sm ${colorClass}`} aria-hidden="true" />
      <span className="text-xs text-slate-800">{label}</span>
    </div>
  );
}

function MapLegend({
  showFastestRoute,
  showSafeRoute,
  onToggleFastestRoute,
  onToggleSafeRoute,
  safeRouteAvailable,
}) {
  return (
    <div className="leaflet-bottom leaflet-right">
      <div className="leaflet-control m-2 rounded-lg border border-slate-300 bg-white/80 px-3 py-2 shadow-md backdrop-blur-sm">
        <p className="mb-1 text-xs font-semibold text-slate-900">Legend</p>
        <div className="space-y-1 mb-2">
          <LegendRow colorClass="bg-blue-600" label="Fastest route" />
          <LegendRow colorClass="bg-green-600" label="Safe route" />
          <LegendRow colorClass="bg-red-600" label="Unsafe segment" />
        </div>
        <div className="space-y-1.5 border-t border-slate-300 pt-2">
          <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={showFastestRoute}
              onChange={(event) => onToggleFastestRoute?.(event.target.checked)}
            />
            <span>Show Fastest Route</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={showSafeRoute}
              onChange={(event) => onToggleSafeRoute?.(event.target.checked)}
              disabled={!safeRouteAvailable}
            />
            <span>
              Show Safe Route
              {!safeRouteAvailable ? ' (not available)' : ''}
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

export default MapLegend;
