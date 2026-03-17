'use client'

export default function LeaderboardChart({
 title,
 rows,
}: {
 title: string
 rows: {
  repName: string
  revenue_signed: number
 }[]
}) {
 const max = Math.max(...rows.map((row) => row.revenue_signed), 1)

 return (
  <section className="rounded-[1.85rem] border border-white/10 bg-black/20 p-6 shadow-[0_22px_70px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
   <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/85">
    Rank
   </div>
   <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>

   <div className="mt-6 space-y-3">
    {rows.length === 0 ? (
     <div className="rounded-[1.35rem] border border-dashed border-white/14 bg-black/10 p-4 text-sm text-white/55">
      No leaderboard data in this range.
     </div>
    ) : (
     rows.slice(0, 8).map((row, index) => (
      <div key={row.repName} className="space-y-1">
       <div className="flex items-center justify-between text-sm text-white/72">
        <div className="font-semibold text-white">
         {index + 1}. {row.repName}
        </div>
        <div>${row.revenue_signed.toLocaleString()}</div>
       </div>
       <div className="h-3 overflow-hidden rounded-full bg-white/8">
        <div
         className="h-full rounded-full bg-gradient-to-r from-[#d6b37a] via-[#e2bf85] to-[#f0d9ae]"
         style={{ width: `${Math.max((row.revenue_signed / max) * 100, 6)}%` }}
        />
       </div>
      </div>
     ))
    )}
   </div>
  </section>
 )
}
