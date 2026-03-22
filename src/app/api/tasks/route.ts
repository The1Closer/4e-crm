import { NextRequest, NextResponse } from 'next/server'
import {
  getRouteRequester,
  requireExistingJob,
  requireJobAccess,
} from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  canManageTaskPresets,
  insertTaskAssignments,
  insertTaskNotifications,
  listVisibleJobsForUser,
  listTaskPresets,
  listTasksForJob,
  listVisibleTasksForUser,
} from '@/lib/tasks-server'
import {
  buildTaskNotificationRows,
  loadPresetSeed,
  normalizeTaskMutationBody,
  resolveTaskAssigneeIds,
} from '@/lib/tasks-route-utils'
import { canMutateTask } from '@/lib/tasks-server'

export async function GET(req: NextRequest) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  try {
    const requester = authResult.requester
    const jobId = req.nextUrl.searchParams.get('jobId')?.trim() ?? ''
    const includeCompleted = req.nextUrl.searchParams.get('includeCompleted') === 'true'

    if (jobId) {
      const existingJobResult = await requireExistingJob(jobId)

      if ('response' in existingJobResult) {
        return existingJobResult.response
      }

      const accessResponse = await requireJobAccess(requester, jobId)

      if (accessResponse) {
        return accessResponse
      }
    }

    const [tasks, presets, assigneeInfo, jobs] = await Promise.all([
      jobId ? listTasksForJob(jobId) : listVisibleTasksForUser(requester, { includeCompleted }),
      listTaskPresets(),
      resolveTaskAssigneeIds({
        requester,
        jobId: jobId || null,
        inputAssigneeIds: [],
      }),
      listVisibleJobsForUser(requester),
    ])

    return NextResponse.json({
      tasks: tasks.map((task) => ({
        ...task,
        can_edit: canMutateTask(requester, task),
      })),
      presets,
      profiles: assigneeInfo.activeProfiles,
      jobs,
      defaultAssignedUserIds: assigneeInfo.defaultAssignedUserIds,
      canManagePresets: canManageTaskPresets(requester),
      viewerId: requester.profile.id,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load tasks.' },
      { status: 400 }
    )
  }
}

export async function POST(req: NextRequest) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  try {
    const requester = authResult.requester
    const body = await req.json().catch(() => ({}))
    const input = normalizeTaskMutationBody(body)

    if (input.jobId) {
      const existingJobResult = await requireExistingJob(input.jobId)

      if ('response' in existingJobResult) {
        return existingJobResult.response
      }

      const accessResponse = await requireJobAccess(requester, input.jobId)

      if (accessResponse) {
        return accessResponse
      }
    }

    const preset = await loadPresetSeed(input.presetId)
    const assigneeInfo = await resolveTaskAssigneeIds({
      requester,
      jobId: input.jobId,
      inputAssigneeIds: input.assigneeIds,
    })

    const taskTitle = input.title || preset?.title?.trim() || ''
    const taskDescription = input.description || preset?.description?.trim() || ''
    const taskKind = input.kind

    if (!taskTitle) {
      return NextResponse.json({ error: 'Task title is required.' }, { status: 400 })
    }

    const { data: insertedTask, error: insertError } = await supabaseAdmin
      .from('tasks')
      .insert({
        job_id: input.jobId,
        preset_id: preset?.id ?? input.presetId,
        title: taskTitle,
        description: taskDescription || null,
        kind: taskKind,
        status: input.status,
        scheduled_for: input.scheduledFor,
        due_at: input.dueAt,
        appointment_address: input.appointmentAddress || null,
        created_by: requester.profile.id,
        updated_by: requester.profile.id,
        due_reminder_sent_at: null,
      })
      .select('id')
      .single()

    if (insertError || !insertedTask) {
      throw new Error(insertError?.message || 'Could not create the task.')
    }

    await insertTaskAssignments(insertedTask.id, assigneeInfo.finalAssigneeIds)

    try {
      await insertTaskNotifications(
        buildTaskNotificationRows({
          assigneeIds: assigneeInfo.finalAssigneeIds,
          actorUserId: requester.profile.id,
          jobId: input.jobId,
          kind: taskKind,
          title: taskTitle,
        })
      )
    } catch (notificationError) {
      console.error('Could not create task assignment notifications.', notificationError)
    }

    return NextResponse.json({ taskId: insertedTask.id })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not create the task.' },
      { status: 400 }
    )
  }
}
