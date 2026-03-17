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
  <section className="rounded-[1.85rem] border border-white/10 bg-black/20 p-6 shadow-[0_22px_70px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
   <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/85">
    Revenue
   </div>
   <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>

   <div className="mt-6">
    <div className="flex h-64 items-end gap-3">
     {series.length === 0 ? (
      <div className="flex h-full w-full items-center justify-center rounded-[1.35rem] border border-dashed border-white/14 bg-black/10 text-sm text-white/55">
       No revenue data in this range.
      </div>
     ) : (
      series.map((item) => (
       <div key={item.label} className="flex flex-1 flex-col items-center justify-end gap-2">
        <div
         className="w-full rounded-t-[1.35rem] bg-gradient-to-t from-[#d6b37a] via-[#c79c5b] to-[#f1dcb5] shadow-[0_12px_28px_rgba(214,179,122,0.2)] transition-all"
         style={{
          height: `${Math.max((item.value / max) * 220, 8)}px`,
         }}
        />
        <div className="text-[11px] font-medium text-white/55">{item.label}</div>
       </div>
      ))
     )}
    </div>
   </div>
  </section>
 )
}
