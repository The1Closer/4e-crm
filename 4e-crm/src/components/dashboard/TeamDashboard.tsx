'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  buildSmartInsights,
  loadDashboardDataset,
  type DashboardDataset,
} from '@/lib/dashboard-data'
import {
  loadActivityFeed,
  type DashboardActivityItem,
} from '@/lib/dashboard-feed'
import KPIBar from '@/components/dashboard/KPIBar'
import SmartInsights from '@/components/dashboard/SmartInsights'
import PipelineKanban from '@/components/dashboard/PipelineKanban'
import ChartModule from '@/components/dashboard/ChartModule'
import RecentJobsPanel from '@/components/dashboard/RecentJobsPanel'
import AlertFeed from '@/components/dashboard/AlertFeed'
import ActivityFeedPanel from '@/components/dashboard/ActivityFeedPanel'
import LeaderboardChart from '@/components/charts/LeaderboardChart'
import type { UserProfile } from '@/lib/auth-helpers'

export default function TeamDashboard({
  profile,
  filters,
  activeChart,
  onActiveChartChange,
  periodLabel,
  showProjection,
}: {
  profile: UserProfile
  filters: { startDate: string; endDate: string }
  activeChart: 'revenue' | 'funnel' | 'leaderboard' | 'pipeline'
  onActiveChartChange: (
    next: 'revenue' | 'funnel' | 'leaderboard' | 'pipeline'
  ) => void
  periodLabel: string
  showProjection: boolean
}) {
  const [selectedRepId, setSelectedRepId] = useState('')
  const [dataset, setDataset] = useState<DashboardDataset | null>(null)
  const [activityFeed, setActivityFeed] = useState<DashboardActivityItem[]>([])
  const { startDate, endDate } = filters
  const effectiveFilters = useMemo(
    () => ({
      startDate,
      endDate,
      selectedRepId: selectedRepId || undefined,
    }),
    [endDate, selectedRepId, startDate]
  )

  useEffect(() => {
    async function load() {
      const data = await loadDashboardDataset({
        scope: 'team',
        profile,
        filters: effectiveFilters,
      })

      setDataset(data)

      const effectiveRepIds = selectedRepId ? [selectedRepId] : data.accessibleRepIds

      const activity = await loadActivityFeed({
        repIds: effectiveRepIds,
        limit: 6,
      })

      setActivityFeed(activity)
    }

    void load()
  }, [effectiveFilters, profile, selectedRepId])

  if (!dataset) {
    return (
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-sm text-white/60 shadow-[0_25px_80px_rgba(0,0,0,0.25)] backdrop-blur-2xl">
        Loading team view…
      </div>
    )
  }

  const insights = buildSmartInsights(dataset)

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.25)] backdrop-blur-2xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]">
              Team
            </div>
            <div className="mt-1 text-2xl font-bold tracking-tight text-white">
              Performance
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedRepId}
              onChange={(e) => setSelectedRepId(e.target.value)}
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="">All Team Reps</option>
              {dataset.repOptions.map((rep) => (
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
                  ...dataset.repSummaries.map((row) => [row.repName, row.revenue_signed]),
                ]
                const csv = rows.map((row) => row.join(',')).join('\n')
                const blob = new Blob([csv], {
                  type: 'text/csv;charset=utf-8;',
                })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'team-dashboard.csv'
                a.click()
                URL.revokeObjectURL(url)
              }}
              className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08]"
            >
              Export CSV
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-2xl bg-[#d6b37a] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#e2bf85]"
            >
              Export PDF
            </button>
          </div>
        </div>
      </section>

      <KPIBar
        totals={dataset.totals}
        projection={dataset.projection}
        periodLabel={periodLabel}
        showProjection={showProjection}
      />

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <PipelineKanban
            title={selectedRepId ? 'Team Pipeline · Selected Rep' : 'Team Pipeline'}
            repIds={selectedRepId ? [selectedRepId] : dataset.accessibleRepIds}
          />
        </div>

        <div className="xl:col-span-5">
          <ChartModule
            activeChart={activeChart}
            onActiveChartChange={onActiveChartChange}
            dataset={dataset}
          />
        </div>

        <div className="xl:col-span-4">
          <RecentJobsPanel rows={dataset.recentJobs} />
        </div>

        <div className="xl:col-span-3">
          <AlertFeed rows={dataset.alertFeed} />
        </div>

        <div className="xl:col-span-5">
          <LeaderboardChart title="Team Leaderboard" rows={dataset.repSummaries} />
        </div>

        <div className="xl:col-span-12">
          <ActivityFeedPanel rows={activityFeed} title="Team Activity" />
        </div>
      </div>

      <SmartInsights insights={insights} />
    </div>
  )
}
