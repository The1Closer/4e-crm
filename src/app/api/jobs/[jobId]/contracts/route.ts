import { NextRequest, NextResponse } from 'next/server'
import { normalizeTradeValues } from '@/lib/job-contracts'
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

function normalizeDate(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeNumber(value: unknown) {
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

  const [contractsRes, supplementsRes] = await Promise.all([
    supabaseAdmin
      .from('job_contracts')
      .select(
        'id, job_id, trades_included, trade_other_detail, contract_amount, date_signed, created_at, created_by'
      )
      .eq('job_id', jobId)
      .order('date_signed', { ascending: false })
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('job_contract_supplements')
      .select('id, job_contract_id, amount')
      .eq('job_id', jobId),
  ])

  if (contractsRes.error) {
    return NextResponse.json({ error: contractsRes.error.message }, { status: 400 })
  }

  if (supplementsRes.error) {
    return NextResponse.json({ error: supplementsRes.error.message }, { status: 400 })
  }

  const supplements = supplementsRes.data ?? []
  const supplementByContract = supplements.reduce<Record<string, number>>((acc, row) => {
    const current = Number(acc[row.job_contract_id] ?? 0)
    acc[row.job_contract_id] = current + Number(row.amount ?? 0)
    return acc
  }, {})

  return NextResponse.json({
    contracts: (contractsRes.data ?? []).map((contract) => ({
      ...contract,
      supplement_total: supplementByContract[contract.id] ?? 0,
    })),
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
      trades_included?: unknown
      trade_other_detail?: unknown
      contract_amount?: unknown
      date_signed?: unknown
    }

    const tradesIncluded = normalizeTradeValues(body.trades_included)
    const tradeOtherDetail = normalizeText(body.trade_other_detail)
    const contractAmount = normalizeNumber(body.contract_amount)
    const dateSigned = normalizeDate(body.date_signed)

    if (tradesIncluded.length === 0) {
      return NextResponse.json(
        { error: 'Select at least one trade for the contract.' },
        { status: 400 }
      )
    }

    if (tradesIncluded.includes('Misc/other') && !tradeOtherDetail) {
      return NextResponse.json(
        { error: 'Specify the Misc/other trade details.' },
        { status: 400 }
      )
    }

    if (contractAmount === null || contractAmount <= 0) {
      return NextResponse.json(
        { error: 'Contract amount must be greater than zero.' },
        { status: 400 }
      )
    }

    if (!dateSigned) {
      return NextResponse.json({ error: 'Date signed is required.' }, { status: 400 })
    }

    const { data: contract, error } = await supabaseAdmin
      .from('job_contracts')
      .insert({
        job_id: jobId,
        trades_included: tradesIncluded,
        trade_other_detail: tradesIncluded.includes('Misc/other') ? tradeOtherDetail : null,
        contract_amount: contractAmount,
        date_signed: dateSigned,
        created_by: authResult.requester.profile.id,
      })
      .select(
        'id, job_id, trades_included, trade_other_detail, contract_amount, date_signed, created_at, created_by'
      )
      .single()

    if (error || !contract) {
      return NextResponse.json(
        { error: error?.message ?? 'Could not create contract.' },
        { status: 400 }
      )
    }

    await syncJobFinancialCache(jobId)

    return NextResponse.json({ contract })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Could not create contract.',
      },
      { status: 400 }
    )
  }
}
