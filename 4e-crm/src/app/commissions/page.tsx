'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import ManagerOnlyRoute from '../../components/ManagerOnlyRoute'
import {
  ARCHIVE_INACTIVITY_DAYS,
  isArchivedByInactivity,
  isPaidInFull,
} from '@/lib/job-lifecycle'
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
        name: string | null
      }
    | {
        name: string | null
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

function shouldShowInQueue(stageName: string, paid: boolean, paidInFull: boolean) {
  if (paid) return false
  if (paidInFull) return true

  const s = stageName.toLowerCase().trim()

  return (
    s.includes('contract') ||
    s.includes('pre-production') ||
    s.includes('deposit') ||
    s.includes('install')
  )
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

function buildDraft(job: JobRow, row?: CommissionRow): CommissionDraft {
  const assignedReps = getAssignedReps(job.job_reps)

  return {
    material_cost: String(row?.material_cost ?? ''),
    additional_material_cost: String(row?.additional_material_cost ?? ''),
    material_refund: String(row?.material_refund ?? ''),
    labor_cost: String(row?.labor_cost ?? ''),
    rep_1_profile_id: row?.rep_1_profile_id ?? assignedReps[0]?.id ?? '',
    rep_1_commission_type: row?.rep_1_commission_type ?? '',
    rep_2_profile_id: row?.rep_2_profile_id ?? assignedReps[1]?.id ?? '',
    rep_2_commission_type: row?.rep_2_commission_type ?? '',
  }
}

export default function CommissionsPage() {
  return (
    <ManagerOnlyRoute>
      <CommissionsPageContent />
    </ManagerOnlyRoute>
  )
}

function CommissionHistoryFact({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-gray-900">{value}</div>
    </div>
  )
}

function CommissionsPageContent() {
  const [loading, setLoading] = useState(true)
  const [savingJobId, setSavingJobId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const [jobs, setJobs] = useState<JobRow[]>([])
  const [commissionRows, setCommissionRows] = useState<Record<string, CommissionRow>>({})
  const [drafts, setDrafts] = useState<Record<string, CommissionDraft>>({})

  async function loadData() {
    setLoading(true)
    setMessage('')

    const [jobsRes, commissionsRes] = await Promise.all([
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
            name
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
    ])

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

    const jobsData = (jobsRes.data ?? []) as JobRow[]
    const commissionData = (commissionsRes.data ?? []) as CommissionRow[]

    const byJobId: Record<string, CommissionRow> = {}
    commissionData.forEach((row) => {
      byJobId[row.job_id] = row
    })

    const nextDrafts: Record<string, CommissionDraft> = {}
    jobsData.forEach((job) => {
      nextDrafts[job.id] = buildDraft(job, byJobId[job.id])
    })

    setJobs(jobsData)
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

      const stageName = getStageName(job.pipeline_stages)
      const existing = commissionRows[job.id]
      const allPaid = existing?.all_commissions_paid ?? false
      const paidInFull = isPaidInFull(job.remaining_balance)

      return shouldShowInQueue(stageName, allPaid, paidInFull)
    })
  }, [jobs, commissionRows])

  const paidOutJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (isArchivedByInactivity(job.updated_at)) {
        return false
      }

      const existing = commissionRows[job.id]

      return Boolean(existing?.all_commissions_paid) && isPaidInFull(job.remaining_balance)
    })
  }, [jobs, commissionRows])

  return (
    <main className="p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Commissions Queue</h1>
            <p className="mt-2 text-sm text-gray-600">
              Review payout-ready jobs, enter costs, lock front-end payouts, calculate backend pay, and keep fully paid / fully paid-out jobs visible until they are cleared from the queue.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/archive"
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
            >
              Archive
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
            >
              Home
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Active Queue
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900">{queueJobs.length}</div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Paid Out / Closed
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900">{paidOutJobs.length}</div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Archive Threshold
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900">
              {ARCHIVE_INACTIVITY_DAYS} days
            </div>
          </div>
        </div>

        {message ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 shadow-sm">
            {message}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
            Loading commissions queue...
          </div>
        ) : (
          <div className="space-y-6">
            {queueJobs.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
                No jobs are currently in the active commissions queue.
              </div>
            ) : null}

            {queueJobs.map((job) => {
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
              const materialRefund = Number(draft.material_refund || 0)
              const laborCost = Number(draft.labor_cost || 0)

              const contractAmount = Number(job.contract_amount ?? 0)
              const supplementedAmount = Number(job.supplemented_amount ?? 0)
              const effectiveContractTotal = contractAmount + supplementedAmount

              const netMaterialCost = materialCost + additionalMaterialCost - materialRefund
              const totalCost = netMaterialCost + laborCost
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

              const homeowner = getHomeowner(job.homeowners)
              const stageName = getStageName(job.pipeline_stages)
              const isSaving = savingJobId === job.id

              return (
                <section
                  key={job.id}
                  className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        {homeowner?.name ?? 'Unnamed Homeowner'}
                      </h2>
                      <p className="mt-1 text-sm text-gray-600">
                        {homeowner?.address ?? '-'}
                      </p>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Stage: {stageName}
                      </p>
                    </div>

                    <Link
                      href={`/jobs/${job.id}`}
                      className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
                    >
                      Open Job
                    </Link>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="text-sm font-semibold text-gray-900">Original Contract</div>
                      <div className="mt-2 text-xl font-bold text-gray-900">
                        {toMoney(contractAmount)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="text-sm font-semibold text-gray-900">Supplemented Amount</div>
                      <div className="mt-2 text-xl font-bold text-gray-900">
                        {toMoney(supplementedAmount)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="text-sm font-semibold text-gray-900">Effective Contract Total</div>
                      <div className="mt-2 text-xl font-bold text-gray-900">
                        {toMoney(effectiveContractTotal)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="text-sm font-semibold text-gray-900">Gross Profit Margin</div>
                      <div className="mt-2 text-xl font-bold text-gray-900">
                        {grossProfitMargin.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">Job Costs & Rep Setup</h3>

                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => saveCommissionRow(job.id)}
                        className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
                      >
                        Save Job Setup
                      </button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Material Cost
                        </label>
                        <input
                          className="w-full rounded-xl border px-4 py-3 text-sm"
                          value={draft.material_cost}
                          onChange={(e) => updateDraft(job.id, 'material_cost', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Additional Material Cost
                        </label>
                        <input
                          className="w-full rounded-xl border px-4 py-3 text-sm"
                          value={draft.additional_material_cost}
                          onChange={(e) =>
                            updateDraft(job.id, 'additional_material_cost', e.target.value)
                          }
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Material Refund
                        </label>
                        <input
                          className="w-full rounded-xl border px-4 py-3 text-sm"
                          value={draft.material_refund}
                          onChange={(e) => updateDraft(job.id, 'material_refund', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Labor Cost
                        </label>
                        <input
                          className="w-full rounded-xl border px-4 py-3 text-sm"
                          value={draft.labor_cost}
                          onChange={(e) => updateDraft(job.id, 'labor_cost', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Rep 1 Commission Type
                        </label>
                        <select
                          className="w-full rounded-xl border px-4 py-3 text-sm"
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
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Rep 2 Commission Type
                        </label>
                        <select
                          className="w-full rounded-xl border px-4 py-3 text-sm"
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

                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <div className="text-sm font-semibold text-gray-900">Net Material Cost</div>
                        <div className="mt-2 text-lg font-bold text-gray-900">
                          {toMoney(netMaterialCost)}
                        </div>
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <div className="text-sm font-semibold text-gray-900">Total Cost</div>
                        <div className="mt-2 text-lg font-bold text-gray-900">
                          {toMoney(totalCost)}
                        </div>
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <div className="text-sm font-semibold text-gray-900">Gross Profit</div>
                        <div className="mt-2 text-lg font-bold text-gray-900">
                          {toMoney(grossProfit)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-6 xl:grid-cols-2">
                    <div className="rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-lg font-semibold text-gray-900">{rep1Name}</h3>
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Rep 1
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Type
                          </div>
                          <div className="mt-2 text-sm font-semibold text-gray-900">
                            {commissionLabel(rep1Type)}
                          </div>
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Front End Status
                          </div>
                          <div className="mt-2 text-sm font-semibold text-gray-900">
                            {row?.rep_1_front_end_paid ? 'Locked / Paid' : 'Not Paid'}
                          </div>
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Front End
                          </div>
                          <div className="mt-2 text-lg font-bold text-gray-900">
                            {toMoney(rep1Calc.frontEndDisplay)}
                          </div>
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Back End
                          </div>
                          <div className="mt-2 text-lg font-bold text-gray-900">
                            {toMoney(rep1Calc.backEndCommission)}
                          </div>
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 md:col-span-2">
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Total Commission
                          </div>
                          <div className="mt-2 text-lg font-bold text-gray-900">
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
                          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100 disabled:opacity-50"
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
                            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100 disabled:opacity-50"
                          >
                            Unlock Front End
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {rep2Id ? rep2Name : 'No Split Rep'}
                        </h3>
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Rep 2
                        </div>
                      </div>

                      {rep2Id ? (
                        <>
                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Type
                              </div>
                              <div className="mt-2 text-sm font-semibold text-gray-900">
                                {commissionLabel(rep2Type)}
                              </div>
                            </div>

                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Front End Status
                              </div>
                              <div className="mt-2 text-sm font-semibold text-gray-900">
                                {row?.rep_2_front_end_paid ? 'Locked / Paid' : 'Not Paid'}
                              </div>
                            </div>

                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Front End
                              </div>
                              <div className="mt-2 text-lg font-bold text-gray-900">
                                {toMoney(rep2Calc.frontEndDisplay)}
                              </div>
                            </div>

                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Back End
                              </div>
                              <div className="mt-2 text-lg font-bold text-gray-900">
                                {toMoney(rep2Calc.backEndCommission)}
                              </div>
                            </div>

                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 md:col-span-2">
                              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Total Commission
                              </div>
                              <div className="mt-2 text-lg font-bold text-gray-900">
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
                              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100 disabled:opacity-50"
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
                                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100 disabled:opacity-50"
                              >
                                Unlock Front End
                              </button>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600">
                          This job does not currently have a second assigned rep.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Rep 1 Type
                        </div>
                        <div className="mt-2 text-sm font-semibold text-gray-900">
                          {commissionLabel(rep1Type)}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Rep 2 Type
                        </div>
                        <div className="mt-2 text-sm font-semibold text-gray-900">
                          {rep2Id ? commissionLabel(rep2Type) : 'No Split Rep'}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Total Projected Payout
                        </div>
                        <div className="mt-2 text-lg font-bold text-gray-900">
                          {toMoney(rep1Calc.totalCommission + rep2Calc.totalCommission)}
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
                      className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
                    >
                      Mark All Commissions Paid
                    </button>

                    {row?.all_commissions_paid ? (
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() =>
                          saveCommissionRow(job.id, {
                            all_commissions_paid: false,
                            all_commissions_paid_at: null,
                          })
                        }
                        className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-100 disabled:opacity-50"
                      >
                        Reopen
                      </button>
                    ) : null}

                    {isSaving ? (
                      <div className="flex items-center text-sm text-gray-500">
                        Saving...
                      </div>
                    ) : null}
                  </div>
                </section>
              )
            })}

            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">Paid Out / Closed</h2>
                  <p className="mt-2 text-sm text-gray-600">
                    Jobs stay here once the homeowner balance is paid in full and all commissions have been marked paid.
                  </p>
                </div>
              </div>

              {paidOutJobs.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600">
                  No paid-out jobs are currently being tracked here.
                </div>
              ) : (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {paidOutJobs.map((job) => {
                    const homeowner = getHomeowner(job.homeowners)
                    const stageName = getStageName(job.pipeline_stages)
                    const row = commissionRows[job.id]

                    return (
                      <Link
                        key={job.id}
                        href={`/jobs/${job.id}`}
                        className="block rounded-2xl border border-gray-200 bg-gray-50 p-5 transition hover:border-gray-300 hover:bg-white"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-lg font-semibold text-gray-900">
                              {homeowner?.name ?? 'Unnamed Homeowner'}
                            </div>
                            <div className="mt-1 text-sm text-gray-600">
                              {homeowner?.address ?? '-'}
                            </div>
                          </div>

                          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                            Paid Out
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <CommissionHistoryFact label="Stage" value={stageName} />
                          <CommissionHistoryFact
                            label="Paid In Full"
                            value={`Yes • ${toMoney(Number(job.remaining_balance ?? 0))} balance`}
                          />
                          <CommissionHistoryFact
                            label="Contract"
                            value={toMoney(Number(job.contract_amount ?? 0))}
                          />
                          <CommissionHistoryFact
                            label="Commissions Paid"
                            value={
                              row?.all_commissions_paid_at
                                ? new Date(row.all_commissions_paid_at).toLocaleString('en-US')
                                : 'Recorded'
                            }
                          />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
