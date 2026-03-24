export type JobPaymentRecord = {
  id: string
  job_id: string
  amount: number
  payment_type: string
  payment_date: string
  check_number: string | null
  note: string | null
  proof_file_name: string | null
  proof_file_path: string | null
  created_at: string
  created_by: string | null
}

export type JobPaymentSummary = {
  contractAmount: number
  supplementedAmount: number
  totalDue: number
  totalPaid: number
  remainingBalance: number
}

export function toMoneyAmount(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return 0
  }

  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function calculateJobPaymentSummary(params: {
  contractAmount: number | string | null | undefined
  supplementedAmount: number | string | null | undefined
  totalPaid: number | string | null | undefined
}): JobPaymentSummary {
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
  }
}

export function getTodayDateInputValue() {
  const now = new Date()
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 10)
}
