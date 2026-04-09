function TruckForm({ truck, onTruckChange, onSubmit, loading }) {
  function handleChange(event) {
    const { name, value } = event.target;
    onTruckChange((previous) => ({
      ...previous,
      [name]: Number(value),
    }));
  }

  return (
    <form className="flex flex-col gap-2.5" onSubmit={onSubmit}>
      <label className="flex flex-col gap-1 font-semibold">
        Height (m)
        <input
          name="height"
          type="number"
          min="0"
          step="0.1"
          value={truck.height}
          onChange={handleChange}
          required
          className="rounded-xl border border-slate-300 px-2.5 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1 font-semibold">
        Weight (tons)
        <input
          name="weight"
          type="number"
          min="0"
          step="0.1"
          value={truck.weight}
          onChange={handleChange}
          required
          className="rounded-xl border border-slate-300 px-2.5 py-2 text-sm"
        />
      </label>

      <button type="submit" disabled={loading} className="border-none rounded-xl px-3.5 py-2.5 font-semibold text-sm bg-teal-700 text-white cursor-pointer transition-all duration-150 hover:scale-[1.02] hover:shadow-lg disabled:opacity-65 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none">
        {loading ? 'Checking route...' : 'Calculate Safe Route'}
      </button>
    </form>
  );
}

export default TruckForm;
