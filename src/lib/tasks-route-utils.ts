import 'server-only'

import { type RouteRequester, isManagerRole } from '@/lib/server-auth'
import {
  listActiveProfiles,
  listJobAssignmentIds,
} from '@/lib/tasks-server'
import {
  normalizeTaskKind,
  normalizeTaskStatus,
  toIsoDateTimeOrNull,
  type TaskKind,
  type TaskStatus,
} from '@/lib/tasks'
import { supabaseAdmin } from '@/lib/supabase-admin'

export type TaskMutationInput = {
  jobId: string | null
  presetId: string | null
  title: string
  description: string
  kind: TaskKind
  status: TaskStatus
  scheduledFor: string | null
  dueAt: string | null
  appointmentAddress: string
  assigneeIds: string[]
}

export type TaskPresetMutationInput = {
  title: string
  description: string
  kind: TaskKind
}

type TaskPresetSeed = {
  id: string
  title: string | null
  description: string | null
  kind: string | null
}

function normalizeId(value: unknown) {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  return trimmed || null
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function normalizeAssigneeIds(value: unknown) {
  if (!Array.isArray(value)) return []

  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim())
    ),
  ]
}

export function normalizeTaskMutationBody(body: unknown): TaskMutationInput {
  const payload = typeof body === 'object' && body ? body : {}

  const jobId =
    'jobId' in payload ? normalizeId(payload.jobId) : null
  const presetId =
    'presetId' in payload ? normalizeId(payload.presetId) : null
  const title = 'title' in payload ? normalizeText(payload.title) : ''
  const description = 'description' in payload ? normalizeText(payload.description) : ''
  const kind = normalizeTaskKind('kind' in payload ? payload.kind : null)
  const status = normalizeTaskStatus('status' in payload ? payload.status : null)
  const scheduledFor =
    'scheduledFor' in payload ? toIsoDateTimeOrNull(payload.scheduledFor) : null
  const dueAt = 'dueAt' in payload ? toIsoDateTimeOrNull(payload.dueAt) : null
  const appointmentAddress =
    'appointmentAddress' in payload ? normalizeText(payload.appointmentAddress) : ''
  const assigneeIds =
    'assigneeIds' in payload ? normalizeAssigneeIds(payload.assigneeIds) : []

  if (!title) {
    throw new Error('Task title is required.')
  }

  if (!scheduledFor && !dueAt) {
    throw new Error('Set at least a scheduled date or a due date.')
  }

  return {
    jobId,
    presetId,
    title,
    description,
    kind,
    status,
    scheduledFor,
    dueAt,
    appointmentAddress,
    assigneeIds,
  }
}

export function normalizeTaskPresetBody(body: unknown): TaskPresetMutationInput {
  const payload = typeof body === 'object' && body ? body : {}
  const title = 'title' in payload ? normalizeText(payload.title) : ''
  const description = 'description' in payload ? normalizeText(payload.description) : ''
  const kind = normalizeTaskKind('kind' in payload ? payload.kind : null)

  if (!title) {
    throw new Error('Preset title is required.')
  }

  return {
    title,
    description,
    kind,
  }
}

export async function loadPresetSeed(presetId: string | null) {
  if (!presetId) {
    return null
  }

  const { data, error } = await supabaseAdmin
    .from('task_presets')
    .select('id, title, description, kind')
    .eq('id', presetId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error('Selected task preset was not found.')
  }

  return data as TaskPresetSeed
}

export async function resolveTaskAssigneeIds(params: {
  requester: RouteRequester
  jobId: string | null
  inputAssigneeIds: string[]
}) {
  const isManager = isManagerRole(params.requester.profile.role)
  const activeProfiles = await listActiveProfiles()
  const activeProfileIds = new Set(activeProfiles.map((profile) => profile.id))
  const jobAssignedIds = params.jobId ? await listJobAssignmentIds(params.jobId) : []

  let finalAssigneeIds =
    params.inputAssigneeIds.length > 0
      ? params.inputAssigneeIds.filter((profileId) => activeProfileIds.has(profileId))
      : jobAssignedIds.filter((profileId) => activeProfileIds.has(profileId))

  if (finalAssigneeIds.length === 0) {
    finalAssigneeIds = [params.requester.profile.id]
  }

  finalAssigneeIds = [...new Set(finalAssigneeIds)]

  if (!params.jobId && !isManager) {
    finalAssigneeIds = [params.requester.profile.id]
  }

  if (params.jobId && !isManager) {
    const allowedAssigneeIds = new Set([
      params.requester.profile.id,
      ...jobAssignedIds,
    ])

    finalAssigneeIds = finalAssigneeIds.filter((profileId) =>
      allowedAssigneeIds.has(profileId)
    )

    if (finalAssigneeIds.length === 0) {
      finalAssigneeIds = [params.requester.profile.id]
    }
  }

  return {
    activeProfiles,
    defaultAssignedUserIds:
      jobAssignedIds.length > 0 ? jobAssignedIds : [params.requester.profile.id],
    finalAssigneeIds,
  }
}

export function getTaskReminderAt(params: {
  kind: TaskKind
  scheduledFor: string | null
  dueAt: string | null
}) {
  if (params.kind === 'appointment') {
    return params.scheduledFor ?? params.dueAt
  }

  return params.dueAt ?? params.scheduledFor
}

export function buildTaskNotificationRows(params: {
  assigneeIds: string[]
  actorUserId: string
  jobId: string | null
  kind: TaskKind
  title: string
}) {
  const link = params.jobId ? `/jobs/${params.jobId}` : '/calendar/installs'
  const notificationTitle =
    params.kind === 'appointment' ? 'Appointment assigned' : 'Task assigned'
  const notificationMessage =
    params.kind === 'appointment'
      ? `${params.title} was added to your calendar.`
      : `${params.title} was assigned to you.`

  return params.assigneeIds.map((userId) => ({
    user_id: userId,
    actor_user_id: params.actorUserId,
    job_id: params.jobId,
    note_id: null,
    title: notificationTitle,
    message: notificationMessage,
    link,
    type: 'task_assignment',
    metadata: {
      kind: params.kind,
      task_title: params.title,
    },
  }))
}
