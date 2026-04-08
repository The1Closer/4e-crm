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
    contractId: string
  }>
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const { jobId, contractId } = await context.params
  const existingJobResult = await requireExistingJob(jobId)

  if ('response' in existingJobResult) {
    return existingJobResult.response
  }

  const accessError = await requireJobAccess(authResult.requester, jobId)

  if (accessError) {
    return accessError
  }

  const [supplementsRes, paymentsRes] = await Promise.all([
    supabaseAdmin
      .from('job_contract_supplements')
      .select('id')
      .eq('job_id', jobId)
      .eq('job_contract_id', contractId)
      .limit(1),
    supabaseAdmin
      .from('job_payments')
      .select('id')
      .eq('job_id', jobId)
      .eq('job_contract_id', contractId)
      .limit(1),
  ])

  if (supplementsRes.error) {
    return NextResponse.json({ error: supplementsRes.error.message }, { status: 400 })
  }

  if (paymentsRes.error) {
    return NextResponse.json({ error: paymentsRes.error.message }, { status: 400 })
  }

  if ((supplementsRes.data ?? []).length > 0 || (paymentsRes.data ?? []).length > 0) {
    return NextResponse.json(
      {
        error:
          'This contract has supplements or payments and cannot be deleted. Remove linked records first.',
      },
      { status: 400 }
    )
  }

  const { data: contract, error: contractError } = await supabaseAdmin
    .from('job_contracts')
    .select('id, job_id')
    .eq('id', contractId)
    .maybeSingle()

  if (contractError) {
    return NextResponse.json({ error: contractError.message }, { status: 400 })
  }

  if (!contract || contract.job_id !== jobId) {
    return NextResponse.json({ error: 'Contract not found.' }, { status: 404 })
  }

  const { error: deleteError } = await supabaseAdmin
    .from('job_contracts')
    .delete()
    .eq('id', contractId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 })
  }

  try {
    await syncJobFinancialCache(jobId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Contract deleted but totals could not be recalculated.',
      },
      { status: 400 }
    )
  }
}
