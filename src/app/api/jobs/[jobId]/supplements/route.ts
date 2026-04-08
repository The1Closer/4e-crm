import { NextRequest, NextResponse } from 'next/server'
import { syncJobFinancialCache } from '@/lib/job-financials-server'
import {
  getRouteRequester,
  requireExistingJob,
  requireJobAccess,
} from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

type RouteContext = {
  params: Promise<{
    jobId: string
  }>
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeAmount(value: unknown) {
  if (value === null || value === undefined || value === '') return null

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null

  return parsed
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

  const { data, error } = await supabaseAdmin
    .from('job_contract_supplements')
    .select(
      `
        id,
        job_id,
        job_contract_id,
        amount,
        supplement_for,
        created_at,
        created_by,
        job_contracts!inner (
          id,
          date_signed,
          contract_amount,
          trades_included
        )
      `
    )
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({
    supplements: data ?? [],
  })
}

export async function POST(req: NextRequest, context: RouteContext) {
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
    const body = (await req.json()) as {
      jobContractId?: unknown
      amount?: unknown
      supplementFor?: unknown
    }

    const jobContractId = normalizeText(body.jobContractId)
    const amount = normalizeAmount(body.amount)
    const supplementFor = normalizeText(body.supplementFor)

    if (!jobContractId) {
      return NextResponse.json({ error: 'Contract is required.' }, { status: 400 })
    }

    if (amount === null || amount <= 0) {
      return NextResponse.json(
        { error: 'Supplement amount must be greater than zero.' },
        { status: 400 }
      )
    }

    if (!supplementFor) {
      return NextResponse.json(
        { error: 'Supplement reason is required.' },
        { status: 400 }
      )
    }

    const { data: contract, error: contractError } = await supabaseAdmin
      .from('job_contracts')
      .select('id')
      .eq('id', jobContractId)
      .eq('job_id', jobId)
      .maybeSingle()

    if (contractError) {
      return NextResponse.json({ error: contractError.message }, { status: 400 })
    }

    if (!contract) {
      return NextResponse.json(
        { error: 'Selected contract was not found for this job.' },
        { status: 404 }
      )
    }

    const { data: supplement, error } = await supabaseAdmin
      .from('job_contract_supplements')
      .insert({
        job_id: jobId,
        job_contract_id: jobContractId,
        amount,
        supplement_for: supplementFor,
        created_by: authResult.requester.profile.id,
      })
      .select('id, job_id, job_contract_id, amount, supplement_for, created_at, created_by')
      .single()

    if (error || !supplement) {
      return NextResponse.json(
        { error: error?.message ?? 'Could not create supplement.' },
        { status: 400 }
      )
    }

    await syncJobFinancialCache(jobId)

    return NextResponse.json({
      supplement,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Could not create supplement.',
      },
      { status: 400 }
    )
  }
}
