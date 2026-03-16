'use client'

import { useEffect, useState } from 'react'
import { buildSmartInsights, loadDashboardDataset } from '@/lib/dashboard-data'
import KPIBar from '@/components/dashboard/KPIBar'
import SmartInsights from '@/components/dashboard/SmartInsights'
import PipelineKanban from '@/components/dashboard/PipelineKanban'
import RevenueChart from '@/components/charts/RevenueChart'
import FunnelChart from '@/components/charts/FunnelChart'
import LeaderboardChart from '@/components/charts/LeaderboardChart'
import PipelineChart from '@/components/charts/PipelineChart'

export default function TeamDashboard({
 profile,
 filters,
 activeChart,
 visibleModules,
}: {
 profile: any
 filters: { startDate: string; endDate: string }
 activeChart: 'revenue' | 'funnel' | 'leaderboard' | 'pipeline'
 visibleModules: { kpi: boolean; insights: boolean; kanban: boolean }
}) {
 const [selectedRepId, setSelectedRepId] = useState('')
 const [dataset, setDataset] = useState<any>(null)

 useEffect(() => {
  async function load() {
   const data = await loadDashboardDataset({
    scope: 'team',
    profile,
    filters: {
     ...filters,
     selectedRepId: selectedRepId || undefined,
    },
   })
   setDataset(data)
  }

  load()
 }, [profile, filters.startDate, filters.endDate, selectedRepId])

 if (!dataset) {
  return <div className="rounded-3xl border border-white/70 bg-white/95 p-6 shadow-[0_10px_40px_rgba(15,23,42,0.08)] text-sm text-gray-600">Loading team view…</div>
 }

 const insights = buildSmartInsights(dataset)

 return (
  <div className="space-y-6">
   <section className="rounded-3xl border border-white/70 bg-white/95 p-5 shadow-[0_10px_40px_rgba(15,23,42,0.08)]">
    <div className="flex flex-wrap items-end justify-between gap-4">
     <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Team</div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-gray-900">Performance</div>
     </div>

     <select
      value={selectedRepId}
      onChange={(e) => setSelectedRepId(e.target.value)}
      className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900"
     >
      <option value="">All Team Reps</option>
      {dataset.repOptions.map((rep: any) => (
       <option key={rep.id} value={rep.id}>
        {rep.full_name}
       </option>
      ))}
     </select>
    </div>
   </section>

   {visibleModules.kpi ? (
    <KPIBar totals={dataset.totals} projection={dataset.projection} scopeLabel="Team" />
   ) : null}

   {visibleModules.insights ? <SmartInsights insights={insights} /> : null}

   {visibleModules.kanban ? (
    <PipelineKanban
     title={selectedRepId ? 'Team Pipeline · Selected Rep' : 'Team Pipeline'}
     repIds={selectedRepId ? [selectedRepId] : dataset.accessibleRepIds}
    />
   ) : null}

   {activeChart === 'revenue' ? (
    <RevenueChart title="Revenue Trend" series={dataset.revenueSeries} />
   ) : null}

   {activeChart === 'funnel' ? (
    <FunnelChart title="Conversion Funnel" funnel={dataset.funnel} />
   ) : null}

   {activeChart === 'leaderboard' ? (
    <LeaderboardChart title="Leaderboard" rows={dataset.repSummaries} />
   ) : null}

   {activeChart === 'pipeline' ? (
    <PipelineChart title="Pipeline Stages" counts={dataset.pipelineCounts} />
   ) : null}
  </div>
 )
}