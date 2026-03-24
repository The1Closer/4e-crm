'use client'

import { safePercent } from '@/lib/stats-utils'

export default function PersonalMetricsPanel({
  funnel,
  totals,
}: {
  funnel: {
    knocks: number
    talks: number
    inspections: number
    contingencies: number
    contracts: number
  }
  totals: {
    revenue_signed: number
  }
}) {
  const rows = [
    {
      label: 'Talk Rate',
      value: `${safePercent(funnel.talks, funnel.knocks)}%`,
    },
    {
      label: 'Inspection Rate',
      value: `${safePercent(funnel.inspections, funnel.talks)}%`,
    },
    {
      label: 'Contingency Rate',
      value: `${safePercent(funnel.contingencies, funnel.inspections)}%`,
    },
    {
      label: 'Close Rate',
      value: `${safePercent(funnel.contracts, funnel.contingencies)}%`,
    },
    {
      label: 'Revenue Signed',
      value: `$${totals.revenue_signed.toLocaleString()}`,
    },
  ]

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]">
          Personal Metrics
        </div>
        <div className="mt-2 text-xl font-bold tracking-tight text-white">
          Conversion snapshot
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
              {row.label}
            </div>
            <div className="mt-2 text-xl font-bold text-white">{row.value}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
