import 'server-only'

import { isManagerRole, type RouteRequester } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  type TaskAssignee,
  type TaskItem,
  type TaskJobOption,
  type TaskJobSummary,
  type TaskPreset,
  normalizeTaskKind,
  normalizeTaskStatus,
} from '@/lib/tasks'

type TaskProfileRow = {
  id: string
  full_name: string | null
  role: string | null
  is_active?: boolean | null
}

type TaskAssignmentRow = {
  profile_id?: string | null
  profiles?:
    | {
        id?: string | null
        full_name?: string | null
      }
    | {
        id?: string | null
        full_name?: string | null
      }[]
    | null
}

type JobRepAssignmentRow = {
  profile_id?: string | null
}

type TaskRow = {
  id: string
  job_id: string | null
  preset_id: string | null
  title: string | null
  description: string | null
  kind: string | null
  status: string | null
  scheduled_for: string | null
  due_at: string | null
  appointment_address: string | null
  created_by: string
  completed_at: string | null
  created_at: string
  updated_at: string
  jobs?:
    | {
        id?: string | null
        homeowners?:
          | {
              name?: string | null
              address?: string | null
            }
          | {
              name?: string | null
              address?: string | null
            }[]
          | null
      }
    | {
        id?: string | null
        homeowners?:
          | {
              name?: string | null
              address?: string | null
            }
          | {
              name?: string | null
              address?: string | null
            }[]
          | null
      }[]
    | null
  task_assignments?: TaskAssignmentRow[] | null
}

type TaskPresetRow = {
  id: string
  title: string | null
  description: string | null
  kind: string | null
  is_active: boolean | null
  created_at: string
}

type VisibleJobRow = {
  id: string
  homeowners:
    | {
        name?: string | null
        address?: string | null
      }
    | {
        name?: string | null
        address?: string | null
      }[]
    | null
  job_reps?: JobRepAssignmentRow[] | null
}

const TASK_SELECT = `
  id,
  job_id,
  preset_id,
  title,
  description,
  kind,
  status,
  scheduled_for,
  due_at,
  appointment_address,
  created_by,
  completed_at,
  created_at,
  updated_at,
  jobs (
    id,
    homeowners (
      name,
      address
    )
  ),
  task_assignments (
    profile_id,
    profiles (
      id,
      full_name
    )
  )
`

function getProfile(value: TaskAssignmentRow['profiles']) {
  if (!value) return null

  return Array.isArray(value) ? value[0] ?? null : value
}

function getJob(value: TaskRow['jobs']) {
  if (!value) return null

  return Array.isArray(value) ? value[0] ?? null : value
}

function getHomeowner(
  homeowners:
    | {
        name?: string | null
        address?: string | null
      }
    | {
        name?: string | null
        address?: string | null
      }[]
    | null
    | undefined
) {
  if (!homeowners) return null

  return Array.isArray(homeowners) ? homeowners[0] ?? null : homeowners
}

export function mapTaskRow(row: TaskRow): TaskItem {
  const assignees = ((row.task_assignments ?? []) as TaskAssignmentRow[])
    .map((assignment) => {
      const profile = getProfile(assignment.profiles)
      const id = profile?.id ?? assignment.profile_id ?? null

      if (!id) return null

      return {
        id,
        full_name: profile?.full_name?.trim() || 'Unknown user',
      } satisfies TaskAssignee
    })
    .filter((assignment): assignment is TaskAssignee => Boolean(assignment))

  const taskJob = getJob(row.jobs)
  const taskHomeowner = getHomeowner(taskJob?.homeowners)

  const job: TaskJobSummary | null = taskJob?.id
    ? {
        id: taskJob.id,
        homeowner_name: taskHomeowner?.name?.trim() || 'Unnamed homeowner',
        address: taskHomeowner?.address?.trim() || '',
      }
    : null

  return {
    id: row.id,
    job_id: row.job_id,
    preset_id: row.preset_id,
    title: row.title?.trim() || 'Untitled task',
    description: row.description?.trim() || '',
    kind: normalizeTaskKind(row.kind),
    status: normalizeTaskStatus(row.status),
    scheduled_for: row.scheduled_for,
    due_at: row.due_at,
    appointment_address: row.appointment_address?.trim() || '',
    created_by: row.created_by,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    job,
    assignees,
  }
}

export function mapTaskPresetRow(row: TaskPresetRow): TaskPreset {
  return {
    id: row.id,
    title: row.title?.trim() || 'Untitled preset',
    description: row.description?.trim() || '',
    kind: normalizeTaskKind(row.kind),
    is_active: row.is_active !== false,
    created_at: row.created_at,
  }
}

export async function listTaskPresets() {
  const { data, error } = await supabaseAdmin
    .from('task_presets')
    .select('id, title, description, kind, is_active, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as TaskPresetRow[]).map(mapTaskPresetRow)
}

export function mapVisibleJobRow(row: VisibleJobRow): TaskJobOption {
  const homeowner = getHomeowner(row.homeowners)

  return {
    id: row.id,
    homeowner_name: homeowner?.name?.trim() || 'Unnamed homeowner',
    address: homeowner?.address?.trim() || '',
    assigned_profile_ids: [
      ...new Set(
        (row.job_reps ?? [])
          .map((rep) => rep.profile_id ?? null)
          .filter((profileId): profileId is string => Boolean(profileId))
      ),
    ],
  }
}

export async function listActiveProfiles() {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role, is_active')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as TaskProfileRow[]).map((profile) => ({
    id: profile.id,
    full_name: profile.full_name?.trim() || 'Unknown user',
    role: profile.role ?? null,
  }))
}

export async function listJobAssignmentIds(jobId: string) {
  const { data, error } = await supabaseAdmin
    .from('job_reps')
    .select('profile_id')
    .eq('job_id', jobId)

  if (error) {
    throw new Error(error.message)
  }

  return [
    ...new Set(
      (data ?? [])
        .map((row) => ('profile_id' in row ? row.profile_id : null))
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    ),
  ]
}

export async function listVisibleJobsForUser(requester: RouteRequester) {
  let query = supabaseAdmin
    .from('jobs')
    .select(`
      id,
      homeowners (
        name,
        address
      ),
      job_reps (
        profile_id
      )
    `)

  if (!isManagerRole(requester.profile.role)) {
    const { data: assignedRows, error: assignedError } = await supabaseAdmin
      .from('job_reps')
      .select('job_id')
      .eq('profile_id', requester.profile.id)

    if (assignedError) {
      throw new Error(assignedError.message)
    }

    const visibleJobIds = [
      ...new Set(
        (assignedRows ?? [])
          .map((row) => ('job_id' in row ? row.job_id : null))
          .filter((jobId): jobId is string => Boolean(jobId))
      ),
    ]

    if (visibleJobIds.length === 0) {
      return []
    }

    query = query.in('id', visibleJobIds)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as VisibleJobRow[])
    .map(mapVisibleJobRow)
    .sort((left, right) => left.homeowner_name.localeCompare(right.homeowner_name))
}

export async function listTasksForJob(jobId: string) {
  const { data, error } = await supabaseAdmin
    .from('tasks')
    .select(TASK_SELECT)
    .eq('job_id', jobId)
    .order('status', { ascending: true })
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('scheduled_for', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as TaskRow[]).map(mapTaskRow)
}

async function listAssignedTaskIds(profileId: string) {
  const { data, error } = await supabaseAdmin
    .from('task_assignments')
    .select('task_id')
    .eq('profile_id', profileId)

  if (error) {
    throw new Error(error.message)
  }

  return [
    ...new Set(
      (data ?? [])
        .map((row) => ('task_id' in row ? row.task_id : null))
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    ),
  ]
}

export async function listVisibleTasksForUser(
  requester: RouteRequester,
  options?: {
    includeCompleted?: boolean
  }
) {
  const assignedTaskIds = await listAssignedTaskIds(requester.profile.id)
  const taskIdsToLoad = assignedTaskIds
  const queryRequests: Array<PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>> = []

  queryRequests.push(
    supabaseAdmin
      .from('tasks')
      .select(TASK_SELECT)
      .eq('created_by', requester.profile.id)
  )

  if (taskIdsToLoad.length > 0) {
    queryRequests.push(
      supabaseAdmin
        .from('tasks')
        .select(TASK_SELECT)
        .in('id', taskIdsToLoad)
    )
  }

  const results = await Promise.all(queryRequests)

  const rowsById = new Map<string, TaskRow>()

  results.forEach((result) => {
    if (result.error) {
      throw new Error(result.error.message)
    }

    ;((result.data ?? []) as TaskRow[]).forEach((row) => {
      rowsById.set(row.id, row)
    })
  })

  let tasks = [...rowsById.values()].map(mapTaskRow)

  if (!options?.includeCompleted) {
    tasks = tasks.filter((task) => task.status !== 'completed')
  }

  tasks.sort((left, right) => {
    const leftTime = new Date(left.due_at ?? left.scheduled_for ?? left.created_at).getTime()
    const rightTime = new Date(right.due_at ?? right.scheduled_for ?? right.created_at).getTime()

    if (leftTime !== rightTime) {
      return leftTime - rightTime
    }

    return left.title.localeCompare(right.title)
  })

  return tasks
}

export async function getTaskById(taskId: string) {
  const { data, error } = await supabaseAdmin
    .from('tasks')
    .select(TASK_SELECT)
    .eq('id', taskId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    return null
  }

  return mapTaskRow(data as TaskRow)
}

export async function deleteTaskAssignments(taskId: string) {
  const { error } = await supabaseAdmin
    .from('task_assignments')
    .delete()
    .eq('task_id', taskId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function insertTaskAssignments(taskId: string, profileIds: string[]) {
  if (profileIds.length === 0) {
    return
  }

  const { error } = await supabaseAdmin
    .from('task_assignments')
    .insert(
      profileIds.map((profileId) => ({
        task_id: taskId,
        profile_id: profileId,
      }))
    )

  if (error) {
    throw new Error(error.message)
  }
}

export function canManageTaskPresets(requester: RouteRequester) {
  return isManagerRole(requester.profile.role)
}

export function canMutateTask(requester: RouteRequester, task: TaskItem) {
  if (isManagerRole(requester.profile.role)) {
    return true
  }

  if (task.created_by === requester.profile.id) {
    return true
  }

  return task.assignees.some((assignee) => assignee.id === requester.profile.id)
}

export async function insertTaskNotifications(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) {
    return
  }

  const { error } = await supabaseAdmin
    .from('notifications')
    .insert(rows)

  if (error) {
    throw new Error(error.message)
  }
}
