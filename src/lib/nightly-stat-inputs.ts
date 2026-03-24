export const NIGHTLY_STAT_FIELDS = [
  'knocks',
  'talks',
  'inspections',
  'contingencies',
  'contracts_with_deposit',
  'revenue_signed',
] as const

export type NightlyStatField = (typeof NIGHTLY_STAT_FIELDS)[number]

export type NightlyStatInputValues = Record<NightlyStatField, string>
export type ParsedNightlyStatValues = Record<NightlyStatField, number>

export const NIGHTLY_STAT_LABELS: Record<NightlyStatField, string> = {
  knocks: 'Knocks',
  talks: 'Talks',
  inspections: 'Inspections',
  contingencies: 'Contingencies',
  contracts_with_deposit: 'Contracts',
  revenue_signed: 'Revenue',
}

const HALF_STEP_FIELDS = new Set<NightlyStatField>([
  'inspections',
  'contingencies',
  'contracts_with_deposit',
])

const DECIMAL_INPUT_PATTERN = /^(?:\d+|\d*\.\d+)$/

export function getNightlyStatInputMode(field: NightlyStatField): 'numeric' | 'decimal' {
  return field === 'revenue_signed' || HALF_STEP_FIELDS.has(field) ? 'decimal' : 'numeric'
}

export function parseNightlyStatInputs(values: NightlyStatInputValues): {
  error: string | null
  values: ParsedNightlyStatValues | null
} {
  const parsedValues = {} as ParsedNightlyStatValues

  for (const field of NIGHTLY_STAT_FIELDS) {
    const parsedValue = parseNightlyStatValue(field, values[field])

    if (parsedValue === null) {
      return {
        error: getNightlyStatValidationMessage(field),
        values: null,
      }
    }

    parsedValues[field] = parsedValue
  }

  return {
    error: null,
    values: parsedValues,
  }
}

function parseNightlyStatValue(field: NightlyStatField, rawValue: string) {
  const trimmedValue = rawValue.trim()

  if (!trimmedValue) {
    return 0
  }

  if (!DECIMAL_INPUT_PATTERN.test(trimmedValue)) {
    return null
  }

  const parsedValue = Number(trimmedValue)

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return null
  }

  if (field === 'revenue_signed') {
    return parsedValue
  }

  if (HALF_STEP_FIELDS.has(field)) {
    return Number.isInteger(parsedValue * 2) ? parsedValue : null
  }

  return Number.isInteger(parsedValue) ? parsedValue : null
}

function getNightlyStatValidationMessage(field: NightlyStatField) {
  const label = NIGHTLY_STAT_LABELS[field]

  if (field === 'revenue_signed') {
    return `${label} must be a valid number.`
  }

  if (HALF_STEP_FIELDS.has(field)) {
    return `${label} must be a whole number or .5 for split deals.`
  }

  return `${label} must be a whole number.`
}
