'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  UserRound,
} from 'lucide-react'
import TaskEditorDialog, { type TaskEditorValue } from '@/components/tasks/TaskEditorDialog'
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
  formatTaskDateTime,
  getTaskJobLabel,
  getTaskLocationLabel,
  getTaskPrimaryDate,
  sortTasksByUpcoming,
  TASK_KIND_LABEL,
  type TaskItem,
  type TaskListPayload,
} from '@/lib/tasks'

type TaskFilter = 'all' | 'task' | 'appointment'
type TaskPanelDensity = 'default' | 'compact' | 'mini' | 'micro'

function getTaskTheme(task: TaskItem) {
  if (task.kind === 'appointment') {
    return {
      card: 'border-[#d6b37a]/22 bg-[linear-gradient(160deg,rgba(214,179,122,0.12),rgba(255,255,255,0.04))]',
      badge: 'border-[#d6b37a]/30 bg-[#d6b37a]/12 text-[#f2d9ac]',
      tile: 'border-[#d6b37a]/14 bg-black/16',
      accent: 'text-[#f2d9ac]',
    }
  }

  return {
    card: 'border-emerald-300/18 bg-[linear-gradient(160deg,rgba(52,211,153,0.12),rgba(255,255,255,0.03))]',
    badge: 'border-emerald-300/28 bg-emerald-300/10 text-emerald-100',
    tile: 'border-emerald-300/12 bg-black/16',
    accent: 'text-emerald-100',
  }
}

export default function TasksPanel({
  jobId,
  title,
  description,
  contextLabel,
  maxVisible,
  compact = false,
  density,
  upcomingWindowDays,
}: {
  jobId?: string
  title: string
  description: string
  contextLabel: string
  maxVisible?: number
  compact?: boolean
  density?: TaskPanelDensity
  upcomingWindowDays?: number
}) {
  const [payload, setPayload] = useState<TaskListPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [taskSaving, setTaskSaving] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null)
  const [filter, setFilter] = useState<TaskFilter>('all')
  const [countdownReferenceTime, setCountdownReferenceTime] = useState(() => Date.now())
  const displayDensity: TaskPanelDensity = density ?? (compact ? 'compact' : 'default')
  const isCompactLike = displayDensity !== 'default'
  const isMini = displayDensity === 'mini'
  const isMicro = displayDensity === 'micro'
  const windowEndTime =
    typeof upcomingWindowDays === 'number' && upcomingWindowDays > 0
      ? countdownReferenceTime + upcomingWindowDays * 24 * 60 * 60 * 1000
      : null

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

    async function loadPanel() {
      setLoading(true)
      setError('')

      try {
        const nextPayload = await fetchTasks({
          jobId,
        })

        if (!isActive) {
          return
        }

        setPayload(nextPayload)
      } catch (loadError) {
        if (!isActive) {
          return
        }

        setError(loadError instanceof Error ? loadError.message : 'Could not load tasks.')
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    void loadPanel()

    return () => {
      isActive = false
    }
  }, [jobId])

  const filteredOpenTasks = useMemo(() => {
    return (payload?.tasks ?? [])
      .filter((task) => task.status === 'open')
      .filter((task) => {
        if (filter === 'all') {
          return true
        }

        return task.kind === filter
      })
      .filter((task) => {
        if (windowEndTime === null) {
          return true
        }

        const primaryDate = getTaskPrimaryDate(task)

        if (!primaryDate) {
          return false
        }

        const taskTime = new Date(primaryDate).getTime()

        if (Number.isNaN(taskTime)) {
          return false
        }

        return taskTime >= countdownReferenceTime && taskTime <= windowEndTime
      })
      .sort(sortTasksByUpcoming)
  }, [countdownReferenceTime, filter, payload?.tasks, windowEndTime])

  const visibleTasks = useMemo(() => {
    if (typeof maxVisible === 'number' && maxVisible > 0) {
      return filteredOpenTasks.slice(0, maxVisible)
    }

    return filteredOpenTasks
  }, [filteredOpenTasks, maxVisible])

  const hiddenTaskCount = useMemo(() => {
    if (typeof maxVisible !== 'number' || maxVisible <= 0) {
      return 0
    }

    return Math.max(0, filteredOpenTasks.length - maxVisible)
  }, [filteredOpenTasks.length, maxVisible])

  async function reloadTasks() {
    const nextPayload = await fetchTasks({
      jobId,
    })
    setPayload(nextPayload)
  }

  async function handleSaveTask(value: TaskEditorValue) {
    setTaskSaving(true)
    setError('')

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
      setEditorOpen(false)
      setActiveTask(null)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the task.')
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
    setError('')

    try {
      await deleteTask(activeTask.id)
      await reloadTasks()
      setEditorOpen(false)
      setActiveTask(null)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the task.')
    } finally {
      setTaskSaving(false)
    }
  }

  async function handleDeletePreset(presetId: string) {
    setTaskSaving(true)
    setError('')

    try {
      await deleteTaskPreset(presetId)
      await reloadTasks()
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Could not delete the task preset.'
      )
    } finally {
      setTaskSaving(false)
    }
  }

  async function handleCreatePreset(value: {
    title: string
    description: string
    kind: 'task' | 'appointment'
  }) {
    setTaskSaving(true)
    setError('')

    try {
      await createTaskPreset(value)
      await reloadTasks()
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Could not create the task preset.'
      )
    } finally {
      setTaskSaving(false)
    }
  }

  async function handleQuickComplete(task: TaskItem) {
    setTaskSaving(true)
    setError('')

    try {
      await updateTask(task.id, {
        jobId: task.job_id,
        presetId: task.preset_id,
        title: task.title,
        description: task.description,
        kind: task.kind,
        status: 'completed',
        scheduledFor: task.scheduled_for ?? '',
        dueAt: task.due_at ?? '',
        appointmentAddress: task.appointment_address,
        assigneeIds: task.assignees.map((assignee) => assignee.id),
      })

      await reloadTasks()
    } catch (completeError) {
      setError(
        completeError instanceof Error
          ? completeError.message
          : 'Could not complete the task.'
      )
    } finally {
      setTaskSaving(false)
    }
  }

  const totalOpenTasks = filteredOpenTasks.length
  const sectionClassName =
    displayDensity === 'default'
      ? 'rounded-[2rem] border border-white/10 bg-[#0b0f16]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]'
      : displayDensity === 'micro'
        ? 'rounded-[1.45rem] border border-white/10 bg-[#0b0f16]/95 p-3 shadow-[0_16px_38px_rgba(0,0,0,0.18)]'
        : displayDensity === 'mini'
          ? 'rounded-[1.5rem] border border-white/10 bg-[#0b0f16]/95 p-3 shadow-[0_17px_42px_rgba(0,0,0,0.18)]'
          : 'rounded-[1.55rem] border border-white/10 bg-[#0b0f16]/95 p-3.5 shadow-[0_18px_48px_rgba(0,0,0,0.2)]'
  const emptyWindowText =
    typeof upcomingWindowDays === 'number' && upcomingWindowDays > 0
      ? ` in the next ${upcomingWindowDays} day${upcomingWindowDays === 1 ? '' : 's'}`
      : ' right now'

  return (
    <section className={sectionClassName}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d6b37a]">
            Task Desk
          </div>
          <h2
            className={
              isMicro
                ? 'text-lg font-semibold text-white'
                : isCompactLike
                  ? 'text-xl font-semibold text-white'
                  : 'text-2xl font-semibold text-white'
            }
          >
            {title}
          </h2>
          <p
            className={
              isMicro
                ? 'max-w-3xl text-[12px] leading-[1.125rem] text-white/58'
                : isCompactLike
                  ? 'max-w-3xl text-[13px] leading-5 text-white/60'
                  : 'max-w-3xl text-sm leading-7 text-white/60'
            }
          >
            {description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void reloadTasks().catch((loadError) => {
                setError(
                  loadError instanceof Error ? loadError.message : 'Could not refresh tasks.'
                )
              })
            }}
            className={`inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] ${
              isMicro ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm'
            } font-semibold text-white transition hover:bg-white/[0.09]`}
          >
            <RefreshCw className="h-4 w-4 text-white/70" />
            Refresh
          </button>

          {!jobId ? (
            <Link
              href="/calendar/installs"
              className={`inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] ${
                isMicro ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm'
              } font-semibold text-white transition hover:bg-white/[0.09]`}
            >
              <CalendarRange className="h-4 w-4 text-[#d6b37a]" />
              Calendar
            </Link>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setActiveTask(null)
              setEditorOpen(true)
            }}
            className={`inline-flex items-center gap-2 rounded-2xl bg-[#d6b37a] ${
              isMicro ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm'
            } font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.22)] transition hover:bg-[#e2bf85]`}
          >
            <Plus className="h-4 w-4" />
            New
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-[1.4rem] border border-red-400/22 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <div className={`${isCompactLike ? 'mt-3.5' : 'mt-6'} flex flex-wrap items-center justify-between gap-3`}>
        <div className="inline-flex rounded-2xl border border-white/10 bg-black/20 p-1">
          {(['all', 'task', 'appointment'] as const).map((nextFilter) => {
            const active = filter === nextFilter

            return (
              <button
                key={nextFilter}
                type="button"
                onClick={() => setFilter(nextFilter)}
                className={`rounded-[1rem] ${isMicro ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} font-semibold transition ${
                  active
                    ? 'bg-white text-black'
                    : 'text-white/62 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                {nextFilter === 'all'
                  ? 'All'
                  : nextFilter === 'task'
                    ? 'Tasks'
                    : 'Appointments'}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
          <span>{totalOpenTasks} open</span>
          {hiddenTaskCount > 0 ? <span>{hiddenTaskCount} more hidden</span> : null}
        </div>
      </div>

      {loading ? (
        <div className={`${isCompactLike ? 'mt-3.5 py-3.5' : 'mt-6 py-5'} flex items-center gap-3 rounded-[1.45rem] border border-white/10 bg-white/[0.04] px-4 text-sm text-white/60`}>
          <Loader2 className="h-4 w-4 animate-spin text-[#d6b37a]" />
          Loading tasks...
        </div>
      ) : visibleTasks.length === 0 ? (
        <div className={`${isCompactLike ? 'mt-3.5 py-3.5' : 'mt-6 py-5'} rounded-[1.45rem] border border-dashed border-white/12 bg-white/[0.03] px-4 text-sm text-white/52`}>
          No open {filter === 'all' ? 'tasks or appointments' : `${filter}s`} for {contextLabel}
          {emptyWindowText}.
        </div>
      ) : (
        <div
          className={`${
            isMicro ? 'mt-3 space-y-1.5' : isMini ? 'mt-3.5 space-y-2' : isCompactLike ? 'mt-3.5 space-y-2.5' : 'mt-6 space-y-4'
          }`}
        >
          {visibleTasks.map((task) => {
            const theme = getTaskTheme(task)
            const primaryDate = getTaskPrimaryDate(task)
            const Icon = task.kind === 'appointment' ? CalendarRange : ClipboardList
            const cardClassName = isMicro
              ? `overflow-hidden rounded-[1rem] border p-2 shadow-[0_10px_24px_rgba(0,0,0,0.16)] transition ${theme.card}`
              : isMini
                ? `overflow-hidden rounded-[1.1rem] border p-2 shadow-[0_10px_26px_rgba(0,0,0,0.16)] transition ${theme.card}`
                : isCompactLike
                  ? `overflow-hidden rounded-[1.25rem] border p-2.5 shadow-[0_12px_30px_rgba(0,0,0,0.18)] transition ${theme.card}`
                  : `overflow-hidden rounded-[1.8rem] border p-4 shadow-[0_18px_45px_rgba(0,0,0,0.20)] transition ${theme.card}`

            return (
              <article key={task.id} className={cardClassName}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTask(task)
                    setEditorOpen(true)
                  }}
                  className="block w-full text-left"
                >
                  <div className={`flex flex-wrap items-start justify-between ${isCompactLike ? 'gap-2.5' : 'gap-4'}`}>
                    <div className={isCompactLike ? 'space-y-2' : 'space-y-3'}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full border ${
                            isMicro ? 'px-2 py-0.5 text-[9px]' : isCompactLike ? 'px-2.5 py-0.5 text-[10px]' : 'px-3 py-1 text-[11px]'
                          } font-semibold uppercase tracking-[0.18em] ${theme.badge}`}
                        >
                          <Icon className={isMicro ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
                          {TASK_KIND_LABEL[task.kind]}
                        </span>

                        {task.job ? (
                          <span className={`rounded-full border border-white/10 bg-white/[0.05] ${
                            isMicro ? 'px-2 py-0.5 text-[9px]' : isCompactLike ? 'px-2.5 py-0.5 text-[10px]' : 'px-3 py-1 text-[11px]'
                          } font-semibold uppercase tracking-[0.14em] text-white/58`}>
                            {getTaskJobLabel(task)}
                          </span>
                        ) : (
                          <span className={`rounded-full border border-white/10 bg-white/[0.05] ${
                            isMicro ? 'px-2 py-0.5 text-[9px]' : isCompactLike ? 'px-2.5 py-0.5 text-[10px]' : 'px-3 py-1 text-[11px]'
                          } font-semibold uppercase tracking-[0.14em] text-white/48`}>
                            General
                          </span>
                        )}
                      </div>

                      <div>
                        <h3
                          className={
                            isMicro
                              ? 'text-sm font-semibold tracking-tight text-white'
                              : isCompactLike
                                ? 'text-base font-semibold tracking-tight text-white'
                                : 'text-xl font-semibold tracking-tight text-white'
                          }
                        >
                          {task.title}
                        </h3>
                        <p
                          className={`${
                            isMicro ? 'mt-0.5 text-[10px]' : isCompactLike ? 'mt-1 text-[11px]' : 'mt-2 text-sm'
                          } font-semibold uppercase tracking-[0.18em] ${theme.accent}`}
                        >
                          {formatTaskCountdown(primaryDate, countdownReferenceTime)}
                        </p>
                      </div>
                    </div>

                    <div className={`${isMicro ? 'text-[9px]' : isCompactLike ? 'text-[10px]' : 'text-xs'} text-right font-semibold uppercase tracking-[0.18em] text-white/42`}>
                      {formatTaskDateTime(primaryDate)}
                    </div>
                  </div>

                  {isMicro ? (
                    <>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <div className={`rounded-[0.9rem] border px-2 py-1 text-[10px] text-white/80 ${theme.tile}`}>
                          <span className="font-semibold text-white/46">When:</span>{' '}
                          {formatTaskDateTime(primaryDate).replace(',', '')}
                        </div>
                        <div className={`rounded-[0.9rem] border px-2 py-1 text-[10px] text-white/80 ${theme.tile}`}>
                          <span className="font-semibold text-white/46">Where:</span>{' '}
                          {getTaskLocationLabel(task)}
                        </div>
                        <div className={`rounded-[0.9rem] border px-2 py-1 text-[10px] text-white/80 ${theme.tile}`}>
                          <span className="font-semibold text-white/46">Who:</span>{' '}
                          {task.assignees.map((assignee) => assignee.full_name).join(', ')}
                        </div>
                      </div>

                      {task.description ? (
                        <p className="mt-1.5 line-clamp-1 text-[11px] text-white/66">
                          {task.description}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <div className={`${isCompactLike ? 'mt-2.5 gap-2 md:grid-cols-3' : 'mt-4 gap-3 lg:grid-cols-3'} grid`}>
                        <div className={`${isCompactLike ? isMini ? 'rounded-[0.95rem] p-2' : 'rounded-[1rem] p-2.5' : 'rounded-[1.3rem] p-4'} border ${theme.tile}`}>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">
                            When
                          </div>
                          <div className={`${isCompactLike ? isMini ? 'mt-1 text-[12px]' : 'mt-1 text-[13px]' : 'mt-2 text-base'} font-semibold text-white`}>
                            {isCompactLike ? formatTaskDateTime(primaryDate).replace(',', '') : formatTaskDateTime(primaryDate)}
                          </div>
                        </div>

                        <div className={`${isCompactLike ? isMini ? 'rounded-[0.95rem] p-2' : 'rounded-[1rem] p-2.5' : 'rounded-[1.3rem] p-4'} border ${theme.tile}`}>
                          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">
                            <MapPin className="h-3.5 w-3.5 text-white/48" />
                            Where
                          </div>
                          <div className={`${isCompactLike ? isMini ? 'mt-1 text-[12px]' : 'mt-1 text-[13px]' : 'mt-2 text-base'} font-semibold text-white`}>
                            {getTaskLocationLabel(task)}
                          </div>
                        </div>

                        <div className={`${isCompactLike ? isMini ? 'rounded-[0.95rem] p-2' : 'rounded-[1rem] p-2.5' : 'rounded-[1.3rem] p-4'} border ${theme.tile}`}>
                          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">
                            <UserRound className="h-3.5 w-3.5 text-white/48" />
                            Who
                          </div>
                          <div className={`${isCompactLike ? isMini ? 'mt-1 text-[12px]' : 'mt-1 text-[13px]' : 'mt-2 text-base'} font-semibold text-white`}>
                            {task.assignees.map((assignee) => assignee.full_name).join(', ')}
                          </div>
                        </div>
                      </div>

                      {task.description ? (
                        <div className={`${isCompactLike ? isMini ? 'mt-1.5 rounded-[0.95rem] p-2' : 'mt-2 rounded-[1rem] p-2.5' : 'mt-3 rounded-[1.3rem] p-4'} border ${theme.tile}`}>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">
                            Description
                          </div>
                          <p className={`${isCompactLike ? isMini ? 'mt-1 text-[12px] leading-[1.125rem] line-clamp-2' : 'mt-1 text-[13px] leading-5 line-clamp-2' : 'mt-2 text-base leading-7'} whitespace-pre-wrap text-white/76`}>
                            {task.description}
                          </p>
                        </div>
                      ) : null}
                    </>
                  )}
                </button>

                <div className={`${isMicro ? 'mt-2 pt-2' : isCompactLike ? 'mt-2.5 pt-2.5' : 'mt-4 pt-4'} flex flex-wrap items-center justify-between gap-3 border-t border-white/8`}>
                  <div className={`${isMicro ? 'text-[10px]' : 'text-xs'} text-white/44`}>
                    {task.job ? `Linked to ${task.job.homeowner_name}` : 'General task'}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      void handleQuickComplete(task)
                    }}
                    disabled={taskSaving}
                    className={`inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 ${
                      isMicro ? 'px-2 py-0.5 text-[9px]' : isCompactLike ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'
                    } font-semibold uppercase tracking-[0.16em] text-emerald-100 transition hover:bg-emerald-400/18 disabled:opacity-55`}
                  >
                    <CheckCircle2 className={isMicro ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
                    Mark Done
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {payload ? (
        <TaskEditorDialog
          key={activeTask?.id ?? `task-panel-create-${editorOpen ? 'open' : 'closed'}`}
          open={editorOpen}
          task={activeTask}
          jobId={jobId}
          contextLabel={contextLabel}
          presets={payload.presets}
          profiles={payload.profiles}
          jobs={payload.jobs}
          defaultAssignedUserIds={
            activeTask?.assignees.map((assignee) => assignee.id) ??
            payload.defaultAssignedUserIds
          }
          viewerId={payload.viewerId}
          canManagePresets={payload.canManagePresets}
          saving={taskSaving}
          onClose={() => {
            if (taskSaving) {
              return
            }

            setEditorOpen(false)
            setActiveTask(null)
          }}
          onSave={handleSaveTask}
          onDelete={activeTask ? handleDeleteTask : null}
          onCreatePreset={payload.canManagePresets ? handleCreatePreset : null}
          onDeletePreset={payload.canManagePresets ? handleDeletePreset : null}
        />
      ) : null}
    </section>
  )
}
