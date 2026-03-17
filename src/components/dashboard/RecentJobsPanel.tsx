'use client'

type JobRow = {
  id: string
  homeowner_name?: string | null
  address?: string | null
  contract_amount?: number | null
  stage_name?: string | null
}

export default function RecentJobsPanel({
  rows = [],
}: {
  rows?: JobRow[]
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.25)] backdrop-blur-2xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]">
            Jobs
          </div>
          <div className="text-lg font-bold text-white">
            Recent Jobs
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/50">
            No recent jobs in this range.
          </div>
        ) : (
          rows.map((job) => (
            <div
              key={job.id}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
            >
              <div>
                <div className="text-sm font-semibold text-white">
                  {job.homeowner_name ?? 'Unknown Homeowner'}
                </div>
                <div className="text-xs text-white/50">
                  {job.address ?? 'No address'}
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-semibold text-white">
                  {job.contract_amount
                    ? `$${job.contract_amount.toLocaleString()}`
                    : '-'}
                </div>
                <div className="text-xs text-white/50">
                  {job.stage_name ?? 'No Stage'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}