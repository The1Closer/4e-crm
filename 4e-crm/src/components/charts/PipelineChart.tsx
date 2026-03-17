'use client'

export default function PipelineChart({
 title,
 counts,
}: {
 title: string
 counts: Record<string, number>
}) {
 const entries = Object.entries(counts)
 const max = Math.max(...entries.map(([, value]) => value), 1)

 return (
  <section className="rounded-[1.85rem] border border-white/10 bg-black/20 p-6 shadow-[0_22px_70px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
   <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/85">
    Stages
   </div>
   <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>

   <div className="mt-6 space-y-3">
    {entries.length === 0 ? (
     <div className="rounded-[1.35rem] border border-dashed border-white/14 bg-black/10 p-4 text-sm text-white/55">
      No pipeline data available.
     </div>
    ) : (
     entries.map(([label, value]) => (
      <div key={label} className="space-y-1">
       <div className="flex items-center justify-between text-sm text-white/72">
        <div className="font-semibold text-white">{label}</div>
        <div>{value}</div>
       </div>
       <div className="h-3 overflow-hidden rounded-full bg-white/8">
        <div
         className="h-full rounded-full bg-gradient-to-r from-[#5f8fff] to-[#7fd7ff]"
         style={{ width: `${Math.max((value / max) * 100, 6)}%` }}
        />
       </div>
      </div>
     ))
    )}
   </div>
  </section>
 )
}
