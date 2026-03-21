import { NextRequest, NextResponse } from 'next/server'
import {
  findInstallScheduledStage,
  isInstallScheduledStage,
  isInstallWorkflowStage,
  isManagementLockedStage,
  isPreProductionPrepStage,
} from '@/lib/job-stage-access'
import {
  getRouteRequester,
  isManagerRole,
  requireExistingJob,
  requireJobAccess,
  requireManager,
} from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

type RouteContext = {
  params: Promise<{
    jobId: string
  }>
}

type JobMutationBody = {
  homeowner_name?: string
  phone?: string
  address?: string
  email?: string
  stage_id?: string | number | null
  insurance_carrier?: string
  deductible?: string | number | null
  claim_number?: string
  adjuster_name?: string
  adjuster_phone?: string
  adjuster_email?: string
  date_of_loss?: string | null
  type_of_loss?: string
  install_date?: string | null
  contract_signed_date?: string | null
  contract_amount?: string | number | null
  deposit_collected?: string | number | null
  remaining_balance?: string | number | null
  supplemented_amount?: string | number | null
  shingle_name?: string
  rep_ids?: string[]
}

type StageRow = {
  id: number
  name: string
  sort_order: number | null
}

type JobFileRow = {
  file_path: string | null
}

function formatNotificationDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return value
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeDate(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeStageId(value: unknown) {
  if (value === null || value === undefined || value === '') return null

  const parsed = Number(value)
  if (!Number.isInteger(parsed)) {
    throw new Error('Stage selection is invalid.')
  }

  return parsed
}

function normalizeNumber(value: unknown, fallbackToZero = false) {
  if (value === null || value === undefined || value === '') {
    return fallbackToZero ? 0 : null
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error('One of the numeric values is invalid.')
  }

  return parsed
}

function normalizeRepIds(value: unknown) {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value
        .filter(
          (item): item is string =>
            typeof item === 'string' && item.trim().length > 0
        )
        .map((item) => item.trim())
    ),
  ]
}

async function loadStageRows() {
  const { data, error } = await supabaseAdmin
    .from('pipeline_stages')
    .select('id, name, sort_order')
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as StageRow[]
}

async function notifyAssignedReps(params: {
  jobId: string
  actorUserId: string
  repIds: string[]
}) {
  if (params.repIds.length === 0) return

  const rows = params.repIds
    .filter((repId) => repId !== params.actorUserId)
    .map((repId) => ({
      user_id: repId,
      actor_user_id: params.actorUserId,
      type: 'assignment',
      title: 'You were assigned to a job',
      message: 'You were assigned to a job in the CRM.',
      link: `/jobs/${params.jobId}`,
      job_id: params.jobId,
      note_id: null,
      metadata: {},
    }))

  if (rows.length === 0) return

  await supabaseAdmin.from('notifications').insert(rows)
}

async function notifyStageChange(params: {
  jobId: string
  actorUserId: string
  repIds: string[]
  stage: StageRow
}) {
  const rows = params.repIds
    .filter((repId) => repId !== params.actorUserId)
    .map((repId) => ({
      user_id: repId,
      actor_user_id: params.actorUserId,
      type: 'stage_change',
      title: 'Job stage changed',
      message: `A job was moved to ${params.stage.name}.`,
      link: `/jobs/${params.jobId}`,
      job_id: params.jobId,
      note_id: null,
      metadata: {
        stage_id: params.stage.id,
        stage_name: params.stage.name,
      },
    }))

  if (rows.length === 0) return

  await supabaseAdmin.from('notifications').insert(rows)
}

async function notifyInstallScheduled(params: {
  jobId: string
  actorUserId: string
  repIds: string[]
  installDate: string
}) {
  if (params.repIds.length === 0) return

  const formattedDate = formatNotificationDate(params.installDate)
  const rows = params.repIds
    .filter((repId) => repId !== params.actorUserId)
    .map((repId) => ({
      user_id: repId,
      actor_user_id: params.actorUserId,
      type: 'stage_change',
      title: 'Install scheduled',
      message: `Install scheduled for ${formattedDate}.`,
      link: `/jobs/${params.jobId}`,
      job_id: params.jobId,
      note_id: null,
      metadata: {
        event: 'install_scheduled',
        install_date: params.installDate,
      },
    }))

  if (rows.length === 0) return

  await supabaseAdmin.from('notifications').insert(rows)
}

async function removeStoragePaths(
  bucketName: 'documents' | 'job-files',
  filePaths: (string | null | undefined)[]
) {
  const uniquePaths = [
    ...new Set(
      filePaths.filter(
        (path): path is string => typeof path === 'string' && path.trim().length > 0
      )
    ),
  ]

  if (uniquePaths.length === 0) {
    return
  }

  const { error } = await supabaseAdmin.storage.from(bucketName).remove(uniquePaths)

  if (error) {
    console.error(`Could not remove ${bucketName} files for deleted job.`, error)
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const { jobId } = await context.params
  const existingJobResult = await requireExistingJob(jobId)

  if ('response' in existingJobResult) {
    return existingJobResult.response
  }

  const accessError = await requireJobAccess(authResult.requester, jobId)

  if (accessError) {
    return accessError
  }

  const [jobRes, stagesRes, repsRes, jobRepsRes, notesRes] = await Promise.all([
    supabaseAdmin
      .from('jobs')
      .select(`
        id,
        homeowner_id,
        stage_id,
        insurance_carrier,
        deductible,
        claim_number,
        adjuster_name,
        adjuster_phone,
        adjuster_email,
        date_of_loss,
        type_of_loss,
        install_date,
        contract_signed_date,
        contract_amount,
        deposit_collected,
        remaining_balance,
        supplemented_amount,
        shingle_name,
        created_at,
        updated_at,
        homeowners (
          id,
          name,
          phone,
          address,
          email,
          created_at,
          updated_at
        ),
        pipeline_stages (
          id,
          name,
          sort_order,
          created_at
        ),
        job_reps (
          id,
          job_id,
          profile_id,
          created_at,
          profiles (
            id,
            full_name
          )
        )
      `)
      .eq('id', jobId)
      .single(),
    supabaseAdmin
      .from('pipeline_stages')
      .select('id, name, sort_order')
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, is_active')
      .eq('is_active', true)
      .order('full_name', { ascending: true }),
    supabaseAdmin.from('job_reps').select('profile_id').eq('job_id', jobId),
    supabaseAdmin
      .from('notes')
      .select('id, body, created_at, updated_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false }),
  ])

  if (jobRes.error || !jobRes.data) {
    return NextResponse.json(
      {
        error: jobRes.error?.message ?? 'Job not found.',
      },
      { status: 404 }
    )
  }

  return NextResponse.json({
    job: jobRes.data,
    stages: stagesRes.data ?? [],
    reps: repsRes.data ?? [],
    initialSelectedRepIds: (jobRepsRes.data ?? []).map(
      (row: { profile_id: string }) => row.profile_id
    ),
    initialNotes: notesRes.data ?? [],
  })
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const { jobId } = await context.params
  const existingJobResult = await requireExistingJob(jobId)

  if ('response' in existingJobResult) {
    return existingJobResult.response
  }

  const accessError = await requireJobAccess(authResult.requester, jobId)

  if (accessError) {
    return accessError
  }

  try {
    const body = (await req.json()) as JobMutationBody
    const { data: existingJob, error: existingJobError } = await supabaseAdmin
      .from('jobs')
      .select('id, homeowner_id, stage_id, install_date')
      .eq('id', jobId)
      .single()

    if (existingJobError || !existingJob) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
    }

    const stages = await loadStageRows()
    const bodyIncludesStageId = Object.prototype.hasOwnProperty.call(body, 'stage_id')
    const bodyIncludesInstallDate = Object.prototype.hasOwnProperty.call(body, 'install_date')
    const requestedStageId = bodyIncludesStageId
      ? normalizeStageId(body.stage_id)
      : existingJob.stage_id
    const installDate = bodyIncludesInstallDate
      ? normalizeDate(body.install_date)
      : existingJob.install_date
    const repIds = normalizeRepIds(body.rep_ids)

    const requestedStage =
      requestedStageId === null
        ? null
        : stages.find((stage) => stage.id === requestedStageId) ?? null
    const autoScheduledStage = installDate ? findInstallScheduledStage(stages) : null
    const stageId =
      installDate && (!requestedStage || isPreProductionPrepStage(requestedStage))
        ? autoScheduledStage?.id ?? requestedStageId
        : requestedStageId
    const targetStage = stageId === null ? null : stages.find((stage) => stage.id === stageId)

    if (requestedStageId !== null && !requestedStage) {
      return NextResponse.json({ error: 'Stage not found.' }, { status: 400 })
    }

    if (stageId !== null && !targetStage) {
      return NextResponse.json({ error: 'Stage not found.' }, { status: 400 })
    }

    if (targetStage && isInstallScheduledStage(targetStage) && !installDate) {
      return NextResponse.json(
        { error: 'Install Scheduled requires an install date.' },
        { status: 400 }
      )
    }

    if (
      targetStage &&
      isManagementLockedStage(targetStage, stages) &&
      !isInstallWorkflowStage(targetStage) &&
      !isManagerRole(authResult.requester.profile.role)
    ) {
      return NextResponse.json(
        { error: 'Only management can move jobs into this stage.' },
        { status: 403 }
      )
    }

    const { data: currentAssignments, error: assignmentError } = await supabaseAdmin
      .from('job_reps')
      .select('profile_id')
      .eq('job_id', jobId)

    if (assignmentError) {
      throw new Error(assignmentError.message)
    }

    const currentRepIds = (currentAssignments ?? []).map(
      (row: { profile_id: string }) => row.profile_id
    )

    const { error: homeownerError } = await supabaseAdmin
      .from('homeowners')
      .update({
        name: normalizeText(body.homeowner_name),
        phone: normalizeText(body.phone),
        address: normalizeText(body.address),
        email: normalizeText(body.email),
      })
      .eq('id', existingJob.homeowner_id)

    if (homeownerError) {
      throw new Error(homeownerError.message)
    }

    const { error: jobError } = await supabaseAdmin
      .from('jobs')
      .update({
        stage_id: stageId,
        insurance_carrier: normalizeText(body.insurance_carrier),
        deductible: normalizeNumber(body.deductible),
        claim_number: normalizeText(body.claim_number),
        adjuster_name: normalizeText(body.adjuster_name),
        adjuster_phone: normalizeText(body.adjuster_phone),
        adjuster_email: normalizeText(body.adjuster_email),
        date_of_loss: normalizeDate(body.date_of_loss),
        type_of_loss: normalizeText(body.type_of_loss),
        install_date: installDate,
        contract_signed_date: normalizeDate(body.contract_signed_date),
        contract_amount: normalizeNumber(body.contract_amount),
        deposit_collected: normalizeNumber(body.deposit_collected, true),
        remaining_balance: normalizeNumber(body.remaining_balance, true),
        supplemented_amount: normalizeNumber(body.supplemented_amount, true),
        shingle_name: normalizeText(body.shingle_name),
      })
      .eq('id', jobId)

    if (jobError) {
      throw new Error(jobError.message)
    }

    const { error: deleteAssignmentError } = await supabaseAdmin
      .from('job_reps')
      .delete()
      .eq('job_id', jobId)

    if (deleteAssignmentError) {
      throw new Error(deleteAssignmentError.message)
    }

    if (repIds.length > 0) {
      const { error: insertAssignmentError } = await supabaseAdmin
        .from('job_reps')
        .insert(repIds.map((repId) => ({ job_id: jobId, profile_id: repId })))

      if (insertAssignmentError) {
        throw new Error(insertAssignmentError.message)
      }
    }

    const newlyAddedRepIds = repIds.filter((repId) => !currentRepIds.includes(repId))
    try {
      await notifyAssignedReps({
        jobId,
        actorUserId: authResult.requester.profile.id,
        repIds: newlyAddedRepIds,
      })
    } catch (notificationError) {
      console.error('Could not notify newly assigned reps.', notificationError)
    }

    const shouldNotifyInstallScheduled =
      Boolean(targetStage) &&
      Boolean(installDate) &&
      isInstallScheduledStage(targetStage as StageRow) &&
      (existingJob.stage_id !== stageId || existingJob.install_date !== installDate)

    if (shouldNotifyInstallScheduled && installDate) {
      try {
        await notifyInstallScheduled({
          jobId,
          actorUserId: authResult.requester.profile.id,
          repIds,
          installDate,
        })
      } catch (notificationError) {
        console.error('Could not notify reps about the install schedule.', notificationError)
      }
    } else if (targetStage && existingJob.stage_id !== stageId) {
      try {
        await notifyStageChange({
          jobId,
          actorUserId: authResult.requester.profile.id,
          repIds,
          stage: targetStage,
        })
      } catch (notificationError) {
        console.error('Could not notify reps about the stage change.', notificationError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Could not update the job.',
      },
      { status: 400 }
    )
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const managerError = requireManager(authResult.requester)

  if (managerError) {
    return managerError
  }

  const { jobId } = await context.params
  const existingJobResult = await requireExistingJob(jobId)

  if ('response' in existingJobResult) {
    return existingJobResult.response
  }

  try {
    const [jobRes, signedDocsRes, uploadedDocsRes] = await Promise.all([
      supabaseAdmin
        .from('jobs')
        .select('id, homeowner_id')
        .eq('id', jobId)
        .single(),
      supabaseAdmin
        .from('job_documents')
        .select('file_path')
        .eq('job_id', jobId),
      supabaseAdmin
        .from('documents')
        .select('file_path')
        .eq('job_id', jobId),
    ])

    if (jobRes.error || !jobRes.data) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
    }

    if (signedDocsRes.error) {
      throw new Error(signedDocsRes.error.message)
    }

    if (uploadedDocsRes.error) {
      throw new Error(uploadedDocsRes.error.message)
    }

    const signedFilePaths = (signedDocsRes.data ?? []) as JobFileRow[]
    const uploadedFilePaths = (uploadedDocsRes.data ?? []) as JobFileRow[]

    const { error: notificationsError } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('job_id', jobId)

    if (notificationsError) {
      throw new Error(notificationsError.message)
    }

    const { error: notesError } = await supabaseAdmin
      .from('notes')
      .delete()
      .eq('job_id', jobId)

    if (notesError) {
      throw new Error(notesError.message)
    }

    const { error: repsError } = await supabaseAdmin
      .from('job_reps')
      .delete()
      .eq('job_id', jobId)

    if (repsError) {
      throw new Error(repsError.message)
    }

    const { error: commissionsError } = await supabaseAdmin
      .from('job_commissions')
      .delete()
      .eq('job_id', jobId)

    if (
      commissionsError &&
      !/relation .* does not exist/i.test(commissionsError.message)
    ) {
      throw new Error(commissionsError.message)
    }

    const { error: signedDocsDeleteError } = await supabaseAdmin
      .from('job_documents')
      .delete()
      .eq('job_id', jobId)

    if (signedDocsDeleteError) {
      throw new Error(signedDocsDeleteError.message)
    }

    const { error: uploadsDeleteError } = await supabaseAdmin
      .from('documents')
      .delete()
      .eq('job_id', jobId)

    if (uploadsDeleteError) {
      throw new Error(uploadsDeleteError.message)
    }

    const { error: jobDeleteError } = await supabaseAdmin
      .from('jobs')
      .delete()
      .eq('id', jobId)

    if (jobDeleteError) {
      throw new Error(jobDeleteError.message)
    }

    if (jobRes.data.homeowner_id) {
      const { data: remainingJobs, error: remainingJobsError } = await supabaseAdmin
        .from('jobs')
        .select('id')
        .eq('homeowner_id', jobRes.data.homeowner_id)
        .limit(1)

      if (remainingJobsError) {
        console.error('Could not confirm remaining jobs for deleted homeowner.', remainingJobsError)
      } else if ((remainingJobs ?? []).length === 0) {
        const { error: homeownerDeleteError } = await supabaseAdmin
          .from('homeowners')
          .delete()
          .eq('id', jobRes.data.homeowner_id)

        if (homeownerDeleteError) {
          console.error('Could not remove orphaned homeowner after job delete.', homeownerDeleteError)
        }
      }
    }

    await Promise.allSettled([
      removeStoragePaths(
        'documents',
        signedFilePaths.map((file) => file.file_path)
      ),
      removeStoragePaths(
        'job-files',
        uploadedFilePaths.map((file) => file.file_path)
      ),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Could not delete the job.',
      },
      { status: 400 }
    )
  }
}
