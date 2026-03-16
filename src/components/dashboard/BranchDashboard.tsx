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

export default function BranchDashboard({
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
        scope: 'branch',
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
    return <div className="rounded-3xl border border-white/70 bg-white/95 p-6 shadow-[0_10px_40px_rgba(15,23,42,0.08)] text-sm text-gray-600">Loading branch view…</div>
  }

  const insights = buildSmartInsights(dataset)

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/70 bg-white/95 p-5 shadow-[0_10px_40px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Branch</div>
            <div className="mt-1 text-2xl font-bold tracking-tight text-gray-900">Performance</div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedRepId}
              onChange={(e) => setSelectedRepId(e.target.value)}
              className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900"
            >
              <option value="">All Reps</option>
              {dataset.repOptions.map((rep: any) => (
                <option key={rep.id} value={rep.id}>
                  {rep.full_name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                const rows = [
                  ['Rep', 'Revenue'],
                  ...dataset.repSummaries.map((row: any) => [row.repName, row.revenue_signed]),
                ]
                const csv = rows.map((row: any[]) => row.join(',')).join('\n')
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'branch-dashboard.csv'
                a.click()
                URL.revokeObjectURL(url)
              }}
              className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-100"
            >
              Export CSV
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Export PDF
            </button>
          </div>
        </div>
      </section>

      {visibleModules.kpi ? (
        <KPIBar totals={dataset.totals} projection={dataset.projection} scopeLabel="Branch" />
      ) : null}

      {visibleModules.insights ? <SmartInsights insights={insights} /> : null}

      {visibleModules.kanban ? (
        <PipelineKanban
          title={selectedRepId ? 'Branch Pipeline · Selected Rep' : 'Branch Pipeline'}
          repIds={selectedRepId ? [selectedRepId] : undefined}
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