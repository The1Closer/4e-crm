'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import ProtectedRoute from '../../components/ProtectedRoute'
import {
  ARCHIVE_INACTIVITY_DAYS,
  isArchivedByInactivity,
} from '@/lib/job-lifecycle'
import {
  getCurrentUserProfile,
  getPermissions,
  type UserProfile,
} from '@/lib/auth-helpers'
import {
  getManagementStageThreshold,
  normalizeStageName,
  type PipelineStageRecord,
} from '@/lib/job-stage-access'
import { supabase } from '../../lib/supabase'

type JobRow = {
  id: string
  contract_amount: number | null
  supplemented_amount: number | null
  remaining_balance: number | null
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
        id: number | null
        name: string | null
        sort_order: number | null
      }
    | {
        id: number | null
        name: string | null
        sort_order: number | null
      }[]
    | null
  job_reps:
    | {
        profile_id: string
        profiles:
          | {
              full_name: string | null
            }
          | {
              full_name: string | null
            }[]
          | null
      }[]
    | null
}

type CommissionType = 'junior' | 'regular' | 'senior' | 'legend'

type CommissionRow = {
  id: string
  job_id: string
  material_cost: number
  additional_material_cost: number
  additional_job_cost: number
  material_refund: number
  labor_cost: number
  rep_1_profile_id: string | null
  rep_1_commission_type: CommissionType | null
  rep_1_front_end_paid: boolean
  rep_1_front_end_locked_amount: number
  rep_2_profile_id: string | null
  rep_2_commission_type: CommissionType | null
  rep_2_front_end_paid: boolean
  rep_2_front_end_locked_amount: number
  all_commissions_paid: boolean
  all_commissions_paid_at: string | null
}

type RepOption = {
  id: string
  full_name: string
}

type CommissionDraft = {
  material_cost: string
  additional_material_cost: string
  additional_job_cost: string
  material_refund: string
  labor_cost: string
  rep_1_profile_id: string
  rep_1_commission_type: string
  rep_2_profile_id: string
  rep_2_commission_type: string
}

const COMMISSION_OPTIONS: { value: CommissionType; label: string }[] = [
  { value: 'junior', label: 'Junior' },
  { value: 'regular', label: 'Regular' },
  { value: 'senior', label: 'Senior' },
  { value: 'legend', label: 'Legend' },
]

const SURFACE_CLASS =
  'relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl before:pointer-events-none before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgba(214,179,122,0.72),transparent)]'

const SUB_SURFACE_CLASS =
  'rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]'

const INPUT_CLASS =
  'w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/24 focus:border-[#d6b37a]/35'

const FIELD_LABEL_CLASS =
  'mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/42'

const SECONDARY_BUTTON_CLASS =
  'rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50'

const PRIMARY_BUTTON_CLASS =
  'rounded-2xl bg-[#d6b37a] px-4 py-2.5 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85] disabled:cursor-not-allowed disabled:opacity-50'

const MUTED_TEXT_CLASS = 'text-white/60'

const MANAGEMENT_PAYOUT_RULES = [
  {
    key: 'grsm',
    label: 'GRSM',
    description: '2% of effective contract total',
  },
  {
    key: 'sales_manager',
    label: 'Sales Manager',
    description: '12.5% of gross profit',
  },
  {
    key: 'production_manager',
    label: 'Production Manager',
    description: '5% of effective contract total',
  },
] as const

const COMMISSION_STAGE_FALLBACK_LABELS = new Set([
  'contracted',
  'contract signed',
  'signed contract',
  'contract executed',
  'pre-production prep',
  'pre production prep',
  'production',
  'production ready',
  'scheduled',
  'install scheduled',
  'install',
  'installed',
  'final qc',
  'complete',
  'completed',
  'paid in full',
  'paid',
])

function QueueMetricCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className={`${SURFACE_CLASS} p-4`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d6b37a]/88">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-white">{value}</div>
    </div>
  )
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

function getStage(stage: JobRow['pipeline_stages']) {
  if (!stage) return null
  return Array.isArray(stage) ? stage[0] ?? null : stage
}

function getAssignedReps(jobReps: JobRow['job_reps']): RepOption[] {
  if (!jobReps || jobReps.length === 0) return []

  return jobReps
    .map((rep) => {
      const profile = Array.isArray(rep.profiles)
        ? rep.profiles[0] ?? null
        : rep.profiles

      if (!profile?.full_name) return null

      return {
        id: rep.profile_id,
        full_name: profile.full_name,
      }
    })
    .filter((x): x is RepOption => Boolean(x))
    .slice(0, 2)
}

function toMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

function commissionLabel(value: CommissionType | null) {
  if (!value) return 'Not Set'
  return COMMISSION_OPTIONS.find((x) => x.value === value)?.label ?? value
}

function normalizeCommissionType(value: string): CommissionType | null {
  if (value === 'junior' || value === 'regular' || value === 'senior' || value === 'legend') {
    return value
  }
  return null
}

function getPaidInFullStageThreshold(stages: PipelineStageRecord[]) {
  const paidStage = stages.find((stage) => {
    const normalized = normalizeStageName(stage.name)

    return (
      normalized === 'paid in full' ||
      normalized === 'paid' ||
      normalized.includes('paid in full')
    )
  })

  if (!paidStage) return null

  if (paidStage.sort_order !== null && paidStage.sort_order !== undefined) {
    return paidStage.sort_order
  }

  return stages.findIndex((stage) => stage.id === paidStage.id)
}

function isStageWithinCommissionWindow(params: {
  stageName: string
  stageSortOrder: number | null | undefined
  contractedThreshold: number | null
  paidThreshold: number | null
}) {
  const { stageName, stageSortOrder, contractedThreshold, paidThreshold } = params

  if (contractedThreshold !== null && stageSortOrder !== null && stageSortOrder !== undefined) {
    if (stageSortOrder < contractedThreshold) return false
    if (paidThreshold !== null && stageSortOrder > paidThreshold) return false
    return true
  }

  const normalized = normalizeStageName(stageName)

  if (COMMISSION_STAGE_FALLBACK_LABELS.has(normalized)) return true

  return (
    normalized.includes('contract') ||
    normalized.includes('production') ||
    normalized.includes('install') ||
    normalized.includes('paid')
  )
}

function shouldShowInQueue(params: {
  stageName: string
  stageSortOrder: number | null | undefined
  contractedThreshold: number | null
  paidThreshold: number | null
  paid: boolean
}) {
  const { stageName, stageSortOrder, contractedThreshold, paidThreshold, paid } = params

  if (paid) return false

  return isStageWithinCommissionWindow({
    stageName,
    stageSortOrder,
    contractedThreshold,
    paidThreshold,
  })
}

function calculateRepCommission(params: {
  effectiveContractTotal: number
  grossProfit: number
  type: CommissionType | null
  isSplit: boolean
  frontEndPaid: boolean
  lockedFrontEndAmount: number
}) {
  const {
    effectiveContractTotal,
    grossProfit,
    type,
    isSplit,
    frontEndPaid,
    lockedFrontEndAmount,
  } = params

  if (!type) {
    return {
      frontEndCurrent: 0,
      frontEndDisplay: 0,
      totalCommission: 0,
      backEndCommission: 0,
    }
  }

  const splitFactor = isSplit ? 0.5 : 1

  let frontEndCurrent = 0
  let totalCommission = 0

  if (type === 'junior') {
    frontEndCurrent = effectiveContractTotal * 0.08 * splitFactor
    totalCommission = frontEndCurrent
  }

  if (type === 'regular') {
    frontEndCurrent = effectiveContractTotal * 0.08 * splitFactor
    totalCommission = grossProfit * 0.25 * splitFactor
  }

  if (type === 'senior') {
    frontEndCurrent = effectiveContractTotal * 0.08 * splitFactor
    totalCommission = grossProfit * 0.30 * splitFactor
  }

  if (type === 'legend') {
    frontEndCurrent = effectiveContractTotal * 0.10 * splitFactor
    const adminFee = effectiveContractTotal * 0.10 * splitFactor
    totalCommission = Math.max(0, (grossProfit - adminFee) * 0.5 * splitFactor)
  }

  const frontEndDisplay = frontEndPaid ? lockedFrontEndAmount : frontEndCurrent
  const backEndCommission = Math.max(0, totalCommission - frontEndDisplay)

  return {
    frontEndCurrent,
    frontEndDisplay,
    totalCommission,
    backEndCommission,
  }
}

function calculateManagementPayouts(params: {
  effectiveContractTotal: number
  grossProfit: number
}) {
  const { effectiveContractTotal, grossProfit } = params

  const grsm = effectiveContractTotal * 0.02
  const salesManager = Math.max(0, grossProfit) * 0.125
  const productionManager = effectiveContractTotal * 0.05
  const total = grsm + salesManager + productionManager

  return {
    grsm,
    salesManager,
    productionManager,
    total,
  }
}

function buildDraft(job: JobRow, row?: CommissionRow): CommissionDraft {
  const assignedReps = getAssignedReps(job.job_reps)

  return {
    material_cost: String(row?.material_cost ?? ''),
    additional_material_cost: String(row?.additional_material_cost ?? ''),
    additional_job_cost: String(row?.additional_job_cost ?? ''),
    material_refund: String(row?.material_refund ?? ''),
    labor_cost: String(row?.labor_cost ?? ''),
    rep_1_profile_id: row?.rep_1_profile_id ?? assignedReps[0]?.id ?? '',
    rep_1_commission_type: row?.rep_1_commission_type ?? '',
    rep_2_profile_id: row?.rep_2_profile_id ?? assignedReps[1]?.id ?? '',
    rep_2_commission_type: row?.rep_2_commission_type ?? '',
  }
}

function matchesCommissionSearch(job: JobRow, search: string) {
  const normalizedSearch = search.trim().toLowerCase()

  if (!normalizedSearch) return true

  const homeowner = getHomeowner(job.homeowners)
  const stageName = getStageName(job.pipeline_stages).toLowerCase()
  const repNames = getAssignedReps(job.job_reps)
    .map((rep) => rep.full_name.toLowerCase())
    .join(' ')

  return (
    homeowner?.name?.toLowerCase().includes(normalizedSearch) ||
    homeowner?.address?.toLowerCase().includes(normalizedSearch) ||
    stageName.includes(normalizedSearch) ||
    repNames.includes(normalizedSearch)
  )
}

export default function CommissionsPage() {
  return (
    <ProtectedRoute>
      <CommissionsPageContent />
    </ProtectedRoute>
  )
}

function ValueCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className={`${SUB_SURFACE_CLASS} p-4`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/82">
        {label}
      </div>
      <div className="mt-2 text-xl font-bold tracking-tight text-white">{value}</div>
    </div>
  )
}

function CommissionsPageContent() {
  const [loading, setLoading] = useState(true)
  const [savingJobId, setSavingJobId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [profile, setProfile] = useState<UserProfile | null>(null)

  const [jobs, setJobs] = useState<JobRow[]>([])
  const [pipelineStages, setPipelineStages] = useState<PipelineStageRecord[]>([])
  const [commissionRows, setCommissionRows] = useState<Record<string, CommissionRow>>({})
  const [drafts, setDrafts] = useState<Record<string, CommissionDraft>>({})

  async function loadData() {
    setLoading(true)
    setMessage('')

    const [currentProfile, jobsRes, commissionsRes, stagesRes] = await Promise.all([
      getCurrentUserProfile(),
      supabase
        .from('jobs')
        .select(`
          id,
          contract_amount,
          supplemented_amount,
          remaining_balance,
          updated_at,
          homeowners (
            name,
            address
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
              full_name
            )
          )
        `)
        .order('created_at', { ascending: false }),

      supabase
        .from('job_commissions')
        .select('*'),

      supabase
        .from('pipeline_stages')
        .select('id, name, sort_order')
        .order('sort_order', { ascending: true }),
    ])

    if (!currentProfile) {
      setMessage('Unable to load your profile.')
      setLoading(false)
      return
    }

    if (jobsRes.error) {
      setMessage(jobsRes.error.message)
      setLoading(false)
      return
    }

    if (commissionsRes.error) {
      setMessage(commissionsRes.error.message)
      setLoading(false)
      return
    }

    if (stagesRes.error) {
      setMessage(stagesRes.error.message)
      setLoading(false)
      return
    }

    const permissions = getPermissions(currentProfile.role)
    const jobsData = (jobsRes.data ?? []) as JobRow[]
    const commissionData = (commissionsRes.data ?? []) as CommissionRow[]
    const stagesData = (stagesRes.data ?? []) as PipelineStageRecord[]
    const visibleJobs = permissions.canViewAllCommissions
      ? jobsData
      : jobsData.filter((job) =>
          (job.job_reps ?? []).some((rep) => rep.profile_id === currentProfile.id)
        )

    const byJobId: Record<string, CommissionRow> = {}
    commissionData.forEach((row) => {
      byJobId[row.job_id] = row
    })

    const nextDrafts: Record<string, CommissionDraft> = {}
    visibleJobs.forEach((job) => {
      nextDrafts[job.id] = buildDraft(job, byJobId[job.id])
    })

    setProfile(currentProfile)
    setJobs(visibleJobs)
    setPipelineStages(stagesData)
    setCommissionRows(byJobId)
    setDrafts(nextDrafts)
    setLoading(false)
  }

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => {
      window.clearTimeout(loadTimer)
    }
  }, [])

  function updateDraft(jobId: string, field: keyof CommissionDraft, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [jobId]: {
        ...prev[jobId],
        [field]: value,
      },
    }))
  }

  const permissions = useMemo(() => getPermissions(profile?.role), [profile?.role])
  const contractedThreshold = useMemo(
    () => getManagementStageThreshold(pipelineStages),
    [pipelineStages]
  )
  const paidThreshold = useMemo(
    () => getPaidInFullStageThreshold(pipelineStages),
    [pipelineStages]
  )

  async function saveCommissionRow(jobId: string, extraPartial?: Partial<CommissionRow>) {
    setSavingJobId(jobId)
    setMessage('')

    const job = jobs.find((j) => j.id === jobId)
    if (!job) {
      setMessage('Job not found.')
      setSavingJobId(null)
      return
    }

    const draft = drafts[jobId]
    const existing = commissionRows[jobId]
    const assignedReps = getAssignedReps(job.job_reps)

    const payload = {
      job_id: jobId,
      material_cost: Number(draft?.material_cost || 0),
      additional_material_cost: Number(draft?.additional_material_cost || 0),
      additional_job_cost: Number(draft?.additional_job_cost || 0),
      material_refund: Number(draft?.material_refund || 0),
      labor_cost: Number(draft?.labor_cost || 0),

      rep_1_profile_id: draft?.rep_1_profile_id || assignedReps[0]?.id || null,
      rep_1_commission_type: normalizeCommissionType(draft?.rep_1_commission_type || ''),
      rep_1_front_end_paid: existing?.rep_1_front_end_paid ?? false,
      rep_1_front_end_locked_amount: existing?.rep_1_front_end_locked_amount ?? 0,

      rep_2_profile_id: draft?.rep_2_profile_id || assignedReps[1]?.id || null,
      rep_2_commission_type: normalizeCommissionType(draft?.rep_2_commission_type || ''),
      rep_2_front_end_paid: existing?.rep_2_front_end_paid ?? false,
      rep_2_front_end_locked_amount: existing?.rep_2_front_end_locked_amount ?? 0,

      all_commissions_paid: existing?.all_commissions_paid ?? false,
      all_commissions_paid_at: existing?.all_commissions_paid_at ?? null,

      ...extraPartial,
    }

    const { error } = await supabase
      .from('job_commissions')
      .upsert(payload, {
        onConflict: 'job_id',
      })

    if (error) {
      setMessage(error.message)
      setSavingJobId(null)
      return
    }

    await loadData()
    setSavingJobId(null)
  }

  const queueJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (isArchivedByInactivity(job.updated_at)) {
        return false
      }

      const stage = getStage(job.pipeline_stages)
      const stageName = stage?.name ?? 'No Stage'
      const existing = commissionRows[job.id]
      const allPaid = existing?.all_commissions_paid ?? false

      return shouldShowInQueue({
        stageName,
        stageSortOrder: stage?.sort_order,
        contractedThreshold,
        paidThreshold,
        paid: allPaid,
      })
    })
  }, [commissionRows, contractedThreshold, jobs, paidThreshold])

  const filteredQueueJobs = useMemo(
    () => queueJobs.filter((job) => matchesCommissionSearch(job, search)),
    [queueJobs, search]
  )

  return (
    <main className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.22),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_26%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,179,122,0.7),transparent)]" />

        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b37a]">
              Commissions
            </div>

            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
              Payout Command Queue
            </h1>

            <p className="mt-3 max-w-3xl text-base leading-7 text-white/68 md:text-lg">
              Review contracted-through-paid jobs, lock front-end payouts, calculate backend commissions, and let files fall out of the queue as soon as all commissions are marked paid.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/archive" className={SECONDARY_BUTTON_CLASS}>
              Archive
            </Link>
            <Link href="/" className={PRIMARY_BUTTON_CLASS}>
              Home
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <QueueMetricCard label="Active Queue" value={String(queueJobs.length)} />
        <QueueMetricCard
          label="Access Scope"
          value={permissions.canViewAllCommissions ? 'All Jobs' : 'Assigned Only'}
        />
        <QueueMetricCard
          label="Archive Threshold"
          value={`${ARCHIVE_INACTIVITY_DAYS} days`}
        />
      </section>

      <section className={`${SURFACE_CLASS} p-5`}>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <label className="block">
            <div className={FIELD_LABEL_CLASS}>Search Queue</div>
            <div className="flex items-center gap-3 rounded-[1.35rem] border border-white/10 bg-black/20 px-4 py-3">
              <Search className="h-4 w-4 text-[#d6b37a]" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                placeholder="Search homeowner, address, stage, or assignee..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </label>

          <div className={`${SUB_SURFACE_CLASS} flex items-center justify-between gap-4 px-4 py-3`}>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/82">
                Visible Results
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-white">
                {filteredQueueJobs.length}
              </div>
            </div>

            <div className="text-right text-sm text-white/55">
              <div>{filteredQueueJobs.length} queue items</div>
              <div className="mt-1">
                {permissions.canViewAllCommissions ? 'All eligible jobs' : 'Assigned to you'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {message ? (
        <section className="rounded-[1.5rem] border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          {message}
        </section>
      ) : null}

      {loading ? (
        <section className={`${SURFACE_CLASS} p-6 text-sm ${MUTED_TEXT_CLASS}`}>
          Loading commissions queue...
        </section>
      ) : (
        <div className="space-y-6">
          {filteredQueueJobs.length === 0 ? (
            <section className={`${SURFACE_CLASS} p-6 text-sm ${MUTED_TEXT_CLASS}`}>
              {search.trim()
                ? 'No jobs in the active commissions queue match this search.'
                : 'No jobs are currently in the active commissions queue.'}
            </section>
          ) : null}

            {filteredQueueJobs.map((job) => {
              const assignedReps = getAssignedReps(job.job_reps)
              const row = commissionRows[job.id]
              const draft = drafts[job.id] ?? buildDraft(job, row)

              const rep1Id = draft.rep_1_profile_id || assignedReps[0]?.id || null
              const rep2Id = draft.rep_2_profile_id || assignedReps[1]?.id || null

              const rep1Name =
                assignedReps.find((r) => r.id === rep1Id)?.full_name ??
                assignedReps[0]?.full_name ??
                'Rep 1'

              const rep2Name =
                assignedReps.find((r) => r.id === rep2Id)?.full_name ??
                assignedReps[1]?.full_name ??
                'Rep 2'

              const rep1Type = normalizeCommissionType(draft.rep_1_commission_type)
              const rep2Type = normalizeCommissionType(draft.rep_2_commission_type)

              const materialCost = Number(draft.material_cost || 0)
              const additionalMaterialCost = Number(draft.additional_material_cost || 0)
              const additionalJobCost = Number(draft.additional_job_cost || 0)
              const materialRefund = Number(draft.material_refund || 0)
              const laborCost = Number(draft.labor_cost || 0)

              const contractAmount = Number(job.contract_amount ?? 0)
              const supplementedAmount = Number(job.supplemented_amount ?? 0)
              const effectiveContractTotal = contractAmount + supplementedAmount

              const netMaterialCost = materialCost + additionalMaterialCost - materialRefund
              const totalCost = netMaterialCost + laborCost + additionalJobCost
              const grossProfit = effectiveContractTotal - totalCost
              const grossProfitMargin =
                effectiveContractTotal > 0 ? (grossProfit / effectiveContractTotal) * 100 : 0

              const isSplit = Boolean(rep1Id && rep2Id)

              const rep1Calc = calculateRepCommission({
                effectiveContractTotal,
                grossProfit,
                type: rep1Type,
                isSplit,
                frontEndPaid: row?.rep_1_front_end_paid ?? false,
                lockedFrontEndAmount: Number(row?.rep_1_front_end_locked_amount ?? 0),
              })

              const rep2Calc = calculateRepCommission({
                effectiveContractTotal,
                grossProfit,
                type: rep2Type,
                isSplit,
                frontEndPaid: row?.rep_2_front_end_paid ?? false,
                lockedFrontEndAmount: Number(row?.rep_2_front_end_locked_amount ?? 0),
              })
              const managementPayouts = calculateManagementPayouts({
                effectiveContractTotal,
                grossProfit,
              })
              const totalRepPayout =
                rep1Calc.totalCommission + rep2Calc.totalCommission
              const grandProjectedPayout =
                totalRepPayout + managementPayouts.total

              const homeowner = getHomeowner(job.homeowners)
              const stageName = getStageName(job.pipeline_stages)
              const isSaving = savingJobId === job.id

              return (
                <section
                  key={job.id}
                  className={`${SURFACE_CLASS} p-6`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/82">
                        Queue Item
                      </div>
                      <h2 className="mt-2 text-2xl font-semibold text-white">
                        {homeowner?.name ?? 'Unnamed Homeowner'}
                      </h2>
                      <p className={`mt-1 text-sm ${MUTED_TEXT_CLASS}`}>
                        {homeowner?.address ?? '-'}
                      </p>
                      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/46">
                        Stage: {stageName}
                      </p>
                    </div>

                    <Link href={`/jobs/${job.id}`} className={SECONDARY_BUTTON_CLASS}>
                      Open Job
                    </Link>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <ValueCard label="Original Contract" value={toMoney(contractAmount)} />
                    <ValueCard label="Supplemented Amount" value={toMoney(supplementedAmount)} />
                    <ValueCard
                      label="Effective Contract Total"
                      value={toMoney(effectiveContractTotal)}
                    />
                    <ValueCard
                      label="Gross Profit Margin"
                      value={`${grossProfitMargin.toFixed(2)}%`}
                    />
                  </div>

                  <div className="mt-6">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-white">Job Costs & Rep Setup</h3>

                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => saveCommissionRow(job.id)}
                        className={PRIMARY_BUTTON_CLASS}
                      >
                        Save Job Setup
                      </button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                      <div>
                        <label className={FIELD_LABEL_CLASS}>
                          Material Cost
                        </label>
                        <input
                          className={INPUT_CLASS}
                          value={draft.material_cost}
                          onChange={(e) => updateDraft(job.id, 'material_cost', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className={FIELD_LABEL_CLASS}>
                          Additional Material Cost
                        </label>
                        <input
                          className={INPUT_CLASS}
                          value={draft.additional_material_cost}
                          onChange={(e) =>
                            updateDraft(job.id, 'additional_material_cost', e.target.value)
                          }
                        />
                      </div>

                      <div>
                        <label className={FIELD_LABEL_CLASS}>
                          Additional Job Cost
                        </label>
                        <input
                          className={INPUT_CLASS}
                          value={draft.additional_job_cost}
                          onChange={(e) =>
                            updateDraft(job.id, 'additional_job_cost', e.target.value)
                          }
                          placeholder="Credit card fees, permits, etc."
                        />
                      </div>

                      <div>
                        <label className={FIELD_LABEL_CLASS}>
                          Material Refund
                        </label>
                        <input
                          className={INPUT_CLASS}
                          value={draft.material_refund}
                          onChange={(e) => updateDraft(job.id, 'material_refund', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className={FIELD_LABEL_CLASS}>
                          Labor Cost
                        </label>
                        <input
                          className={INPUT_CLASS}
                          value={draft.labor_cost}
                          onChange={(e) => updateDraft(job.id, 'labor_cost', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <label className={FIELD_LABEL_CLASS}>
                          Rep 1 Commission Type
                        </label>
                        <select
                          className={INPUT_CLASS}
                          value={draft.rep_1_commission_type}
                          onChange={(e) =>
                            updateDraft(job.id, 'rep_1_commission_type', e.target.value)
                          }
                        >
                          <option value="">Select Type</option>
                          {COMMISSION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className={FIELD_LABEL_CLASS}>
                          Rep 2 Commission Type
                        </label>
                        <select
                          className={INPUT_CLASS}
                          value={draft.rep_2_commission_type}
                          onChange={(e) =>
                            updateDraft(job.id, 'rep_2_commission_type', e.target.value)
                          }
                          disabled={!rep2Id}
                        >
                          <option value="">Select Type</option>
                          {COMMISSION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <ValueCard label="Net Material Cost" value={toMoney(netMaterialCost)} />
                      <ValueCard label="Additional Job Cost" value={toMoney(additionalJobCost)} />
                      <ValueCard label="Total Cost" value={toMoney(totalCost)} />
                      <ValueCard label="Gross Profit" value={toMoney(grossProfit)} />
                    </div>
                  </div>

                  <div className="mt-6 grid gap-6 xl:grid-cols-2">
                    <div className={`${SUB_SURFACE_CLASS} p-4`}>
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-lg font-semibold text-white">{rep1Name}</h3>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/82">
                          Rep 1
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className={`${SUB_SURFACE_CLASS} p-3`}>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/76">
                            Type
                          </div>
                          <div className="mt-2 text-sm font-semibold text-white">
                            {commissionLabel(rep1Type)}
                          </div>
                        </div>

                        <div className={`${SUB_SURFACE_CLASS} p-3`}>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/76">
                            Front End Status
                          </div>
                          <div className="mt-2 text-sm font-semibold text-white">
                            {row?.rep_1_front_end_paid ? 'Locked / Paid' : 'Not Paid'}
                          </div>
                        </div>

                        <div className={`${SUB_SURFACE_CLASS} p-3`}>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/76">
                            Front End
                          </div>
                          <div className="mt-2 text-lg font-bold text-white">
                            {toMoney(rep1Calc.frontEndDisplay)}
                          </div>
                        </div>

                        <div className={`${SUB_SURFACE_CLASS} p-3`}>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/76">
                            Back End
                          </div>
                          <div className="mt-2 text-lg font-bold text-white">
                            {toMoney(rep1Calc.backEndCommission)}
                          </div>
                        </div>

                        <div className={`${SUB_SURFACE_CLASS} p-3 md:col-span-2`}>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/76">
                            Total Commission
                          </div>
                          <div className="mt-2 text-lg font-bold text-white">
                            {toMoney(rep1Calc.totalCommission)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          disabled={!rep1Type || row?.rep_1_front_end_paid || isSaving}
                          onClick={() =>
                            saveCommissionRow(job.id, {
                              rep_1_front_end_paid: true,
                              rep_1_front_end_locked_amount: rep1Calc.frontEndCurrent,
                            })
                          }
                          className={SECONDARY_BUTTON_CLASS}
                        >
                          Lock Front End
                        </button>

                        {row?.rep_1_front_end_paid ? (
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() =>
                              saveCommissionRow(job.id, {
                                rep_1_front_end_paid: false,
                                rep_1_front_end_locked_amount: 0,
                              })
                            }
                            className={SECONDARY_BUTTON_CLASS}
                          >
                            Unlock Front End
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className={`${SUB_SURFACE_CLASS} p-4`}>
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-lg font-semibold text-white">
                          {rep2Id ? rep2Name : 'No Split Rep'}
                        </h3>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/82">
                          Rep 2
                        </div>
                      </div>

                      {rep2Id ? (
                        <>
                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <div className={`${SUB_SURFACE_CLASS} p-3`}>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/76">
                                Type
                              </div>
                              <div className="mt-2 text-sm font-semibold text-white">
                                {commissionLabel(rep2Type)}
                              </div>
                            </div>

                            <div className={`${SUB_SURFACE_CLASS} p-3`}>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/76">
                                Front End Status
                              </div>
                              <div className="mt-2 text-sm font-semibold text-white">
                                {row?.rep_2_front_end_paid ? 'Locked / Paid' : 'Not Paid'}
                              </div>
                            </div>

                            <div className={`${SUB_SURFACE_CLASS} p-3`}>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/76">
                                Front End
                              </div>
                              <div className="mt-2 text-lg font-bold text-white">
                                {toMoney(rep2Calc.frontEndDisplay)}
                              </div>
                            </div>

                            <div className={`${SUB_SURFACE_CLASS} p-3`}>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/76">
                                Back End
                              </div>
                              <div className="mt-2 text-lg font-bold text-white">
                                {toMoney(rep2Calc.backEndCommission)}
                              </div>
                            </div>

                            <div className={`${SUB_SURFACE_CLASS} p-3 md:col-span-2`}>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/76">
                                Total Commission
                              </div>
                              <div className="mt-2 text-lg font-bold text-white">
                                {toMoney(rep2Calc.totalCommission)}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-3">
                            <button
                              type="button"
                              disabled={!rep2Type || row?.rep_2_front_end_paid || isSaving}
                              onClick={() =>
                                saveCommissionRow(job.id, {
                                  rep_2_front_end_paid: true,
                                  rep_2_front_end_locked_amount: rep2Calc.frontEndCurrent,
                                })
                              }
                              className={SECONDARY_BUTTON_CLASS}
                            >
                              Lock Front End
                            </button>

                            {row?.rep_2_front_end_paid ? (
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() =>
                                  saveCommissionRow(job.id, {
                                    rep_2_front_end_paid: false,
                                    rep_2_front_end_locked_amount: 0,
                                  })
                                }
                                className={SECONDARY_BUTTON_CLASS}
                              >
                                Unlock Front End
                              </button>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <div className="mt-4 rounded-[1.35rem] border border-dashed border-white/14 p-4 text-sm text-white/55">
                          This job does not currently have a second assigned rep.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={`${SUB_SURFACE_CLASS} mt-6 p-4`}>
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-lg font-semibold text-white">
                        Static Management Payouts
                      </h3>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/82">
                        Every Job
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className={`${SUB_SURFACE_CLASS} p-3`}>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/76">
                          {MANAGEMENT_PAYOUT_RULES[0].label}
                        </div>
                        <div className="mt-2 text-lg font-bold text-white">
                          {toMoney(managementPayouts.grsm)}
                        </div>
                        <div className="mt-1 text-xs text-white/45">
                          {MANAGEMENT_PAYOUT_RULES[0].description}
                        </div>
                      </div>

                      <div className={`${SUB_SURFACE_CLASS} p-3`}>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/76">
                          {MANAGEMENT_PAYOUT_RULES[1].label}
                        </div>
                        <div className="mt-2 text-lg font-bold text-white">
                          {toMoney(managementPayouts.salesManager)}
                        </div>
                        <div className="mt-1 text-xs text-white/45">
                          {MANAGEMENT_PAYOUT_RULES[1].description}
                        </div>
                      </div>

                      <div className={`${SUB_SURFACE_CLASS} p-3`}>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/76">
                          {MANAGEMENT_PAYOUT_RULES[2].label}
                        </div>
                        <div className="mt-2 text-lg font-bold text-white">
                          {toMoney(managementPayouts.productionManager)}
                        </div>
                        <div className="mt-1 text-xs text-white/45">
                          {MANAGEMENT_PAYOUT_RULES[2].description}
                        </div>
                      </div>

                      <div className={`${SUB_SURFACE_CLASS} p-3`}>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/76">
                          Total Management Payout
                        </div>
                        <div className="mt-2 text-lg font-bold text-white">
                          {toMoney(managementPayouts.total)}
                        </div>
                        <div className="mt-1 text-xs text-white/45">
                          Static defaults shown for every job.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-[linear-gradient(135deg,rgba(214,179,122,0.14),rgba(255,255,255,0.04))] p-4">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/76">
                          Rep 1 Type
                        </div>
                        <div className="mt-2 text-sm font-semibold text-white">
                          {commissionLabel(rep1Type)}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/76">
                          Rep 2 Type
                        </div>
                        <div className="mt-2 text-sm font-semibold text-white">
                          {rep2Id ? commissionLabel(rep2Type) : 'No Split Rep'}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/76">
                          Rep Projected Payout
                        </div>
                        <div className="mt-2 text-lg font-bold text-white">
                          {toMoney(totalRepPayout)}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/76">
                          Management Payout
                        </div>
                        <div className="mt-2 text-lg font-bold text-white">
                          {toMoney(managementPayouts.total)}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/76">
                          Total Projected Payout
                        </div>
                        <div className="mt-2 text-lg font-bold text-white">
                          {toMoney(grandProjectedPayout)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() =>
                        saveCommissionRow(job.id, {
                          all_commissions_paid: true,
                          all_commissions_paid_at: new Date().toISOString(),
                        })
                      }
                      className={PRIMARY_BUTTON_CLASS}
                    >
                      Mark All Commissions Paid
                    </button>

                    {isSaving ? (
                      <div className="flex items-center text-sm text-white/55">
                        Saving...
                      </div>
                    ) : null}
                  </div>
                </section>
              )
            })}
          </div>
        )}
    </main>
  )
}
