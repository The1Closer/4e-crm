'use client'

import { authorizedFetch } from '@/lib/api-client'
import { dispatchNotificationsRefresh } from '@/lib/notifications-client'
import { type TaskItem, type TaskKind, type TaskListPayload } from '@/lib/tasks'

type TaskMutationInput = {
  jobId?: string | null
  presetId?: string | null
  title: string
  description: string
  kind: TaskKind
  status?: 'open' | 'completed'
  scheduledFor?: string
  dueAt?: string
  appointmentAddress?: string
  assigneeIds: string[]
}

type TaskPayloadResponse = TaskListPayload & {
  error?: string
}

function getErrorMessage(payload: { error?: string } | null, fallback: string) {
  return payload?.error || fallback
}

export async function fetchTasks(options?: {
  jobId?: string
  includeCompleted?: boolean
}) {
  const searchParams = new URLSearchParams()

  if (options?.jobId) {
    searchParams.set('jobId', options.jobId)
  }

  if (options?.includeCompleted) {
    searchParams.set('includeCompleted', 'true')
  }

  const suffix = searchParams.toString()
  const response = await authorizedFetch(`/api/tasks${suffix ? `?${suffix}` : ''}`, {
    cache: 'no-store',
  })
  const payload = (await response.json().catch(() => null)) as TaskPayloadResponse | null

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, 'Failed to load tasks.'))
  }

  return payload as TaskListPayload
}

export async function createTask(input: TaskMutationInput) {
  const response = await authorizedFetch('/api/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => null)) as
    | { taskId?: string; error?: string }
    | null

  if (!response.ok || !payload?.taskId) {
    throw new Error(getErrorMessage(payload, 'Failed to create the task.'))
  }

  dispatchNotificationsRefresh()
  return payload.taskId
}

export async function updateTask(taskId: string, input: TaskMutationInput) {
  const response = await authorizedFetch(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; error?: string }
    | null

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, 'Failed to update the task.'))
  }

  dispatchNotificationsRefresh()
}

export async function deleteTask(taskId: string) {
  const response = await authorizedFetch(`/api/tasks/${taskId}`, {
    method: 'DELETE',
  })
  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; error?: string }
    | null

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, 'Failed to delete the task.'))
  }
}

export async function createTaskPreset(input: {
  title: string
  description: string
  kind: TaskKind
}) {
  const response = await authorizedFetch('/api/tasks/presets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  const payload = (await response.json().catch(() => null)) as
    | { presetId?: string; error?: string }
    | null

  if (!response.ok || !payload?.presetId) {
    throw new Error(getErrorMessage(payload, 'Failed to create the task preset.'))
  }

  return payload.presetId
}

export async function deleteTaskPreset(presetId: string) {
  const response = await authorizedFetch(`/api/tasks/presets/${presetId}`, {
    method: 'DELETE',
  })
  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; error?: string }
    | null

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, 'Failed to delete the task preset.'))
  }
}

export function upsertTask(tasks: TaskItem[], nextTask: TaskItem) {
  const existingIndex = tasks.findIndex((task) => task.id === nextTask.id)

  if (existingIndex === -1) {
    return [nextTask, ...tasks]
  }

  return tasks.map((task) => (task.id === nextTask.id ? nextTask : task))
}
