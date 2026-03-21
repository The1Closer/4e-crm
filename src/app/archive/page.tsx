'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getCurrentUserProfile, isManagerLike } from '@/lib/auth-helpers'
import {
  ARCHIVE_INACTIVITY_DAYS,
  getArchiveCutoffDate,
  isArchivedByInactivity,
} from '@/lib/job-lifecycle'
import { supabase } from '@/lib/supabase'

type JobRep = {
  profile_id: string
  profiles:
    | {
        full_name: string | null
      }
    | {
        full_name: string | null
      }[]
    | null
}

type JobRow = {
  id: string
  insurance_carrier: string | null
  claim_number: string | null
  contract_amount: number | null
  remaining_balance: number | null
  updated_at: string | null
  install_date: string | null
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

type AssignedJobRef = {
  job_id: string
}

function getHomeowner(
  homeowner: JobRow['homeowners']
): {
  name: string | null
  address: string | null
} | null {
  if (!homeowner) return null
  return Array.isArray(homeowner) ? homeowner[0] ?? null : homeowner
}

function getStageName(stage: JobRow['pipeline_stages']) {
  if (!stage) return 'No Stage'
  const item = Array.isArray(stage) ? stage[0] ?? null : stage
  return item?.name ?? 'No Stage'
}

function getRepNames(jobReps: JobRep[] | null) {
  if (!jobReps?.length) return []

  return jobReps
    .map((rep) => {
      const profile = Array.isArray(rep.profiles)
        ? rep.profiles[0] ?? null
        : rep.profiles

      return profile?.full_name ?? null
    })
    .filter((value): value is string => Boolean(value))
}

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return '-'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDateTime(value: string | null) {
  if (!value) return 'Unknown'
  return new Date(value).toLocaleString('en-US')
}

function getDaysInactive(value: string | null) {
  if (!value) return 0

  const diff = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(diff) || diff < 0) return 0
  return Math.floor(diff / (24 * 60 * 60 * 1000))
}

function ArchivePageContent() {
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let isActive = true

    async function loadArchive() {
      setLoading(true)
      setMessage('')

      const currentProfile = await getCurrentUserProfile()

      if (!isActive) return

      if (!currentProfile) {
        setJobs([])
        setLoading(false)
        return
      }

      let visibleJobIds: string[] | null = null

      if (!isManagerLike(currentProfile.role)) {
        const { data: assignedRows, error: assignedError } = await supabase
          .from('job_reps')
          .select('job_id')
          .eq('profile_id', currentProfile.id)

        if (!isActive) return

        if (assignedError) {
          setJobs([])
          setMessage(assignedError.message)
          setLoading(false)
          return
        }

        visibleJobIds = [
          ...new Set(
            ((assignedRows ?? []) as AssignedJobRef[]).map((row) => row.job_id)
          ),
        ]

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
          insurance_carrier,
          claim_number,
          contract_amount,
          remaining_balance,
          install_date,
          updated_at,
          homeowners (
            name,
            address
          ),
          pipeline_stages (
            id,
            name,
            sort_order
          ),
          job_reps (
            profile_id,
            profiles (
              full_name
            )
          )
        `)
        .order('updated_at', { ascending: true })

      if (visibleJobIds) {
        query = query.in('id', visibleJobIds)
      }

      const { data, error } = await query

      if (!isActive) return

      if (error) {
        setJobs([])
        setMessage(error.message)
        setLoading(false)
        return
      }

      const nextJobs = (data ?? []) as JobRow[]
      setJobs(nextJobs.filter((job) => isArchivedByInactivity(job.updated_at)))
      setLoading(false)
    }

    void loadArchive()

    return () => {
      isActive = false
    }
  }, [])

  const filteredJobs = useMemo(() => {
    const loweredSearch = search.trim().toLowerCase()

    if (!loweredSearch) {
      return jobs
    }

    return jobs.filter((job) => {
      const homeowner = getHomeowner(job.homeowners)
      const repNames = getRepNames(job.job_reps).join(' ').toLowerCase()

      return (
        homeowner?.name?.toLowerCase().includes(loweredSearch) ||
        homeowner?.address?.toLowerCase().includes(loweredSearch) ||
        job.claim_number?.toLowerCase().includes(loweredSearch) ||
        job.insurance_carrier?.toLowerCase().includes(loweredSearch) ||
        repNames.includes(loweredSearch)
      )
    })
  }, [jobs, search])

  const cutoffLabel = useMemo(
    () => getArchiveCutoffDate().toLocaleDateString('en-US'),
    []
  )

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.22),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_26%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,179,122,0.7),transparent)]" />

        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b37a]">
              Archive
            </div>

            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
              Inactive Jobs Vault
            </h1>

            <p className="mt-3 max-w-3xl text-base leading-7 text-white/68 md:text-lg">
              Jobs move here automatically after {ARCHIVE_INACTIVITY_DAYS} days without activity. Cutoff for this workspace is currently {cutoffLabel}.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/jobs"
              className="rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.1]"
            >
              Active Jobs
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <ArchiveMetric label="Archived Jobs" value={String(jobs.length)} />
        <ArchiveMetric
          label="Longest Inactive"
          value={String(Math.max(...jobs.map((job) => getDaysInactive(job.updated_at)), 0))}
          suffix="days"
        />
        <ArchiveMetric label="Search Results" value={String(filteredJobs.length)} />
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
        <input
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#d6b37a]/35"
          placeholder="Search homeowner, address, carrier, claim, rep..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </section>

      {message ? (
        <section className="rounded-[2rem] border border-red-400/20 bg-red-500/10 p-4 text-red-200 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          {message}
        </section>
      ) : null}

      {loading ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-white/60 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          Loading archive...
        </section>
      ) : filteredJobs.length === 0 ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-white/60 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          No archived jobs match the current search.
        </section>
      ) : (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredJobs.map((job) => {
            const homeowner = getHomeowner(job.homeowners)
            const repNames = getRepNames(job.job_reps)

            return (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="group block rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.25)] backdrop-blur-2xl transition duration-200 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-white">
                      {homeowner?.name ?? 'Unnamed Homeowner'}
                    </h2>
                    <p className="mt-1 truncate text-sm text-white/55">
                      {homeowner?.address ?? '-'}
                    </p>
                  </div>

                  <div className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100">
                    {getDaysInactive(job.updated_at)}d idle
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <ArchiveFact label="Stage" value={getStageName(job.pipeline_stages)} />
                  <ArchiveFact
                    label="Last Activity"
                    value={formatDateTime(job.updated_at)}
                  />
                  <ArchiveFact
                    label="Contract"
                    value={formatCurrency(job.contract_amount)}
                  />
                  <ArchiveFact
                    label="Remaining"
                    value={formatCurrency(job.remaining_balance)}
                  />
                </div>

                <div className="mt-5 rounded-[1.35rem] border border-white/10 bg-black/20 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
                    Assigned Team
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {repNames.length === 0 ? (
                      <span className="text-sm text-white/55">No one assigned</span>
                    ) : (
                      repNames.map((rep) => (
                        <span
                          key={rep}
                          className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-white/75"
                        >
                          {rep}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </section>
      )}
    </div>
  )
}

function ArchiveMetric({
  label,
  value,
  suffix = '',
}: {
  label: string
  value: string
  suffix?: string
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-white">
        {value}
        {suffix ? ` ${suffix}` : ''}
      </div>
    </div>
  )
}

function ArchiveFact({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
        {label}
      </div>
      <div className="mt-1 font-medium text-white">{value}</div>
    </div>
  )
}

export default function ArchivePage() {
  return (
    <ProtectedRoute>
      <ArchivePageContent />
    </ProtectedRoute>
  )
}
