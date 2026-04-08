import { NextRequest, NextResponse } from 'next/server'
import {
  findInstallScheduledStage,
  isInstallScheduledStage,
  isManagementLockedStage,
} from '@/lib/job-stage-access'
import { getRouteRequester, isManagerRole } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

type JobCreateBody = {
  homeowner_name?: string
  phone?: string
  address?: string
  email?: string
  stage_id?: string | number | null
  insurance_carrier?: string
  claim_number?: string
  install_date?: string | null
  rep_ids?: string[]
}

type StageRow = {
  id: number
  name: string
  sort_order: number | null
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

export async function POST(req: NextRequest) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  try {
    const body = (await req.json()) as JobCreateBody
    const stages = await loadStageRows()
    const requestedStageId = normalizeStageId(body.stage_id)
    const installDate = normalizeDate(body.install_date)
    const repIds = [
      ...new Set([
        authResult.requester.profile.id,
        ...normalizeRepIds(body.rep_ids),
      ]),
    ]
    const homeownerName = normalizeText(body.homeowner_name)

    if (!homeownerName) {
      return NextResponse.json(
        { error: 'Homeowner name is required.' },
        { status: 400 }
      )
    }

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
        { error: 'Only management can create jobs directly in this stage.' },
        { status: 403 }
      )
    }

    const { data: homeowner, error: homeownerError } = await supabaseAdmin
      .from('homeowners')
      .insert({
        name: homeownerName,
        phone: normalizeText(body.phone),
        address: normalizeText(body.address),
        email: normalizeText(body.email),
      })
      .select('id')
      .single()

    if (homeownerError || !homeowner) {
      throw new Error(homeownerError?.message || 'Could not create homeowner.')
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .insert({
        homeowner_id: homeowner.id,
        stage_id: stageId,
        insurance_carrier: normalizeText(body.insurance_carrier),
        claim_number: normalizeText(body.claim_number),
        install_date: installDate,
        contract_amount: 0,
        deposit_collected: 0,
        remaining_balance: 0,
        supplemented_amount: 0,
      })
      .select('id')
      .single()

    if (jobError || !job) {
      await supabaseAdmin.from('homeowners').delete().eq('id', homeowner.id)
      throw new Error(jobError?.message || 'Could not create job.')
    }

    if (repIds.length > 0) {
      const { error: assignmentError } = await supabaseAdmin
        .from('job_reps')
        .insert(repIds.map((repId) => ({ job_id: job.id, profile_id: repId })))

      if (assignmentError) {
        throw new Error(assignmentError.message)
      }
    }

    await notifyAssignedReps({
      jobId: job.id,
      actorUserId: authResult.requester.profile.id,
      repIds,
    })

    if (installDate && targetStage && isInstallScheduledStage(targetStage)) {
      await notifyInstallScheduled({
        jobId: job.id,
        actorUserId: authResult.requester.profile.id,
        repIds,
        installDate,
      })
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Could not create the job.',
      },
      { status: 400 }
    )
  }
}
