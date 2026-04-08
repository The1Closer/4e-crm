import 'server-only'

import {
  calculateJobPaymentSummary,
  toMoneyAmount,
  type JobPaymentRecord,
} from '@/lib/job-payments'
import {
  calculateJobFinancialSnapshot,
  syncJobFinancialCache,
} from '@/lib/job-financials-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export type JobContractOptionRecord = {
  id: string
  contract_amount: number
  date_signed: string
  trades_included: string[]
}

export const JOB_PAYMENT_SELECT_FIELDS = `
  id,
  job_id,
  job_contract_id,
  amount,
  payment_type,
  payment_type_other_detail,
  payment_method,
  payment_method_other_detail,
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

async function loadJobContractOptionsInternal(jobId: string) {
  const { data, error } = await supabaseAdmin
    .from('job_contracts')
    .select('id, contract_amount, date_signed, trades_included')
    .eq('job_id', jobId)
    .order('date_signed', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as JobContractOptionRecord[]
}

export async function loadJobPaymentsData(jobId: string) {
  const [financialSnapshot, { payments, missingTable }, contracts] = await Promise.all([
    calculateJobFinancialSnapshot(jobId),
    loadJobPaymentRowsInternal(jobId),
    loadJobContractOptionsInternal(jobId),
  ])
  const totalPaid = missingTable
    ? toMoneyAmount(financialSnapshot.totalPaid)
    : payments.reduce((sum, payment) => sum + toMoneyAmount(payment.amount), 0)

  return {
    payments,
    contracts,
    summary: calculateJobPaymentSummary({
      contractAmount: financialSnapshot.contractAmount,
      supplementedAmount: financialSnapshot.supplementedAmount,
      totalPaid,
    }),
    missingTable,
  }
}

export async function syncJobFinancialTotals(jobId: string) {
  const snapshot = await syncJobFinancialCache(jobId)

  return calculateJobPaymentSummary({
    contractAmount: snapshot.contractAmount,
    supplementedAmount: snapshot.supplementedAmount,
    totalPaid: snapshot.totalPaid,
  })
}
