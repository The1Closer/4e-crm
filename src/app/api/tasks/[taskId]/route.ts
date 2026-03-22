import { NextRequest, NextResponse } from 'next/server'
import { canMutateTask, deleteTaskAssignments, getTaskById, insertTaskAssignments, insertTaskNotifications } from '@/lib/tasks-server'
import { getRouteRequester, requireExistingJob, requireJobAccess } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  buildTaskNotificationRows,
  getTaskReminderAt,
  loadPresetSeed,
  normalizeTaskMutationBody,
  resolveTaskAssigneeIds,
} from '@/lib/tasks-route-utils'
import { getTaskPrimaryDate } from '@/lib/tasks'

export async function PATCH(
  req: NextRequest,
  context: {
    params: Promise<{
      taskId: string
    }>
  }
) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  try {
    const requester = authResult.requester
    const { taskId } = await context.params
    const existingTask = await getTaskById(taskId)

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
    }

    if (!canMutateTask(requester, existingTask)) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

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
    const previousPrimaryDate = getTaskPrimaryDate(existingTask)
    const nextPrimaryDate = getTaskReminderAt({
      kind: taskKind,
      scheduledFor: input.scheduledFor,
      dueAt: input.dueAt,
    })
    const reminderChanged = previousPrimaryDate !== nextPrimaryDate
    const nextCompletedAt = input.status === 'completed' ? new Date().toISOString() : null
    const nextCompletedBy = input.status === 'completed' ? requester.profile.id : null

    const { error: updateError } = await supabaseAdmin
      .from('tasks')
      .update({
        job_id: input.jobId,
        preset_id: preset?.id ?? input.presetId,
        title: taskTitle,
        description: taskDescription || null,
        kind: taskKind,
        status: input.status,
        scheduled_for: input.scheduledFor,
        due_at: input.dueAt,
        appointment_address: input.appointmentAddress || null,
        updated_by: requester.profile.id,
        completed_at: nextCompletedAt,
        completed_by: nextCompletedBy,
        due_reminder_sent_at: reminderChanged ? null : undefined,
      })
      .eq('id', taskId)

    if (updateError) {
      throw new Error(updateError.message)
    }

    const previousAssigneeIds = new Set(existingTask.assignees.map((assignee) => assignee.id))
    const newlyAssignedIds = assigneeInfo.finalAssigneeIds.filter(
      (profileId) => !previousAssigneeIds.has(profileId)
    )

    await deleteTaskAssignments(taskId)
    await insertTaskAssignments(taskId, assigneeInfo.finalAssigneeIds)

    if (newlyAssignedIds.length > 0) {
      try {
        await insertTaskNotifications(
          buildTaskNotificationRows({
            assigneeIds: newlyAssignedIds,
            actorUserId: requester.profile.id,
            jobId: input.jobId,
            kind: taskKind,
            title: taskTitle,
          })
        )
      } catch (notificationError) {
        console.error('Could not create task reassignment notifications.', notificationError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not update the task.' },
      { status: 400 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  context: {
    params: Promise<{
      taskId: string
    }>
  }
) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  try {
    const requester = authResult.requester
    const { taskId } = await context.params
    const existingTask = await getTaskById(taskId)

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
    }

    if (!canMutateTask(requester, existingTask)) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    const { error } = await supabaseAdmin
      .from('tasks')
      .delete()
      .eq('id', taskId)

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not delete the task.' },
      { status: 400 }
    )
  }
}
