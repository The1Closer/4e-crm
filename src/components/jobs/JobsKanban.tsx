'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { FilePenLine, GripVertical, Loader2, Lock, Trash2 } from 'lucide-react'
import { type JobListRow, type JobStageOption } from '@/components/jobs/job-types'

export default function JobsKanban({
  rows,
  stageOptions,
  onQuickEdit,
  canDelete,
  deletingJobId,
  onDelete,
  onMoveJob,
  movingJobId,
  getMoveDisabledReason,
}: {
  rows: JobListRow[]
  stageOptions: JobStageOption[]
  onQuickEdit?: (job: JobListRow) => void
  canDelete?: boolean
  deletingJobId?: string | null
  onDelete?: (job: JobListRow) => void | Promise<void>
  onMoveJob?: (job: JobListRow, stageId: number | null) => void | Promise<void>
  movingJobId?: string | null
  getMoveDisabledReason?: (job: JobListRow) => string | null
}) {
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null)
  const [dragOverColumnKey, setDragOverColumnKey] = useState<string | null>(null)

  const grouped = useMemo(() => {
    return rows.reduce<Record<string, JobListRow[]>>((accumulator, row) => {
      const key = row.stageId === null ? 'no-stage' : String(row.stageId)
      if (!accumulator[key]) accumulator[key] = []
      accumulator[key].push(row)
      return accumulator
    }, {})
  }, [rows])

  const columns = useMemo(() => {
    const knownStageKeys = new Set(stageOptions.map((stage) => String(stage.id)))
    const orderedColumns = stageOptions.map((stage) => ({
      key: String(stage.id),
      stageId: stage.id,
      stageName: stage.name,
      jobs: grouped[String(stage.id)] ?? [],
    }))

    const remainingColumns = Object.entries(grouped)
      .filter(([key]) => key !== 'no-stage' && !knownStageKeys.has(key))
      .map(([key, jobs]) => ({
        key,
        stageId: jobs[0]?.stageId ?? Number(key),
        stageName: jobs[0]?.stageName || 'Unknown Stage',
        jobs,
      }))

    return [
      ...orderedColumns,
      ...remainingColumns,
      {
        key: 'no-stage',
        stageId: null,
        stageName: 'No Stage',
        jobs: grouped['no-stage'] ?? [],
      },
    ]
  }, [grouped, stageOptions])

  function resetDragState() {
    setDraggedJobId(null)
    setDragOverColumnKey(null)
  }

  const boardBusy = Boolean(movingJobId || deletingJobId)

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-white/55">
          Drag jobs between status columns to update the pipeline.
        </div>

        {movingJobId ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-[#d6b37a]/20 bg-[#d6b37a]/10 px-3 py-1.5 text-xs font-semibold text-[#f2d9ac]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Moving job...
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-4">
          {columns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/50">
              No jobs available.
            </div>
          ) : (
            columns.map((column) => {
              const totalItems = column.jobs.length
              const visibleRows = column.jobs
              const columnHighlighted =
                draggedJobId !== null && dragOverColumnKey === column.key

              return (
                <div
                  key={column.key}
                  className="flex h-[46rem] w-[340px] shrink-0 flex-col rounded-[1.5rem] border border-white/10 bg-black/20"
                >
                  <div className="border-b border-white/10 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">
                        {column.stageName}
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-semibold text-white/60">
                        {totalItems}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`flex-1 overflow-y-auto p-3 transition ${
                      columnHighlighted ? 'bg-[#d6b37a]/6' : ''
                    }`}
                    onDragOver={(event) => {
                      if (!onMoveJob || boardBusy || draggedJobId === null) {
                        return
                      }

                      event.preventDefault()
                      setDragOverColumnKey(column.key)
                    }}
                    onDrop={(event) => {
                      event.preventDefault()

                      if (!onMoveJob || boardBusy || draggedJobId === null) {
                        resetDragState()
                        return
                      }

                      const draggedJob =
                        rows.find((row) => row.id === draggedJobId) ?? null

                      resetDragState()

                      if (!draggedJob) {
                        return
                      }

                      void onMoveJob(draggedJob, column.stageId)
                    }}
                  >
                    {visibleRows.length === 0 ? (
                      <div
                        className={`flex min-h-full items-center justify-center rounded-[1.25rem] border border-dashed p-4 text-center text-sm transition ${
                          columnHighlighted
                            ? 'border-[#d6b37a]/45 bg-[#d6b37a]/12 text-[#f2d9ac]'
                            : 'border-white/12 bg-black/15 text-white/40'
                        }`}
                      >
                        {draggedJobId ? 'Drop job here' : 'No jobs in this status yet.'}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {visibleRows.map((job) => {
                          const deleting = deletingJobId === job.id
                          const moving = movingJobId === job.id
                          const actionDisabled = Boolean(deletingJobId || movingJobId)
                          const moveDisabledReason = getMoveDisabledReason?.(job) ?? null
                          const draggable =
                            Boolean(onMoveJob) &&
                            !boardBusy &&
                            !moving &&
                            !deleting &&
                            !moveDisabledReason

                          return (
                            <div
                              key={job.id}
                              draggable={draggable}
                              title={
                                moveDisabledReason ??
                                (draggable ? 'Drag to move this job' : '')
                              }
                              onDragStart={(event) => {
                                if (!draggable) {
                                  return
                                }

                                event.dataTransfer.effectAllowed = 'move'
                                event.dataTransfer.setData('text/plain', job.id)
                                setDraggedJobId(job.id)
                                setDragOverColumnKey(column.key)
                              }}
                              onDragEnd={resetDragState}
                              className={`rounded-[1.25rem] border border-white/10 bg-white/[0.05] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.18)] transition ${
                                draggedJobId === job.id ? 'opacity-45' : 'opacity-100'
                              } ${
                                draggable ? 'cursor-grab active:cursor-grabbing' : ''
                              } ${moving ? 'border-[#d6b37a]/35 ring-1 ring-[#d6b37a]/30' : ''}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="text-sm font-semibold text-white">
                                  {job.homeownerName}
                                </div>

                                {moving ? (
                                  <div className="inline-flex items-center gap-1.5 rounded-full border border-[#d6b37a]/20 bg-[#d6b37a]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f2d9ac]">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Moving
                                  </div>
                                ) : draggable ? (
                                  <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
                                    <GripVertical className="h-3 w-3 text-[#d6b37a]" />
                                    Drag
                                  </div>
                                ) : moveDisabledReason ? (
                                  <div className="inline-flex items-center gap-1 rounded-full border border-amber-300/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f2d9ac]">
                                    <Lock className="h-3 w-3" />
                                    Locked
                                  </div>
                                ) : null}
                              </div>

                              <div className="mt-1 text-xs text-white/50">{job.address}</div>

                              <div className="mt-3 space-y-1 text-xs text-white/55">
                                <div>Insurance: {job.insuranceCarrier}</div>
                                <div>Claim: {job.claimNumber}</div>
                                <div>Install: {job.installDate || '—'}</div>
                                <div>
                                  Reps:{' '}
                                  {job.repNames.length > 0 ? job.repNames.join(', ') : '—'}
                                </div>
                              </div>

                              {moveDisabledReason ? (
                                <div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-500/10 px-3 py-2 text-[11px] leading-5 text-[#f2d9ac]">
                                  {moveDisabledReason}
                                </div>
                              ) : null}

                              <div className="mt-4 flex flex-wrap gap-2">
                                <Link
                                  href={`/jobs/${job.id}`}
                                  className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#d6b37a] px-3 py-2 text-xs font-semibold text-black transition hover:bg-[#e2bf85]"
                                >
                                  Open
                                </Link>
                                <button
                                  type="button"
                                  disabled={actionDisabled}
                                  onClick={() => onQuickEdit?.(job)}
                                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-60"
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
                                    disabled={actionDisabled}
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
                    )}
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
