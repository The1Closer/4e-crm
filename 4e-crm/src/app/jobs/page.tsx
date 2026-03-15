'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import ProtectedRoute from '../../components/ProtectedRoute'
import { getCurrentUserProfile, isManagerLike } from '../../lib/auth-helpers'

type JobRep = {
  profile_id: string
  profiles:
    | {
        full_name: string | null
        manager_id?: string | null
      }
    | {
        full_name: string | null
        manager_id?: string | null
      }[]
    | null
}

type JobRow = {
  id: string
  insurance_carrier: string | null
  claim_number: string | null
  contract_amount: number | null
  deposit_collected: number | null
  remaining_balance: number | null
  install_date: string | null
  homeowners:
    | {
        name: string | null
        phone: string | null
        address: string | null
        email: string | null
      }
    | {
        name: string | null
        phone: string | null
        address: string | null
        email: string | null
      }[]
    | null
  pipeline_stages:
    | {
        name: string | null
      }
    | {
        name: string | null
      }[]
    | null
  job_reps: JobRep[] | null
}

type StageOption = {
  id: number
  name: string
}

type ProfileOption = {
  id: string
  full_name: string
  role: string | null
  manager_id: string | null
}

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(value + 'T00:00:00').toLocaleDateString('en-US')
}

function getHomeowner(
  homeowner: JobRow['homeowners']
): {
  name: string | null
  phone: string | null
  address: string | null
  email: string | null
} | null {
  if (!homeowner) return null
  return Array.isArray(homeowner) ? homeowner[0] ?? null : homeowner
}

function getStageName(stage: JobRow['pipeline_stages']) {
  if (!stage) return 'No Stage'
  const item = Array.isArray(stage) ? stage[0] ?? null : stage
  return item?.name ?? 'No Stage'
}

function getRepNames(jobReps: JobRep[] | null): string[] {
  if (!jobReps || jobReps.length === 0) return []

  return jobReps
    .map((rep) => {
      const profile = Array.isArray(rep.profiles)
        ? rep.profiles[0] ?? null
        : rep.profiles

      return profile?.full_name ?? null
    })
    .filter((name): name is string => Boolean(name))
}

function JobsPageContent() {
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [filteredJobs, setFilteredJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [role, setRole] = useState<string | null>(null)

  const [stageOptions, setStageOptions] = useState<StageOption[]>([])
  const [profileOptions, setProfileOptions] = useState<ProfileOption[]>([])

  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [managerFilter, setManagerFilter] = useState('')
  const [repFilter, setRepFilter] = useState('')

  useEffect(() => {
    async function loadPageData() {
      setLoading(true)
      setErrorMessage('')

      const currentProfile = await getCurrentUserProfile()

      if (!currentProfile) {
        setJobs([])
        setFilteredJobs([])
        setLoading(false)
        return
      }

      setRole(currentProfile.role)

      const [stagesRes, profilesRes] = await Promise.all([
        supabase
          .from('pipeline_stages')
          .select('id, name')
          .order('sort_order', { ascending: true }),
        supabase
          .from('profiles')
          .select('id, full_name, role, manager_id')
          .eq('is_active', true)
          .order('full_name', { ascending: true }),
      ])

      setStageOptions((stagesRes.data ?? []) as StageOption[])
      setProfileOptions((profilesRes.data ?? []) as ProfileOption[])

      let baseQuery = supabase
        .from('jobs')
        .select(`
          id,
          insurance_carrier,
          claim_number,
          contract_amount,
          deposit_collected,
          remaining_balance,
          install_date,
          homeowners (
            name,
            phone,
            address,
            email
          ),
          pipeline_stages (
            name
          ),
          job_reps (
            profile_id,
            profiles (
              full_name,
              manager_id
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (isManagerLike(currentProfile.role)) {
        const { data, error } = await baseQuery

        if (error) {
          setErrorMessage(error.message)
          setLoading(false)
          return
        }

        const rows = (data ?? []) as JobRow[]
        setJobs(rows)
        setFilteredJobs(rows)
        setLoading(false)
        return
      }

      const { data: assignedRows, error: assignedError } = await supabase
        .from('job_reps')
        .select('job_id')
        .eq('profile_id', currentProfile.id)

      if (assignedError) {
        setErrorMessage(assignedError.message)
        setLoading(false)
        return
      }

      const jobIds = [...new Set((assignedRows ?? []).map((row: any) => row.job_id))]

      if (jobIds.length === 0) {
        setJobs([])
        setFilteredJobs([])
        setLoading(false)
        return
      }

      const { data, error } = await baseQuery.in('id', jobIds)

      if (error) {
        setErrorMessage(error.message)
        setLoading(false)
        return
      }

      const rows = (data ?? []) as JobRow[]
      setJobs(rows)
      setFilteredJobs(rows)
      setLoading(false)
    }

    loadPageData()
  }, [])

  useEffect(() => {
    let next = [...jobs]

    const loweredSearch = search.trim().toLowerCase()

    if (loweredSearch) {
      next = next.filter((job) => {
        const homeowner = getHomeowner(job.homeowners)
        const repNames = getRepNames(job.job_reps).join(' ').toLowerCase()

        return (
          homeowner?.name?.toLowerCase().includes(loweredSearch) ||
          homeowner?.address?.toLowerCase().includes(loweredSearch) ||
          homeowner?.email?.toLowerCase().includes(loweredSearch) ||
          job.claim_number?.toLowerCase().includes(loweredSearch) ||
          job.insurance_carrier?.toLowerCase().includes(loweredSearch) ||
          repNames.includes(loweredSearch)
        )
      })
    }

    if (stageFilter) {
      next = next.filter((job) => getStageName(job.pipeline_stages) === stageFilter)
    }

    if (repFilter) {
      next = next.filter((job) =>
        (job.job_reps ?? []).some((rep) => rep.profile_id === repFilter)
      )
    }

    if (managerFilter) {
      const teamRepIds = profileOptions
        .filter((profile) => profile.manager_id === managerFilter)
        .map((profile) => profile.id)

      next = next.filter((job) =>
        (job.job_reps ?? []).some((rep) => teamRepIds.includes(rep.profile_id))
      )
    }

    setFilteredJobs(next)
  }, [jobs, search, stageFilter, repFilter, managerFilter, profileOptions])

  const managers = useMemo(
    () => profileOptions.filter((p) => p.role === 'manager' || p.role === 'admin'),
    [profileOptions]
  )

  const reps = useMemo(
    () => profileOptions.filter((p) => p.role === 'rep'),
    [profileOptions]
  )

  return (
    <main className="p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
          <p className="mt-2 text-sm text-gray-600">
            Roofing claims, contracts, and production records.
          </p>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <input
              className="rounded-xl border px-4 py-3 text-sm"
              placeholder="Search homeowner, address, carrier, claim, rep..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="rounded-xl border px-4 py-3 text-sm"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
            >
              <option value="">All Stages</option>
              {stageOptions.map((stage) => (
                <option key={stage.id} value={stage.name}>
                  {stage.name}
                </option>
              ))}
            </select>

            {isManagerLike(role) ? (
              <select
                className="rounded-xl border px-4 py-3 text-sm"
                value={managerFilter}
                onChange={(e) => setManagerFilter(e.target.value)}
              >
                <option value="">All Managers / Teams</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.full_name}
                  </option>
                ))}
              </select>
            ) : (
              <div />
            )}

            <select
              className="rounded-xl border px-4 py-3 text-sm"
              value={repFilter}
              onChange={(e) => setRepFilter(e.target.value)}
            >
              <option value="">All Reps</option>
              {reps.map((rep) => (
                <option key={rep.id} value={rep.id}>
                  {rep.full_name}
                </option>
              ))}
            </select>
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border bg-white p-6 text-gray-600 shadow-sm">
            Loading jobs...
          </div>
        ) : errorMessage ? (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-700">
            Error loading jobs: {errorMessage}
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-gray-600 shadow-sm">
            No jobs match the current filters.
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredJobs.map((job) => {
              const homeowner = getHomeowner(job.homeowners)
              const stageName = getStageName(job.pipeline_stages)
              const repNames = getRepNames(job.job_reps)

              return (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="block rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        {homeowner?.name ?? 'Unnamed Homeowner'}
                      </h2>
                      <p className="mt-1 text-sm text-gray-600">
                        {homeowner?.address ?? '-'}
                      </p>
                    </div>

                    <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
                      {stageName}
                    </div>
                  </div>

                  <div className="mt-3 text-sm text-gray-600">
                    <div>{homeowner?.phone ?? '-'}</div>
                    <div>{homeowner?.email ?? '-'}</div>
                  </div>

                  <div className="mt-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Assigned Reps
                    </div>
                    <div className="mt-1 text-sm font-medium text-gray-900">
                      {repNames.length > 0 ? repNames.join(', ') : 'No reps assigned'}
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Insurance
                      </div>
                      <div className="mt-1 font-medium text-gray-900">
                        {job.insurance_carrier ?? '-'}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Claim Number
                      </div>
                      <div className="mt-1 font-medium text-gray-900">
                        {job.claim_number ?? '-'}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Install Date
                      </div>
                      <div className="mt-1 font-medium text-gray-900">
                        {formatDate(job.install_date)}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Contract Amount
                      </div>
                      <div className="mt-1 font-medium text-gray-900">
                        {formatCurrency(job.contract_amount)}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Deposit Collected
                      </div>
                      <div className="mt-1 font-medium text-gray-900">
                        {formatCurrency(job.deposit_collected)}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Remaining Balance
                      </div>
                      <div className="mt-1 font-medium text-gray-900">
                        {formatCurrency(job.remaining_balance)}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

export default function JobsPage() {
  return (
    <ProtectedRoute>
      <JobsPageContent />
    </ProtectedRoute>
  )
}