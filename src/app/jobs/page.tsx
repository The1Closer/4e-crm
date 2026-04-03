'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { authorizedFetch } from '@/lib/api-client'
import ProtectedRoute from '@/components/ProtectedRoute'
import {
  getCurrentUserProfile,
  getPermissions,
  isManagerLike,
} from '@/lib/auth-helpers'
import JobCard from '@/components/jobs/JobCard'
import JobsStageRail from '@/components/jobs/JobsStageRail'
import JobsViewSwitcher, { type JobsViewMode } from '@/components/jobs/JobsViewSwitcher'
import JobsSortSelect, { type JobsSortKey } from '@/components/jobs/JobsSortSelect'
import JobsQuickFilters, {
  type JobsQuickFilter,
} from '@/components/jobs/JobsQuickFilters'
import JobsExportTools from '@/components/jobs/JobsExportTools'
import JobsTable from '@/components/jobs/JobsTable'
import JobsKanban from '@/components/jobs/JobsKanban'
import JobsQuickEditDialog from '@/components/jobs/JobsQuickEditDialog'
import JobsPagination from '@/components/jobs/JobsPagination'
import {
  type JobListRow,
  type JobRepOption,
  type JobStageOption,
} from '@/components/jobs/job-types'
import { ARCHIVE_INACTIVITY_DAYS, isArchivedByInactivity } from '@/lib/job-lifecycle'
import {
  getVisibleStagesForUser,
  isInstallScheduledStage,
  isInstallWorkflowStage,
  isManagementLockedStage,
  isPreProductionPrepStage,
} from '@/lib/job-stage-access'

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
  supplemented_amount: number | null
  install_date: string | null
  created_at: string | null
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

type ProfileOption = {
  id: string
  full_name: string
  role: string | null
  manager_id: string | null
}

type AssignedJobRef = {
  job_id: string
}

type TaskSignalRow = {
  job_id: string | null
  title: string | null
  due_at: string | null
  scheduled_for: string | null
  created_at: string | null
}

type NotificationSignalRow = {
  job_id: string | null
  type: string | null
  created_at: string | null
}

type JobTaskSignal = {
  overdueOpenCount: number
  overdueFollowUpCount: number
}

type JobNotificationSignal = {
  recentUnreadCount: number
  recentMentionCount: number
}

const PAGE_SIZE_BY_VIEW: Record<JobsViewMode, number> = {
  cards: 9,
  table: 10,
  kanban: 999,
}
const TABLE_PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

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

function getStage(stage: JobRow['pipeline_stages']) {
  if (!stage) return null
  return Array.isArray(stage) ? stage[0] ?? null : stage
}

function getStageName(stage: JobRow['pipeline_stages']) {
  return getStage(stage)?.name ?? 'No Stage'
}

function toTime(value: string | null | undefined, fallback: number) {
  if (!value) return fallback
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? fallback : parsed
}

function normalizeStageLabel(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function isFinanciallyClosedStage(stageName: string) {
  const normalized = normalizeStageLabel(stageName)
  return normalized.includes('paid in full') || normalized === 'paid'
}

function isInstallCompletedStage(stageName: string) {
  const normalized = normalizeStageLabel(stageName)
  return (
    normalized.includes('install complete') ||
    normalized.includes('installed') ||
    normalized.includes('final qc') ||
    normalized.includes('complete')
  )
}

function getStageSortOrder(
  job: JobRow,
  stageOrderById: Map<number, number>
) {
  const stage = getStage(job.pipeline_stages)
  if (!stage) return Number.MAX_SAFE_INTEGER
  if (typeof stage.sort_order === 'number') return stage.sort_order
  if (typeof stage.id === 'number') {
    return stageOrderById.get(stage.id) ?? Number.MAX_SAFE_INTEGER
  }
  return Number.MAX_SAFE_INTEGER
}

function getFirstAssignedRep(job: JobRow) {
  const repNames = getRepNames(job.job_reps)
  return repNames[0] ?? ''
}

function getSmartPriorityScore(params: {
  job: JobRow
  now: Date
  stageOrderById: Map<number, number>
  taskSignal: JobTaskSignal
  notificationSignal: JobNotificationSignal
}) {
  const { job, now, taskSignal, notificationSignal } = params
  const stageName = getStageName(job.pipeline_stages)
  const normalizedStage = normalizeStageLabel(stageName)
  const updatedAtMs = toTime(job.updated_at, 0)
  const ageDays = updatedAtMs > 0 ? (now.getTime() - updatedAtMs) / 86_400_000 : 999
  const installAtMs = job.install_date
    ? new Date(`${job.install_date}T00:00:00`).getTime()
    : Number.NaN
  const hasInstallDate = Number.isFinite(installAtMs)
  const installDaysAway = hasInstallDate
    ? (installAtMs - now.getTime()) / 86_400_000
    : Number.POSITIVE_INFINITY
  const outstanding = Number(job.remaining_balance ?? 0)
  const hasUnassignedTeam = (job.job_reps ?? []).length === 0

  let score = 0

  if (taskSignal.overdueOpenCount > 0) {
    score += 40 + Math.min(20, (taskSignal.overdueOpenCount - 1) * 5)
  }

  if (taskSignal.overdueFollowUpCount > 0) {
    score += 20 + Math.min(10, (taskSignal.overdueFollowUpCount - 1) * 3)
  }

  if (hasInstallDate && installDaysAway < 0) {
    score += 40
  } else if (hasInstallDate && installDaysAway <= 3) {
    score += 35
  } else if (hasInstallDate && installDaysAway <= 7) {
    score += 20
  }

  const activeMidStages = new Set([
    'contingency',
    'adjuster meeting',
    'partial approval',
    'approved',
    'contracted',
    'contracted awaiting deposit',
    'contracted awaiting manager approval',
    'deposit collected awaiting manager approval',
    'pre-production prep',
    'contracted/pre-production prep',
    'contracted / pre-production prep',
  ])

  if (activeMidStages.has(normalizedStage) && ageDays >= 7) {
    score += 25
  }

  if (isInstallCompletedStage(stageName) && outstanding > 0) {
    score += 30
  }

  if (
    (normalizedStage.includes('coc') || normalizedStage.includes('certificate')) &&
    outstanding > 0
  ) {
    score += 20
  }

  if (hasUnassignedTeam) {
    score += 15
  }

  if (notificationSignal.recentUnreadCount > 0) {
    score += 10
  }

  if (notificationSignal.recentMentionCount > 0) {
    score += 5
  }

  if (activeMidStages.has(normalizedStage) && ageDays <= 2) {
    score += 10
  }

  if (!isFinanciallyClosedStage(stageName) && outstanding > 0 && hasInstallDate) {
    score += 10
  }

  if (
    !isFinanciallyClosedStage(stageName) &&
    getStageSortOrder(job, params.stageOrderById) < Number.MAX_SAFE_INTEGER
  ) {
    score += 5
  }

  return score
}

function compareWithRecentUpdateFallback(
  a: JobRow,
  b: JobRow,
  primary: number
) {
  if (primary !== 0) return primary
  return toTime(b.updated_at, 0) - toTime(a.updated_at, 0)
}

function buildTaskSignalsByJob(rows: TaskSignalRow[], nowMs: number) {
  const map: Record<string, JobTaskSignal> = {}

  rows.forEach((row) => {
    if (!row.job_id) return

    const jobId = row.job_id
    if (!map[jobId]) {
      map[jobId] = {
        overdueOpenCount: 0,
        overdueFollowUpCount: 0,
      }
    }

    const dueMs = toTime(
      row.due_at ?? row.scheduled_for ?? row.created_at,
      Number.NaN
    )

    if (!Number.isFinite(dueMs) || dueMs >= nowMs) {
      return
    }

    map[jobId].overdueOpenCount += 1

    const normalizedTitle = (row.title ?? '').trim().toLowerCase()
    if (
      normalizedTitle.includes('follow up') ||
      normalizedTitle.includes('follow-up')
    ) {
      map[jobId].overdueFollowUpCount += 1
    }
  })

  return map
}

function buildNotificationSignalsByJob(
  rows: NotificationSignalRow[],
  nowMs: number
) {
  const map: Record<string, JobNotificationSignal> = {}
  const recentThresholdMs = 7 * 24 * 60 * 60 * 1000

  rows.forEach((row) => {
    if (!row.job_id) return

    const createdAtMs = toTime(row.created_at, Number.NaN)
    if (!Number.isFinite(createdAtMs)) return

    const ageMs = nowMs - createdAtMs
    if (ageMs < 0 || ageMs > recentThresholdMs) return

    const jobId = row.job_id
    if (!map[jobId]) {
      map[jobId] = {
        recentUnreadCount: 0,
        recentMentionCount: 0,
      }
    }

    map[jobId].recentUnreadCount += 1

    const type = (row.type ?? '').trim().toLowerCase()
    if (type.includes('mention')) {
      map[jobId].recentMentionCount += 1
    }
  })

  return map
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

function getRepIds(jobReps: JobRep[] | null): string[] {
  if (!jobReps || jobReps.length === 0) return []

  return [...new Set(jobReps.map((rep) => rep.profile_id).filter(Boolean))]
}

function JobsPageContent() {
  const searchParams = useSearchParams()
  const requestedSearch = searchParams.get('search')?.trim() ?? ''
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [pageMessage, setPageMessage] = useState('')
  const [pageMessageTone, setPageMessageTone] = useState<'success' | 'error'>(
    'success'
  )
  const [role, setRole] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState('')
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null)
  const [movingJobId, setMovingJobId] = useState<string | null>(null)

  const [stageOptions, setStageOptions] = useState<JobStageOption[]>([])
  const [profileOptions, setProfileOptions] = useState<ProfileOption[]>([])

  const [search, setSearch] = useState(requestedSearch)
  const [stageFilters, setStageFilters] = useState<string[]>([])
  const [managerFilter, setManagerFilter] = useState('')
  const [repFilter, setRepFilter] = useState('')
  const [viewMode, setViewMode] = useState<JobsViewMode>('cards')
  const [sortKey, setSortKey] = useState<JobsSortKey>('smart_priority')
  const [quickFilter, setQuickFilter] = useState<JobsQuickFilter>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [tablePageSize, setTablePageSize] = useState(10)
  const [editingJob, setEditingJob] = useState<JobListRow | null>(null)
  const [taskSignalsByJobId, setTaskSignalsByJobId] = useState<
    Record<string, JobTaskSignal>
  >({})
  const [notificationSignalsByJobId, setNotificationSignalsByJobId] = useState<
    Record<string, JobNotificationSignal>
  >({})

  const loadPrioritySignals = useCallback(
    async (params: { userId: string; jobIds: string[] }) => {
      if (params.jobIds.length === 0) {
        setTaskSignalsByJobId({})
        setNotificationSignalsByJobId({})
        return
      }

      const [tasksRes, notificationsRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('job_id, title, due_at, scheduled_for, created_at')
          .eq('status', 'open')
          .in('job_id', params.jobIds),
        supabase
          .from('notifications')
          .select('job_id, type, created_at')
          .eq('user_id', params.userId)
          .eq('is_read', false)
          .in('job_id', params.jobIds),
      ])

      const nowMs = Date.now()

      if (tasksRes.error) {
        console.error('Could not load task urgency signals.', tasksRes.error)
        setTaskSignalsByJobId({})
      } else {
        setTaskSignalsByJobId(
          buildTaskSignalsByJob((tasksRes.data ?? []) as TaskSignalRow[], nowMs)
        )
      }

      if (notificationsRes.error) {
        console.error(
          'Could not load notification urgency signals.',
          notificationsRes.error
        )
        setNotificationSignalsByJobId({})
      } else {
        setNotificationSignalsByJobId(
          buildNotificationSignalsByJob(
            (notificationsRes.data ?? []) as NotificationSignalRow[],
            nowMs
          )
        )
      }
    },
    []
  )

  const loadPageData = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')

    const currentProfile = await getCurrentUserProfile()

    if (!currentProfile) {
      setRole(null)
      setCurrentUserId('')
      setJobs([])
      setTaskSignalsByJobId({})
      setNotificationSignalsByJobId({})
      setLoading(false)
      return
    }

    setRole(currentProfile.role)
    setCurrentUserId(currentProfile.id)

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

    const nextStages = (stagesRes.data ?? []) as JobStageOption[]
    const nextProfiles = (profilesRes.data ?? []) as ProfileOption[]
    setStageOptions(nextStages)
    setProfileOptions(nextProfiles)

    const baseQuery = supabase
      .from('jobs')
      .select(`
        id,
        insurance_carrier,
        claim_number,
        contract_amount,
        deposit_collected,
        remaining_balance,
        supplemented_amount,
        install_date,
        created_at,
        updated_at,
        homeowners (
          name,
          phone,
          address,
          email
        ),
        pipeline_stages (
          id,
          name,
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

    let nextJobs: JobRow[] = []

    if (isManagerLike(currentProfile.role)) {
      const { data, error } = await baseQuery

      if (error) {
        setErrorMessage(error.message)
        setLoading(false)
        return
      }

      nextJobs = (data ?? []) as JobRow[]
    } else {
      const { data: assignedRows, error: assignedError } = await supabase
        .from('job_reps')
        .select('job_id')
        .eq('profile_id', currentProfile.id)

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

      if (jobIds.length > 0) {
        const { data, error } = await baseQuery.in('id', jobIds)

        if (error) {
          setErrorMessage(error.message)
          setLoading(false)
          return
        }

        nextJobs = (data ?? []) as JobRow[]
      }
    }

    setJobs(nextJobs)

    try {
      await loadPrioritySignals({
        userId: currentProfile.id,
        jobIds: nextJobs.map((job) => job.id),
      })
    } catch (signalError) {
      console.error('Could not build priority signals.', signalError)
      setTaskSignalsByJobId({})
      setNotificationSignalsByJobId({})
    }

    setLoading(false)
  }, [loadPrioritySignals])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPageData()
    }, 0)

    return () => clearTimeout(timer)
  }, [loadPageData])

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1)
    }, 0)

    return () => clearTimeout(timer)
  }, [search, stageFilters, managerFilter, repFilter, quickFilter, sortKey, viewMode])

  useEffect(() => {
    setSearch(requestedSearch)
  }, [requestedSearch])

  const baseFilteredJobs = useMemo(() => {
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

    if (quickFilter === 'mine' && currentUserId) {
      next = next.filter((job) =>
        (job.job_reps ?? []).some((rep) => rep.profile_id === currentUserId)
      )
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

    return next
  }, [
    jobs,
    search,
    repFilter,
    managerFilter,
    profileOptions,
    quickFilter,
    currentUserId,
  ])

  const filteredJobs = useMemo(() => {
    const next =
      stageFilters.length > 0
        ? baseFilteredJobs.filter((job) =>
            stageFilters.includes(getStageName(job.pipeline_stages))
          )
        : [...baseFilteredJobs]

    const stageOrderById = new Map<number, number>()

    stageOptions.forEach((stage, index) => {
      stageOrderById.set(stage.id, stage.sort_order ?? index)
    })

    const now = new Date()

    next.sort((a, b) => {
      if (sortKey === 'smart_priority') {
        const defaultTaskSignal: JobTaskSignal = {
          overdueOpenCount: 0,
          overdueFollowUpCount: 0,
        }
        const defaultNotificationSignal: JobNotificationSignal = {
          recentUnreadCount: 0,
          recentMentionCount: 0,
        }
        const aScore = getSmartPriorityScore({
          job: a,
          now,
          stageOrderById,
          taskSignal: taskSignalsByJobId[a.id] ?? defaultTaskSignal,
          notificationSignal:
            notificationSignalsByJobId[a.id] ?? defaultNotificationSignal,
        })
        const bScore = getSmartPriorityScore({
          job: b,
          now,
          stageOrderById,
          taskSignal: taskSignalsByJobId[b.id] ?? defaultTaskSignal,
          notificationSignal:
            notificationSignalsByJobId[b.id] ?? defaultNotificationSignal,
        })
        return compareWithRecentUpdateFallback(a, b, bScore - aScore)
      }

      if (sortKey === 'newest_created') {
        return compareWithRecentUpdateFallback(
          a,
          b,
          toTime(b.created_at, 0) - toTime(a.created_at, 0)
        )
      }

      if (sortKey === 'oldest_created') {
        return compareWithRecentUpdateFallback(
          a,
          b,
          toTime(a.created_at, Number.MAX_SAFE_INTEGER) -
            toTime(b.created_at, Number.MAX_SAFE_INTEGER)
        )
      }

      if (sortKey === 'recently_updated') {
        return toTime(b.updated_at, 0) - toTime(a.updated_at, 0)
      }

      if (sortKey === 'least_recently_updated') {
        return toTime(a.updated_at, Number.MAX_SAFE_INTEGER) - toTime(b.updated_at, Number.MAX_SAFE_INTEGER)
      }

      if (sortKey === 'pipeline_stage_order') {
        return compareWithRecentUpdateFallback(
          a,
          b,
          getStageSortOrder(a, stageOrderById) - getStageSortOrder(b, stageOrderById)
        )
      }

      if (sortKey === 'install_soonest') {
        const aTime = a.install_date
          ? new Date(a.install_date).getTime()
          : Number.MAX_SAFE_INTEGER
        const bTime = b.install_date
          ? new Date(b.install_date).getTime()
          : Number.MAX_SAFE_INTEGER
        return compareWithRecentUpdateFallback(a, b, aTime - bTime)
      }

      if (sortKey === 'balance_high') {
        return compareWithRecentUpdateFallback(
          a,
          b,
          Number(b.remaining_balance ?? 0) - Number(a.remaining_balance ?? 0)
        )
      }

      if (sortKey === 'homeowner_az') {
        const aName = getHomeowner(a.homeowners)?.name ?? ''
        const bName = getHomeowner(b.homeowners)?.name ?? ''
        return compareWithRecentUpdateFallback(a, b, aName.localeCompare(bName))
      }

      if (sortKey === 'homeowner_za') {
        const aName = getHomeowner(a.homeowners)?.name ?? ''
        const bName = getHomeowner(b.homeowners)?.name ?? ''
        return compareWithRecentUpdateFallback(a, b, bName.localeCompare(aName))
      }

      if (sortKey === 'address_az') {
        const aAddress = getHomeowner(a.homeowners)?.address ?? ''
        const bAddress = getHomeowner(b.homeowners)?.address ?? ''
        return compareWithRecentUpdateFallback(a, b, aAddress.localeCompare(bAddress))
      }

      if (sortKey === 'address_za') {
        const aAddress = getHomeowner(a.homeowners)?.address ?? ''
        const bAddress = getHomeowner(b.homeowners)?.address ?? ''
        return compareWithRecentUpdateFallback(a, b, bAddress.localeCompare(aAddress))
      }

      if (sortKey === 'assigned_rep') {
        const aRep = getFirstAssignedRep(a)
        const bRep = getFirstAssignedRep(b)

        if (!aRep && bRep) {
          return compareWithRecentUpdateFallback(a, b, 1)
        }

        if (aRep && !bRep) {
          return compareWithRecentUpdateFallback(a, b, -1)
        }

        return compareWithRecentUpdateFallback(
          a,
          b,
          aRep.localeCompare(bRep)
        )
      }

      return compareWithRecentUpdateFallback(a, b, 0)
    })

    return next
  }, [
    baseFilteredJobs,
    notificationSignalsByJobId,
    stageOptions,
    stageFilters,
    sortKey,
    taskSignalsByJobId,
  ])

  const managers = useMemo(
    () =>
      profileOptions.filter((profile) => isManagerLike(profile.role)),
    [profileOptions]
  )

  const reps = useMemo<JobRepOption[]>(
    () =>
      profileOptions
        .map((profile) => ({
          id: profile.id,
          full_name: profile.full_name,
        })),
    [profileOptions]
  )

  const visibleReps = useMemo<JobRepOption[]>(
    () => {
      if (!managerFilter) {
        return reps
      }

      const managerTeamIds = new Set(
        profileOptions
          .filter(
            (profile) =>
              profile.id === managerFilter || profile.manager_id === managerFilter
          )
          .map((profile) => profile.id)
      )

      return reps.filter((rep) => managerTeamIds.has(rep.id))
    },
    [managerFilter, profileOptions, reps]
  )

  const visibleStageOptions = useMemo(() => stageOptions, [stageOptions])
  const canManageLockedStages = useMemo(
    () => getPermissions(role).canManageLockedStages,
    [role]
  )
  const kanbanStageOptions = useMemo<JobStageOption[]>(
    () =>
      getVisibleStagesForUser(stageOptions, canManageLockedStages).filter(
        (stage): stage is JobStageOption =>
          typeof stage.id === 'number' && typeof stage.name === 'string'
      ),
    [canManageLockedStages, stageOptions]
  )

  const normalizedJobs = useMemo<JobListRow[]>(
    () =>
      filteredJobs.map((job) => {
        const homeowner = getHomeowner(job.homeowners)
        const stage = getStage(job.pipeline_stages)

        return {
          id: job.id,
          homeownerName: homeowner?.name ?? 'Unnamed Homeowner',
          phone: homeowner?.phone ?? '-',
          email: homeowner?.email ?? '-',
          address: homeowner?.address ?? '-',
          stageId: stage?.id ?? null,
          stageName: stage?.name ?? 'No Stage',
          repNames: getRepNames(job.job_reps),
          repIds: getRepIds(job.job_reps),
          insuranceCarrier: job.insurance_carrier ?? '-',
          claimNumber: job.claim_number ?? '-',
          installDate: job.install_date,
          contractAmount: job.contract_amount,
          depositCollected: job.deposit_collected,
          remainingBalance: job.remaining_balance,
          supplementedAmount: job.supplemented_amount,
        }
      }),
    [filteredJobs]
  )

  const pageSize = viewMode === 'table' ? tablePageSize : PAGE_SIZE_BY_VIEW[viewMode]
  const totalPages =
    viewMode === 'kanban'
      ? 1
      : Math.max(1, Math.ceil(normalizedJobs.length / pageSize))
  const paginatedJobs =
    viewMode === 'kanban'
      ? normalizedJobs
      : normalizedJobs.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  useEffect(() => {
    if (viewMode === 'kanban') return

    const maxPage = Math.max(1, Math.ceil(normalizedJobs.length / pageSize))

    const timer = setTimeout(() => {
      setCurrentPage((current) => Math.min(current, maxPage))
    }, 0)

    return () => clearTimeout(timer)
  }, [normalizedJobs.length, pageSize, viewMode])

  useEffect(() => {
    if (!repFilter) {
      return
    }

    if (visibleReps.some((rep) => rep.id === repFilter)) {
      return
    }

    const timer = setTimeout(() => {
      setRepFilter('')
    }, 0)

    return () => clearTimeout(timer)
  }, [repFilter, visibleReps])

  const totalContractAmount = useMemo(
    () => filteredJobs.reduce((sum, job) => sum + Number(job.contract_amount ?? 0), 0),
    [filteredJobs]
  )

  const totalDepositCollected = useMemo(
    () =>
      filteredJobs.reduce((sum, job) => sum + Number(job.deposit_collected ?? 0), 0),
    [filteredJobs]
  )

  const totalRemainingBalance = useMemo(
    () =>
      filteredJobs.reduce((sum, job) => sum + Number(job.remaining_balance ?? 0), 0),
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

    baseFilteredJobs.forEach((job) => {
      const stageName = getStageName(job.pipeline_stages)
      counts.set(stageName, (counts.get(stageName) ?? 0) + 1)
    })

    const orderedCounts = visibleStageOptions
      .map((stage) => ({
        name: stage.name,
        count: counts.get(stage.name) ?? 0,
      }))
      .filter((stage) => stage.count > 0)

    const noStageCount = counts.get('No Stage')

    if (noStageCount && noStageCount > 0) {
      orderedCounts.push({
        name: 'No Stage',
        count: noStageCount,
      })
    }

    return orderedCounts
  }, [baseFilteredJobs, visibleStageOptions])

  function toggleStageFilter(stageName: string) {
    setStageFilters((current) =>
      current.includes(stageName)
        ? current.filter((value) => value !== stageName)
        : [...current, stageName]
    )
  }

  function getStageOptionById(stageId: number | null, stageName?: string) {
    if (stageId === null) {
      return null
    }

    return (
      stageOptions.find((stage) => stage.id === stageId) ?? {
        id: stageId,
        name: stageName ?? 'Unknown Stage',
        sort_order: null,
      }
    )
  }

  function getKanbanMoveDisabledReason(job: JobListRow) {
    const currentStage = getStageOptionById(job.stageId, job.stageName)

    if (
      currentStage &&
      isManagementLockedStage(currentStage, stageOptions) &&
      !isInstallWorkflowStage(currentStage) &&
      !canManageLockedStages
    ) {
      return 'Only management can move jobs once they reach Pre-Production Prep or later.'
    }

    return null
  }

  async function handleKanbanMove(job: JobListRow, nextStageId: number | null) {
    if (movingJobId || deletingJobId) {
      return
    }

    const currentStage = getStageOptionById(job.stageId, job.stageName)
    const requestedStage = getStageOptionById(nextStageId)

    if (nextStageId !== null && !requestedStage) {
      setPageMessageTone('error')
      setPageMessage('That status is no longer available.')
      return
    }

    if (
      currentStage &&
      isManagementLockedStage(currentStage, stageOptions) &&
      !isInstallWorkflowStage(currentStage) &&
      !canManageLockedStages
    ) {
      setPageMessageTone('error')
      setPageMessage(
        'Only management can change the stage once a job reaches Pre-Production Prep or later.'
      )
      return
    }

    if (requestedStage && isInstallScheduledStage(requestedStage) && !job.installDate) {
      setPageMessageTone('error')
      setPageMessage('Set an install date before moving this job into Install Scheduled.')
      return
    }

    if (
      requestedStage &&
      isManagementLockedStage(requestedStage, stageOptions) &&
      !isInstallWorkflowStage(requestedStage) &&
      !canManageLockedStages
    ) {
      setPageMessageTone('error')
      setPageMessage('Only management can move jobs into Pre-Production Prep and later stages.')
      return
    }

    const nextInstallDate =
      requestedStage && isPreProductionPrepStage(requestedStage) ? null : job.installDate
    const noChange =
      job.stageId === (requestedStage?.id ?? null) && job.installDate === nextInstallDate

    if (noChange) {
      return
    }

    setMovingJobId(job.id)
    setPageMessage('')

    const response = await authorizedFetch(`/api/jobs/${job.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        stage_id: requestedStage?.id ?? null,
        install_date: nextInstallDate,
      }),
    })

    const result = (await response.json().catch(() => null)) as
      | { error?: string }
      | null

    if (!response.ok) {
      setPageMessageTone('error')
      setPageMessage(result?.error || 'Could not update the job stage.')
      setMovingJobId(null)
      return
    }

    setJobs((current) =>
      current.map((entry) =>
        entry.id === job.id
          ? {
              ...entry,
              install_date: nextInstallDate,
              updated_at: new Date().toISOString(),
              pipeline_stages: requestedStage
                ? {
                    id: requestedStage.id,
                    name: requestedStage.name,
                    sort_order: requestedStage.sort_order ?? null,
                  }
                : null,
            }
          : entry
      )
    )

    setPageMessageTone('success')
    setPageMessage(
      requestedStage
        ? nextInstallDate === null &&
          job.installDate &&
          isPreProductionPrepStage(requestedStage)
          ? `${job.homeownerName} moved to ${requestedStage.name}. The install date was cleared.`
          : `${job.homeownerName} moved to ${requestedStage.name}.`
        : `${job.homeownerName} moved to No Stage.`
    )
    setMovingJobId(null)
  }

  async function handleQuickEditSaved() {
    await loadPageData()
    setPageMessageTone('success')
    setPageMessage('Job updated.')
  }

  async function handleDeleteJob(job: JobListRow) {
    if (deletingJobId) return

    const confirmed = window.confirm(
      `Delete ${job.homeownerName}? This will remove the job, notes, uploads, and related records.`
    )

    if (!confirmed) return

    setDeletingJobId(job.id)
    setPageMessage('')

    try {
      const response = await authorizedFetch(`/api/jobs/${job.id}`, {
        method: 'DELETE',
      })

      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null

      if (!response.ok) {
        setPageMessageTone('error')
        setPageMessage(result?.error || 'Could not delete the job.')
        return
      }

      if (editingJob?.id === job.id) {
        setEditingJob(null)
      }

      await loadPageData()
      setPageMessageTone('success')
      setPageMessage('Job deleted.')
    } catch (error) {
      setPageMessageTone('error')
      setPageMessage(
        error instanceof Error ? error.message : 'Could not delete the job.'
      )
    } finally {
      setDeletingJobId(null)
    }
  }

  const canDeleteJobs = isManagerLike(role)

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
                Faster list management, cleaner filters, quick edits, and shorter pages so the pipeline stays usable when volume climbs.
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
          <MetricCard
            label="Visible Jobs"
            value={String(filteredJobs.length)}
            sub={`${archivedCount} archived after ${ARCHIVE_INACTIVITY_DAYS} days`}
          />
          <MetricCard
            label="Contract Volume"
            value={formatCurrency(totalContractAmount)}
          />
          <MetricCard
            label="Total Paid"
            value={formatCurrency(totalDepositCollected)}
          />
          <MetricCard
            label="Remaining Balance"
            value={formatCurrency(totalRemainingBalance)}
            sub={`${unassignedCount} unassigned job(s)`}
          />
        </section>

        <JobsStageRail
          counts={stageCounts}
          activeStages={stageFilters}
          onStageToggle={toggleStageFilter}
          onClearStages={() => setStageFilters([])}
        />

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          <div className="crm-control-row crm-control-row--2 crm-control-row--4 crm-grid-safe">
            <input
              className="crm-clamp-input rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#d6b37a]/35"
              placeholder="Search homeowner, address, carrier, claim, rep..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/72">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
                Stage Stack
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {stageFilters.length === 0 ? (
                  <span className="text-sm text-white/45">
                    Use the status rail above to stack multiple stages.
                  </span>
                ) : (
                  stageFilters.map((stageName) => (
                    <button
                      key={stageName}
                      type="button"
                      onClick={() => toggleStageFilter(stageName)}
                      className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/[0.14]"
                    >
                      {stageName}
                    </button>
                  ))
                )}
              </div>
            </div>

            {isManagerLike(role) ? (
              <select
                className="crm-clamp-input rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
                value={managerFilter}
                onChange={(event) => setManagerFilter(event.target.value)}
              >
                <option value="">All Sales Managers</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.full_name}
                  </option>
                ))}
              </select>
            ) : null}

            <select
              className="crm-clamp-input rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
              value={repFilter}
              onChange={(event) => setRepFilter(event.target.value)}
            >
              <option value="">
                {managerFilter ? 'All Team Assignees' : 'All Assignees'}
              </option>
              {visibleReps.map((rep) => (
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

        {pageMessage ? (
          <section
            className={
              pageMessageTone === 'error'
                ? 'rounded-[1.6rem] border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl'
                : 'rounded-[1.6rem] border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl'
            }
          >
            {pageMessage}
          </section>
        ) : null}

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
        ) : (
          <>
            {viewMode === 'table' ? (
              <JobsTable
                rows={paginatedJobs}
                onQuickEdit={setEditingJob}
                canDelete={canDeleteJobs}
                deletingJobId={deletingJobId}
                onDelete={handleDeleteJob}
              />
            ) : viewMode === 'kanban' ? (
              <JobsKanban
                rows={paginatedJobs}
                stageOptions={kanbanStageOptions}
                onQuickEdit={setEditingJob}
                canDelete={canDeleteJobs}
                deletingJobId={deletingJobId}
                onDelete={handleDeleteJob}
                onMoveJob={handleKanbanMove}
                movingJobId={movingJobId}
                getMoveDisabledReason={getKanbanMoveDisabledReason}
              />
            ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {paginatedJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onQuickEdit={setEditingJob}
                    canDelete={canDeleteJobs}
                    deletingJobId={deletingJobId}
                    onDelete={handleDeleteJob}
                  />
                ))}
              </div>
            )}

            {viewMode !== 'kanban' ? (
              <JobsPagination
                page={currentPage}
                totalPages={totalPages}
                totalItems={normalizedJobs.length}
                pageSize={pageSize}
                itemLabel="jobs"
                onPageChange={setCurrentPage}
                pageSizeOptions={
                  viewMode === 'table' ? TABLE_PAGE_SIZE_OPTIONS : undefined
                }
                onPageSizeChange={
                  viewMode === 'table'
                    ? (nextPageSize) => {
                        if (!TABLE_PAGE_SIZE_OPTIONS.includes(nextPageSize)) {
                          return
                        }

                        setTablePageSize(nextPageSize)
                        setCurrentPage(1)
                      }
                    : undefined
                }
              />
            ) : null}
          </>
        )}
      </div>

      <JobsQuickEditDialog
        open={Boolean(editingJob)}
        job={editingJob}
        stages={visibleStageOptions}
        reps={reps}
        onClose={() => setEditingJob(null)}
        onSaved={handleQuickEditSaved}
      />
    </main>
  )
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-white">
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-[#d6b37a]">{sub}</div> : null}
    </div>
  )
}

export default function JobsPage() {
  return (
    <ProtectedRoute>
      <JobsPageContent />
    </ProtectedRoute>
  )
}
