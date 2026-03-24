import 'server-only'

import {
  calculateJobPaymentSummary,
  toMoneyAmount,
  type JobPaymentRecord,
} from '@/lib/job-payments'
import { supabaseAdmin } from '@/lib/supabase-admin'

type JobFinancialRow = {
  contract_amount: number | null
  supplemented_amount: number | null
  deposit_collected: number | null
  remaining_balance: number | null
}

export const JOB_PAYMENT_SELECT_FIELDS = `
  id,
  job_id,
  amount,
  payment_type,
  payment_date,
  check_number,
  note,
  proof_file_name,
  proof_file_path,
  created_at,
  created_by
`

export function isMissingJobPaymentsTableError(error: { message?: string } | null | undefined) {
  return /relation .*job_payments.* does not exist/i.test(error?.message ?? '')
}

async function loadJobFinancialRow(jobId: string) {
  const { data, error } = await supabaseAdmin
    .from('jobs')
    .select(
      'contract_amount, supplemented_amount, deposit_collected, remaining_balance'
    )
    .eq('id', jobId)
    .maybeSingle()

  if (error || !data) {
    throw new Error(error?.message || 'Job not found.')
  }

  return data as JobFinancialRow
}

async function loadJobPaymentRowsInternal(jobId: string) {
  const { data, error } = await supabaseAdmin
    .from('job_payments')
    .select(JOB_PAYMENT_SELECT_FIELDS)
    .eq('job_id', jobId)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    if (isMissingJobPaymentsTableError(error)) {
      return {
        payments: [] as JobPaymentRecord[],
        missingTable: true,
      }
    }

    throw new Error(error.message)
  }

  return {
    payments: (data ?? []) as JobPaymentRecord[],
    missingTable: false,
  }
}

export async function loadJobPaymentsData(jobId: string) {
  const job = await loadJobFinancialRow(jobId)
  const { payments, missingTable } = await loadJobPaymentRowsInternal(jobId)
  const totalPaid = missingTable
    ? toMoneyAmount(job.deposit_collected)
    : payments.reduce((sum, payment) => sum + toMoneyAmount(payment.amount), 0)

  return {
    payments,
    summary: calculateJobPaymentSummary({
      contractAmount: job.contract_amount,
      supplementedAmount: job.supplemented_amount,
      totalPaid,
    }),
    missingTable,
  }
}

export async function syncJobFinancialTotals(jobId: string) {
  const { summary } = await loadJobPaymentsData(jobId)

  const { error } = await supabaseAdmin
    .from('jobs')
    .update({
      deposit_collected: summary.totalPaid,
      remaining_balance: summary.remainingBalance,
    })
    .eq('id', jobId)

  if (error) {
    throw new Error(error.message)
  }

  return summary
}
