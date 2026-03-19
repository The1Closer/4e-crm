'use client'

export default function SmartInsights({
 insights,
}: {
 insights: string[]
}) {
 return (
  <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
   <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_30%)]" />
   <div className="relative text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d6b37a]">
    Smart Insights
   </div>

   <div className="relative mt-4 grid gap-3 md:grid-cols-2">
    {insights.map((item, index) => (
     <div
      key={`${item}-${index}`}
      className="rounded-[1.35rem] border border-white/10 bg-black/20 p-4 text-sm text-white/78 shadow-[0_18px_50px_rgba(0,0,0,0.18)]"
     >
      {item}
     </div>
    ))}
   </div>
  </section>
 )
}
