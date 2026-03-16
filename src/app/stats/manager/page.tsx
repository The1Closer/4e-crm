'use client'

import { useEffect, useMemo, useState } from 'react'
import ManagerOnlyRoute from '@/components/ManagerOnlyRoute'
import { supabase } from '@/lib/supabase'
import { getCurrentUserProfile } from '@/lib/auth-helpers'

type Profile = {
  id: string
  full_name: string
  role: string | null
  manager_id: string | null
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

function getTodayLocalDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getMonthRangeFromDate(dateString: string) {
  const [year, month] = dateString.split('-').map(Number)
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = new Date(year, month, 0)
  const end = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
  return { start, end }
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

type MonthlySummary = {
  rep_id: string
  rep_name: string
  knocks: number
  talks: number
  walks: number
  inspections: number
  contingencies: number
  contracts_with_deposit: number
  revenue_signed: number
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
  const [teamReps, setTeamReps] = useState<Profile[]>([])
  const [rows, setRows] = useState<EditableRow[]>([])
  const [managerName, setManagerName] = useState('')
  const [monthStats, setMonthStats] = useState<StatRow[]>([])

  async function loadTeamAndStats(date: string) {
    setLoading(true)
    setMessage('')
    setMessageType('')

    const currentProfile = await getCurrentUserProfile()

    if (!currentProfile) {
      setTeamReps([])
      setRows([])
      setMonthStats([])
      setLoading(false)
      return
    }

    setManagerName(currentProfile.full_name ?? 'Manager')

    const { data: repsData, error: repsError } = await supabase
      .from('profiles')
      .select('id, full_name, role, manager_id')
      .eq('manager_id', currentProfile.id)
      .eq('is_active', true)
      .eq('role', 'rep')
      .order('full_name', { ascending: true })

    if (repsError) {
      setMessageType('error')
      setMessage(repsError.message)
      setTeamReps([])
      setRows([])
      setMonthStats([])
      setLoading(false)
      return
    }

    const reps = (repsData ?? []) as Profile[]
    setTeamReps(reps)

    if (reps.length === 0) {
      setRows([])
      setMonthStats([])
      setLoading(false)
      return
    }

    const repIds = reps.map((rep) => rep.id)

    const { data: statData, error: statError } = await supabase
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
      .in('rep_id', repIds)

    if (statError) {
      setMessageType('error')
      setMessage(statError.message)
      setRows(reps.map(emptyRow))
      setMonthStats([])
      setLoading(false)
      return
    }

    const stats = (statData ?? []) as StatRow[]

    const mappedRows: EditableRow[] = reps.map((rep) => {
      const existing = stats.find((s) => s.rep_id === rep.id)

      if (!existing) return emptyRow(rep)

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

    const monthRange = getMonthRangeFromDate(date)

    const { data: monthlyData, error: monthlyError } = await supabase
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
      .gte('report_date', monthRange.start)
      .lte('report_date', monthRange.end)
      .in('rep_id', repIds)

    if (monthlyError) {
      setMessageType('error')
      setMessage(monthlyError.message)
      setRows(mappedRows)
      setMonthStats([])
      setLoading(false)
      return
    }

    setRows(mappedRows)
    setMonthStats((monthlyData ?? []) as StatRow[])
    setLoading(false)
  }

  useEffect(() => {
    loadTeamAndStats(reportDate)
  }, [])

  async function handleDateChange(nextDate: string) {
    setReportDate(nextDate)
    await loadTeamAndStats(nextDate)
  }

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
      setMessage('Team nightly numbers saved.')
      setSaving(false)
      await loadTeamAndStats(reportDate)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Something went wrong'
      setMessageType('error')
      setMessage(msg)
      setSaving(false)
    }
  }

  const totals = useMemo(() => {
    return rows.reduce(
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
      {
        knocks: 0,
        talks: 0,
        walks: 0,
        inspections: 0,
        contingencies: 0,
        contracts_with_deposit: 0,
        revenue_signed: 0,
      }
    )
  }, [rows])

  const monthlySummaries = useMemo<MonthlySummary[]>(() => {
    return teamReps
      .map((rep) => {
        const repRows = monthStats.filter((row) => row.rep_id === rep.id)

        return repRows.reduce<MonthlySummary>(
          (acc, row) => {
            acc.knocks += row.knocks || 0
            acc.talks += row.talks || 0
            acc.walks += row.walks || 0
            acc.inspections += row.inspections || 0
            acc.contingencies += row.contingencies || 0
            acc.contracts_with_deposit += row.contracts_with_deposit || 0
            acc.revenue_signed += row.revenue_signed || 0
            return acc
          },
          {
            rep_id: rep.id,
            rep_name: rep.full_name,
            knocks: 0,
            talks: 0,
            walks: 0,
            inspections: 0,
            contingencies: 0,
            contracts_with_deposit: 0,
            revenue_signed: 0,
          }
        )
      })
      .sort((a, b) => b.revenue_signed - a.revenue_signed)
  }, [teamReps, monthStats])

  const monthLabel = useMemo(() => {
    const date = new Date(`${reportDate}T12:00:00`)
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
  }, [reportDate])

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Manager Entry
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Enter or review nightly team numbers, and track each rep’s month-to-date production.
            </p>
          </div>

          <div className="flex items-end gap-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Report Date
              </label>
              <input
                type="date"
                className="rounded-xl border px-4 py-3 text-sm"
                value={reportDate}
                onChange={(e) => handleDateChange(e.target.value)}
              />
            </div>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving || loading || teamReps.length === 0}
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save All'}
            </button>
          </div>
        </div>

        {message ? (
          <div
            className={`rounded-xl p-4 text-sm shadow-sm ${
              messageType === 'error'
                ? 'border border-red-200 bg-red-50 text-red-700'
                : 'border border-green-200 bg-green-50 text-green-700'
            }`}
          >
            {message}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
            Loading manager entry form...
          </div>
        ) : teamReps.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              No reps assigned yet
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {managerName || 'This manager'} does not currently have any active reps
              assigned, so there are no nightly numbers or monthly rep totals to track here yet.
            </p>
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Team Nightly Numbers
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Enter numbers for each rep, then save the entire sheet at once.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
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
                      <tr key={row.rep_id} className="border-b last:border-b-0">
                        <td className="px-3 py-3 font-medium text-gray-900">
                          {row.rep_name}
                        </td>

                        <td className="px-3 py-3">
                          <input
                            inputMode="numeric"
                            className="w-24 rounded-lg border px-3 py-2"
                            value={row.knocks}
                            onChange={(e) =>
                              updateCell(row.rep_id, 'knocks', e.target.value)
                            }
                          />
                        </td>

                        <td className="px-3 py-3">
                          <input
                            inputMode="numeric"
                            className="w-24 rounded-lg border px-3 py-2"
                            value={row.talks}
                            onChange={(e) =>
                              updateCell(row.rep_id, 'talks', e.target.value)
                            }
                          />
                        </td>

                        <td className="px-3 py-3">
                          <input
                            inputMode="numeric"
                            className="w-24 rounded-lg border px-3 py-2"
                            value={row.walks}
                            onChange={(e) =>
                              updateCell(row.rep_id, 'walks', e.target.value)
                            }
                          />
                        </td>

                        <td className="px-3 py-3">
                          <input
                            inputMode="numeric"
                            className="w-24 rounded-lg border px-3 py-2"
                            value={row.inspections}
                            onChange={(e) =>
                              updateCell(row.rep_id, 'inspections', e.target.value)
                            }
                          />
                        </td>

                        <td className="px-3 py-3">
                          <input
                            inputMode="numeric"
                            className="w-24 rounded-lg border px-3 py-2"
                            value={row.contingencies}
                            onChange={(e) =>
                              updateCell(row.rep_id, 'contingencies', e.target.value)
                            }
                          />
                        </td>

                        <td className="px-3 py-3">
                          <input
                            inputMode="numeric"
                            className="w-24 rounded-lg border px-3 py-2"
                            value={row.contracts_with_deposit}
                            onChange={(e) =>
                              updateCell(
                                row.rep_id,
                                'contracts_with_deposit',
                                e.target.value
                              )
                            }
                          />
                        </td>

                        <td className="px-3 py-3">
                          <input
                            inputMode="decimal"
                            className="w-32 rounded-lg border px-3 py-2"
                            value={row.revenue_signed}
                            onChange={(e) =>
                              updateCell(row.rep_id, 'revenue_signed', e.target.value)
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  <tfoot>
                    <tr className="border-t bg-gray-50 font-semibold text-gray-900">
                      <td className="px-3 py-3">Totals</td>
                      <td className="px-3 py-3">{totals.knocks}</td>
                      <td className="px-3 py-3">{totals.talks}</td>
                      <td className="px-3 py-3">{totals.walks}</td>
                      <td className="px-3 py-3">{totals.inspections}</td>
                      <td className="px-3 py-3">{totals.contingencies}</td>
                      <td className="px-3 py-3">{totals.contracts_with_deposit}</td>
                      <td className="px-3 py-3">${totals.revenue_signed.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  {monthLabel} Rep Totals
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Month-to-date totals for each rep based on saved daily numbers.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
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
                      <tr key={row.rep_id} className="border-b last:border-b-0">
                        <td className="px-3 py-3 font-medium text-gray-900">{row.rep_name}</td>
                        <td className="px-3 py-3">{row.knocks}</td>
                        <td className="px-3 py-3">{row.talks}</td>
                        <td className="px-3 py-3">{row.walks}</td>
                        <td className="px-3 py-3">{row.inspections}</td>
                        <td className="px-3 py-3">{row.contingencies}</td>
                        <td className="px-3 py-3">{row.contracts_with_deposit}</td>
                        <td className="px-3 py-3">${row.revenue_signed.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}