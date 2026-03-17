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
  <section className="rounded-3xl border border-white/70 bg-white/95 p-6 shadow-[0_10px_40px_rgba(15,23,42,0.08)]">
   <h3 className="text-lg font-semibold text-gray-900">{title}</h3>

   <div className="mt-6 space-y-3">
    {rows.length === 0 ? (
     <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
      No leaderboard data in this range.
     </div>
    ) : (
     rows.slice(0, 8).map((row, index) => (
      <div key={row.repName} className="space-y-1">
       <div className="flex items-center justify-between text-sm text-gray-700">
        <div className="font-semibold">
         {index + 1}. {row.repName}
        </div>
        <div>${row.revenue_signed.toLocaleString()}</div>
       </div>
       <div className="h-3 overflow-hidden rounded-full bg-gray-100">
        <div
         className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300"
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