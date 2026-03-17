'use client'

import RevenueChart from '@/components/charts/RevenueChart'
import FunnelChart from '@/components/charts/FunnelChart'
import LeaderboardChart from '@/components/charts/LeaderboardChart'
import PipelineChart from '@/components/charts/PipelineChart'
import type { DashboardDataset } from '@/lib/dashboard-data'

export default function ChartModule({
  activeChart,
  onActiveChartChange,
  dataset,
}: {
  activeChart: 'revenue' | 'funnel' | 'leaderboard' | 'pipeline'
  onActiveChartChange: (next: 'revenue' | 'funnel' | 'leaderboard' | 'pipeline') => void
  dataset: DashboardDataset
}) {
  const chartOptions = [
    { key: 'revenue', label: 'Revenue Trend' },
    { key: 'funnel', label: 'Pipeline Funnel' },
    { key: 'leaderboard', label: 'Rep Comparison' },
    { key: 'pipeline', label: 'Stage Distribution' },
  ] as const

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]">
            Interactive Charts
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-white">
            Visual breakdown
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {chartOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onActiveChartChange(option.key)}
              className={`rounded-2xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                activeChart === option.key
                  ? 'bg-[#d6b37a] text-black'
                  : 'border border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

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
    </section>
  )
}
