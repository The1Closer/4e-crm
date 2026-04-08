import 'server-only'

import { toMoneyAmount } from '@/lib/job-payments'
import { supabaseAdmin } from '@/lib/supabase-admin'

export type JobFinancialSnapshot = {
  contractAmount: number
  supplementedAmount: number
  totalDue: number
  totalPaid: number
  remainingBalance: number
  latestContractSignedDate: string | null
}

function buildSnapshot(params: {
  contractAmount: number
  supplementedAmount: number
  totalPaid: number
  latestContractSignedDate: string | null
}): JobFinancialSnapshot {
  const contractAmount = toMoneyAmount(params.contractAmount)
  const supplementedAmount = toMoneyAmount(params.supplementedAmount)
  const totalPaid = toMoneyAmount(params.totalPaid)
  const totalDue = contractAmount + supplementedAmount

  return {
    contractAmount,
    supplementedAmount,
    totalDue,
    totalPaid,
    remainingBalance: totalDue - totalPaid,
    latestContractSignedDate: params.latestContractSignedDate,
  }
}

export async function calculateJobFinancialSnapshot(jobId: string) {
  const [contractsRes, supplementsRes, paymentsRes] = await Promise.all([
    supabaseAdmin
      .from('job_contracts')
      .select('contract_amount, date_signed')
      .eq('job_id', jobId),
    supabaseAdmin
      .from('job_contract_supplements')
      .select('amount')
      .eq('job_id', jobId),
    supabaseAdmin
      .from('job_payments')
      .select('amount')
      .eq('job_id', jobId),
  ])

  if (contractsRes.error) {
    throw new Error(contractsRes.error.message)
  }

  if (supplementsRes.error) {
    throw new Error(supplementsRes.error.message)
  }

  if (paymentsRes.error) {
    throw new Error(paymentsRes.error.message)
  }

  const contracts = contractsRes.data ?? []
  const supplements = supplementsRes.data ?? []
  const payments = paymentsRes.data ?? []
  const latestContractSignedDate =
    contracts
      .map((row) => row.date_signed)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => (a < b ? 1 : -1))[0] ?? null

  return buildSnapshot({
    contractAmount: contracts.reduce(
      (sum, row) => sum + toMoneyAmount(row.contract_amount),
      0
    ),
    supplementedAmount: supplements.reduce(
      (sum, row) => sum + toMoneyAmount(row.amount),
      0
    ),
    totalPaid: payments.reduce((sum, row) => sum + toMoneyAmount(row.amount), 0),
    latestContractSignedDate,
  })
}

export async function syncJobFinancialCache(jobId: string) {
  const snapshot = await calculateJobFinancialSnapshot(jobId)

  const { error } = await supabaseAdmin
    .from('jobs')
    .update({
      contract_amount: snapshot.contractAmount,
      supplemented_amount: snapshot.supplementedAmount,
      contract_signed_date: snapshot.latestContractSignedDate,
      deposit_collected: snapshot.totalPaid,
      remaining_balance: snapshot.remainingBalance,
    })
    .eq('id', jobId)

  if (error) {
    throw new Error(error.message)
  }

  return snapshot
}
