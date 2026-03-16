'use client'

import { useEffect, useMemo, useState } from 'react'
import ManagerOnlyRoute from '../../../components/ManagerOnlyRoute'
import { supabase } from '../../../lib/supabase'
import { getCurrentUserProfile } from '../../../lib/auth-helpers'
import {
  buildRepSummaries,
  buildTotals,
  getMonthRange,
  projectMonthEnd,
  safePercent,
  type RepDailyStat,
} from '../../../lib/stats-utils'

type Profile = {
  id: string
  full_name: string
  role: string | null
  manager_id: string | null
}

function getTodayLocalDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function TeamDashboardContent() {
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [stats, setStats] = useState<RepDailyStat[]>([])

  const monthInfo = getMonthRange()
  const today = getTodayLocalDate()

  useEffect(() => {
    async function loadData() {
      setLoading(true)

      const currentProfile = await getCurrentUserProfile()

      if (!currentProfile) {
        setLoading(false)
        return
      }

      const { data: repsData } = await supabase
        .from('profiles')
        .select('id, full_name, role, manager_id')
        .eq('manager_id', currentProfile.id)
        .eq('is_active', true)
        .order('full_name', { ascending: true })

      const repRows = (repsData ?? []) as Profile[]
      setProfiles(repRows)

      const repIds = repRows.map((r) => r.id)

      if (repIds.length === 0) {
        setStats([])
        setLoading(false)
        return
      }

      const { data: statsData } = await supabase
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
        .gte('report_date', monthInfo.start)
        .lte('report_date', monthInfo.end)
        .in('rep_id', repIds)

      setStats((statsData ?? []) as RepDailyStat[])
      setLoading(false)
    }

    loadData()
  }, [])

  const repSummaries = useMemo(() => {
    return buildRepSummaries({
      stats,
      profiles: profiles.map((p) => ({ id: p.id, full_name: p.full_name })),
    }).sort((a, b) => b.revenue_signed - a.revenue_signed)
  }, [stats, profiles])

  const totals = useMemo(() => buildTotals(repSummaries), [repSummaries])

  const missingToday = useMemo(() => {
    const submittedRepIds = new Set(
      stats.filter((row) => row.report_date === today).map((row) => row.rep_id)
    )

    return profiles.filter((rep) => !submittedRepIds.has(rep.id))
  }, [profiles, stats, today])

  if (loading) {
    return (
      <main className="p-8">
        <div className="mx-auto max-w-7xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm text-sm text-gray-600">
          Loading team dashboard...
        </div>
      </main>
    )
  }

  return (
    <main className="p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">
            Team production, conversion rates, and missing nightly submissions.
          </p>
        </div>

        {missingToday.length > 0 ? (
          <section className="rounded-2xl border border-yellow-300 bg-yellow-50 p-5 shadow-sm">
            <div className="text-sm font-semibold text-yellow-900">
              Missing Nightly Numbers Today
            </div>
            <div className="mt-2 text-sm text-yellow-800">
              {missingToday.map((rep) => rep.full_name).join(', ')}
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-gray-900">Team Contingencies</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{totals.contingencies}</div>
            <div className="mt-1 text-xs text-gray-500">
              Projected: {projectMonthEnd(totals.contingencies, monthInfo.currentDay, monthInfo.daysInMonth)}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-gray-900">Team Contracts</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{totals.contracts_with_deposit}</div>
            <div className="mt-1 text-xs text-gray-500">
              Projected: {projectMonthEnd(totals.contracts_with_deposit, monthInfo.currentDay, monthInfo.daysInMonth)}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-gray-900">Team Revenue</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              ${totals.revenue_signed.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Projected: ${projectMonthEnd(totals.revenue_signed, monthInfo.currentDay, monthInfo.daysInMonth).toLocaleString()}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-gray-900">Inspection → Contingency</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              {safePercent(totals.contingencies, totals.inspections)}%
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Team Leaderboard</h2>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="px-3 py-3">Rep</th>
                  <th className="px-3 py-3">Contingencies</th>
                  <th className="px-3 py-3">Contracts</th>
                  <th className="px-3 py-3">Revenue</th>
                  <th className="px-3 py-3">Talk Rate</th>
                  <th className="px-3 py-3">Walk Rate</th>
                  <th className="px-3 py-3">Inspection Rate</th>
                  <th className="px-3 py-3">Close Rate</th>
                </tr>
              </thead>
              <tbody>
                {repSummaries.map((rep) => (
                  <tr key={rep.repId} className="border-b last:border-b-0">
                    <td className="px-3 py-3 font-medium text-gray-900">{rep.repName}</td>
                    <td className="px-3 py-3">{rep.contingencies}</td>
                    <td className="px-3 py-3">{rep.contracts_with_deposit}</td>
                    <td className="px-3 py-3">${rep.revenue_signed.toLocaleString()}</td>
                    <td className="px-3 py-3">{safePercent(rep.talks, rep.knocks)}%</td>
                    <td className="px-3 py-3">{safePercent(rep.walks, rep.talks)}%</td>
                    <td className="px-3 py-3">{safePercent(rep.inspections, rep.walks)}%</td>
                    <td className="px-3 py-3">{safePercent(rep.contracts_with_deposit, rep.contingencies)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}

export default function TeamDashboardPage() {
  return (
    <ManagerOnlyRoute>
      <main>...</main>
    </ManagerOnlyRoute>
  )
}