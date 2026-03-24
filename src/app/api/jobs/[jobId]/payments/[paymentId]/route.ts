import { NextRequest, NextResponse } from 'next/server'
import {
  isMissingJobPaymentsTableError,
  syncJobFinancialTotals,
} from '@/lib/job-payments-server'
import {
  getRouteRequester,
  requireExistingJob,
  requireJobAccess,
} from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

type RouteContext = {
  params: Promise<{
    jobId: string
    paymentId: string
  }>
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const { jobId, paymentId } = await context.params
  const existingJobResult = await requireExistingJob(jobId)

  if ('response' in existingJobResult) {
    return existingJobResult.response
  }

  const accessError = await requireJobAccess(authResult.requester, jobId)

  if (accessError) {
    return accessError
  }

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from('job_payments')
    .select('id, job_id, proof_file_path')
    .eq('id', paymentId)
    .maybeSingle()

  if (paymentError) {
    return NextResponse.json(
      {
        error: isMissingJobPaymentsTableError(paymentError)
          ? 'Run the latest Supabase migration before using job payments.'
          : paymentError.message,
      },
      { status: 400 }
    )
  }

  if (!payment || payment.job_id !== jobId) {
    return NextResponse.json({ error: 'Payment not found.' }, { status: 404 })
  }

  const { error: deleteError } = await supabaseAdmin
    .from('job_payments')
    .delete()
    .eq('id', paymentId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 })
  }

  if (payment.proof_file_path) {
    await supabaseAdmin.storage.from('job-files').remove([payment.proof_file_path])
  }

  try {
    const summary = await syncJobFinancialTotals(jobId)

    return NextResponse.json({
      success: true,
      summary,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Could not recalculate job totals.',
      },
      { status: 400 }
    )
  }
}
