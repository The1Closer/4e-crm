'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, FilePenLine } from 'lucide-react'
import { type JobListRow } from '@/components/jobs/job-types'

const COLUMN_PAGE_SIZE = 5

export default function JobsKanban({
  rows,
  onQuickEdit,
}: {
  rows: JobListRow[]
  onQuickEdit?: (job: JobListRow) => void
}) {
  const grouped = useMemo(() => {
    return rows.reduce<Record<string, JobListRow[]>>((accumulator, row) => {
      const key = row.stageName || 'No Stage'
      if (!accumulator[key]) accumulator[key] = []
      accumulator[key].push(row)
      return accumulator
    }, {})
  }, [rows])

  const stages = useMemo(() => Object.keys(grouped), [grouped])

  const [pageByStage, setPageByStage] = useState<Record<string, number>>({})

  const totalPagesByStage = useMemo(() => {
    const next: Record<string, number> = {}

    stages.forEach((stage) => {
      next[stage] = Math.max(1, Math.ceil((grouped[stage]?.length ?? 0) / COLUMN_PAGE_SIZE))
    })

    return next
  }, [grouped, stages])

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-4">
          {stages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/50">
              No jobs available.
            </div>
          ) : (
            stages.map((stage) => {
              const totalItems = grouped[stage].length
              const totalPages = totalPagesByStage[stage] ?? 1
              const page = Math.min(pageByStage[stage] ?? 1, totalPages)
              const start = (page - 1) * COLUMN_PAGE_SIZE
              const visibleRows = grouped[stage].slice(start, start + COLUMN_PAGE_SIZE)

              return (
                <div
                  key={stage}
                  className="w-[340px] shrink-0 rounded-[1.5rem] border border-white/10 bg-black/20"
                >
                  <div className="border-b border-white/10 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">{stage}</div>
                      <div className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-semibold text-white/60">
                        {totalItems}
                      </div>
                    </div>

                    {totalPages > 1 ? (
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="text-xs text-white/45">
                          Page {page} / {totalPages}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setPageByStage((current) => ({
                                ...current,
                                [stage]: Math.max(1, page - 1),
                              }))
                            }
                            disabled={page <= 1}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
                            aria-label={`Previous page for ${stage}`}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPageByStage((current) => ({
                                ...current,
                                [stage]: Math.min(totalPages, page + 1),
                              }))
                            }
                            disabled={page >= totalPages}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
                            aria-label={`Next page for ${stage}`}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-3 p-3">
                    {visibleRows.map((job) => (
                      <div
                        key={job.id}
                        className="rounded-[1.25rem] border border-white/10 bg-white/[0.05] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
                      >
                        <div className="text-sm font-semibold text-white">
                          {job.homeownerName}
                        </div>

                        <div className="mt-1 text-xs text-white/50">{job.address}</div>

                        <div className="mt-3 space-y-1 text-xs text-white/55">
                          <div>Insurance: {job.insuranceCarrier}</div>
                          <div>Claim: {job.claimNumber}</div>
                          <div>Install: {job.installDate || '—'}</div>
                          <div>
                            Reps: {job.repNames.length > 0 ? job.repNames.join(', ') : '—'}
                          </div>
                        </div>

                        <div className="mt-4 flex gap-2">
                          <Link
                            href={`/jobs/${job.id}`}
                            className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#d6b37a] px-3 py-2 text-xs font-semibold text-black transition hover:bg-[#e2bf85]"
                          >
                            Open
                          </Link>
                          <button
                            type="button"
                            onClick={() => onQuickEdit?.(job)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.1]"
                          >
                            <FilePenLine className="h-3.5 w-3.5 text-[#d6b37a]" />
                            Edit
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </section>
  )
}
