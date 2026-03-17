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
  <section className="rounded-3xl border border-white/70 bg-white/95 p-6 shadow-[0_10px_40px_rgba(15,23,42,0.08)]">
   <h3 className="text-lg font-semibold text-gray-900">{title}</h3>

   <div className="mt-6 space-y-3">
    {entries.length === 0 ? (
     <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
      No pipeline data available.
     </div>
    ) : (
     entries.map(([label, value]) => (
      <div key={label} className="space-y-1">
       <div className="flex items-center justify-between text-sm text-gray-700">
        <div className="font-semibold">{label}</div>
        <div>{value}</div>
       </div>
       <div className="h-3 overflow-hidden rounded-full bg-gray-100">
        <div
         className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-400"
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