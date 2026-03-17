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
     className="overflow-hidden rounded-3xl border border-white/70 bg-white/95 p-5 shadow-[0_10px_40px_rgba(15,23,42,0.08)]"
    >
     <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
      {card.label}
     </div>
     <div className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
      {card.value}
     </div>
     <div className="mt-2 text-sm text-gray-500">
      {card.sub}
     </div>
    </div>
   ))}
  </section>
 )
}
