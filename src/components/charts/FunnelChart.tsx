'use client'

export default function FunnelChart({
  title,
  funnel,
}: {
  title: string
  funnel: {
    knocks: number
    talks: number
    walks: number
    inspections: number
    contingencies: number
    contracts: number
  }
}) {
  const rows = [
    { label: 'Knocks', value: funnel.knocks, width: 100 },
    { label: 'Talks', value: funnel.talks, width: 84 },
    { label: 'Walks', value: funnel.walks, width: 70 },
    { label: 'Inspections', value: funnel.inspections, width: 56 },
    { label: 'Contingencies', value: funnel.contingencies, width: 42 },
    { label: 'Contracts', value: funnel.contracts, width: 30 },
  ]

  return (
    <section className="rounded-3xl border border-white/70 bg-white/95 p-6 shadow-[0_10px_40px_rgba(15,23,42,0.08)]">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>

      <div className="mt-6 flex flex-col items-center gap-3">
        {rows.map((row, index) => (
          <div
            key={row.label}
            className="flex h-12 items-center justify-between rounded-2xl bg-gradient-to-r from-slate-900 to-slate-600 px-4 text-white shadow-sm"
            style={{
              width: `${row.width}%`,
              minWidth: '220px',
              opacity: 1 - index * 0.06,
            }}
          >
            <span className="text-sm font-semibold">{row.label}</span>
            <span className="text-sm">{row.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </section>
  )
}