'use client'

export default function FunnelChart({
  title,
  funnel,
}: {
  title: string
  funnel: {
    knocks: number
    talks: number
    inspections: number
    contingencies: number
    contracts: number
  }
}) {
  const rows = [
    { label: 'Knocks', value: funnel.knocks, width: 100 },
    { label: 'Talks', value: funnel.talks, width: 84 },
    { label: 'Inspections', value: funnel.inspections, width: 68 },
    { label: 'Contingencies', value: funnel.contingencies, width: 52 },
    { label: 'Contracts', value: funnel.contracts, width: 36 },
  ]

  return (
    <section className="rounded-[1.85rem] border border-white/10 bg-black/20 p-6 shadow-[0_22px_70px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/85">
        Funnel
      </div>
      <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>

      <div className="mt-6 flex flex-col items-center gap-3">
        {rows.map((row, index) => (
          <div
            key={row.label}
            className="flex h-12 items-center justify-between rounded-[1.35rem] border border-white/10 bg-[linear-gradient(90deg,rgba(214,179,122,0.22),rgba(255,255,255,0.06))] px-4 text-white shadow-[0_14px_36px_rgba(0,0,0,0.18)]"
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
