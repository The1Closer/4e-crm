'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { supabase } from '../../../lib/supabase'
import { getCurrentUserProfile, isManagerLike } from '../../../lib/auth-helpers'

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
        name: string | null
      }
    | {
        name: string | null
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

function InstallCalendarContent() {
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingJobId, setSavingJobId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [viewDate, setViewDate] = useState(startOfMonth(new Date()))
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null)
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null)
  const [dragOverReadyQueue, setDragOverReadyQueue] = useState(false)

  async function loadJobs() {
    setLoading(true)
    setMessage('')

    const currentProfile = await getCurrentUserProfile()

    if (!currentProfile) {
      setJobs([])
      setLoading(false)
      return
    }

    let visibleJobIds: string[] | null = null

    if (!isManagerLike(currentProfile.role)) {
      const { data: assignedRows } = await supabase
        .from('job_reps')
        .select('job_id')
        .eq('profile_id', currentProfile.id)

      visibleJobIds = [...new Set((assignedRows ?? []).map((row: any) => row.job_id))]

      if (visibleJobIds.length === 0) {
        setJobs([])
        setLoading(false)
        return
      }
    }

    let query = supabase
      .from('jobs')
      .select(`
        id,
        install_date,
        homeowners (
          name,
          address
        ),
        pipeline_stages (
          name
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

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    setJobs((data ?? []) as JobRow[])
    setLoading(false)
  }

  useEffect(() => {
    loadJobs()
  }, [])

  async function updateInstallDate(jobId: string, nextDate: string | null) {
    setSavingJobId(jobId)

    const { error } = await supabase
      .from('jobs')
      .update({
        install_date: nextDate,
      })
      .eq('id', jobId)

    if (error) {
      setMessage(error.message)
      setSavingJobId(null)
      return
    }

    setJobs((prev) =>
      prev.map((job) =>
        job.id === jobId
          ? {
              ...job,
              install_date: nextDate,
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
    await updateInstallDate(draggedJobId, null)
  }

  const calendarDays = useMemo(() => buildCalendarDays(viewDate), [viewDate])

  const jobsByDate = useMemo(() => {
    const grouped: Record<string, JobRow[]> = {}

    jobs.forEach((job) => {
      if (!job.install_date) return
      if (!grouped[job.install_date]) grouped[job.install_date] = []
      grouped[job.install_date].push(job)
    })

    return grouped
  }, [jobs])

  const readyToSchedule = useMemo(() => {
    return jobs.filter((job) => {
      const stageName = getStageName(job.pipeline_stages).toLowerCase().trim()
      return !job.install_date && stageName === 'pre-production prep'
    })
  }, [jobs])

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                Scheduling
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
                Install Calendar
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-gray-600">
                Drag jobs onto a day to schedule them. Drag scheduled jobs to another day to move them.
                Drag them back into the ready queue to unschedule them.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/jobs"
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
              >
                Jobs
              </Link>

              <Link
                href="/"
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
              >
                Home
              </Link>
            </div>
          </div>

          {message ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {message}
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm md:p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={() =>
                setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
              }
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
            >
              Previous
            </button>

            <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-900">
                {monthLabel(viewDate)}
              </h2>
              <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">
                Install schedule
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
              }
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
            >
              Next
            </button>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
              Loading install calendar...
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-7 gap-3">
                {weekdays.map((day) => (
                  <div
                    key={day}
                    className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-gray-500"
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
                      onDragOver={(e) => {
                        e.preventDefault()
                        setDragOverDateKey(day.key)
                        setDragOverReadyQueue(false)
                      }}
                      onDragLeave={() => {
                        if (dragOverDateKey === day.key) {
                          setDragOverDateKey(null)
                        }
                      }}
                      onDrop={async (e) => {
                        e.preventDefault()
                        await handleDropOnDate(day.key)
                      }}
                      className={`min-h-[190px] rounded-2xl border p-3 transition ${
                        day.isCurrentMonth
                          ? 'border-gray-200 bg-white'
                          : 'border-gray-100 bg-gray-50'
                      } ${
                        isDropTarget
                          ? 'ring-2 ring-gray-900 ring-offset-2'
                          : ''
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div
                          className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-semibold ${
                            isToday(day.date)
                              ? 'bg-gray-900 text-white'
                              : day.isCurrentMonth
                              ? 'text-gray-900'
                              : 'text-gray-400'
                          }`}
                        >
                          {day.date.getDate()}
                        </div>

                        {dayJobs.length > 0 ? (
                          <div className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                            {dayJobs.length} job{dayJobs.length === 1 ? '' : 's'}
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        {dayJobs.map((job) => {
                          const homeowner = getHomeowner(job.homeowners)
                          const repNames = getRepNames(job.job_reps)
                          const isSaving = savingJobId === job.id
                          const isDragging = draggedJobId === job.id

                          return (
                            <div
                              key={job.id}
                              draggable
                              onDragStart={() => handleDragStart(job.id)}
                              onDragEnd={handleDragEnd}
                              className={`cursor-grab rounded-xl border border-gray-200 bg-gray-50 p-3 shadow-sm transition active:cursor-grabbing ${
                                isDragging ? 'opacity-40' : 'opacity-100'
                              }`}
                            >
                              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Install
                              </div>

                              <div className="mt-1 text-sm font-semibold text-gray-900">
                                {homeowner?.name ?? 'Unnamed Homeowner'}
                              </div>

                              <div className="mt-1 line-clamp-2 text-xs text-gray-600">
                                {homeowner?.address ?? '-'}
                              </div>

                              <div className="mt-2 text-[11px] text-gray-700">
                                {repNames.length > 0 ? repNames.join(', ') : 'No reps assigned'}
                              </div>

                              <div className="mt-3 flex items-center justify-between gap-2">
                                <input
                                  type="date"
                                  className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-[11px]"
                                  value={job.install_date ?? ''}
                                  onChange={(e) => updateInstallDate(job.id, e.target.value || null)}
                                />

                                <Link
                                  href={`/jobs/${job.id}`}
                                  className="shrink-0 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-[11px] font-medium text-gray-900 transition hover:bg-gray-100"
                                >
                                  Open
                                </Link>
                              </div>

                              {isSaving ? (
                                <div className="mt-2 text-[11px] text-gray-500">
                                  Saving...
                                </div>
                              ) : null}
                            </div>
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
          onDragOver={(e) => {
            e.preventDefault()
            setDragOverReadyQueue(true)
            setDragOverDateKey(null)
          }}
          onDragLeave={() => setDragOverReadyQueue(false)}
          onDrop={async (e) => {
            e.preventDefault()
            await handleDropOnReadyQueue()
          }}
          className={`rounded-3xl border p-6 shadow-sm transition ${
            dragOverReadyQueue
              ? 'border-gray-900 bg-gray-100 ring-2 ring-gray-900 ring-offset-2'
              : 'border-gray-200 bg-white'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">
                Ready to Schedule
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Jobs in Pre-Production Prep with no install date. Drag one onto the calendar to schedule it.
              </p>
            </div>

            <div className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-900">
              {readyToSchedule.length} ready
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {readyToSchedule.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-600">
                No jobs are waiting to be scheduled.
              </div>
            ) : (
              readyToSchedule.map((job) => {
                const homeowner = getHomeowner(job.homeowners)
                const repNames = getRepNames(job.job_reps)
                const isSaving = savingJobId === job.id
                const isDragging = draggedJobId === job.id

                return (
                  <div
                    key={job.id}
                    draggable
                    onDragStart={() => handleDragStart(job.id)}
                    onDragEnd={handleDragEnd}
                    className={`cursor-grab rounded-2xl border border-gray-200 bg-gray-50 p-4 shadow-sm transition active:cursor-grabbing ${
                      isDragging ? 'opacity-40' : 'opacity-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {homeowner?.name ?? 'Unnamed Homeowner'}
                        </div>
                        <div className="mt-1 text-sm text-gray-600">
                          {homeowner?.address ?? '-'}
                        </div>
                      </div>

                      <div className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                        Ready
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-gray-700">
                      {repNames.length > 0 ? repNames.join(', ') : 'No reps assigned'}
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2">
                      <input
                        type="date"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                        value={job.install_date ?? ''}
                        onChange={(e) => updateInstallDate(job.id, e.target.value || null)}
                      />

                      <Link
                        href={`/jobs/${job.id}`}
                        className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 transition hover:bg-gray-100"
                      >
                        Open
                      </Link>
                    </div>

                    {isSaving ? (
                      <div className="mt-2 text-xs text-gray-500">Saving...</div>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

export default function InstallCalendarPage() {
  return (
    <ProtectedRoute>
      <InstallCalendarContent />
    </ProtectedRoute>
  )
}