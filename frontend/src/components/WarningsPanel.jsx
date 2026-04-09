function formatDistance(distanceMeters) {
  if (!Number.isFinite(distanceMeters)) {
    return '-';
  }

  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

function formatDuration(durationSeconds) {
  if (!Number.isFinite(durationSeconds)) {
    return '-';
  }

  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.round((durationSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function WarningsPanel({ warnings, routeMeta }) {
  return (
    <section className="bg-white border border-slate-300 rounded-2xl p-2.5 shadow-md">
      <h2 className="mb-2.5 text-lg">Safety Warnings</h2>
      <p className="text-slate-500 my-1 mb-2.5">{warnings.length ? 'Unsafe constraints found on the route.' : 'No restriction violations detected.'}</p>

      <div className="space-y-1">
        <p>Distance: <strong>{formatDistance(routeMeta?.distanceMeters)}</strong></p>
        <p>ETA: <strong>{formatDuration(routeMeta?.durationSeconds)}</strong></p>
        <p>Roads checked: <strong>{routeMeta?.roadsAnalyzed ?? '-'}</strong></p>
      </div>

      <ul className="mt-2.5 ml-4 space-y-1.5">
        {warnings.map((warning) => (
          <li key={`${warning.roadId}-${warning.type}`}>
            {warning.message}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default WarningsPanel;
