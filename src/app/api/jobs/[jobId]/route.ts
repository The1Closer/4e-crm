import { NextRequest, NextResponse } from 'next/server'
import {
  findInstallScheduledStage,
  isInstallScheduledStage,
  isManagementLockedStage,
} from '@/lib/job-stage-access'
import {
  getRouteRequester,
  isManagerRole,
  requireExistingJob,
  requireJobAccess,
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
    const stages = await loadStageRows()
    const requestedStageId = normalizeStageId(body.stage_id)
    const installDate = normalizeDate(body.install_date)
    const repIds = normalizeRepIds(body.rep_ids)

    const autoScheduledStage = installDate ? findInstallScheduledStage(stages) : null
    const stageId = autoScheduledStage?.id ?? requestedStageId
    const targetStage = stageId === null ? null : stages.find((stage) => stage.id === stageId)

    if (stageId !== null && !targetStage) {
      return NextResponse.json({ error: 'Stage not found.' }, { status: 400 })
    }

    if (
      targetStage &&
      isManagementLockedStage(targetStage, stages) &&
      !(installDate && isInstallScheduledStage(targetStage)) &&
      !isManagerRole(authResult.requester.profile.role)
    ) {
      return NextResponse.json(
        { error: 'Only management can move jobs into this stage.' },
        { status: 403 }
      )
    }

    const { data: existingJob, error: existingJobError } = await supabaseAdmin
      .from('jobs')
      .select('id, homeowner_id')
      .eq('id', jobId)
      .single()

    if (existingJobError || !existingJob) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
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

    await notifyAssignedReps({
      jobId,
      actorUserId: authResult.requester.profile.id,
      repIds: newlyAddedRepIds,
    })

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
