'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  buildSmartInsights,
  loadDashboardDataset,
  type DashboardDataset,
} from '@/lib/dashboard-data'
import { loadAnnouncements, type AnnouncementRow } from '@/lib/dashboard-feed'
import KPIBar from '@/components/dashboard/KPIBar'
import SmartInsights from '@/components/dashboard/SmartInsights'
import PipelineKanban from '@/components/dashboard/PipelineKanban'
import ChartModule from '@/components/dashboard/ChartModule'
import PersonalMetricsPanel from '@/components/dashboard/PersonalMetricsPanel'
import AnnouncementsPanel from '@/components/dashboard/AnnouncementsPanel'
import type { UserProfile } from '@/lib/auth-helpers'

export default function IndividualDashboard({
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
  const [dataset, setDataset] = useState<DashboardDataset | null>(null)
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([])
  const { startDate, endDate } = filters
  const effectiveFilters = useMemo(
    () => ({
      startDate,
      endDate,
    }),
    [endDate, startDate]
  )

  useEffect(() => {
    async function load() {
      const data = await loadDashboardDataset({
        scope: 'individual',
        profile,
        filters: effectiveFilters,
      })

      setDataset(data)

      const announcementRows = await loadAnnouncements({
        role: profile?.role,
        managerId: profile?.manager_id,
      })

      setAnnouncements(announcementRows)
    }

    void load()
  }, [effectiveFilters, profile])

  if (!dataset) {
    return (
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-sm text-white/60 shadow-[0_25px_80px_rgba(0,0,0,0.25)] backdrop-blur-2xl">
        Loading individual view…
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
              Individual
            </div>
            <div className="mt-1 text-2xl font-bold tracking-tight text-white">
              My Performance
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                const rows = [
                  ['Metric', 'Value'],
                  ['Knocks', dataset.totals.knocks],
                  ['Talks', dataset.totals.talks],
                  ['Walks', dataset.totals.walks],
                  ['Contingencies', dataset.totals.contingencies],
                  ['Contracts', dataset.totals.contracts_with_deposit],
                  ['Revenue', dataset.totals.revenue_signed],
                ]
                const csv = rows.map((row) => row.join(',')).join('\n')
                const blob = new Blob([csv], {
                  type: 'text/csv;charset=utf-8;',
                })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'individual-dashboard.csv'
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
          <PipelineKanban title="My Pipeline" repIds={dataset.accessibleRepIds} />
        </div>

        <div className="xl:col-span-5">
          <ChartModule
            activeChart={activeChart}
            onActiveChartChange={onActiveChartChange}
            dataset={dataset}
          />
        </div>

        <div className="xl:col-span-6">
          <PersonalMetricsPanel funnel={dataset.funnel} totals={dataset.totals} />
        </div>

        <div className="xl:col-span-6">
          <AnnouncementsPanel rows={announcements} />
        </div>
      </div>
      <SmartInsights insights={insights} />
    </div>
  )
}
