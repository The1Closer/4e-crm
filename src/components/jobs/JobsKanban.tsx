'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { FilePenLine, Trash2 } from 'lucide-react'
import { type JobListRow, type JobStageOption } from '@/components/jobs/job-types'

export default function JobsKanban({
  rows,
  stageOptions,
  onQuickEdit,
  canDelete,
  deletingJobId,
  onDelete,
}: {
  rows: JobListRow[]
  stageOptions: JobStageOption[]
  onQuickEdit?: (job: JobListRow) => void
  canDelete?: boolean
  deletingJobId?: string | null
  onDelete?: (job: JobListRow) => void | Promise<void>
}) {
  const grouped = useMemo(() => {
    return rows.reduce<Record<string, JobListRow[]>>((accumulator, row) => {
      const key = row.stageName || 'No Stage'
      if (!accumulator[key]) accumulator[key] = []
      accumulator[key].push(row)
      return accumulator
    }, {})
  }, [rows])

  const stages = useMemo(() => {
    const groupedStageNames = new Set(Object.keys(grouped))
    const orderedStages = stageOptions
      .map((stage) => stage.name)
      .filter((stageName) => groupedStageNames.has(stageName))

    const remainingStages = Object.keys(grouped).filter(
      (stageName) => !orderedStages.includes(stageName) && stageName !== 'No Stage'
    )

    if (groupedStageNames.has('No Stage')) {
      remainingStages.push('No Stage')
    }

    return [...orderedStages, ...remainingStages]
  }, [grouped, stageOptions])

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
              const visibleRows = grouped[stage]

              return (
                <div
                  key={stage}
                  className="flex h-[46rem] w-[340px] shrink-0 flex-col rounded-[1.5rem] border border-white/10 bg-black/20"
                >
                  <div className="border-b border-white/10 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">{stage}</div>
                      <div className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-semibold text-white/60">
                        {totalItems}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3 overflow-y-auto p-3">
                    {visibleRows.map((job) => {
                      const deleting = deletingJobId === job.id
                      const deleteDisabled = Boolean(deletingJobId)

                      return (
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

                          <div className="mt-4 flex flex-wrap gap-2">
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
                            {canDelete ? (
                              <button
                                type="button"
                                onClick={() => {
                                  void onDelete?.(job)
                                }}
                                disabled={deleteDisabled}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                {deleting ? 'Deleting...' : 'Delete'}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
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
