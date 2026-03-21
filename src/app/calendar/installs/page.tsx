'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { supabase } from '../../../lib/supabase'
import { createNotifications } from '../../../lib/notification-utils'
import { getCurrentUserProfile, isManagerLike } from '../../../lib/auth-helpers'
import {
  findInstallScheduledStage,
  findPreProductionPrepStage,
  getStageColor,
  isInstallScheduledStage,
  isPreProductionPrepStage,
  normalizeStage,
} from '@/lib/job-stage-access'

type JobRow = {
  id: string
  install_date: string | null
  homeowners:
    | {
        name: string | null
        address: string | null
      }
    | {
        name: string | null
        address: string | null
      }[]
    | null
  pipeline_stages:
    | {
        id?: number | null
        name: string | null
        sort_order?: number | null
      }
    | {
        id?: number | null
        name: string | null
        sort_order?: number | null
      }[]
    | null
  job_reps:
    | {
        profile_id: string
        profiles:
          | {
              full_name: string | null
            }
          | {
              full_name: string | null
            }[]
          | null
      }[]
    | null
}

type StageRow = {
  id: number
  name: string
  sort_order: number | null
}

type AssignedJobRef = {
  job_id: string
}

type CalendarDay = {
  date: Date
  key: string
  isCurrentMonth: boolean
}

function getHomeowner(
  homeowner: JobRow['homeowners']
): {
  name: string | null
  address: string | null
} | null {
  if (!homeowner) return null
  return Array.isArray(homeowner) ? homeowner[0] ?? null : homeowner
}

function getStageName(stage: JobRow['pipeline_stages']) {
  if (!stage) return 'No Stage'
  const item = Array.isArray(stage) ? stage[0] ?? null : stage
  return item?.name ?? 'No Stage'
}

function getRepNames(jobReps: JobRow['job_reps']): string[] {
  if (!jobReps || jobReps.length === 0) return []

  return jobReps
    .map((rep) => {
      const profile = Array.isArray(rep.profiles)
        ? rep.profiles[0] ?? null
        : rep.profiles

      return profile?.full_name ?? null
    })
    .filter((name): name is string => Boolean(name))
}

function getRepIds(jobReps: JobRow['job_reps']): string[] {
  if (!jobReps || jobReps.length === 0) return []

  return [...new Set(jobReps.map((rep) => rep.profile_id).filter(Boolean))]
}

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function buildCalendarDays(viewDate: Date): CalendarDay[] {
  const first = startOfMonth(viewDate)
  const last = endOfMonth(viewDate)

  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())

  const end = new Date(last)
  end.setDate(last.getDate() + (6 - last.getDay()))

  const days: CalendarDay[] = []
  const cursor = new Date(start)

  while (cursor <= end) {
    days.push({
      date: new Date(cursor),
      key: formatDateKey(cursor),
      isCurrentMonth: cursor.getMonth() === viewDate.getMonth(),
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return days
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

function isToday(date: Date) {
  return formatDateKey(date) === formatDateKey(new Date())
}

function getStagePillStyle(stageName: string) {
  const color = getStageColor(stageName)

  return {
    color,
    borderColor: `${color}55`,
    backgroundColor: `${color}14`,
  }
}

function compareJobsByHomeowner(left: JobRow, right: JobRow) {
  const leftName = getHomeowner(left.homeowners)?.name ?? ''
  const rightName = getHomeowner(right.homeowners)?.name ?? ''

  return leftName.localeCompare(rightName)
}

function InstallCalendarContent() {
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [stages, setStages] = useState<StageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingJobId, setSavingJobId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [viewDate, setViewDate] = useState(startOfMonth(new Date()))
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null)
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null)
  const [dragOverReadyQueue, setDragOverReadyQueue] = useState(false)
  const installScheduledStage = useMemo(() => findInstallScheduledStage(stages), [stages])
  const preProductionPrepStage = useMemo(() => findPreProductionPrepStage(stages), [stages])

  useEffect(() => {
    let isActive = true

    async function loadJobs() {
      setLoading(true)
      setMessage('')

      const currentProfile = await getCurrentUserProfile()

      if (!isActive) return

      const { data: stageData, error: stageError } = await supabase
        .from('pipeline_stages')
        .select('id, name, sort_order')
        .order('sort_order', { ascending: true })

      if (!isActive) return

      const stageRows = (stageData ?? []) as StageRow[]
      setStages(stageRows)

      if (stageError) {
        setJobs([])
        setMessage(stageError.message)
        setLoading(false)
        return
      }

      if (!currentProfile) {
        setJobs([])
        setLoading(false)
        return
      }

      let visibleJobIds: string[] | null = null

      if (!isManagerLike(currentProfile.role)) {
        const { data: assignedRows, error: assignedError } = await supabase
          .from('job_reps')
          .select('job_id')
          .eq('profile_id', currentProfile.id)

        if (!isActive) return

        if (assignedError) {
          setJobs([])
          setMessage(assignedError.message)
          setLoading(false)
          return
        }

        visibleJobIds = [
          ...new Set(
            ((assignedRows ?? []) as AssignedJobRef[]).map((row) => row.job_id)
          ),
        ]

        if (visibleJobIds.length === 0) {
          setJobs([])
          setLoading(false)
          return
        }
      }

      let query = supabase.from('jobs').select(`
        id,
        install_date,
        homeowners (
          name,
          address
        ),
        pipeline_stages (
          id,
          name,
          sort_order
        ),
        job_reps (
          profile_id,
          profiles (
            full_name
          )
        )
      `)

      if (visibleJobIds) {
        query = query.in('id', visibleJobIds)
      }

      const { data, error } = await query

      if (!isActive) return

      if (error) {
        setJobs([])
        setMessage(error.message)
        setLoading(false)
        return
      }

      const nextJobs = (data ?? []) as JobRow[]
      setJobs(nextJobs)
      setLoading(false)
    }

    void loadJobs()

    return () => {
      isActive = false
    }
  }, [])

  async function updateInstallDate(
    jobId: string,
    nextDate: string | null,
    options?: {
      returnToReadyQueue?: boolean
    }
  ) {
    const targetJob = jobs.find((job) => job.id === jobId) ?? null

    if (!targetJob) {
      return
    }

    const currentStage = normalizeStage(targetJob.pipeline_stages)
    let nextStage = currentStage

    if (nextDate) {
      if (installScheduledStage) {
        nextStage = installScheduledStage
      } else if (!currentStage || !isInstallScheduledStage(currentStage)) {
        setMessage('Install Scheduled is missing from your pipeline stages.')
        return
      }
    } else if (
      options?.returnToReadyQueue ||
      (currentStage && isInstallScheduledStage(currentStage))
    ) {
      if (preProductionPrepStage) {
        nextStage = preProductionPrepStage
      } else if (options?.returnToReadyQueue) {
        setMessage('Pre-Production Prep is missing from your pipeline stages.')
        return
      }
    }

    setSavingJobId(jobId)
    setMessage('')

    const updates: {
      install_date: string | null
      stage_id?: number | null
    } = {
      install_date: nextDate,
    }

    if (nextStage?.id !== undefined) {
      updates.stage_id = nextStage.id
    }

    const { error } = await supabase
      .from('jobs')
      .update(updates)
      .eq('id', jobId)

    if (error) {
      setMessage(error.message)
      setSavingJobId(null)
      return
    }

    const assignedRepIds = getRepIds(targetJob.job_reps)

    if (assignedRepIds.length > 0 && nextStage?.name) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      try {
        await createNotifications({
          userIds: assignedRepIds,
          actorUserId: user?.id ?? null,
          type: 'stage_change',
          title: 'Job stage changed',
          message: `A job was moved to ${nextStage.name}.`,
          link: `/jobs/${jobId}`,
          jobId,
          metadata: {
            stage_id: nextStage.id ?? null,
            stage_name: nextStage.name,
          },
        })
      } catch (notificationError) {
        console.error('Could not send calendar stage-change notifications.', notificationError)
      }
    }

    setJobs((prev) =>
      prev.map((job) =>
        job.id === jobId
          ? {
              ...job,
              install_date: nextDate,
              pipeline_stages: nextStage
                ? {
                    id: nextStage.id ?? null,
                    name: nextStage.name ?? null,
                    sort_order: nextStage.sort_order ?? null,
                  }
                : job.pipeline_stages,
            }
          : job
      )
    )

    setSavingJobId(null)
    setDraggedJobId(null)
    setDragOverDateKey(null)
    setDragOverReadyQueue(false)
  }

  function handleDragStart(jobId: string) {
    setDraggedJobId(jobId)
  }

  function handleDragEnd() {
    setDraggedJobId(null)
    setDragOverDateKey(null)
    setDragOverReadyQueue(false)
  }

  async function handleDropOnDate(dateKey: string) {
    if (!draggedJobId) return
    await updateInstallDate(draggedJobId, dateKey)
  }

  async function handleDropOnReadyQueue() {
    if (!draggedJobId) return
    await updateInstallDate(draggedJobId, null, { returnToReadyQueue: true })
  }

  const calendarDays = useMemo(() => buildCalendarDays(viewDate), [viewDate])

  const jobsByDate = useMemo(() => {
    const grouped: Record<string, JobRow[]> = {}

    jobs.forEach((job) => {
      if (!job.install_date || !isInstallScheduledStage(job.pipeline_stages)) return
      if (!grouped[job.install_date]) grouped[job.install_date] = []
      grouped[job.install_date].push(job)
    })

    Object.values(grouped).forEach((entries) => {
      entries.sort(compareJobsByHomeowner)
    })

    return grouped
  }, [jobs])

  const readyToSchedule = useMemo(() => {
    return [...jobs]
      .filter((job) => !job.install_date && isPreProductionPrepStage(job.pipeline_stages))
      .sort(compareJobsByHomeowner)
  }, [jobs])

  const scheduledCount = useMemo(
    () =>
      jobs.filter(
        (job) => Boolean(job.install_date) && isInstallScheduledStage(job.pipeline_stages)
      ).length,
    [jobs]
  )

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.22),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_26%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,179,122,0.7),transparent)]" />

        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b37a]">
              Scheduling
            </div>

            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
              Install Command Board
            </h1>

            <p className="mt-3 max-w-3xl text-base leading-7 text-white/68 md:text-lg">
              Drag pre-production jobs onto the calendar to schedule installs, move them into Install Scheduled automatically, and keep each day compact even when the board gets busy.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/jobs"
              className="rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.1]"
            >
              View Jobs
            </Link>
            <Link
              href="/map"
              className="rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85]"
            >
              Open Lead Map
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Visible Jobs" value={String(jobs.length)} />
        <MetricCard label="Scheduled" value={String(scheduledCount)} />
        <MetricCard label="Ready Queue" value={String(readyToSchedule.length)} />
      </section>

      {message ? (
        <section className="rounded-[1.6rem] border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          {message}
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() =>
              setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
            }
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
          >
            Previous
          </button>

          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              {monthLabel(viewDate)}
            </h2>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/38">
              Install Schedule
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
            }
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
          >
            Next
          </button>
        </div>

        {loading ? (
          <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-6 text-sm text-white/60">
            Loading install calendar...
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-7 gap-3">
              {weekdays.map((day) => (
                <div
                  key={day}
                  className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-white/38"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-3">
              {calendarDays.map((day) => {
                const dayJobs = jobsByDate[day.key] ?? []
                const isDropTarget = dragOverDateKey === day.key

                return (
                  <div
                    key={day.key}
                    onDragOver={(event) => {
                      event.preventDefault()
                      setDragOverDateKey(day.key)
                      setDragOverReadyQueue(false)
                    }}
                    onDragLeave={() => {
                      if (dragOverDateKey === day.key) {
                        setDragOverDateKey(null)
                      }
                    }}
                    onDrop={async (event) => {
                      event.preventDefault()
                      await handleDropOnDate(day.key)
                    }}
                    className={`flex h-[280px] flex-col rounded-[1.5rem] border p-3 transition ${
                      day.isCurrentMonth
                        ? 'border-white/10 bg-black/20'
                        : 'border-white/6 bg-white/[0.02]'
                    } ${isDropTarget ? 'ring-2 ring-[#d6b37a]' : ''}`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div
                        className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-semibold ${
                          isToday(day.date)
                            ? 'bg-[#d6b37a] text-black'
                            : day.isCurrentMonth
                              ? 'text-white'
                              : 'text-white/28'
                        }`}
                      >
                        {day.date.getDate()}
                      </div>

                      {dayJobs.length > 0 ? (
                        <div className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/48">
                          {dayJobs.length} job{dayJobs.length === 1 ? '' : 's'}
                        </div>
                      ) : null}
                    </div>

                    <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
                      {dayJobs.map((job) => {
                        const homeowner = getHomeowner(job.homeowners)
                        const repNames = getRepNames(job.job_reps)
                        const isSaving = savingJobId === job.id
                        const isDragging = draggedJobId === job.id
                        const stageName = getStageName(job.pipeline_stages)

                        return (
                          <article
                            key={job.id}
                            draggable
                            onDragStart={() => handleDragStart(job.id)}
                            onDragEnd={handleDragEnd}
                            className={`shrink-0 cursor-grab rounded-[1.2rem] border border-white/10 bg-white/[0.05] p-3 shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition active:cursor-grabbing ${
                              isDragging ? 'opacity-40' : 'opacity-100'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-white">
                                  {homeowner?.name ?? 'Unnamed Homeowner'}
                                </div>
                                <div className="mt-1 line-clamp-2 text-xs text-white/48">
                                  {homeowner?.address ?? '-'}
                                </div>
                              </div>

                              <div
                                className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
                                style={getStagePillStyle(stageName)}
                              >
                                {stageName}
                              </div>
                            </div>

                            <div className="mt-3 text-[11px] text-white/62">
                              {repNames.length > 0 ? repNames.join(', ') : 'No one assigned'}
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-2">
                              <input
                                type="date"
                                className="w-full rounded-xl border border-white/10 bg-black/20 px-2.5 py-2 text-[11px] text-white outline-none transition focus:border-[#d6b37a]/35"
                                value={job.install_date ?? ''}
                                onChange={(event) =>
                                  void updateInstallDate(job.id, event.target.value || null)
                                }
                              />

                              <Link
                                href={`/jobs/${job.id}`}
                                className="shrink-0 rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-2 text-[11px] font-semibold text-white transition hover:bg-white/[0.1]"
                              >
                                Open
                              </Link>
                            </div>

                            {isSaving ? (
                              <div className="mt-2 text-[11px] text-white/42">
                                Saving...
                              </div>
                            ) : null}
                          </article>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      <section
        onDragOver={(event) => {
          event.preventDefault()
          setDragOverReadyQueue(true)
          setDragOverDateKey(null)
        }}
        onDragLeave={() => setDragOverReadyQueue(false)}
        onDrop={async (event) => {
          event.preventDefault()
          await handleDropOnReadyQueue()
        }}
        className={`rounded-[2rem] border p-6 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl transition ${
          dragOverReadyQueue
            ? 'border-[#d6b37a]/40 bg-[#d6b37a]/10 ring-2 ring-[#d6b37a]'
            : 'border-white/10 bg-white/[0.04]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
              Ready Queue
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
              Pre-Production Prep
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/62">
              Only jobs in Pre-Production Prep without an install date stay here. Dropping one onto the calendar moves it straight into Install Scheduled.
            </p>
          </div>

          <div className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white">
            {readyToSchedule.length} ready
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {readyToSchedule.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-white/14 p-6 text-sm text-white/55">
              No jobs are waiting to be scheduled.
            </div>
          ) : (
            readyToSchedule.map((job) => {
              const homeowner = getHomeowner(job.homeowners)
              const repNames = getRepNames(job.job_reps)
              const isSaving = savingJobId === job.id
              const isDragging = draggedJobId === job.id
              const stageName = getStageName(job.pipeline_stages)

              return (
                <article
                  key={job.id}
                  draggable
                  onDragStart={() => handleDragStart(job.id)}
                  onDragEnd={handleDragEnd}
                  className={`cursor-grab rounded-[1.6rem] border border-white/10 bg-black/20 p-4 shadow-[0_16px_35px_rgba(0,0,0,0.22)] transition active:cursor-grabbing ${
                    isDragging ? 'opacity-40' : 'opacity-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">
                        {homeowner?.name ?? 'Unnamed Homeowner'}
                      </div>
                      <div className="mt-1 text-sm text-white/55">
                        {homeowner?.address ?? '-'}
                      </div>
                    </div>

                    <div
                      className="rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
                      style={getStagePillStyle(stageName)}
                    >
                      {stageName}
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-white/62">
                    {repNames.length > 0 ? repNames.join(', ') : 'No one assigned'}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <input
                      type="date"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
                      value={job.install_date ?? ''}
                      onChange={(event) =>
                        void updateInstallDate(job.id, event.target.value || null)
                      }
                    />

                    <Link
                      href={`/jobs/${job.id}`}
                      className="shrink-0 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.1]"
                    >
                      Open
                    </Link>
                  </div>

                  {isSaving ? (
                    <div className="mt-2 text-xs text-white/42">Saving...</div>
                  ) : null}
                </article>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}

function MetricCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-white">
        {value}
      </div>
    </div>
  )
}

export default function InstallCalendarPage() {
  return (
    <ProtectedRoute>
      <InstallCalendarContent />
    </ProtectedRoute>
  )
}
