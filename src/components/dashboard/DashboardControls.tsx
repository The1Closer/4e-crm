'use client'

type VisibleModules = {
 kpi: boolean
 insights: boolean
 kanban: boolean
}

export default function DashboardControls({
 filters,
 onFiltersChange,
 activeChart,
 onActiveChartChange,
 visibleModules,
 onVisibleModulesChange,
}: {
 filters: { startDate: string; endDate: string }
 onFiltersChange: (next: { startDate: string; endDate: string }) => void
 activeChart: 'revenue' | 'funnel' | 'leaderboard' | 'pipeline'
 onActiveChartChange: (next: 'revenue' | 'funnel' | 'leaderboard' | 'pipeline') => void
 visibleModules: VisibleModules
 onVisibleModulesChange: (next: VisibleModules) => void
}) {
 return (
  <section className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-[0_10px_40px_rgba(15,23,42,0.08)] backdrop-blur">
   <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
     <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
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
       className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400"
      />
     </div>

     <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
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
       className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400"
      />
     </div>

     <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
       Active Chart
      </label>
      <select
       value={activeChart}
       onChange={(e) =>
        onActiveChartChange(e.target.value as 'revenue' | 'funnel' | 'leaderboard' | 'pipeline')
       }
       className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400"
      >
       <option value="revenue">Revenue</option>
       <option value="funnel">Funnel</option>
       <option value="leaderboard">Leaderboard</option>
       <option value="pipeline">Pipeline</option>
      </select>
     </div>

     <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
       Layout
      </label>
      <div className="flex flex-wrap gap-2">
       {(['kpi', 'insights', 'kanban'] as const).map((key) => (
        <button
         key={key}
         type="button"
         onClick={() =>
          onVisibleModulesChange({
           ...visibleModules,
           [key]: !visibleModules[key],
          })
         }
         className={`rounded-2xl px-3 py-2 text-xs font-semibold transition ${visibleModules[key]
           ? 'bg-gray-900 text-white'
           : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
         {key.toUpperCase()}
        </button>
       ))}
      </div>
     </div>
    </div>

    <div className="text-right">
     <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
      Phase 1
     </div>
     <div className="mt-1 text-lg font-semibold text-gray-900">
      Dashboard Foundation
     </div>
    </div>
   </div>
  </section>
 )
}