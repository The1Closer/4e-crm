'use client'

import { useEffect, useMemo, useState } from 'react'
import ManagerOnlyRoute from '@/components/ManagerOnlyRoute'
import {
  isIncludedInNightlyNumbers,
  isMissingNightlyNumbersColumnError,
  ROSTER_PROFILE_SELECT_FIELDS,
  ROSTER_PROFILE_SELECT_WITH_NIGHTLY_FIELDS,
} from '@/lib/nightly-numbers'
import { supabase } from '@/lib/supabase'
import { getCurrentUserProfile } from '@/lib/auth-helpers'

type Profile = {
  id: string
  full_name: string
  role: string | null
  manager_id: string | null
  is_active?: boolean | null
  include_in_nightly_numbers?: boolean | null
}

type StatRow = {
  rep_id: string
  report_date: string
  knocks: number
  talks: number
  walks: number
  inspections: number
  contingencies: number
  contracts_with_deposit: number
  revenue_signed: number
}

type EditableRow = {
  rep_id: string
  rep_name: string
  knocks: string
  talks: string
  walks: string
  inspections: string
  contingencies: string
  contracts_with_deposit: string
  revenue_signed: string
}

type Totals = {
  knocks: number
  talks: number
  walks: number
  inspections: number
  contingencies: number
  contracts_with_deposit: number
  revenue_signed: number
}

type MonthlySummary = Totals & {
  rep_id: string
  rep_name: string
}

const EMPTY_TOTALS: Totals = {
  knocks: 0,
  talks: 0,
  walks: 0,
  inspections: 0,
  contingencies: 0,
  contracts_with_deposit: 0,
  revenue_signed: 0,
}

function getTodayLocalDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getMonthStart(dateString: string) {
  const [year, month] = dateString.split('-').map(Number)
  return `${year}-${String(month).padStart(2, '0')}-01`
}

function getWorkingDaysInMonth(year: number, monthIndex: number) {
  let total = 0

  const date = new Date(year, monthIndex, 1)
  while (date.getMonth() === monthIndex) {
    if (date.getDay() !== 0) {
      total += 1
    }

    date.setDate(date.getDate() + 1)
  }

  return total
}

function getWorkingDaysElapsedInMonth(year: number, monthIndex: number, dayOfMonth: number) {
  let total = 0

  for (let day = 1; day <= dayOfMonth; day += 1) {
    const date = new Date(year, monthIndex, day)

    if (date.getDay() !== 0) {
      total += 1
    }
  }

  return total
}

function projectMonthValue(total: number, referenceDate: string) {
  const date = new Date(`${referenceDate}T12:00:00`)
  const year = date.getFullYear()
  const monthIndex = date.getMonth()
  const dayOfMonth = date.getDate()

  const elapsedWorkingDays = getWorkingDaysElapsedInMonth(year, monthIndex, dayOfMonth)
  const totalWorkingDays = getWorkingDaysInMonth(year, monthIndex)

  if (elapsedWorkingDays <= 0) {
    return 0
  }

  return Math.round((total / elapsedWorkingDays) * totalWorkingDays)
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function emptyRow(rep: Profile): EditableRow {
  return {
    rep_id: rep.id,
    rep_name: rep.full_name,
    knocks: '',
    talks: '',
    walks: '',
    inspections: '',
    contingencies: '',
    contracts_with_deposit: '',
    revenue_signed: '',
  }
}

function buildTotalsFromStats(rows: Array<StatRow | EditableRow>) {
  return rows.reduce<Totals>(
    (acc, row) => {
      acc.knocks += Number(row.knocks || 0)
      acc.talks += Number(row.talks || 0)
      acc.walks += Number(row.walks || 0)
      acc.inspections += Number(row.inspections || 0)
      acc.contingencies += Number(row.contingencies || 0)
      acc.contracts_with_deposit += Number(row.contracts_with_deposit || 0)
      acc.revenue_signed += Number(row.revenue_signed || 0)
      return acc
    },
    { ...EMPTY_TOTALS }
  )
}

export default function ManagerNightlyEntryPage() {
  return (
    <ManagerOnlyRoute>
      <ManagerNightlyEntryContent />
    </ManagerOnlyRoute>
  )
}

function ManagerNightlyEntryContent() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')
  const [reportDate, setReportDate] = useState(getTodayLocalDate())
  const [branchReps, setBranchReps] = useState<Profile[]>([])
  const [rows, setRows] = useState<EditableRow[]>([])
  const [viewerName, setViewerName] = useState('')
  const [dayStats, setDayStats] = useState<StatRow[]>([])
  const [monthStats, setMonthStats] = useState<StatRow[]>([])

  async function loadBranchAndStats(date: string) {
    setLoading(true)
    setMessage('')
    setMessageType('')

    const currentProfile = await getCurrentUserProfile()

    if (!currentProfile) {
      setBranchReps([])
      setRows([])
      setDayStats([])
      setMonthStats([])
      setLoading(false)
      return
    }

    setViewerName(currentProfile.full_name ?? 'Manager')

    let { data: repsData, error: repsError } = await supabase
      .from('profiles')
      .select(ROSTER_PROFILE_SELECT_WITH_NIGHTLY_FIELDS)
      .eq('is_active', true)
      .order('full_name', { ascending: true })

    if (repsError && isMissingNightlyNumbersColumnError(repsError)) {
      const fallbackResult = await supabase
        .from('profiles')
        .select(ROSTER_PROFILE_SELECT_FIELDS)
        .eq('is_active', true)
        .order('full_name', { ascending: true })

      repsData = fallbackResult.data as typeof repsData
      repsError = fallbackResult.error
    }

    if (repsError) {
      setMessageType('error')
      setMessage(repsError.message)
      setBranchReps([])
      setRows([])
      setDayStats([])
      setMonthStats([])
      setLoading(false)
      return
    }

    const reps = ((repsData ?? []) as Profile[]).filter(isIncludedInNightlyNumbers)
    setBranchReps(reps)

    if (reps.length === 0) {
      setRows([])
      setDayStats([])
      setMonthStats([])
      setLoading(false)
      return
    }

    const repIds = reps.map((rep) => rep.id)
    const monthStart = getMonthStart(date)

    const [dayStatsResult, monthStatsResult] = await Promise.all([
      supabase
        .from('rep_daily_stats')
        .select(`
          rep_id,
          report_date,
          knocks,
          talks,
          walks,
          inspections,
          contingencies,
          contracts_with_deposit,
          revenue_signed
        `)
        .eq('report_date', date)
        .in('rep_id', repIds),
      supabase
        .from('rep_daily_stats')
        .select(`
          rep_id,
          report_date,
          knocks,
          talks,
          walks,
          inspections,
          contingencies,
          contracts_with_deposit,
          revenue_signed
        `)
        .gte('report_date', monthStart)
        .lte('report_date', date)
        .in('rep_id', repIds),
    ])

    if (dayStatsResult.error) {
      setMessageType('error')
      setMessage(dayStatsResult.error.message)
      setRows(reps.map(emptyRow))
      setDayStats([])
      setMonthStats([])
      setLoading(false)
      return
    }

    if (monthStatsResult.error) {
      setMessageType('error')
      setMessage(monthStatsResult.error.message)
      setRows(reps.map(emptyRow))
      setDayStats((dayStatsResult.data ?? []) as StatRow[])
      setMonthStats([])
      setLoading(false)
      return
    }

    const nextDayStats = (dayStatsResult.data ?? []) as StatRow[]
    const nextMonthStats = (monthStatsResult.data ?? []) as StatRow[]

    const mappedRows: EditableRow[] = reps.map((rep) => {
      const existing = nextDayStats.find((row) => row.rep_id === rep.id)

      if (!existing) {
        return emptyRow(rep)
      }

      return {
        rep_id: rep.id,
        rep_name: rep.full_name,
        knocks: String(existing.knocks ?? ''),
        talks: String(existing.talks ?? ''),
        walks: String(existing.walks ?? ''),
        inspections: String(existing.inspections ?? ''),
        contingencies: String(existing.contingencies ?? ''),
        contracts_with_deposit: String(existing.contracts_with_deposit ?? ''),
        revenue_signed: String(existing.revenue_signed ?? ''),
      }
    })

    setRows(mappedRows)
    setDayStats(nextDayStats)
    setMonthStats(nextMonthStats)
    setLoading(false)
  }

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadBranchAndStats(reportDate)
    }, 0)

    return () => {
      window.clearTimeout(loadTimer)
    }
  }, [reportDate])

  function updateCell(
    repId: string,
    field: keyof Omit<EditableRow, 'rep_id' | 'rep_name'>,
    value: string
  ) {
    setRows((prev) =>
      prev.map((row) =>
        row.rep_id === repId
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    )
  }

  async function handleSaveAll() {
    setSaving(true)
    setMessage('')
    setMessageType('')

    try {
      const payload = rows.map((row) => ({
        rep_id: row.rep_id,
        report_date: reportDate,
        knocks: Number(row.knocks || 0),
        talks: Number(row.talks || 0),
        walks: Number(row.walks || 0),
        inspections: Number(row.inspections || 0),
        contingencies: Number(row.contingencies || 0),
        contracts_with_deposit: Number(row.contracts_with_deposit || 0),
        revenue_signed: Number(row.revenue_signed || 0),
      }))

      const { error } = await supabase
        .from('rep_daily_stats')
        .upsert(payload, {
          onConflict: 'rep_id,report_date',
        })

      if (error) {
        setMessageType('error')
        setMessage(error.message)
        setSaving(false)
        return
      }

      setMessageType('success')
      setMessage('Branch nightly numbers saved.')
      setSaving(false)
      await loadBranchAndStats(reportDate)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Something went wrong'
      setMessageType('error')
      setMessage(msg)
      setSaving(false)
    }
  }

  const totals = useMemo(() => buildTotalsFromStats(rows), [rows])

  const branchMonthTotals = useMemo(() => buildTotalsFromStats(monthStats), [monthStats])

  const projectedBranchTotals = useMemo<Totals>(
    () => ({
      knocks: projectMonthValue(branchMonthTotals.knocks, reportDate),
      talks: projectMonthValue(branchMonthTotals.talks, reportDate),
      walks: projectMonthValue(branchMonthTotals.walks, reportDate),
      inspections: projectMonthValue(branchMonthTotals.inspections, reportDate),
      contingencies: projectMonthValue(branchMonthTotals.contingencies, reportDate),
      contracts_with_deposit: projectMonthValue(
        branchMonthTotals.contracts_with_deposit,
        reportDate
      ),
      revenue_signed: projectMonthValue(branchMonthTotals.revenue_signed, reportDate),
    }),
    [branchMonthTotals, reportDate]
  )

  const monthlySummaries = useMemo<MonthlySummary[]>(
    () =>
      branchReps
        .map((rep) => {
          const repRows = monthStats.filter((row) => row.rep_id === rep.id)
          const summary = buildTotalsFromStats(repRows)

          return {
            rep_id: rep.id,
            rep_name: rep.full_name,
            ...summary,
          }
        })
        .sort((a, b) => b.revenue_signed - a.revenue_signed),
    [branchReps, monthStats]
  )

  const monthLabel = useMemo(() => {
    const date = new Date(`${reportDate}T12:00:00`)
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
  }, [reportDate])

  const submittedCount = dayStats.length
  const missingCount = Math.max(branchReps.length - submittedCount, 0)

  return (
    <main className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.22),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_26%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,179,122,0.7),transparent)]" />

        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b37a]">
              Branch Entry
            </div>

            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
              Branch Nightly Numbers
            </h1>

            <p className="mt-3 max-w-3xl text-base leading-7 text-white/68 md:text-lg">
              Enter the full branch sheet in one pass, keep everyone on the nightly roster visible, and track month-to-date plus projected totals without bouncing to another page.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                Report Date
              </div>
              <input
                type="date"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
                value={reportDate}
                onChange={(event) => setReportDate(event.target.value)}
              />
            </label>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving || loading || branchReps.length === 0}
              className="rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85] disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save All'}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <ManagerMetric label="Nightly Roster" value={String(branchReps.length)} />
        <ManagerMetric label="Submitted" value={String(submittedCount)} />
        <ManagerMetric label="Missing" value={String(missingCount)} />
        <ManagerMetric label="Month" value={monthLabel} />
        <ManagerMetric label="Viewer" value={viewerName || 'Manager'} />
      </section>

      {message ? (
        <div
          className={`rounded-[1.6rem] border p-4 text-sm shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl ${
            messageType === 'error'
              ? 'border-red-400/20 bg-red-500/10 text-red-200'
              : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
          }`}
        >
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-sm text-white/60 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          Loading branch entry form...
        </div>
      ) : branchReps.length === 0 ? (
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          <h2 className="text-xl font-semibold text-white">No nightly roster found</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">
            There are no active users included in nightly numbers yet, so there is nothing to enter for this branch sheet.
          </p>
        </div>
      ) : (
        <>
          <section className="grid gap-6 xl:grid-cols-2">
            <TotalsPanel
              title={`${monthLabel} Branch MTD`}
              description={`Saved totals through ${new Date(`${reportDate}T12:00:00`).toLocaleDateString('en-US')}.`}
              totals={branchMonthTotals}
            />
            <TotalsPanel
              title="Projected Month-End"
              description="Working-day pace projected from the selected report date."
              totals={projectedBranchTotals}
              projected
            />
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
            <div className="mb-5">
              <h2 className="text-2xl font-bold tracking-tight text-white">
                Branch Nightly Numbers
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/60">
                Enter numbers for every included user, then save the full branch sheet at once.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-white/45">
                    <th className="px-3 py-3">Rep</th>
                    <th className="px-3 py-3">Knocks</th>
                    <th className="px-3 py-3">Talks</th>
                    <th className="px-3 py-3">Walks</th>
                    <th className="px-3 py-3">Inspections</th>
                    <th className="px-3 py-3">Contingencies</th>
                    <th className="px-3 py-3">Contracts</th>
                    <th className="px-3 py-3">Revenue</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.rep_id}
                      className="border-b border-white/10 last:border-b-0"
                    >
                      <td className="px-3 py-3 font-medium text-white">{row.rep_name}</td>
                      <td className="px-3 py-3">
                        <ManagerInput
                          value={row.knocks}
                          inputMode="numeric"
                          onChange={(value) => updateCell(row.rep_id, 'knocks', value)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <ManagerInput
                          value={row.talks}
                          inputMode="numeric"
                          onChange={(value) => updateCell(row.rep_id, 'talks', value)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <ManagerInput
                          value={row.walks}
                          inputMode="numeric"
                          onChange={(value) => updateCell(row.rep_id, 'walks', value)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <ManagerInput
                          value={row.inspections}
                          inputMode="numeric"
                          onChange={(value) => updateCell(row.rep_id, 'inspections', value)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <ManagerInput
                          value={row.contingencies}
                          inputMode="numeric"
                          onChange={(value) => updateCell(row.rep_id, 'contingencies', value)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <ManagerInput
                          value={row.contracts_with_deposit}
                          inputMode="numeric"
                          onChange={(value) =>
                            updateCell(row.rep_id, 'contracts_with_deposit', value)
                          }
                        />
                      </td>
                      <td className="px-3 py-3">
                        <ManagerInput
                          value={row.revenue_signed}
                          inputMode="decimal"
                          onChange={(value) =>
                            updateCell(row.rep_id, 'revenue_signed', value)
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr className="border-t border-white/10 bg-black/20 font-semibold text-white">
                    <td className="px-3 py-3">Totals</td>
                    <td className="px-3 py-3">{totals.knocks}</td>
                    <td className="px-3 py-3">{totals.talks}</td>
                    <td className="px-3 py-3">{totals.walks}</td>
                    <td className="px-3 py-3">{totals.inspections}</td>
                    <td className="px-3 py-3">{totals.contingencies}</td>
                    <td className="px-3 py-3">{totals.contracts_with_deposit}</td>
                    <td className="px-3 py-3">{formatCurrency(totals.revenue_signed)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
            <div className="mb-5">
              <h2 className="text-2xl font-bold tracking-tight text-white">
                {monthLabel} Nightly Totals
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/60">
                Month-to-date totals for everyone on the nightly roster based on saved daily numbers through the selected date.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-white/45">
                    <th className="px-3 py-3">Rep</th>
                    <th className="px-3 py-3">Knocks</th>
                    <th className="px-3 py-3">Talks</th>
                    <th className="px-3 py-3">Walks</th>
                    <th className="px-3 py-3">Inspections</th>
                    <th className="px-3 py-3">Contingencies</th>
                    <th className="px-3 py-3">Contracts</th>
                    <th className="px-3 py-3">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlySummaries.map((row) => (
                    <tr
                      key={row.rep_id}
                      className="border-b border-white/10 last:border-b-0"
                    >
                      <td className="px-3 py-3 font-medium text-white">{row.rep_name}</td>
                      <td className="px-3 py-3 text-white/75">{row.knocks}</td>
                      <td className="px-3 py-3 text-white/75">{row.talks}</td>
                      <td className="px-3 py-3 text-white/75">{row.walks}</td>
                      <td className="px-3 py-3 text-white/75">{row.inspections}</td>
                      <td className="px-3 py-3 text-white/75">{row.contingencies}</td>
                      <td className="px-3 py-3 text-white/75">{row.contracts_with_deposit}</td>
                      <td className="px-3 py-3 text-white">
                        {formatCurrency(row.revenue_signed)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  )
}

function ManagerMetric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-white">{value}</div>
    </div>
  )
}

function TotalsPanel({
  title,
  description,
  totals,
  projected = false,
}: {
  title: string
  description: string
  totals: Totals
  projected?: boolean
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="mb-5">
        <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-white/60">{description}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TotalsMetric label="Knocks" value={totals.knocks.toLocaleString()} projected={projected} />
        <TotalsMetric label="Talks" value={totals.talks.toLocaleString()} projected={projected} />
        <TotalsMetric label="Walks" value={totals.walks.toLocaleString()} projected={projected} />
        <TotalsMetric
          label="Inspections"
          value={totals.inspections.toLocaleString()}
          projected={projected}
        />
        <TotalsMetric
          label="Contingencies"
          value={totals.contingencies.toLocaleString()}
          projected={projected}
        />
        <TotalsMetric
          label="Contracts"
          value={totals.contracts_with_deposit.toLocaleString()}
          projected={projected}
        />
        <TotalsMetric
          label="Revenue"
          value={formatCurrency(totals.revenue_signed)}
          projected={projected}
        />
      </div>
    </section>
  )
}

function TotalsMetric({
  label,
  value,
  projected,
}: {
  label: string
  value: string
  projected: boolean
}) {
  return (
    <div
      className={`rounded-[1.4rem] border px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.18)] ${
        projected
          ? 'border-blue-400/20 bg-blue-500/10'
          : 'border-white/10 bg-black/20'
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-white">{value}</div>
    </div>
  )
}

function ManagerInput({
  value,
  inputMode,
  onChange,
}: {
  value: string
  inputMode: React.HTMLAttributes<HTMLInputElement>['inputMode']
  onChange: (value: string) => void
}) {
  return (
    <input
      inputMode={inputMode}
      className="w-24 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/24 focus:border-[#d6b37a]/35"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
