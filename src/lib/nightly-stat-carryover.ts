import {
  NIGHTLY_STAT_FIELDS,
  type NightlyStatField,
  type NightlyStatInputValues,
} from '@/lib/nightly-stat-inputs'

type NightlyStatRowLike = Partial<Record<NightlyStatField, number | null>>

export function isMondayDateString(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`)

  if (Number.isNaN(date.getTime())) {
    return false
  }

  return date.getDay() === 1
}

export function getPreviousDateString(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, (month || 1) - 1, day || 1)
  date.setDate(date.getDate() - 1)

  const previousYear = date.getFullYear()
  const previousMonth = `${date.getMonth() + 1}`.padStart(2, '0')
  const previousDay = `${date.getDate()}`.padStart(2, '0')

  return `${previousYear}-${previousMonth}-${previousDay}`
}

export function toNightlyStatInputValues(
  row: NightlyStatRowLike | null | undefined
): NightlyStatInputValues {
  const values = {} as NightlyStatInputValues

  for (const field of NIGHTLY_STAT_FIELDS) {
    values[field] = row?.[field] === null || row?.[field] === undefined ? '' : String(row[field])
  }

  return values
}
