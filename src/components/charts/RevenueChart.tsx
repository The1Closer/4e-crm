'use client'

export default function RevenueChart({
 title,
 series,
}: {
 title: string
 series: { label: string; value: number }[]
}) {
 const max = Math.max(...series.map((item) => item.value), 1)

 return (
  <section className="rounded-3xl border border-white/70 bg-white/95 p-6 shadow-[0_10px_40px_rgba(15,23,42,0.08)]">
   <h3 className="text-lg font-semibold text-gray-900">{title}</h3>

   <div className="mt-6">
    <div className="flex h-64 items-end gap-3">
     {series.length === 0 ? (
      <div className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">
       No revenue data in this range.
      </div>
     ) : (
      series.map((item) => (
       <div key={item.label} className="flex flex-1 flex-col items-center justify-end gap-2">
        <div
         className="w-full rounded-t-2xl bg-gradient-to-t from-gray-900 to-slate-500 transition-all"
         style={{
          height: `${Math.max((item.value / max) * 220, 8)}px`,
         }}
        />
        <div className="text-[11px] font-medium text-gray-500">{item.label}</div>
       </div>
      ))
     )}
    </div>
   </div>
  </section>
 )
}