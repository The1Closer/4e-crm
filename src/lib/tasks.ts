export type TaskKind = 'task' | 'appointment'
export type TaskStatus = 'open' | 'completed'

export type TaskAssignee = {
  id: string
  full_name: string
}

export type TaskJobSummary = {
  id: string
  homeowner_name: string
  address: string
  assigned_profile_ids?: string[]
}

export type TaskPreset = {
  id: string
  title: string
  description: string
  kind: TaskKind
  is_active: boolean
  created_at: string
}

export type TaskItem = {
  id: string
  job_id: string | null
  preset_id: string | null
  title: string
  description: string
  kind: TaskKind
  status: TaskStatus
  scheduled_for: string | null
  due_at: string | null
  appointment_address: string
  created_by: string
  completed_at: string | null
  created_at: string
  updated_at: string
  job: TaskJobSummary | null
  assignees: TaskAssignee[]
  can_edit?: boolean
}

export type TaskProfileOption = {
  id: string
  full_name: string
  role: string | null
}

export type TaskJobOption = {
  id: string
  homeowner_name: string
  address: string
  assigned_profile_ids: string[]
}

export type TaskListPayload = {
  tasks: TaskItem[]
  presets: TaskPreset[]
  profiles: TaskProfileOption[]
  jobs: TaskJobOption[]
  defaultAssignedUserIds: string[]
  canManagePresets: boolean
  viewerId: string
}

export const TASK_KIND_LABEL: Record<TaskKind, string> = {
  task: 'Task',
  appointment: 'Appointment',
}

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  open: 'Open',
  completed: 'Completed',
}

export function isTaskKind(value: string | null | undefined): value is TaskKind {
  return value === 'task' || value === 'appointment'
}

export function isTaskStatus(value: string | null | undefined): value is TaskStatus {
  return value === 'open' || value === 'completed'
}

export function normalizeTaskKind(value: unknown, fallback: TaskKind = 'task') {
  return typeof value === 'string' && isTaskKind(value) ? value : fallback
}

export function normalizeTaskStatus(
  value: unknown,
  fallback: TaskStatus = 'open'
) {
  return typeof value === 'string' && isTaskStatus(value) ? value : fallback
}

export function toIsoDateTimeOrNull(value: unknown) {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()

  if (!trimmed) return null

  const parsed = new Date(trimmed)

  if (Number.isNaN(parsed.getTime())) {
    throw new Error('One of the task dates is invalid.')
  }

  return parsed.toISOString()
}

export function toLocalDateTimeInputValue(value: string | null | undefined) {
  if (!value) return ''

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  const year = parsed.getFullYear()
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0')
  const day = `${parsed.getDate()}`.padStart(2, '0')
  const hours = `${parsed.getHours()}`.padStart(2, '0')
  const minutes = `${parsed.getMinutes()}`.padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export function getTaskPrimaryDate(task: Pick<TaskItem, 'kind' | 'scheduled_for' | 'due_at'>) {
  if (task.kind === 'appointment') {
    return task.scheduled_for ?? task.due_at
  }

  return task.due_at ?? task.scheduled_for
}

export function getTaskJobLabel(task: Pick<TaskItem, 'job'>) {
  if (!task.job) {
    return 'General task'
  }

  if (task.job.address) {
    return `${task.job.homeowner_name} - ${task.job.address}`
  }

  return task.job.homeowner_name
}

export function getTaskLocationLabel(
  task: Pick<TaskItem, 'kind' | 'job' | 'appointment_address'>
) {
  if (task.job?.address) {
    return task.job.address
  }

  if (task.kind === 'appointment' && task.appointment_address.trim()) {
    return task.appointment_address.trim()
  }

  return 'No location set'
}

export function getTaskDateKey(value: string | null | undefined) {
  if (!value) return null

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  const year = parsed.getFullYear()
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0')
  const day = `${parsed.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function sortTasksByUpcoming(left: TaskItem, right: TaskItem) {
  const leftPrimary = getTaskPrimaryDate(left)
  const rightPrimary = getTaskPrimaryDate(right)

  const leftTime = leftPrimary ? new Date(leftPrimary).getTime() : Number.MAX_SAFE_INTEGER
  const rightTime = rightPrimary ? new Date(rightPrimary).getTime() : Number.MAX_SAFE_INTEGER

  if (leftTime !== rightTime) {
    return leftTime - rightTime
  }

  return left.title.localeCompare(right.title)
}

export function formatTaskDateTime(value: string | null | undefined) {
  if (!value) return 'Not set'

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatTaskTime(value: string | null | undefined) {
  if (!value) return 'No time set'

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatTaskCountdown(
  value: string | null | undefined,
  referenceTime = Date.now()
) {
  if (!value) {
    return 'No date set'
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  const diffMs = parsed.getTime() - referenceTime
  const absoluteMs = Math.abs(diffMs)
  const totalMinutes = Math.round(absoluteMs / 60000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  const parts: string[] = []

  if (days > 0) parts.push(`${days}d`)
  if (hours > 0 && parts.length < 2) parts.push(`${hours}h`)
  if (days === 0 && minutes > 0 && parts.length < 2) parts.push(`${minutes}m`)

  if (parts.length === 0) {
    parts.push('now')
  }

  return diffMs >= 0 ? `in ${parts.join(' ')}` : `${parts.join(' ')} ago`
}
