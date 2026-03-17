'use client'

type DashboardPreset = 'mtd' | 'last7' | 'today' | 'custom'

export default function DashboardControls({
  filters,
  preset,
  onPresetChange,
  onFiltersChange,
  activeChart,
  onActiveChartChange,
}: {
  filters: { startDate: string; endDate: string }
  preset: DashboardPreset
  onPresetChange: (next: DashboardPreset) => void
  onFiltersChange: (next: { startDate: string; endDate: string }) => void
  activeChart: 'revenue' | 'funnel' | 'leaderboard' | 'pipeline'
  onActiveChartChange: (
    next: 'revenue' | 'funnel' | 'leaderboard' | 'pipeline'
  ) => void
}) {
  const presetOptions: DashboardPreset[] = ['mtd', 'last7', 'today', 'custom']

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]">
              Controls
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-white">
              Dashboard Filters
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {presetOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onPresetChange(option)}
                className={`rounded-2xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                  preset === option
                    ? 'bg-[#d6b37a] text-black'
                    : 'border border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                {option === 'mtd'
                  ? 'Month to Date'
                  : option === 'last7'
                    ? 'Last 7 Days'
                    : option === 'today'
                      ? 'Today'
                      : 'Custom'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              Start
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  startDate: e.target.value,
                })
              }
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              End
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  endDate: e.target.value,
                })
              }
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              Active Chart
            </label>
            <select
              value={activeChart}
              onChange={(e) =>
                onActiveChartChange(
                  e.target.value as
                    | 'revenue'
                    | 'funnel'
                    | 'leaderboard'
                    | 'pipeline'
                )
              }
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
            >
              <option value="revenue">Revenue</option>
              <option value="funnel">Funnel</option>
              <option value="leaderboard">Leaderboard</option>
              <option value="pipeline">Pipeline</option>
            </select>
          </div>
        </div>
      </div>
    </section>
  )
}