import { useMemo } from 'react';

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

function WarningsPanel({ unsafeMarkers, routeMeta, focusedWarningId, onWarningClick }) {
  const groupedIssues = useMemo(() => {
    const groups = new Map();

    for (const marker of unsafeMarkers) {
      const key = `${marker.type}-${marker.shortMessage}`;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          type: marker.type,
          title: marker.shortMessage,
          markerIds: [],
        });
      }

      groups.get(key).markerIds.push(marker.id);
    }

    return Array.from(groups.values());
  }, [unsafeMarkers]);

  const markerById = useMemo(
    () => Object.fromEntries(unsafeMarkers.map((marker) => [marker.id, marker])),
    [unsafeMarkers],
  );

  return (
    <section className="bg-white border border-slate-300 rounded-2xl p-2.5 shadow-md">
      <h2 className="mb-2.5 text-lg">Safety Warnings</h2>
      <p className="text-slate-500 my-1 mb-2.5">
        {unsafeMarkers.length
          ? `${unsafeMarkers.length} issue${unsafeMarkers.length > 1 ? 's' : ''} found on the map.`
          : 'No restriction violations detected.'}
      </p>

      <div className="space-y-1">
        <p>Distance: <strong>{formatDistance(routeMeta?.distanceMeters)}</strong></p>
        <p>ETA: <strong>{formatDuration(routeMeta?.durationSeconds)}</strong></p>
        <p>Roads checked: <strong>{routeMeta?.roadsAnalyzed ?? '-'}</strong></p>
      </div>

      <div className="mt-2.5 space-y-2">
        {groupedIssues.map((group) => (
          <div key={group.key} className="rounded-xl border border-slate-200 px-2.5 py-2">
            <p className="text-sm font-semibold text-slate-900">
              {group.title}
              <span className="ml-2 text-slate-500 font-normal">({group.markerIds.length})</span>
            </p>
            <ul className="mt-1.5 ml-4 space-y-1">
              {group.markerIds.map((markerId, index) => {
                const marker = markerById[markerId];
                const isFocused = focusedWarningId === markerId;

                return (
                  <li key={markerId}>
                    <button
                      type="button"
                      onClick={() => onWarningClick?.(markerId)}
                      className={`text-left w-full bg-transparent border-none p-0 cursor-pointer text-sm ${
                        isFocused ? 'text-red-700 font-semibold' : 'text-gray-700'
                      }`}
                    >
                      #{index + 1} at {marker.position[0].toFixed(5)}, {marker.position[1].toFixed(5)}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export default WarningsPanel;
