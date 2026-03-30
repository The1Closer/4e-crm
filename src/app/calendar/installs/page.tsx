'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  GripHorizontal,
  Hammer,
  Loader2,
  Plus,
  RefreshCw,
  Users,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import TaskEditorDialog, {
  type TaskEditorValue,
} from '@/components/tasks/TaskEditorDialog'
import { getCurrentUserProfile, isManagerLike } from '@/lib/auth-helpers'
import { authorizedFetch } from '@/lib/api-client'
import {
  findInstallScheduledStage,
  findPreProductionPrepStage,
  getStageColor,
  isInstallScheduledStage,
  isPreProductionPrepStage,
  normalizeStage,
} from '@/lib/job-stage-access'
import { supabase } from '@/lib/supabase'
import {
  createTask,
  createTaskPreset,
  deleteTask,
  deleteTaskPreset,
  fetchTasks,
  updateTask,
} from '@/lib/tasks-client'
import {
  formatTaskCountdown,
  formatTaskTime,
  getTaskDateKey,
  getTaskLocationLabel,
  getTaskPrimaryDate,
  sortTasksByUpcoming,
  TASK_KIND_LABEL,
  toLocalDateTimeInputValue,
  type TaskItem,
  type TaskListPayload,
} from '@/lib/tasks'

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

type CalendarEntry =
  | {
      key: string
      kind: 'install'
      dateKey: string
      sortKey: string
      job: JobRow
    }
  | {
      key: string
      kind: 'task' | 'appointment'
      dateKey: string
      sortKey: string
      task: TaskItem
    }

type DraggedCalendarItem =
  | {
      type: 'install'
      id: string
    }
  | {
      type: 'task'
      id: string
    }
  | null

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

function formatShortDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
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

function compareJobsByHomeowner(left: JobRow, right: JobRow) {
  const leftName = getHomeowner(left.homeowners)?.name ?? ''
  const rightName = getHomeowner(right.homeowners)?.name ?? ''

  return leftName.localeCompare(rightName)
}

function compareCalendarEntries(left: CalendarEntry, right: CalendarEntry) {
  if (left.kind !== right.kind) {
    const order: Record<CalendarEntry['kind'], number> = {
      install: 0,
      appointment: 1,
      task: 2,
    }

    return order[left.kind] - order[right.kind]
  }

  if (left.sortKey !== right.sortKey) {
    return left.sortKey.localeCompare(right.sortKey)
  }

  if (left.kind === 'install' && right.kind === 'install') {
    return compareJobsByHomeowner(left.job, right.job)
  }

  if (left.kind !== 'install' && right.kind !== 'install') {
    return left.task.title.localeCompare(right.task.title)
  }

  return 0
}

function getStagePillStyle(stageName: string) {
  const color = getStageColor(stageName)

  return {
    color,
    borderColor: `${color}55`,
    backgroundColor: `${color}14`,
  }
}

function replaceDateKeepTime(value: string | null | undefined, dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const existingDate = value ? new Date(value) : null

  const nextDate =
    existingDate && !Number.isNaN(existingDate.getTime())
      ? new Date(existingDate)
      : new Date(year, (month || 1) - 1, day || 1, 9, 0, 0, 0)

  nextDate.setFullYear(year, (month || 1) - 1, day || 1)
  return nextDate.toISOString()
}

function buildTaskDatePatch(task: TaskItem, dateKey: string) {
  const primaryDate = getTaskPrimaryDate(task)
  const fallbackPrimary = replaceDateKeepTime(primaryDate, dateKey)

  if (task.kind === 'appointment') {
    return {
      scheduledFor: task.scheduled_for
        ? replaceDateKeepTime(task.scheduled_for, dateKey)
        : fallbackPrimary,
      dueAt: task.due_at ? replaceDateKeepTime(task.due_at, dateKey) : '',
    }
  }

  return {
    scheduledFor: task.scheduled_for
      ? replaceDateKeepTime(task.scheduled_for, dateKey)
      : '',
    dueAt: task.due_at
      ? replaceDateKeepTime(task.due_at, dateKey)
      : fallbackPrimary,
  }
}

function getTaskHomeownerLabel(task: TaskItem) {
  return task.job?.homeowner_name ?? 'General'
}

function getForecastDays(count = 7) {
  const days: string[] = []
  const start = new Date()

  for (let index = 0; index < count; index += 1) {
    const next = new Date(start)
    next.setDate(start.getDate() + index)
    days.push(formatDateKey(next))
  }

  return days
}

function openCalendarEntry(
  entry: CalendarEntry,
  router: ReturnType<typeof useRouter>,
  openTask: (task: TaskItem) => void
) {
  if (entry.kind === 'install') {
    router.push(`/jobs/${entry.job.id}`)
    return
  }

  if (entry.task.job_id) {
    router.push(`/jobs/${entry.task.job_id}`)
    return
  }

  openTask(entry.task)
}

function InstallCalendarContent() {
  const router = useRouter()
  const [profileRole, setProfileRole] = useState<string | null>(null)
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [taskPayload, setTaskPayload] = useState<TaskListPayload | null>(null)
  const [stages, setStages] = useState<StageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [taskSaving, setTaskSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [viewDate, setViewDate] = useState(startOfMonth(new Date()))
  const [draggedItem, setDraggedItem] = useState<DraggedCalendarItem>(null)
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null)
  const [dragOverReadyQueue, setDragOverReadyQueue] = useState(false)
  const [taskEditorOpen, setTaskEditorOpen] = useState(false)
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null)
  const [manualRescheduleKey, setManualRescheduleKey] = useState<string | null>(null)
  const [countdownReferenceTime, setCountdownReferenceTime] = useState(() => Date.now())
  const installScheduledStage = useMemo(() => findInstallScheduledStage(stages), [stages])
  const preProductionPrepStage = useMemo(() => findPreProductionPrepStage(stages), [stages])
  const canManageInstalls = isManagerLike(profileRole)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCountdownReferenceTime(Date.now())
    }, 60000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    let isActive = true

    async function loadJobs() {
      setLoading(true)
      setMessage('')

      const currentProfile = await getCurrentUserProfile()

      if (!isActive) return

      setProfileRole(currentProfile?.role ?? null)

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

      setJobs((data ?? []) as JobRow[])
      setLoading(false)
    }

    void loadJobs()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    let isActive = true

    async function loadTasks() {
      try {
        const nextPayload = await fetchTasks({
          includeCompleted: true,
        })

        if (!isActive) {
          return
        }

        setTaskPayload(nextPayload)
      } catch (error) {
        if (!isActive) {
          return
        }

        setMessage(error instanceof Error ? error.message : 'Could not load tasks.')
      }
    }

    void loadTasks()

    return () => {
      isActive = false
    }
  }, [])

  async function reloadTasks() {
    const nextPayload = await fetchTasks({
      includeCompleted: true,
    })
    setTaskPayload(nextPayload)
  }

  async function updateInstallDate(
    jobId: string,
    nextDate: string | null,
    options?: {
      returnToReadyQueue?: boolean
    }
  ) {
    if (!canManageInstalls) {
      setMessage('Only management can move or reschedule installs.')
      return
    }

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

    setSavingKey(`install:${jobId}`)
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

    const response = await authorizedFetch(`/api/jobs/${jobId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    })

    const result = (await response.json().catch(() => null)) as
      | { error?: string }
      | null

    if (!response.ok) {
      setMessage(result?.error || 'Could not update install scheduling.')
      setSavingKey(null)
      return
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

    setSavingKey(null)
    setDraggedItem(null)
    setDragOverDateKey(null)
    setDragOverReadyQueue(false)
    setManualRescheduleKey(null)
  }

  async function updateTaskSchedule(task: TaskItem, nextDatePatch: {
    scheduledFor: string
    dueAt: string
  }) {
    if (!task.can_edit) {
      setMessage('You can only move tasks or appointments you can edit.')
      return
    }

    setSavingKey(`task:${task.id}`)
    setMessage('')

    try {
      await updateTask(task.id, {
        jobId: task.job_id,
        presetId: task.preset_id,
        title: task.title,
        description: task.description,
        kind: task.kind,
        status: task.status,
        scheduledFor: nextDatePatch.scheduledFor,
        dueAt: nextDatePatch.dueAt,
        appointmentAddress: task.appointment_address,
        assigneeIds: task.assignees.map((assignee) => assignee.id),
      })

      await reloadTasks()
      setDraggedItem(null)
      setDragOverDateKey(null)
      setManualRescheduleKey(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not move the task.')
    } finally {
      setSavingKey(null)
    }
  }

  async function handleDropOnDate(dateKey: string) {
    if (!draggedItem) return

    if (draggedItem.type === 'install') {
      await updateInstallDate(draggedItem.id, dateKey)
      return
    }

    const targetTask = taskPayload?.tasks.find((task) => task.id === draggedItem.id) ?? null

    if (!targetTask) {
      return
    }

    await updateTaskSchedule(targetTask, buildTaskDatePatch(targetTask, dateKey))
  }

  async function handleDropOnReadyQueue() {
    if (!draggedItem || draggedItem.type !== 'install') return
    await updateInstallDate(draggedItem.id, null, { returnToReadyQueue: true })
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

  const tasksByDate = useMemo(() => {
    const grouped: Record<string, TaskItem[]> = {}

    ;(taskPayload?.tasks ?? [])
      .filter((task) => task.status === 'open')
      .forEach((task) => {
        const dateKey = getTaskDateKey(getTaskPrimaryDate(task))

        if (!dateKey) {
          return
        }

        if (!grouped[dateKey]) {
          grouped[dateKey] = []
        }

        grouped[dateKey].push(task)
      })

    Object.values(grouped).forEach((entries) => {
      entries.sort(sortTasksByUpcoming)
    })

    return grouped
  }, [taskPayload?.tasks])

  const entriesByDate = useMemo(() => {
    const grouped: Record<string, CalendarEntry[]> = {}

    Object.entries(jobsByDate).forEach(([dateKey, dateJobs]) => {
      grouped[dateKey] = [
        ...(grouped[dateKey] ?? []),
        ...dateJobs.map((job) => ({
          key: `install:${job.id}`,
          kind: 'install' as const,
          dateKey,
          sortKey: `${dateKey}T07:00:00`,
          job,
        })),
      ]
    })

    Object.entries(tasksByDate).forEach(([dateKey, dateTasks]) => {
      grouped[dateKey] = [
        ...(grouped[dateKey] ?? []),
        ...dateTasks.map((task) => ({
          key: `task:${task.id}`,
          kind: task.kind,
          dateKey,
          sortKey: getTaskPrimaryDate(task) ?? `${dateKey}T23:59:59`,
          task,
        })),
      ]
    })

    Object.values(grouped).forEach((entries) => {
      entries.sort(compareCalendarEntries)
    })

    return grouped
  }, [jobsByDate, tasksByDate])

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
  const appointmentCount = useMemo(
    () =>
      (taskPayload?.tasks ?? []).filter(
        (task) => task.status === 'open' && task.kind === 'appointment'
      ).length,
    [taskPayload?.tasks]
  )
  const openTaskCount = useMemo(
    () =>
      (taskPayload?.tasks ?? []).filter(
        (task) => task.status === 'open' && task.kind === 'task'
      ).length,
    [taskPayload?.tasks]
  )

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const forecastDays = useMemo(() => getForecastDays(7), [])

  async function handleSaveTask(value: TaskEditorValue) {
    setTaskSaving(true)
    setMessage('')

    try {
      if (activeTask) {
        await updateTask(activeTask.id, {
          jobId: value.jobId || null,
          presetId: value.presetId || null,
          title: value.title,
          description: value.description,
          kind: value.kind,
          status: value.status,
          scheduledFor: value.scheduledFor,
          dueAt: value.dueAt,
          appointmentAddress: value.appointmentAddress,
          assigneeIds: value.assigneeIds,
        })
      } else {
        await createTask({
          jobId: value.jobId || null,
          presetId: value.presetId || null,
          title: value.title,
          description: value.description,
          kind: value.kind,
          status: value.status,
          scheduledFor: value.scheduledFor,
          dueAt: value.dueAt,
          appointmentAddress: value.appointmentAddress,
          assigneeIds: value.assigneeIds,
        })
      }

      await reloadTasks()
      setTaskEditorOpen(false)
      setActiveTask(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save the task.')
    } finally {
      setTaskSaving(false)
    }
  }

  async function handleDeleteTask() {
    if (!activeTask) {
      return
    }

    const confirmed = window.confirm(`Delete ${activeTask.title}?`)

    if (!confirmed) {
      return
    }

    setTaskSaving(true)
    setMessage('')

    try {
      await deleteTask(activeTask.id)
      await reloadTasks()
      setTaskEditorOpen(false)
      setActiveTask(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not delete the task.')
    } finally {
      setTaskSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.35rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.03))] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.20),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(103,232,249,0.10),transparent_24%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,179,122,0.75),transparent)]" />

        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="space-y-4">
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b37a]">
              Scheduling
            </div>

            <div>
              <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
                Calendar Command Board
              </h1>

              <p className="mt-3 max-w-3xl text-base leading-7 text-white/68 md:text-lg">
                Keep installs, appointments, and task follow-ups on one clean board. Open any
                item with one click, drag the work you are allowed to move, or reschedule from the
                small calendar control without leaving the page.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setActiveTask(null)
                setTaskEditorOpen(true)
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85]"
            >
              <Plus className="h-4 w-4" />
              New Task
            </button>

            <button
              type="button"
              onClick={() => {
                setMessage('')
                window.location.reload()
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.1]"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        <MetricCard label="Scheduled Installs" value={String(scheduledCount)} tone="install" />
        <MetricCard label="Ready Queue" value={String(readyToSchedule.length)} tone="install" />
        <MetricCard label="Appointments" value={String(appointmentCount)} tone="appointment" />
        <MetricCard label="Tasks" value={String(openTaskCount)} tone="task" />
      </section>

      <section className="flex flex-wrap items-center gap-3 rounded-[1.7rem] border border-white/10 bg-white/[0.04] px-4 py-4 shadow-[0_18px_45px_rgba(0,0,0,0.18)]">
        <LegendPill label="Installs" tone="install" />
        <LegendPill label="Appointments" tone="appointment" />
        <LegendPill label="Tasks" tone="task" />
        <div className="ml-auto text-xs text-white/45">
          {canManageInstalls
            ? 'Management can move installs, tasks, and appointments.'
            : 'You can move only the tasks and appointments assigned to or created by you.'}
        </div>
      </section>

      {message ? (
        <section className="rounded-[1.6rem] border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          {message}
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-white/10 bg-[var(--shell-panel-bg)] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() =>
              setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
            }
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-[var(--shell-surface-alt)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>

          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white">
              {monthLabel(viewDate)}
            </h2>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/38">
              Install, appointment, and task board
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
            }
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-[var(--shell-surface-alt)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 rounded-[1.6rem] border border-white/10 bg-[var(--shell-surface-alt)] p-6 text-sm text-white/60">
            <Loader2 className="h-4 w-4 animate-spin text-[#d6b37a]" />
            Loading calendar...
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-7 gap-3">
              {weekdays.map((day) => (
                <div
                  key={day}
                  className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-white/38"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
              {calendarDays.map((day) => {
                const dayEntries = entriesByDate[day.key] ?? []
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
                    onDrop={(event) => {
                      event.preventDefault()
                      void handleDropOnDate(day.key)
                    }}
                    className={`flex min-h-[250px] flex-col rounded-[1.45rem] border p-2.5 transition ${
                      day.isCurrentMonth
                        ? 'border-white/10 bg-[var(--shell-surface-alt)]'
                        : 'border-white/6 bg-white/[0.02]'
                    } ${isDropTarget ? 'ring-2 ring-[#d6b37a]' : ''}`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/6 pb-2">
                      <div
                        className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full px-2 text-sm font-semibold ${
                          isToday(day.date)
                            ? 'bg-[#d6b37a] text-black'
                            : day.isCurrentMonth
                              ? 'text-white'
                              : 'text-white/28'
                        }`}
                      >
                        {day.date.getDate()}
                      </div>

                      <div className="flex flex-wrap justify-end gap-2">
                        <div className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/48">
                          {dayEntries.length} item{dayEntries.length === 1 ? '' : 's'}
                        </div>
                      </div>
                    </div>

                    <div className="min-h-0 space-y-1.5 overflow-y-auto pr-1">
                      {dayEntries.length > 0 ? (
                        dayEntries.map((entry) => (
                          <CalendarEntryCard
                            key={entry.key}
                            entry={entry}
                            saving={savingKey === entry.key}
                            dragging={draggedItem?.id === (entry.kind === 'install' ? entry.job.id : entry.task.id)}
                            canManageInstalls={canManageInstalls}
                            countdownReferenceTime={countdownReferenceTime}
                            manualOpen={manualRescheduleKey === entry.key}
                            onClick={() => {
                              openCalendarEntry(entry, router, (task) => {
                                setActiveTask(task)
                                setTaskEditorOpen(true)
                              })
                            }}
                            onDragStart={() => {
                              if (entry.kind === 'install') {
                                if (!canManageInstalls) {
                                  return
                                }

                                setDraggedItem({
                                  type: 'install',
                                  id: entry.job.id,
                                })
                                return
                              }

                              if (!entry.task.can_edit) {
                                return
                              }

                              setDraggedItem({
                                type: 'task',
                                id: entry.task.id,
                              })
                            }}
                            onDragEnd={() => {
                              setDraggedItem(null)
                              setDragOverDateKey(null)
                              setDragOverReadyQueue(false)
                            }}
                            onToggleManual={() => {
                              setManualRescheduleKey((current) =>
                                current === entry.key ? null : entry.key
                              )
                            }}
                            onInstallDateChange={(nextDate) => {
                              if (entry.kind !== 'install') {
                                return
                              }

                              void updateInstallDate(entry.job.id, nextDate || null)
                            }}
                            onTaskDateChange={(nextDateTime) => {
                              if (entry.kind === 'install') {
                                return
                              }

                              if (!nextDateTime) {
                                return
                              }

                              const patch =
                                entry.task.kind === 'appointment'
                                  ? {
                                      scheduledFor: nextDateTime,
                                      dueAt: entry.task.due_at ?? '',
                                    }
                                  : {
                                      scheduledFor: entry.task.scheduled_for ?? '',
                                      dueAt: nextDateTime,
                                    }

                              void updateTaskSchedule(entry.task, patch)
                            }}
                          />
                        ))
                      ) : null}
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
          if (!canManageInstalls) {
            return
          }

          event.preventDefault()
          setDragOverReadyQueue(true)
          setDragOverDateKey(null)
        }}
        onDragLeave={() => setDragOverReadyQueue(false)}
        onDrop={(event) => {
          event.preventDefault()
          void handleDropOnReadyQueue()
        }}
        className={`rounded-[2rem] border p-6 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl transition ${
          dragOverReadyQueue
            ? 'border-[#d6b37a]/40 bg-[#d6b37a]/10 ring-2 ring-[#d6b37a]'
            : 'border-white/10 bg-white/[0.04]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7dd3fc]">
              Ready Queue
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
              Pre-Production Prep
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/62">
              Jobs waiting for an install date stay here until management drops them onto the
              calendar or picks a date manually.
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
              const stageName = getStageName(job.pipeline_stages)
              const entryKey = `install:${job.id}`

              return (
                <article
                  key={job.id}
                  draggable={canManageInstalls}
                  onDragStart={() => {
                    if (!canManageInstalls) {
                      return
                    }

                    setDraggedItem({
                      type: 'install',
                      id: job.id,
                    })
                  }}
                  onDragEnd={() => {
                    setDraggedItem(null)
                    setDragOverDateKey(null)
                    setDragOverReadyQueue(false)
                  }}
                  className={`rounded-[1.6rem] border border-sky-300/18 bg-[linear-gradient(160deg,rgba(56,189,248,0.12),rgba(255,255,255,0.03))] p-4 shadow-[0_16px_35px_rgba(0,0,0,0.22)] transition ${
                    draggedItem?.type === 'install' && draggedItem.id === job.id
                      ? 'opacity-40'
                      : 'opacity-100'
                  } ${canManageInstalls ? 'cursor-grab active:cursor-grabbing' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-100">
                        <Hammer className="h-3.5 w-3.5" />
                        Install
                      </div>
                      <div className="mt-3 text-lg font-semibold text-white">
                        Install - {homeowner?.name ?? 'Unnamed homeowner'}
                      </div>
                      <div className="mt-2 text-sm text-white/68">
                        {homeowner?.address ?? 'No address on file'}
                      </div>
                    </div>

                    <div
                      className="rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
                      style={getStagePillStyle(stageName)}
                    >
                      {stageName}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-sm text-white/64">
                    <Users className="h-4 w-4 text-sky-200" />
                    {repNames.length > 0 ? repNames.join(', ') : 'No reps assigned'}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/jobs/${job.id}`)}
                      className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
                    >
                      Open Job
                    </button>

                    {canManageInstalls ? (
                      <button
                        type="button"
                        onClick={() => {
                          setManualRescheduleKey((current) =>
                            current === entryKey ? null : entryKey
                          )
                        }}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
                      >
                        <CalendarDays className="h-4 w-4 text-[#d6b37a]" />
                        Date
                      </button>
                    ) : null}
                  </div>

                  {manualRescheduleKey === entryKey && canManageInstalls ? (
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type="date"
                        className="w-full rounded-xl border border-white/10 bg-[var(--shell-surface-alt)] px-3 py-2 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
                        value={job.install_date ?? ''}
                        onChange={(event) =>
                          void updateInstallDate(job.id, event.target.value || null)
                        }
                      />
                    </div>
                  ) : null}

                  {savingKey === entryKey ? (
                    <div className="mt-3 text-xs text-white/42">Saving...</div>
                  ) : null}
                </article>
              )
            })
          )}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[var(--shell-panel-bg)] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
              Next 7 Days
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Your upcoming week
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
              Everything visible to you for the next seven days, grouped the same way the calendar
              sees it.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-7">
          {forecastDays.map((dateKey) => {
            const date = new Date(`${dateKey}T12:00:00`)
            const dayEntries = entriesByDate[dateKey] ?? []

            return (
              <div
                key={dateKey}
                className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {formatShortDate(date)}
                </div>

                <div className="mt-4 space-y-2">
                  {dayEntries.length === 0 ? (
                    <div className="rounded-[1.2rem] border border-dashed border-white/10 px-3 py-4 text-center text-xs text-white/34">
                      No items
                    </div>
                  ) : (
                    dayEntries.map((entry) => (
                      <CalendarEntryCard
                        key={`forecast-${entry.key}`}
                        entry={entry}
                        compact
                        saving={savingKey === entry.key}
                        dragging={false}
                        canManageInstalls={canManageInstalls}
                        countdownReferenceTime={countdownReferenceTime}
                        manualOpen={false}
                        onClick={() => {
                          openCalendarEntry(entry, router, (task) => {
                            setActiveTask(task)
                            setTaskEditorOpen(true)
                          })
                        }}
                        onDragStart={() => {}}
                        onDragEnd={() => {}}
                        onToggleManual={() => {}}
                        onInstallDateChange={() => {}}
                        onTaskDateChange={() => {}}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {taskPayload ? (
        <TaskEditorDialog
          key={activeTask?.id ?? `calendar-create-${taskEditorOpen ? 'open' : 'closed'}`}
          open={taskEditorOpen}
          task={activeTask}
          contextLabel="your calendar"
          presets={taskPayload.presets}
          profiles={taskPayload.profiles}
          jobs={taskPayload.jobs}
          defaultAssignedUserIds={
            activeTask?.assignees.map((assignee) => assignee.id) ??
            taskPayload.defaultAssignedUserIds
          }
          viewerId={taskPayload.viewerId}
          canManagePresets={taskPayload.canManagePresets}
          saving={taskSaving}
          onClose={() => {
            if (taskSaving) {
              return
            }

            setTaskEditorOpen(false)
            setActiveTask(null)
          }}
          onSave={handleSaveTask}
          onDelete={activeTask ? handleDeleteTask : null}
          onCreatePreset={
            taskPayload.canManagePresets
              ? async (value) => {
                  setTaskSaving(true)
                  setMessage('')

                  try {
                    await createTaskPreset(value)
                    await reloadTasks()
                  } catch (error) {
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : 'Could not create the task preset.'
                    )
                  } finally {
                    setTaskSaving(false)
                  }
                }
              : null
          }
          onDeletePreset={
            taskPayload.canManagePresets
              ? async (presetId) => {
                  setTaskSaving(true)
                  setMessage('')

                  try {
                    await deleteTaskPreset(presetId)
                    await reloadTasks()
                  } catch (error) {
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : 'Could not delete the task preset.'
                    )
                  } finally {
                    setTaskSaving(false)
                  }
                }
              : null
          }
        />
      ) : null}
    </div>
  )
}

function LegendPill({
  label,
  tone,
}: {
  label: string
  tone: 'install' | 'appointment' | 'task'
}) {
  const classes =
    tone === 'install'
      ? 'border-sky-300/20 bg-sky-300/10 text-sky-100'
      : tone === 'appointment'
        ? 'border-[#d6b37a]/20 bg-[#d6b37a]/12 text-[#f2d9ac]'
        : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${classes}`}
    >
      {label}
    </div>
  )
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'install' | 'appointment' | 'task'
}) {
  const toneClasses =
    tone === 'install'
      ? 'border-sky-300/14 bg-[linear-gradient(160deg,rgba(56,189,248,0.12),rgba(255,255,255,0.04))]'
      : tone === 'appointment'
        ? 'border-[#d6b37a]/16 bg-[linear-gradient(160deg,rgba(214,179,122,0.12),rgba(255,255,255,0.04))]'
        : 'border-emerald-300/14 bg-[linear-gradient(160deg,rgba(52,211,153,0.12),rgba(255,255,255,0.04))]'

  return (
    <div
      className={`rounded-[1.5rem] border px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)] backdrop-blur-2xl ${toneClasses}`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-white">{value}</div>
    </div>
  )
}

function CalendarEntryCard({
  entry,
  compact = false,
  saving,
  dragging,
  canManageInstalls,
  countdownReferenceTime,
  manualOpen,
  onClick,
  onDragStart,
  onDragEnd,
  onToggleManual,
  onInstallDateChange,
  onTaskDateChange,
}: {
  entry: CalendarEntry
  compact?: boolean
  saving: boolean
  dragging: boolean
  canManageInstalls: boolean
  countdownReferenceTime: number
  manualOpen: boolean
  onClick: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onToggleManual: () => void
  onInstallDateChange: (value: string) => void
  onTaskDateChange: (value: string) => void
}) {
  if (entry.kind === 'install') {
    const homeowner = getHomeowner(entry.job.homeowners)
    const repNames = getRepNames(entry.job.job_reps)

    return (
      <article
        draggable={!compact && canManageInstalls}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className={`rounded-[1.15rem] border border-sky-300/22 bg-[linear-gradient(160deg,rgba(59,130,246,0.16),rgba(255,255,255,0.03))] ${compact ? 'p-2.5' : 'p-3'} shadow-[0_12px_30px_rgba(0,0,0,0.18)] transition ${
          dragging ? 'opacity-40' : 'opacity-100'
        } ${!compact && canManageInstalls ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-100">
            <Hammer className="h-3.5 w-3.5" />
            Install
          </div>

          {!compact ? (
            <div className="flex items-center gap-2">
              {canManageInstalls ? (
                <GripHorizontal className="h-4 w-4 text-white/30" />
              ) : null}

              {canManageInstalls ? (
                <button
                  type="button"
                  onClick={onToggleManual}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/72 transition hover:bg-white/[0.1]"
                  aria-label="Change install date"
                >
                  <CalendarDays className="h-4 w-4 text-[#d6b37a]" />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <button type="button" onClick={onClick} className={`${compact ? 'mt-2' : 'mt-2.5'} block w-full text-left`}>
          <div className="text-sm font-semibold leading-5 text-white">
            Install - {homeowner?.name ?? 'Unnamed homeowner'}
          </div>
          <div className="mt-1 line-clamp-2 text-[11px] leading-4.5 text-white/62">
            {homeowner?.address ?? 'No address on file'}
          </div>
          <div className="mt-1.5 text-[11px] text-white/68">
            {repNames.length > 0 ? repNames.join(', ') : 'No reps assigned'}
          </div>
        </button>

        {manualOpen && !compact && canManageInstalls ? (
          <div className="mt-2.5">
            <input
              type="date"
              className="w-full rounded-xl border border-white/10 bg-[var(--shell-surface-alt)] px-3 py-2 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
              value={entry.job.install_date ?? ''}
              onChange={(event) => onInstallDateChange(event.target.value)}
            />
          </div>
        ) : null}

        {saving ? <div className="mt-2 text-[11px] text-white/42">Saving...</div> : null}
      </article>
    )
  }

  const location = getTaskLocationLabel(entry.task)
  const homeownerName = getTaskHomeownerLabel(entry.task)
  const theme =
    entry.kind === 'appointment'
      ? {
          card: 'border-[#d6b37a]/20 bg-[linear-gradient(160deg,rgba(214,179,122,0.12),rgba(255,255,255,0.04))]',
          badge: 'border-[#d6b37a]/24 bg-[#d6b37a]/10 text-[#f2d9ac]',
          icon: CalendarClock,
        }
      : {
          card: 'border-emerald-300/18 bg-[linear-gradient(160deg,rgba(52,211,153,0.12),rgba(255,255,255,0.03))]',
          badge: 'border-emerald-300/24 bg-emerald-300/10 text-emerald-100',
          icon: ClipboardList,
        }
  const Icon = theme.icon
  const canDrag = Boolean(entry.task.can_edit) && !compact

  return (
    <article
      draggable={canDrag}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`rounded-[1.15rem] border ${compact ? 'p-2.5' : 'p-3'} shadow-[0_12px_30px_rgba(0,0,0,0.18)] transition ${
        theme.card
      } ${dragging ? 'opacity-40' : 'opacity-100'} ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${theme.badge}`}
        >
          <Icon className="h-3.5 w-3.5" />
          {TASK_KIND_LABEL[entry.task.kind]}
        </div>

        {!compact ? (
          <div className="flex items-center gap-2">
            {canDrag ? <GripHorizontal className="h-4 w-4 text-white/30" /> : null}

            {entry.task.can_edit ? (
              <button
                type="button"
                onClick={onToggleManual}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/72 transition hover:bg-white/[0.1]"
                aria-label="Change task date"
              >
                <CalendarDays className="h-4 w-4 text-[#d6b37a]" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <button type="button" onClick={onClick} className={`${compact ? 'mt-2' : 'mt-2.5'} block w-full text-left`}>
        <div className="text-sm font-semibold leading-5 text-white">{entry.task.title}</div>
        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/42">
          {homeownerName}
        </div>
        <div className="mt-1.5 text-[11px] leading-4.5 text-white/70">
          {entry.kind === 'appointment'
            ? `${location} • ${formatTaskTime(getTaskPrimaryDate(entry.task))}`
            : `${entry.task.description || 'No description'} • ${formatTaskTime(getTaskPrimaryDate(entry.task))}`}
        </div>
        {!compact ? (
          <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/46">
            {formatTaskCountdown(getTaskPrimaryDate(entry.task), countdownReferenceTime)}
          </div>
        ) : null}
      </button>

      {manualOpen && !compact && entry.task.can_edit ? (
        <div className="mt-2.5">
          <input
            type="datetime-local"
            className="w-full rounded-xl border border-white/10 bg-[var(--shell-surface-alt)] px-3 py-2 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
            value={toLocalDateTimeInputValue(getTaskPrimaryDate(entry.task))}
            onChange={(event) => onTaskDateChange(event.target.value)}
          />
        </div>
      ) : null}

      {saving ? <div className="mt-2 text-[11px] text-white/42">Saving...</div> : null}
    </article>
  )
}

export default function InstallCalendarPage() {
  return (
    <ProtectedRoute>
      <InstallCalendarContent />
    </ProtectedRoute>
  )
}
