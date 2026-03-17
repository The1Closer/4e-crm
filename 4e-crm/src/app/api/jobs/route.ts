import { NextRequest, NextResponse } from 'next/server'
import { isManagementLockedStage } from '@/lib/job-stage-access'
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
  contract_amount?: string | number | null
  deposit_collected?: string | number | null
  remaining_balance?: string | number | null
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

export async function POST(req: NextRequest) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  try {
    const body = (await req.json()) as JobCreateBody
    const stages = await loadStageRows()
    const stageId = normalizeStageId(body.stage_id)
    const repIds = normalizeRepIds(body.rep_ids)
    const homeownerName = normalizeText(body.homeowner_name)

    if (!homeownerName) {
      return NextResponse.json(
        { error: 'Homeowner name is required.' },
        { status: 400 }
      )
    }

    const targetStage = stageId === null ? null : stages.find((stage) => stage.id === stageId)

    if (stageId !== null && !targetStage) {
      return NextResponse.json({ error: 'Stage not found.' }, { status: 400 })
    }

    if (
      targetStage &&
      isManagementLockedStage(targetStage, stages) &&
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
        install_date: normalizeDate(body.install_date),
        contract_amount: normalizeNumber(body.contract_amount),
        deposit_collected: normalizeNumber(body.deposit_collected, true),
        remaining_balance: normalizeNumber(body.remaining_balance, true),
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
