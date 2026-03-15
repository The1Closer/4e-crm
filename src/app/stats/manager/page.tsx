'use client'

import { useEffect, useMemo, useState } from 'react'
import ManagerOnlyRoute from '../../../components/ManagerOnlyRoute'
import { supabase } from '../../../lib/supabase'
import { getCurrentUserProfile } from '../../../lib/auth-helpers'

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
  const [reportDate, setReportDate] = useState(getTodayLocalDate())
  const [teamReps, setTeamReps] = useState<Profile[]>([])
  const [rows, setRows] = useState<EditableRow[]>([])

  async function loadTeamAndStats(date: string) {
    setLoading(true)
    setMessage('')

    const currentProfile = await getCurrentUserProfile()

    if (!currentProfile) {
      setTeamReps([])
      setRows([])
      setLoading(false)
      return
    }

    const { data: repsData, error: repsError } = await supabase
      .from('profiles')
      .select('id, full_name, role, manager_id')
      .eq('manager_id', currentProfile.id)
      .eq('is_active', true)
      .eq('role', 'rep')
      .order('full_name', { ascending: true })

    if (repsError) {
      setMessage(repsError.message)
      setTeamReps([])
      setRows([])
      setLoading(false)
      return
    }

    const reps = (repsData ?? []) as Profile[]
    setTeamReps(reps)

    if (reps.length === 0) {
      setRows([])
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
      setMessage(statError.message)
      setRows(reps.map(emptyRow))
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

    setRows(mappedRows)
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
        setMessage(error.message)
        setSaving(false)
        return
      }

      setMessage('Team nightly numbers saved.')
      setSaving(false)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Something went wrong'
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

  return (
    <main className="p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Manager Nightly Entry</h1>
            <p className="mt-2 text-sm text-gray-600">
              Enter nightly team numbers for all reps on one screen.
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
              disabled={saving || loading}
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save All'}
            </button>
          </div>
        </div>

        {message ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 shadow-sm">
            {message}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm text-sm text-gray-600">
            Loading team entry form...
          </div>
        ) : teamReps.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm text-sm text-gray-600">
            No reps assigned to your team yet.
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
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
                            className="w-24 rounded-lg border px-3 py-2"
                            value={row.knocks}
                            onChange={(e) => updateCell(row.rep_id, 'knocks', e.target.value)}
                          />
                        </td>

                        <td className="px-3 py-3">
                          <input
                            className="w-24 rounded-lg border px-3 py-2"
                            value={row.talks}
                            onChange={(e) => updateCell(row.rep_id, 'talks', e.target.value)}
                          />
                        </td>

                        <td className="px-3 py-3">
                          <input
                            className="w-24 rounded-lg border px-3 py-2"
                            value={row.walks}
                            onChange={(e) => updateCell(row.rep_id, 'walks', e.target.value)}
                          />
                        </td>

                        <td className="px-3 py-3">
                          <input
                            className="w-24 rounded-lg border px-3 py-2"
                            value={row.inspections}
                            onChange={(e) => updateCell(row.rep_id, 'inspections', e.target.value)}
                          />
                        </td>

                        <td className="px-3 py-3">
                          <input
                            className="w-24 rounded-lg border px-3 py-2"
                            value={row.contingencies}
                            onChange={(e) => updateCell(row.rep_id, 'contingencies', e.target.value)}
                          />
                        </td>

                        <td className="px-3 py-3">
                          <input
                            className="w-24 rounded-lg border px-3 py-2"
                            value={row.contracts_with_deposit}
                            onChange={(e) =>
                              updateCell(row.rep_id, 'contracts_with_deposit', e.target.value)
                            }
                          />
                        </td>

                        <td className="px-3 py-3">
                          <input
                            className="w-32 rounded-lg border px-3 py-2"
                            value={row.revenue_signed}
                            onChange={(e) => updateCell(row.rep_id, 'revenue_signed', e.target.value)}
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
          </>
        )}
      </div>
    </main>
  )
}