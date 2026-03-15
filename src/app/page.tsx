'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import NotificationBell from '../components/NotificationBell'
import AuthStatus from '../components/AuthStatus'
import { supabase } from '../lib/supabase'
import { getCurrentUserProfile, isManagerLike } from '../lib/auth-helpers'

type JobRow = {
  id: string
  contract_amount: number | null
  remaining_balance: number | null
  install_date: string | null
  stage_id: number | null
  pipeline_stages:
    | {
        id: number
        name: string | null
      }
    | {
        id: number
        name: string | null
      }[]
    | null
  job_reps:
    | {
        profile_id: string
      }[]
    | null
}

function getStageName(stage: JobRow['pipeline_stages']) {
  if (!stage) return 'No Stage'
  const item = Array.isArray(stage) ? stage[0] ?? null : stage
  return item?.name ?? 'No Stage'
}

export default function HomePage() {
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<JobRow[]>([])

  useEffect(() => {
    async function loadHomeDashboard() {
      setLoading(true)

      const currentProfile = await getCurrentUserProfile()

      if (!currentProfile) {
        setRole(null)
        setJobs([])
        setLoading(false)
        return
      }

      setRole(currentProfile.role)

      let visibleJobIds: string[] | null = null

      if (!isManagerLike(currentProfile.role)) {
        const { data: assignedRows } = await supabase
          .from('job_reps')
          .select('job_id')
          .eq('profile_id', currentProfile.id)

        visibleJobIds = [...new Set((assignedRows ?? []).map((row: any) => row.job_id))]

        if (visibleJobIds.length === 0) {
          setJobs([])
          setLoading(false)
          return
        }
      }

      let query = supabase
        .from('jobs')
        .select(`
          id,
          contract_amount,
          remaining_balance,
          install_date,
          stage_id,
          pipeline_stages (
            id,
            name
          ),
          job_reps (
            profile_id
          )
        `)

      if (visibleJobIds) {
        query = query.in('id', visibleJobIds)
      }

      const { data } = await query
      setJobs((data ?? []) as JobRow[])
      setLoading(false)
    }

    loadHomeDashboard()
  }, [])

  const stats = useMemo(() => {
    const totalJobs = jobs.length
    const totalContractAmount = jobs.reduce(
      (sum, job) => sum + Number(job.contract_amount ?? 0),
      0
    )
    const totalRemainingBalance = jobs.reduce(
      (sum, job) => sum + Number(job.remaining_balance ?? 0),
      0
    )
    const installsScheduled = jobs.filter((job) => !!job.install_date).length
    const paidInFull = jobs.filter((job) => Number(job.remaining_balance ?? 0) <= 0).length
    const contingencies = jobs.filter(
      (job) => getStageName(job.pipeline_stages).toLowerCase() === 'contingency'
    ).length
    const contracted = jobs.filter(
      (job) => getStageName(job.pipeline_stages).toLowerCase().includes('contract')
    ).length

    return {
      totalJobs,
      totalContractAmount,
      totalRemainingBalance,
      installsScheduled,
      paidInFull,
      contingencies,
      contracted,
    }
  }, [jobs])

  const showManagerLinks = isManagerLike(role)

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                4 Elements Renovations
              </p>

              <h1 className="mt-3 text-4xl font-bold tracking-tight text-gray-900">
                4 Elements CRM
              </h1>

              <p className="mt-4 text-base text-gray-600">
                Internal roofing CRM for claims, contracts, production flow, team management, dashboards, and notifications.
              </p>
            </div>

            <AuthStatus />
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/jobs"
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
            >
              View Jobs
            </Link>

            <Link
              href="/jobs/new"
              className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
            >
              Create New Job
            </Link>

            <Link
              href="/team"
              className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
            >
              Team Management
            </Link>

            {showManagerLinks ? (
              <>
                <Link
                  href="/stats/manager"
                  className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
                >
                  Manager Entry
                </Link>

                <Link
                  href="/dashboard/team"
                  className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
                >
                  Team Dashboard
                </Link>

                <Link
                  href="/dashboard/branch"
                  className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
                >
                  Branch Dashboard
                </Link>
              </>
            ) : null}

            <NotificationBell />
          </div>
        </section>

        <section className="space-y-4">
          <div className="text-lg font-semibold text-gray-900">
            CRM Overview
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm text-sm text-gray-600">
              Loading CRM dashboard...
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-gray-900">Total Jobs</div>
                <div className="mt-2 text-3xl font-bold text-gray-900">
                  {stats.totalJobs}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-gray-900">Total Contract Amount</div>
                <div className="mt-2 text-3xl font-bold text-gray-900">
                  ${stats.totalContractAmount.toLocaleString()}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-gray-900">Total Remaining Balance</div>
                <div className="mt-2 text-3xl font-bold text-gray-900">
                  ${stats.totalRemainingBalance.toLocaleString()}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-gray-900">Installs Scheduled</div>
                <div className="mt-2 text-3xl font-bold text-gray-900">
                  {stats.installsScheduled}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-gray-900">Contingencies</div>
                <div className="mt-2 text-3xl font-bold text-gray-900">
                  {stats.contingencies}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-gray-900">Paid In Full</div>
                <div className="mt-2 text-3xl font-bold text-gray-900">
                  {stats.paidInFull}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}