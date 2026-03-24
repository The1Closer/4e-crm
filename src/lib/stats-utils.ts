export type RepDailyStat = {
  rep_id: string
  report_date: string
  knocks: number
  talks: number
  inspections: number
  contingencies: number
  contracts_with_deposit: number
  revenue_signed: number
}

export type RepSummary = {
  repId: string
  repName: string
  knocks: number
  talks: number
  inspections: number
  contingencies: number
  contracts_with_deposit: number
  revenue_signed: number
}

export function getMonthRange() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)

  const fmt = (d: Date) => {
    const y = d.getFullYear()
    const m = `${d.getMonth() + 1}`.padStart(2, '0')
    const day = `${d.getDate()}`.padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  return {
    start: fmt(start),
    end: fmt(end),
    currentDay: now.getDate(),
    daysInMonth: end.getDate(),
  }
}

export function projectMonthEnd(value: number, currentDay: number, daysInMonth: number) {
  if (!currentDay || currentDay <= 0) return 0
  return Math.round((value / currentDay) * daysInMonth)
}

export function buildRepSummaries(params: {
  stats: RepDailyStat[]
  profiles: Array<{ id: string; full_name: string }>
}) {
  const { stats, profiles } = params

  const byRep: Record<string, RepSummary> = {}

  stats.forEach((row) => {
    const rep = profiles.find((p) => p.id === row.rep_id)
    const repName = rep?.full_name ?? 'Unknown Rep'

    if (!byRep[row.rep_id]) {
      byRep[row.rep_id] = {
        repId: row.rep_id,
        repName,
        knocks: 0,
        talks: 0,
        inspections: 0,
        contingencies: 0,
        contracts_with_deposit: 0,
        revenue_signed: 0,
      }
    }

    byRep[row.rep_id].knocks += Number(row.knocks ?? 0)
    byRep[row.rep_id].talks += Number(row.talks ?? 0)
    byRep[row.rep_id].inspections += Number(row.inspections ?? 0)
    byRep[row.rep_id].contingencies += Number(row.contingencies ?? 0)
    byRep[row.rep_id].contracts_with_deposit += Number(row.contracts_with_deposit ?? 0)
    byRep[row.rep_id].revenue_signed += Number(row.revenue_signed ?? 0)
  })

  return Object.values(byRep)
}

export function buildTotals(repSummaries: RepSummary[]) {
  return repSummaries.reduce(
    (acc, rep) => {
      acc.knocks += rep.knocks
      acc.talks += rep.talks
      acc.inspections += rep.inspections
      acc.contingencies += rep.contingencies
      acc.contracts_with_deposit += rep.contracts_with_deposit
      acc.revenue_signed += rep.revenue_signed
      return acc
    },
    {
      knocks: 0,
      talks: 0,
      inspections: 0,
      contingencies: 0,
      contracts_with_deposit: 0,
      revenue_signed: 0,
    }
  )
}

export function safePercent(top: number, bottom: number) {
  if (!bottom) return 0
  return Math.round((top / bottom) * 100)
}
