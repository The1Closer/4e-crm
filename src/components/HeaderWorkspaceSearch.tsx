'use client'

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ArrowUpRight,
  ChevronDown,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { isManagerLike, type UserProfile } from '@/lib/auth-helpers'
import { supabase } from '@/lib/supabase'

type SearchScope = 'all' | 'homeowner' | 'address' | 'claim' | 'rep'

type SearchJobRep = {
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

type SearchJobRow = {
  id: string
  claim_number: string | null
  insurance_carrier: string | null
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
        name: string | null
      }
    | {
        name: string | null
      }[]
    | null
  job_reps: SearchJobRep[] | null
}

type AssignedJobRef = {
  job_id: string
}

type SearchResult = {
  id: string
  homeownerName: string
  address: string
  stageName: string
  claimNumber: string
  insuranceCarrier: string
  repNames: string[]
  updatedAt: number
  score: number
}

const SEARCH_SCOPE_OPTIONS: { value: SearchScope; label: string }[] = [
  { value: 'all', label: 'All Jobs' },
  { value: 'homeowner', label: 'Homeowner' },
  { value: 'address', label: 'Address' },
  { value: 'claim', label: 'Claim / Carrier' },
  { value: 'rep', label: 'Rep' },
]

function getHomeowner(job: SearchJobRow['homeowners']) {
  if (!job) return null
  return Array.isArray(job) ? job[0] ?? null : job
}

function getStageName(stage: SearchJobRow['pipeline_stages']) {
  if (!stage) return 'No Stage'
  const value = Array.isArray(stage) ? stage[0] ?? null : stage
  return value?.name ?? 'No Stage'
}

function getRepNames(jobReps: SearchJobRow['job_reps']) {
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

function scoreMatch(
  value: string,
  query: string,
  weights: {
    startsWith: number
    includes: number
  }
) {
  const normalizedValue = value.trim().toLowerCase()

  if (!normalizedValue) return 0
  if (normalizedValue.startsWith(query)) return weights.startsWith
  if (normalizedValue.includes(query)) return weights.includes
  return 0
}

function buildSearchResult(
  job: SearchJobRow,
  query: string,
  scope: SearchScope
) {
  const homeowner = getHomeowner(job.homeowners)
  const repNames = getRepNames(job.job_reps)
  const homeownerName = homeowner?.name ?? 'Unnamed Homeowner'
  const address = homeowner?.address ?? '-'
  const claimNumber = job.claim_number ?? '-'
  const insuranceCarrier = job.insurance_carrier ?? '-'
  const stageName = getStageName(job.pipeline_stages)
  const updatedAt = job.updated_at ? new Date(job.updated_at).getTime() : 0

  const homeownerScore = scoreMatch(homeownerName, query, {
    startsWith: 140,
    includes: 110,
  })
  const addressScore = scoreMatch(address, query, {
    startsWith: 120,
    includes: 90,
  })
  const claimScore = Math.max(
    scoreMatch(claimNumber, query, {
      startsWith: 100,
      includes: 80,
    }),
    scoreMatch(insuranceCarrier, query, {
      startsWith: 95,
      includes: 70,
    })
  )
  const repScore = repNames.reduce(
    (best, repName) =>
      Math.max(
        best,
        scoreMatch(repName, query, {
          startsWith: 85,
          includes: 65,
        })
      ),
    0
  )

  let score = 0

  if (scope === 'all' || scope === 'homeowner') score = Math.max(score, homeownerScore)
  if (scope === 'all' || scope === 'address') score = Math.max(score, addressScore)
  if (scope === 'all' || scope === 'claim') score = Math.max(score, claimScore)
  if (scope === 'all' || scope === 'rep') score = Math.max(score, repScore)

  if (scope === 'all') {
    score += Math.round((homeownerScore + addressScore + claimScore + repScore) / 8)
  }

  if (score === 0) return null

  return {
    id: job.id,
    homeownerName,
    address,
    stageName,
    claimNumber,
    insuranceCarrier,
    repNames,
    updatedAt,
    score,
  } satisfies SearchResult
}

export default function HeaderWorkspaceSearch({
  profile,
  className,
}: {
  profile: UserProfile | null
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const rootRef = useRef<HTMLDivElement | null>(null)

  const [scope, setScope] = useState<SearchScope>('all')
  const [query, setQuery] = useState('')
  const [jobs, setJobs] = useState<SearchJobRow[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [loadedProfileId, setLoadedProfileId] = useState<string | null>(null)

  const deferredQuery = useDeferredValue(query)
  const normalizedQuery = deferredQuery.trim().toLowerCase()

  const ensureJobsLoaded = useCallback(async () => {
    if (!profile?.id || loading || loadedProfileId === profile.id) return

    setLoading(true)

    try {
      let visibleJobIds: string[] | null = null

      if (!isManagerLike(profile.role)) {
        const { data: assignedRows, error: assignedError } = await supabase
          .from('job_reps')
          .select('job_id')
          .eq('profile_id', profile.id)

        if (assignedError) {
          throw assignedError
        }

        visibleJobIds = [
          ...new Set(
            ((assignedRows ?? []) as AssignedJobRef[]).map((row) => row.job_id)
          ),
        ]

        if (visibleJobIds.length === 0) {
          setJobs([])
          setLoadedProfileId(profile.id)
          return
        }
      }

      let jobsQuery = supabase
        .from('jobs')
        .select(`
          id,
          claim_number,
          insurance_carrier,
          updated_at,
          homeowners (
            name,
            address
          ),
          pipeline_stages (
            name
          ),
          job_reps (
            profile_id,
            profiles (
              full_name
            )
          )
        `)
        .order('updated_at', { ascending: false })

      if (visibleJobIds) {
        jobsQuery = jobsQuery.in('id', visibleJobIds)
      }

      const { data, error } = await jobsQuery

      if (error) {
        throw error
      }

      setJobs((data ?? []) as SearchJobRow[])
      setLoadedProfileId(profile.id)
    } catch {
      setJobs([])
    } finally {
      setLoading(false)
    }
  }, [loadedProfileId, loading, profile])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    setJobs([])
    setLoadedProfileId(null)
  }, [profile?.id])

  useEffect(() => {
    if (!open && !query.trim()) return

    void ensureJobsLoaded()
  }, [ensureJobsLoaded, open, query])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [])

  const searchResults = useMemo(() => {
    if (!normalizedQuery) {
      return jobs.slice(0, 6).map((job) => {
        const homeowner = getHomeowner(job.homeowners)

        return {
          id: job.id,
          homeownerName: homeowner?.name ?? 'Unnamed Homeowner',
          address: homeowner?.address ?? '-',
          stageName: getStageName(job.pipeline_stages),
          claimNumber: job.claim_number ?? '-',
          insuranceCarrier: job.insurance_carrier ?? '-',
          repNames: getRepNames(job.job_reps),
          updatedAt: job.updated_at ? new Date(job.updated_at).getTime() : 0,
          score: 0,
        } satisfies SearchResult
      })
    }

    return jobs
      .map((job) => buildSearchResult(job, normalizedQuery, scope))
      .filter((result): result is SearchResult => Boolean(result))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score
        }

        return right.updatedAt - left.updatedAt
      })
      .slice(0, 8)
  }, [jobs, normalizedQuery, scope])

  function openJobsSearch() {
    const normalizedSearch = query.trim()
    setOpen(false)

    if (!normalizedSearch) {
      router.push('/jobs')
      return
    }

    router.push(`/jobs?search=${encodeURIComponent(normalizedSearch)}`)
  }

  function openJob(jobId: string) {
    setOpen(false)
    router.push(`/jobs/${jobId}`)
  }

  return (
    <div ref={rootRef} className={className}>
      <div className="relative">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            openJobsSearch()
          }}
          className="flex items-center gap-2 rounded-[1.55rem] border border-white/10 bg-white/[0.05] p-2 shadow-[0_14px_40px_rgba(0,0,0,0.22)] backdrop-blur-2xl"
        >
          <label className="flex min-w-0 shrink-0 items-center gap-2 rounded-[1.15rem] border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
            <ChevronDown className="h-4 w-4 text-[#d6b37a]" />
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as SearchScope)}
              onFocus={() => {
                setOpen(true)
                void ensureJobsLoaded()
              }}
              className="w-[112px] bg-transparent text-[11px] text-white outline-none"
              aria-label="Search scope"
            >
              {SEARCH_SCOPE_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  className="bg-[#101010] text-white"
                >
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <Search className="h-4 w-4 shrink-0 text-[#d6b37a]" />

          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setOpen(true)
            }}
            onFocus={() => {
              setOpen(true)
              void ensureJobsLoaded()
            }}
            placeholder="Search jobs, homeowners, addresses, claims, reps..."
            className="min-w-0 flex-1 bg-transparent px-1 text-sm text-white outline-none placeholder:text-white/32"
          />

          {loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-white/55" />
          ) : null}
        </form>

        {open ? (
          <div className="absolute inset-x-0 top-[calc(100%+0.75rem)] z-[80] overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#0c0c0c]/96 shadow-[0_30px_80px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
            <div className="border-b border-white/10 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
                {normalizedQuery ? 'Search Results' : 'Recent Jobs'}
              </div>
              <div className="mt-1 text-sm text-white/55">
                {normalizedQuery
                  ? 'Jump into a file or open the full jobs board with this search.'
                  : 'Start typing to search by homeowner, address, claim, carrier, or rep.'}
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto p-2">
              {loading && jobs.length === 0 ? (
                <div className="flex items-center gap-3 rounded-[1.25rem] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-white/55">
                  <Loader2 className="h-4 w-4 animate-spin text-[#d6b37a]" />
                  Loading searchable jobs...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="rounded-[1.25rem] border border-dashed border-white/12 px-4 py-4 text-sm text-white/52">
                  No matching jobs found for this search yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => openJob(result.id)}
                      className="flex w-full items-start justify-between gap-4 rounded-[1.3rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-white/18 hover:bg-white/[0.06]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-sm font-semibold text-white">
                            {result.homeownerName}
                          </div>
                          <div className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#d6b37a]">
                            {result.stageName}
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-white/55">
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-[#d6b37a]" />
                            {result.address}
                          </span>

                          {result.repNames.length > 0 ? (
                            <span className="inline-flex items-center gap-1.5">
                              <UserRound className="h-3.5 w-3.5 text-[#d6b37a]" />
                              {result.repNames.join(', ')}
                            </span>
                          ) : null}

                          {result.claimNumber !== '-' || result.insuranceCarrier !== '-' ? (
                            <span className="inline-flex items-center gap-1.5">
                              <ShieldCheck className="h-3.5 w-3.5 text-[#d6b37a]" />
                              {[result.claimNumber, result.insuranceCarrier]
                                .filter((value) => value !== '-')
                                .join(' • ')}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-white/28" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-white/10 p-2">
              <button
                type="button"
                onClick={openJobsSearch}
                className="inline-flex w-full items-center justify-center gap-2 rounded-[1.2rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
              >
                <Search className="h-4 w-4 text-[#d6b37a]" />
                {normalizedQuery ? 'Open Full Jobs Search' : 'Open Jobs Board'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
