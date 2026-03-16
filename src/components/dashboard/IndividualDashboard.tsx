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

export default function IndividualDashboard({
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
 const [dataset, setDataset] = useState<any>(null)

 useEffect(() => {
  async function load() {
   const data = await loadDashboardDataset({
    scope: 'individual',
    profile,
    filters,
   })
   setDataset(data)
  }

  load()
 }, [profile, filters.startDate, filters.endDate])

 if (!dataset) {
  return <div className="rounded-3xl border border-white/70 bg-white/95 p-6 shadow-[0_10px_40px_rgba(15,23,42,0.08)] text-sm text-gray-600">Loading individual view…</div>
 }

 const insights = buildSmartInsights(dataset)

 return (
  <div className="space-y-6">
   <section className="rounded-3xl border border-white/70 bg-white/95 p-5 shadow-[0_10px_40px_rgba(15,23,42,0.08)]">
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Individual</div>
    <div className="mt-1 text-2xl font-bold tracking-tight text-gray-900">Performance</div>
   </section>

   {visibleModules.kpi ? (
    <KPIBar totals={dataset.totals} projection={dataset.projection} scopeLabel="My" />
   ) : null}

   {visibleModules.insights ? <SmartInsights insights={insights} /> : null}

   {visibleModules.kanban ? (
    <PipelineKanban title="My Pipeline" repIds={dataset.accessibleRepIds} />
   ) : null}

   {activeChart === 'revenue' ? (
    <RevenueChart title="Revenue Trend" series={dataset.revenueSeries} />
   ) : null}

   {activeChart === 'funnel' ? (
    <FunnelChart title="Conversion Funnel" funnel={dataset.funnel} />
   ) : null}

   {activeChart === 'leaderboard' ? (
    <LeaderboardChart title="My Ranked Deals" rows={dataset.repSummaries} />
   ) : null}

   {activeChart === 'pipeline' ? (
    <PipelineChart title="Pipeline Stages" counts={dataset.pipelineCounts} />
   ) : null}
  </div>
 )
}