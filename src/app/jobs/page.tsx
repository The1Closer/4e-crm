'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import ProtectedRoute from '../../components/ProtectedRoute'
import { getCurrentUserProfile, isManagerLike } from '../../lib/auth-helpers'
import JobCard, { type JobCardRow } from '@/components/jobs/JobCard'
import JobsStageRail from '@/components/jobs/JobsStageRail'
import JobsViewSwitcher, { type JobsViewMode } from '@/components/jobs/JobsViewSwitcher'
import JobsSortSelect, { type JobsSortKey } from '@/components/jobs/JobsSortSelect'
import JobsQuickFilters, { type JobsQuickFilter } from '@/components/jobs/JobsQuickFilters'
import JobsExportTools from '@/components/jobs/JobsExportTools'
import JobsTable from '@/components/jobs/JobsTable'
import JobsKanban from '@/components/jobs/JobsKanban'
import { ARCHIVE_INACTIVITY_DAYS, isArchivedByInactivity } from '@/lib/job-lifecycle'
import { isManagementLockedStage } from '@/lib/job-stage-access'

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
  updated_at: string | null
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
        id?: number | null
        name: string | null
        sort_order?: number | null
      }
    | {
        id?: number | null
        name: string | null
        sort_order?: number | null
      }[]
    | null
  job_reps: JobRep[] | null
}

type StageOption = {
  id: number
  name: string
  sort_order?: number | null
}

type ProfileOption = {
  id: string
  full_name: string
  role: string | null
  manager_id: string | null
}

type AssignedJobRef = {
  job_id: string
}

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return '-'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
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
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [role, setRole] = useState<string | null>(null)

  const [stageOptions, setStageOptions] = useState<StageOption[]>([])
  const [profileOptions, setProfileOptions] = useState<ProfileOption[]>([])

  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [managerFilter, setManagerFilter] = useState('')
  const [repFilter, setRepFilter] = useState('')
  const [viewMode, setViewMode] = useState<JobsViewMode>('cards')
  const [sortKey, setSortKey] = useState<JobsSortKey>('newest')
  const [quickFilter, setQuickFilter] = useState<JobsQuickFilter>('all')

  useEffect(() => {
    let isActive = true

    async function loadPageData() {
      setLoading(true)
      setErrorMessage('')

      const currentProfile = await getCurrentUserProfile()

      if (!isActive) return

      if (!currentProfile) {
        setRole(null)
        setJobs([])
        setLoading(false)
        return
      }

      setRole(currentProfile.role)

      const [stagesRes, profilesRes] = await Promise.all([
        supabase
          .from('pipeline_stages')
          .select('id, name, sort_order')
          .order('sort_order', { ascending: true }),
        supabase
          .from('profiles')
          .select('id, full_name, role, manager_id')
          .eq('is_active', true)
          .order('full_name', { ascending: true }),
      ])

      if (!isActive) return

      if (stagesRes.error || profilesRes.error) {
        setStageOptions([])
        setProfileOptions([])
        setJobs([])
        setErrorMessage(
          stagesRes.error?.message ??
            profilesRes.error?.message ??
            'Unable to load jobs filters.'
        )
        setLoading(false)
        return
      }

      setStageOptions((stagesRes.data ?? []) as StageOption[])
      setProfileOptions((profilesRes.data ?? []) as ProfileOption[])
      const stageRows = (stagesRes.data ?? []) as StageOption[]

      const baseQuery = supabase
        .from('jobs')
        .select(`
          id,
          insurance_carrier,
          claim_number,
          contract_amount,
          deposit_collected,
          remaining_balance,
          install_date,
          updated_at,
          homeowners (
            name,
            phone,
            address,
            email
          ),
          pipeline_stages (
            id,
            name
            ,
            sort_order
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

        if (!isActive) return

        if (error) {
          setErrorMessage(error.message)
          setLoading(false)
          return
        }

        const rows = (data ?? []) as JobRow[]
        setJobs(rows)
        setLoading(false)
        return
      }

      const { data: assignedRows, error: assignedError } = await supabase
        .from('job_reps')
        .select('job_id')
        .eq('profile_id', currentProfile.id)

      if (!isActive) return

      if (assignedError) {
        setErrorMessage(assignedError.message)
        setLoading(false)
        return
      }

      const jobIds = [
        ...new Set(
          ((assignedRows ?? []) as AssignedJobRef[]).map((row) => row.job_id)
        ),
      ]

      if (jobIds.length === 0) {
        setJobs([])
        setLoading(false)
        return
      }

      const { data, error } = await baseQuery.in('id', jobIds)

      if (!isActive) return

      if (error) {
        setErrorMessage(error.message)
        setLoading(false)
        return
      }

      const rows = ((data ?? []) as JobRow[]).filter(
        (row) => !isManagementLockedStage(row.pipeline_stages, stageRows)
      )
      setJobs(rows)
      setLoading(false)
    }

    void loadPageData()

    return () => {
      isActive = false
    }
  }, [])

  const filteredJobs = useMemo(() => {
    let next = jobs.filter((job) => !isArchivedByInactivity(job.updated_at))
    const loweredSearch = search.trim().toLowerCase()

    if (loweredSearch) {
      next = next.filter((job) => {
        const homeowner = getHomeowner(job.homeowners)
        const repNames = getRepNames(job.job_reps).join(' ').toLowerCase()

        return (
          homeowner?.name?.toLowerCase().includes(loweredSearch) ||
          homeowner?.address?.toLowerCase().includes(loweredSearch) ||
          homeowner?.email?.toLowerCase().includes(loweredSearch) ||
          homeowner?.phone?.toLowerCase().includes(loweredSearch) ||
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

    if (quickFilter === 'unassigned') {
      next = next.filter((job) => (job.job_reps ?? []).length === 0)
    }

    if (quickFilter === 'has_install') {
      next = next.filter((job) => Boolean(job.install_date))
    }

    if (quickFilter === 'no_install') {
      next = next.filter((job) => !job.install_date)
    }

    if (quickFilter === 'high_value') {
      next = next.filter((job) => Number(job.contract_amount ?? 0) >= 15000)
    }

    next.sort((a, b) => {
      if (sortKey === 'contract_high') {
        return Number(b.contract_amount ?? 0) - Number(a.contract_amount ?? 0)
      }

      if (sortKey === 'install_soonest') {
        const aTime = a.install_date
          ? new Date(a.install_date).getTime()
          : Number.MAX_SAFE_INTEGER
        const bTime = b.install_date
          ? new Date(b.install_date).getTime()
          : Number.MAX_SAFE_INTEGER
        return aTime - bTime
      }

      if (sortKey === 'homeowner_az') {
        const aName = getHomeowner(a.homeowners)?.name ?? ''
        const bName = getHomeowner(b.homeowners)?.name ?? ''
        return aName.localeCompare(bName)
      }

      return 0
    })

    return next
  }, [
    jobs,
    search,
    stageFilter,
    repFilter,
    managerFilter,
    profileOptions,
    quickFilter,
    sortKey,
  ])

  const managers = useMemo(
    () =>
      profileOptions.filter(
        (p) =>
          p.role === 'manager' ||
          p.role === 'admin' ||
          p.role === 'sales_manager'
      ),
    [profileOptions]
  )

  const reps = useMemo(
    () => profileOptions.filter((p) => p.role === 'rep'),
    [profileOptions]
  )

  const visibleStageOptions = useMemo(
    () =>
      isManagerLike(role)
        ? stageOptions
        : stageOptions.filter(
            (stage) => !isManagementLockedStage(stage, stageOptions)
          ),
    [role, stageOptions]
  )

  const normalizedJobs = useMemo<JobCardRow[]>(
    () =>
      filteredJobs.map((job) => {
        const homeowner = getHomeowner(job.homeowners)

        return {
          id: job.id,
          homeownerName: homeowner?.name ?? 'Unnamed Homeowner',
          phone: homeowner?.phone ?? '-',
          email: homeowner?.email ?? '-',
          address: homeowner?.address ?? '-',
          stageName: getStageName(job.pipeline_stages),
          repNames: getRepNames(job.job_reps),
          insuranceCarrier: job.insurance_carrier ?? '-',
          claimNumber: job.claim_number ?? '-',
          installDate: job.install_date,
          contractAmount: job.contract_amount,
          depositCollected: job.deposit_collected,
          remainingBalance: job.remaining_balance,
        }
      }),
    [filteredJobs]
  )

  const totalContractAmount = useMemo(
    () => filteredJobs.reduce((sum, job) => sum + Number(job.contract_amount ?? 0), 0),
    [filteredJobs]
  )

  const totalDepositCollected = useMemo(
    () => filteredJobs.reduce((sum, job) => sum + Number(job.deposit_collected ?? 0), 0),
    [filteredJobs]
  )

  const totalRemainingBalance = useMemo(
    () => filteredJobs.reduce((sum, job) => sum + Number(job.remaining_balance ?? 0), 0),
    [filteredJobs]
  )

  const archivedCount = useMemo(
    () => jobs.filter((job) => isArchivedByInactivity(job.updated_at)).length,
    [jobs]
  )

  const unassignedCount = useMemo(
    () => filteredJobs.filter((job) => (job.job_reps ?? []).length === 0).length,
    [filteredJobs]
  )

  const stageCounts = useMemo(() => {
    const counts = new Map<string, number>()

    filteredJobs.forEach((job) => {
      const stage = getStageName(job.pipeline_stages)
      counts.set(stage, (counts.get(stage) ?? 0) + 1)
    })

    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }))
  }, [filteredJobs])

  return (
    <main>
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.22),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_26%)]" />
          <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,179,122,0.7),transparent)]" />

          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b37a]">
                Jobs
              </div>

              <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
                Deal Pipeline
              </h1>

              <p className="mt-3 max-w-3xl text-base leading-7 text-white/68 md:text-lg">
                Search, filter, sort, export, and move through claims, contracts,
                installs, and assigned reps from one control surface.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <JobsExportTools rows={normalizedJobs} />
              <Link
                href="/archive"
                className="rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.1]"
              >
                Open Archive
              </Link>
              <Link
                href="/jobs/new"
                className="rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85]"
              >
                Create Job
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">
              Visible Jobs
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-white">
              {filteredJobs.length}
            </div>
            <div className="mt-1 text-xs text-[#d6b37a]">
              {archivedCount} archived after {ARCHIVE_INACTIVITY_DAYS} days
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">
              Contract Volume
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-white">
              {formatCurrency(totalContractAmount)}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">
              Deposits Collected
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-white">
              {formatCurrency(totalDepositCollected)}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">
              Remaining / Unassigned
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-white">
              {formatCurrency(totalRemainingBalance)}
            </div>
            <div className="mt-1 text-xs text-[#d6b37a]">
              {unassignedCount} unassigned job(s)
            </div>
          </div>
        </section>

        <JobsStageRail
          counts={stageCounts}
          activeStage={stageFilter}
          onStageChange={setStageFilter}
        />

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr_1fr]">
            <input
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#d6b37a]/35"
              placeholder="Search homeowner, address, carrier, claim, rep..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
            >
              <option value="">All Stages</option>
              {visibleStageOptions.map((stage) => (
                <option key={stage.id} value={stage.name}>
                  {stage.name}
                </option>
              ))}
            </select>

            {isManagerLike(role) ? (
              <select
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
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
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
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

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <JobsQuickFilters active={quickFilter} onChange={setQuickFilter} />

            <div className="flex flex-wrap items-center gap-3">
              <JobsSortSelect value={sortKey} onChange={setSortKey} />
              <JobsViewSwitcher view={viewMode} onViewChange={setViewMode} />
            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-white/60 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
            Loading jobs...
          </div>
        ) : errorMessage ? (
          <div className="rounded-[2rem] border border-red-400/20 bg-red-500/10 p-4 text-red-200 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
            Error loading jobs: {errorMessage}
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-white/60 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
            No jobs match the current filters.
          </div>
        ) : viewMode === 'table' ? (
          <JobsTable rows={normalizedJobs} />
        ) : viewMode === 'kanban' ? (
          <JobsKanban rows={normalizedJobs} />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {normalizedJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
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
