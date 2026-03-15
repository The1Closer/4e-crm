'use client'

import { useEffect, useMemo, useState } from 'react'
import ManagerOnlyRoute from '../../../components/ManagerOnlyRoute'
import { supabase } from '../../../lib/supabase'
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

type PipelineJob = {
  id: string
  pipeline_stages:
    | {
        name: string | null
      }
    | {
        name: string | null
      }[]
    | null
}

function getTodayLocalDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getStageName(stage: PipelineJob['pipeline_stages']) {
  if (!stage) return 'No Stage'
  const item = Array.isArray(stage) ? stage[0] ?? null : stage
  return item?.name ?? 'No Stage'
}

function BranchDashboardContent() {
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [stats, setStats] = useState<RepDailyStat[]>([])
  const [jobs, setJobs] = useState<PipelineJob[]>([])

  const monthInfo = getMonthRange()
  const today = getTodayLocalDate()

  useEffect(() => {
    async function loadData() {
      setLoading(true)

      const { data: repData } = await supabase
        .from('profiles')
        .select('id, full_name, role, manager_id')
        .eq('role', 'rep')
        .eq('is_active', true)
        .order('full_name', { ascending: true })

      const repRows = (repData ?? []) as Profile[]
      setProfiles(repRows)

      const repIds = repRows.map((r) => r.id)

      const [statsRes, jobsRes] = await Promise.all([
        repIds.length > 0
          ? supabase
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
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from('jobs')
          .select(`
            id,
            pipeline_stages (
              name
            )
          `),
      ])

      setStats((statsRes.data ?? []) as RepDailyStat[])
      setJobs((jobsRes.data ?? []) as PipelineJob[])
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

  const pipelineCounts = useMemo(() => {
    const counts: Record<string, number> = {}

    jobs.forEach((job) => {
      const name = getStageName(job.pipeline_stages)
      counts[name] = (counts[name] ?? 0) + 1
    })

    return counts
  }, [jobs])

  if (loading) {
    return (
      <main className="p-8">
        <div className="mx-auto max-w-7xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm text-sm text-gray-600">
          Loading branch dashboard...
        </div>
      </main>
    )
  }

  return (
    <main className="p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Branch Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">
            Whole-branch production, conversion, pipeline health, and missing nightly numbers.
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
            <div className="text-sm font-semibold text-gray-900">Branch Contingencies</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{totals.contingencies}</div>
            <div className="mt-1 text-xs text-gray-500">
              Projected: {projectMonthEnd(totals.contingencies, monthInfo.currentDay, monthInfo.daysInMonth)}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-gray-900">Branch Contracts</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{totals.contracts_with_deposit}</div>
            <div className="mt-1 text-xs text-gray-500">
              Projected: {projectMonthEnd(totals.contracts_with_deposit, monthInfo.currentDay, monthInfo.daysInMonth)}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-gray-900">Branch Revenue</div>
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
          <h2 className="text-xl font-semibold text-gray-900">Pipeline Stage Counts</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Object.entries(pipelineCounts).map(([stageName, count]) => (
              <div
                key={stageName}
                className="rounded-xl border border-gray-200 bg-gray-50 p-4"
              >
                <div className="text-sm font-semibold text-gray-900">{stageName}</div>
                <div className="mt-2 text-2xl font-bold text-gray-900">{count}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Branch Leaderboard</h2>

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

export default function BranchDashboardPage() {
  return (
    <ManagerOnlyRoute>
      <BranchDashboardContent />
    </ManagerOnlyRoute>
  )
}