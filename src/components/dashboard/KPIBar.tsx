'use client'

export default function KPIBar({
 totals,
 projection,
 scopeLabel,
 periodLabel,
 showProjection = true,
}: {
 totals: {
  contingencies: number
  contracts_with_deposit: number
  revenue_signed: number
  inspections: number
 }
 projection: {
  contingencies: number
  contracts: number
  revenue: number
 }
 scopeLabel?: string
 periodLabel?: string
 showProjection?: boolean
}) {
 const resolvedScopeLabel = scopeLabel ?? 'Current'
 const projectionLabel = showProjection ? 'Projected' : periodLabel ?? 'Current Period'

 const cards = [
  {
   label: `${resolvedScopeLabel} Revenue`,
   value: `$${totals.revenue_signed.toLocaleString()}`,
   sub: showProjection
    ? `${projectionLabel} $${projection.revenue.toLocaleString()}`
    : projectionLabel,
  },
  {
   label: `${resolvedScopeLabel} Contingencies`,
   value: totals.contingencies.toLocaleString(),
   sub: showProjection
    ? `${projectionLabel} ${projection.contingencies}`
    : projectionLabel,
  },
  {
   label: `${resolvedScopeLabel} Contracts`,
   value: totals.contracts_with_deposit.toLocaleString(),
   sub: showProjection
    ? `${projectionLabel} ${projection.contracts}`
    : projectionLabel,
  },
  {
   label: `${resolvedScopeLabel} Inspections`,
   value: totals.inspections.toLocaleString(),
   sub: periodLabel ?? 'Month to date',
  },
 ]

 return (
  <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
   {cards.map((card) => (
    <div
     key={card.label}
     className="relative overflow-hidden rounded-[1.9rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl"
    >
     <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.18),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.06),transparent_28%)]" />
     <div className="relative">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d6b37a]/88">
       {card.label}
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight text-white">
       {card.value}
      </div>
      <div className="mt-2 text-sm text-white/60">
       {card.sub}
      </div>
     </div>
    </div>
   ))}
  </section>
 )
}
