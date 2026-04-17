import { supabase } from '@/lib/supabase'
import { isManagerLike } from '@/lib/auth-helpers'
import { isDeadStageName } from '@/lib/job-stage-access'
import {
  isIncludedInNightlyNumbers,
  isMissingNightlyNumbersColumnError,
  ROSTER_PROFILE_SELECT_FIELDS,
  ROSTER_PROFILE_SELECT_WITH_NIGHTLY_FIELDS,
} from '@/lib/nightly-numbers'
import {
  buildRepSummaries,
  buildTotals,
  safePercent,
  type RepDailyStat,
} from '@/lib/stats-utils'

export type DashboardScope = 'branch' | 'team' | 'individual'

export type DashboardFilters = {
  startDate: string
  endDate: string
  selectedRepId?: string
}

export type DashboardRecentJob = {
  id: string
  homeowner_name: string | null
  address: string | null
  contract_amount: number | null
  stage_name: string | null
}

export type DashboardAlertItem = {
  id: string
  title: string
  body: string
  tone: 'gold' | 'blue' | 'red'
}

type ProfileRow = {
  id: string
  full_name: string
  role: string | null
  manager_id: string | null
  is_active?: boolean | null
  include_in_nightly_numbers?: boolean | null
}

type JobRepLinkRow = {
  job_id: string
  profile_id: string
}

type JobRow = {
  id: string
  insurance_carrier: string | null
  type_of_loss: string | null
  install_date: string | null
  contract_signed_date: string | null
  contract_amount: number | null
  updated_at: string | null
  homeowners:
  | {
    name: string | null
    address: string | null
  }
  | {
    name: string | null
    address: string | null
  }[]
  | null
  pipeline_stages:
  | {
    id: number
    name: string | null
    sort_order: number | null
  }
  | {
    id: number
    name: string | null
    sort_order: number | null
  }[]
  | null
}

export type DashboardDataset = {
  repOptions: { id: string; full_name: string }[]
  accessibleRepIds: string[]
  totals: ReturnType<typeof buildTotals>
  repSummaries: ReturnType<typeof buildRepSummaries>
  missingToday: string[]
  pipelineCounts: Record<string, number>
  revenueSeries: { label: string; value: number }[]
  funnel: {
    knocks: number
    talks: number
    inspections: number
    contingencies: number
    contracts: number
  }
  projection: {
    contingencies: number
    contracts: number
    revenue: number
  }
  recentJobs: DashboardRecentJob[]
  alertFeed: DashboardAlertItem[]
}

function normalizeStage(
  stage: JobRow['pipeline_stages']
): { id: number; name: string | null; sort_order: number | null } | null {
  if (!stage) return null
  return Array.isArray(stage) ? stage[0] ?? null : stage
}

function normalizeHomeowner(
  homeowner: JobRow['homeowners']
): { name: string | null; address: string | null } | null {
  if (!homeowner) return null
  return Array.isArray(homeowner) ? homeowner[0] ?? null : homeowner
}

function getTodayLocalDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getWorkingDaysInMonth(year: number, monthIndex: number) {
  let total = 0

  const date = new Date(year, monthIndex, 1)
  while (date.getMonth() === monthIndex) {
    const day = date.getDay()
    if (day !== 0) total += 1
    date.setDate(date.getDate() + 1)
  }

  return total
}

function getWorkingDaysElapsedInMonth(year: number, monthIndex: number, dayOfMonth: number) {
  let total = 0

  for (let day = 1; day <= dayOfMonth; day += 1) {
    const date = new Date(year, monthIndex, day)
    if (date.getDay() !== 0) total += 1
  }

  return total
}

function projectMonthEnd(total: number, referenceDate: string) {
  const date = new Date(`${referenceDate}T12:00:00`)
  const year = date.getFullYear()
  const monthIndex = date.getMonth()
  const dayOfMonth = date.getDate()

  const elapsed = getWorkingDaysElapsedInMonth(year, monthIndex, dayOfMonth)
  const totalWorkingDays = getWorkingDaysInMonth(year, monthIndex)

  if (elapsed <= 0) return 0

  return Math.round((total / elapsed) * totalWorkingDays)
}

function sumField(rows: RepDailyStat[], field: keyof RepDailyStat) {
  return rows.reduce((acc, row) => acc + Number(row[field] || 0), 0)
}

export async function loadDashboardDataset({
  scope,
  profile,
  filters,
}: {
  scope: DashboardScope
  profile: { id: string; role?: string | null } | null
  filters: DashboardFilters
}): Promise<DashboardDataset> {
  let repRows: ProfileRow[] = []

  async function fetchNightlyRoster(
    filters: {
      managerId?: string
      profileId?: string
    } = {}
  ) {
    let query = supabase
      .from('profiles')
      .select(ROSTER_PROFILE_SELECT_WITH_NIGHTLY_FIELDS)

    if (filters.profileId) {
      query = query.eq('id', filters.profileId).limit(1)
    } else {
      query = query.eq('is_active', true).order('full_name', { ascending: true })
    }

    if (filters.managerId) {
      query = query.eq('manager_id', filters.managerId)
    }

    let { data, error } = await query

    if (error && isMissingNightlyNumbersColumnError(error)) {
      let fallbackQuery = supabase
        .from('profiles')
        .select(ROSTER_PROFILE_SELECT_FIELDS)

      if (filters.profileId) {
        fallbackQuery = fallbackQuery.eq('id', filters.profileId).limit(1)
      } else {
        fallbackQuery = fallbackQuery.eq('is_active', true).order('full_name', {
          ascending: true,
        })
      }

      if (filters.managerId) {
        fallbackQuery = fallbackQuery.eq('manager_id', filters.managerId)
      }

      const fallbackResult = await fallbackQuery
      data = fallbackResult.data as typeof data
      error = fallbackResult.error
    }

    return { data, error }
  }

  if (scope === 'branch') {
    const { data } = await fetchNightlyRoster()

    repRows = ((data ?? []) as ProfileRow[]).filter(isIncludedInNightlyNumbers)
  }

  if (scope === 'team') {
    if (!isManagerLike(profile?.role)) {
      repRows = []
    } else {
      const { data } = await fetchNightlyRoster({
        managerId: profile?.id ?? '',
      })

      repRows = ((data ?? []) as ProfileRow[]).filter(isIncludedInNightlyNumbers)
    }
  }

  if (scope === 'individual') {
    if (profile?.id) {
      const { data } = await fetchNightlyRoster({
        profileId: profile.id,
      })

      repRows = (data ?? []) as ProfileRow[]
    } else {
      repRows = []
    }
  }

  const baseRepOptions = repRows.map((rep) => ({
    id: rep.id,
    full_name: rep.full_name,
  }))

  const activeRepIds =
    filters.selectedRepId && (scope === 'branch' || scope === 'team')
      ? [filters.selectedRepId]
      : repRows.map((rep) => rep.id)

  const statsQuery = supabase
    .from('rep_daily_stats')
    .select(`
      rep_id,
      report_date,
      knocks,
      talks,
      inspections,
      contingencies,
      contracts_with_deposit,
      revenue_signed
    `)
    .gte('report_date', filters.startDate)
    .lte('report_date', filters.endDate)

  const { data: statsData } =
    activeRepIds.length > 0
      ? await statsQuery.in('rep_id', activeRepIds)
      : await Promise.resolve({ data: [] as RepDailyStat[] })

  const stats = (statsData ?? []) as RepDailyStat[]

  const repSummaries = buildRepSummaries({
    stats,
    profiles: repRows.map((p) => ({ id: p.id, full_name: p.full_name })),
  }).sort((a, b) => b.revenue_signed - a.revenue_signed)

  const totals = buildTotals(repSummaries)

  const today = getTodayLocalDate()
  const missingToday =
    scope === 'individual'
      ? []
      : repRows
        .filter((rep) => !stats.some((row) => row.report_date === today && row.rep_id === rep.id))
        .map((rep) => rep.full_name)

  const { data: jobsData } = await supabase
    .from('jobs')
    .select(`
      id,
      insurance_carrier,
      type_of_loss,
      install_date,
      contract_signed_date,
      contract_amount,
      updated_at,
      homeowners (
        name,
        address
      ),
      pipeline_stages (
        id,
        name,
        sort_order
      )
    `)

  let jobs = (jobsData ?? []) as JobRow[]

  if (activeRepIds.length > 0) {
    const { data: jobRepRows } = await supabase
      .from('job_reps')
      .select('job_id, profile_id')
      .in('profile_id', activeRepIds)

    const allowedJobIds = new Set(
      ((jobRepRows ?? []) as JobRepLinkRow[]).map((row) => row.job_id)
    )
    if (scope !== 'branch' || filters.selectedRepId) {
      jobs = jobs.filter((job) => allowedJobIds.has(job.id))
    }
  } else if (scope === 'team' || scope === 'individual') {
    jobs = []
  }

  const pipelineCounts: Record<string, number> = {}
  jobs.forEach((job) => {
    const stage = normalizeStage(job.pipeline_stages)
    const name = stage?.name ?? 'No Stage'
    if (isDeadStageName(name)) return
    pipelineCounts[name] = (pipelineCounts[name] ?? 0) + 1
  })

  const revenueByDay = new Map<string, number>()
  stats.forEach((row) => {
    const current = revenueByDay.get(row.report_date) ?? 0
    revenueByDay.set(row.report_date, current + Number(row.revenue_signed || 0))
  })

  const revenueSeries = Array.from(revenueByDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, value]) => ({
      label: label.slice(5),
      value,
    }))

  const funnel = {
    knocks: sumField(stats, 'knocks'),
    talks: sumField(stats, 'talks'),
    inspections: sumField(stats, 'inspections'),
    contingencies: sumField(stats, 'contingencies'),
    contracts: sumField(stats, 'contracts_with_deposit'),
  }

  const projection = {
    contingencies: projectMonthEnd(totals.contingencies, filters.endDate),
    contracts: projectMonthEnd(totals.contracts_with_deposit, filters.endDate),
    revenue: projectMonthEnd(totals.revenue_signed, filters.endDate),
  }

  const recentJobs = [...jobs]
    .sort((a, b) => {
      const aTime = new Date(a.updated_at ?? 0).getTime()
      const bTime = new Date(b.updated_at ?? 0).getTime()
      return bTime - aTime
    })
    .slice(0, 6)
    .map((job) => {
      const homeowner = normalizeHomeowner(job.homeowners)
      const stage = normalizeStage(job.pipeline_stages)

      return {
        id: job.id,
        homeowner_name: homeowner?.name ?? null,
        address: homeowner?.address ?? null,
        contract_amount: job.contract_amount ?? null,
        stage_name: stage?.name ?? null,
      }
    })

  const alertFeed: DashboardAlertItem[] = []

  if (missingToday.length > 0) {
    alertFeed.push({
      id: 'missing-today',
      title: 'Missing nightly reports',
      body: `${missingToday.length} team member(s) still have not submitted today.`,
      tone: 'red',
    })
  }

  if ((pipelineCounts['No Stage'] ?? 0) > 0) {
    alertFeed.push({
      id: 'no-stage',
      title: 'Jobs missing a stage',
      body: `${pipelineCounts['No Stage']} job(s) need a clean pipeline stage assignment.`,
      tone: 'gold',
    })
  }

  if (totals.contingencies > 0 && totals.contracts_with_deposit === 0) {
    alertFeed.push({
      id: 'contracts-trailing',
      title: 'Contracts are trailing contingencies',
      body: 'There is contingency volume in play but no matching contract conversions yet.',
      tone: 'blue',
    })
  }

  if (alertFeed.length === 0) {
    alertFeed.push({
      id: 'stable-board',
      title: 'Board looks clean',
      body: 'No immediate branch-wide alerts are surfacing from the current dataset.',
      tone: 'blue',
    })
  }

  return {
    repOptions: baseRepOptions,
    accessibleRepIds: activeRepIds,
    totals,
    repSummaries,
    missingToday,
    pipelineCounts,
    revenueSeries,
    funnel,
    projection,
    recentJobs,
    alertFeed,
  }
}

export function buildSmartInsights(dataset: DashboardDataset) {
  const insights: string[] = []

  const talkRate = safePercent(dataset.funnel.talks, dataset.funnel.knocks)
  const inspectionRate = safePercent(dataset.funnel.inspections, dataset.funnel.talks)
  const closeRate = safePercent(dataset.funnel.contracts, dataset.funnel.contingencies)

  if (dataset.funnel.knocks > 0 && talkRate < 25) {
    insights.push('Talk rate is low. Focus on opening stronger and stopping fewer doors from brushing you off.')
  }

  if (dataset.funnel.talks > 0 && inspectionRate < 35) {
    insights.push('Inspection conversion is soft. Tighten the transition from conversation to inspection.')
  }

  if (dataset.funnel.contingencies > 0 && closeRate < 45) {
    insights.push('Close rate is trailing. More follow-up and tighter commitment language could help.')
  }

  if (dataset.projection.revenue > dataset.totals.revenue_signed) {
    insights.push(`Current pace projects to $${dataset.projection.revenue.toLocaleString()} this month if momentum holds.`)
  }

  if (dataset.missingToday.length > 0) {
    insights.push(`${dataset.missingToday.length} team member(s) are still missing nightly numbers today.`)
  }

  if (insights.length === 0) {
    insights.push('Numbers look stable. Keep pressure on activity and consistency.')
  }

  return insights
}
