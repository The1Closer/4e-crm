'use client'

export default function SmartInsights({
 insights,
}: {
 insights: string[]
}) {
 return (
  <section className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-5 shadow-[0_10px_40px_rgba(37,99,235,0.08)]">
   <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-500">
    Smart Insights
   </div>

   <div className="mt-4 grid gap-3 md:grid-cols-2">
    {insights.map((item, index) => (
     <div
      key={`${item}-${index}`}
      className="rounded-2xl border border-white/70 bg-white/80 p-4 text-sm text-slate-700 shadow-sm"
     >
      {item}
     </div>
    ))}
   </div>
  </section>
 )
}