import { useMemo, useState } from 'react';

const INITIAL_VISIBLE_COUNT = 5;

function WarningsPanel({ warnings = [], selectedWarningId = null, onSelectWarning }) {
  const [showAll, setShowAll] = useState(false);

  const summary = useMemo(() => {
    return warnings.reduce(
      (acc, warning) => {
        if (warning.type === 'height') {
          acc.height += 1;
        } else if (warning.type === 'weight') {
          acc.weight += 1;
        }
        return acc;
      },
      { height: 0, weight: 0 },
    );
  }, [warnings]);

  const visibleWarnings = showAll
    ? warnings
    : warnings.slice(0, INITIAL_VISIBLE_COUNT);

  function handleSelect(warning) {
    onSelectWarning?.(warning);
  }

  return (
    <section className="bg-white border border-slate-300 rounded-2xl p-3 shadow-md">
      <h2 className="mb-2 text-lg font-semibold text-slate-900">Safety Warnings</h2>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-slate-500">Height Issues</p>
          <p className="text-xl font-semibold text-slate-900">{summary.height}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-slate-500">Weight Issues</p>
          <p className="text-xl font-semibold text-slate-900">{summary.weight}</p>
        </div>
      </div>

      {!warnings.length && (
        <p className="text-sm text-slate-500">No restriction violations detected.</p>
      )}

      <ul className="space-y-2">
        {visibleWarnings.map((warning) => {
          const isSelected = selectedWarningId === warning.id;
          const icon = warning.type === 'height' ? '🚫' : '⚠️';

          return (
            <li key={warning.id}>
              <button
                type="button"
                onClick={() => handleSelect(warning)}
                className={`w-full text-left rounded-xl border px-3 py-2.5 transition ${
                  isSelected
                    ? 'border-rose-300 bg-rose-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <p className="text-sm font-medium text-slate-900">
                  <span className="mr-2" aria-hidden="true">{icon}</span>
                  {warning.message}
                </p>
              </button>
            </li>
          );
        })}
      </ul>

      {warnings.length > INITIAL_VISIBLE_COUNT && (
        <button
          type="button"
          onClick={() => setShowAll((current) => !current)}
          className="mt-3 text-sm font-medium text-teal-700 hover:text-teal-800"
        >
          {showAll ? 'Show less' : `Show all (${warnings.length})`}
        </button>
      )}
    </section>
  );
}

export default WarningsPanel;
