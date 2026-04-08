export const CONTRACT_TRADE_OPTIONS = [
  'Roof',
  'Gutters',
  'Fascia',
  'Siding & Shutters',
  'Windows & Doors',
  'Interior',
  'Crawlspace',
  'Flooring',
  'Decks',
  'Misc/other',
] as const

export type ContractTradeOption = (typeof CONTRACT_TRADE_OPTIONS)[number]

export type JobContractRecord = {
  id: string
  job_id: string
  trades_included: string[]
  trade_other_detail: string | null
  contract_amount: number
  date_signed: string
  created_at: string
  created_by: string | null
}

export type JobContractSupplementRecord = {
  id: string
  job_id: string
  job_contract_id: string
  amount: number
  supplement_for: string
  created_at: string
  created_by: string | null
}

export type JobContractSummary = {
  totalContractAmount: number
  totalSupplementAmount: number
}

export function normalizeTradeValues(values: unknown): string[] {
  if (!Array.isArray(values)) return []

  return [
    ...new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter((value) => CONTRACT_TRADE_OPTIONS.includes(value as ContractTradeOption))
    ),
  ]
}
