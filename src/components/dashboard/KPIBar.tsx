'use client'

export default function KPIBar({
 totals,
 projection,
 scopeLabel,
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
 scopeLabel: string
}) {
 const cards = [
  {
   label: `${scopeLabel} Revenue`,
   value: `$${totals.revenue_signed.toLocaleString()}`,
   sub: `Projected $${projection.revenue.toLocaleString()}`,
  },
  {
   label: `${scopeLabel} Contingencies`,
   value: totals.contingencies.toLocaleString(),
   sub: `Projected ${projection.contingencies}`,
  },
  {
   label: `${scopeLabel} Contracts`,
   value: totals.contracts_with_deposit.toLocaleString(),
   sub: `Projected ${projection.contracts}`,
  },
  {
   label: `${scopeLabel} Inspections`,
   value: totals.inspections.toLocaleString(),
   sub: 'Month to date',
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