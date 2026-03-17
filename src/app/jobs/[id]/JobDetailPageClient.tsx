'use client'

import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import StageSelector from './StageSelector'
import EditJobForm from './EditJobForm'
import QuickUploadSection from './QuickUploadSection'
import JobDetailTabs from './JobDetailTabs'
import ManagementStageGate from './ManagementStageGate'
import { authorizedFetch } from '@/lib/api-client'

type JobResponse = {
  id: string
  homeowner_id: string
  stage_id: number | null
  insurance_carrier: string | null
  deductible: number | null
  claim_number: string | null
  adjuster_name: string | null
  adjuster_phone: string | null
  adjuster_email: string | null
  date_of_loss: string | null
  type_of_loss: string | null
  install_date: string | null
  contract_signed_date: string | null
  contract_amount: number | null
  deposit_collected: number | null
  remaining_balance: number | null
  supplemented_amount: number | null
  shingle_name: string | null
  created_at: string
  updated_at: string
  homeowners:
    | {
        id?: string
        name: string | null
        phone: string | null
        address: string | null
        email: string | null
      }[]
    | {
        id?: string
        name: string | null
        phone: string | null
        address: string | null
        email: string | null
      }
    | null
  pipeline_stages:
    | {
        id?: number
        name: string | null
        sort_order?: number | null
      }[]
    | {
        id?: number
        name: string | null
        sort_order?: number | null
      }
    | null
  job_reps:
    | {
        profile_id: string
        profiles:
          | {
              id: string
              full_name: string | null
            }
          | {
              id: string
              full_name: string | null
            }[]
          | null
      }[]
    | null
}

type Stage = {
  id: number
  name: string
  sort_order?: number | null
}

type Rep = {
  id: string
  full_name: string
  role?: string
  is_active?: boolean
}

type Note = {
  id: string
  body: string
  created_at: string
  updated_at?: string
}

type JobDetailPayload = {
  job: JobResponse
  stages: Stage[]
  reps: Rep[]
  initialSelectedRepIds: string[]
  initialNotes: Note[]
}

type FormData = {
  homeowner_name: string
  phone: string
  address: string
  email: string
  stage_id: string
  insurance_carrier: string
  deductible: string
  claim_number: string
  adjuster_name: string
  adjuster_phone: string
  adjuster_email: string
  date_of_loss: string
  type_of_loss: string
  install_date: string
  contract_signed_date: string
  contract_amount: string
  deposit_collected: string
  remaining_balance: string
  supplemented_amount: string
  shingle_name: string
}

function getHomeowner(homeowners: JobResponse['homeowners']) {
  if (!homeowners) return null
  return Array.isArray(homeowners) ? homeowners[0] ?? null : homeowners
}

function getStage(stages: JobResponse['pipeline_stages']) {
  if (!stages) return null
  return Array.isArray(stages) ? stages[0] ?? null : stages
}

function getReps(jobReps: JobResponse['job_reps']) {
  if (!jobReps || jobReps.length === 0) return []

  return jobReps
    .map((rep) => {
      const profile = Array.isArray(rep.profiles)
        ? rep.profiles[0] ?? null
        : rep.profiles

      if (!profile) return null

      return {
        id: profile.id,
        full_name: profile.full_name ?? '',
      }
    })
    .filter(
      (
        rep
      ): rep is {
        id: string
        full_name: string
      } => Boolean(rep)
    )
}

function formatMoney(value: number | null) {
  if (value === null || value === undefined) return '-'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US')
}

function buildInitialData(
  job: JobResponse,
  homeowner: ReturnType<typeof getHomeowner>
): FormData {
  return {
    homeowner_name: homeowner?.name ?? '',
    phone: homeowner?.phone ?? '',
    address: homeowner?.address ?? '',
    email: homeowner?.email ?? '',
    stage_id: job.stage_id ? String(job.stage_id) : '',
    insurance_carrier: job.insurance_carrier ?? '',
    deductible: job.deductible ? String(job.deductible) : '',
    claim_number: job.claim_number ?? '',
    adjuster_name: job.adjuster_name ?? '',
    adjuster_phone: job.adjuster_phone ?? '',
    adjuster_email: job.adjuster_email ?? '',
    date_of_loss: job.date_of_loss ?? '',
    type_of_loss: job.type_of_loss ?? '',
    install_date: job.install_date ?? '',
    contract_signed_date: job.contract_signed_date ?? '',
    contract_amount: job.contract_amount ? String(job.contract_amount) : '',
    deposit_collected: job.deposit_collected ? String(job.deposit_collected) : '',
    remaining_balance: job.remaining_balance ? String(job.remaining_balance) : '',
    supplemented_amount: job.supplemented_amount
      ? String(job.supplemented_amount)
      : '',
    shingle_name: job.shingle_name ?? '',
  }
}

export default function JobDetailPageClient({
  jobId,
}: {
  jobId: string
}) {
  const [payload, setPayload] = useState<JobDetailPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const loadJobDetails = useEffectEvent(async () => {
    setLoading(true)
    setMessage('')

    try {
      const response = await authorizedFetch(`/api/jobs/${jobId}`)
      const result = (await response.json().catch(() => null)) as
        | (JobDetailPayload & { error?: string })
        | { error?: string }
        | null

      if (!response.ok) {
        throw new Error(
          result && 'error' in result
            ? result.error || 'Failed to load job.'
            : 'Failed to load job.'
        )
      }

      setPayload(result as JobDetailPayload)
    } catch (error) {
      setPayload(null)
      setMessage(error instanceof Error ? error.message : 'Failed to load job.')
    } finally {
      setLoading(false)
    }
  })

  useEffect(() => {
    void loadJobDetails()
  }, [jobId])

  useEffect(() => {
    function handleRefresh(event: Event) {
      const detail =
        event instanceof CustomEvent ? (event.detail as { jobId?: string } | undefined) : undefined

      if (detail?.jobId && detail.jobId !== jobId) {
        return
      }

      void loadJobDetails()
    }

    window.addEventListener('job-detail:refresh', handleRefresh)

    return () => {
      window.removeEventListener('job-detail:refresh', handleRefresh)
    }
  }, [jobId])

  const homeowner = useMemo(
    () => (payload ? getHomeowner(payload.job.homeowners) : null),
    [payload]
  )
  const currentStage = useMemo(
    () => (payload ? getStage(payload.job.pipeline_stages) : null),
    [payload]
  )
  const assignedReps = useMemo(
    () => (payload ? getReps(payload.job.job_reps) : []),
    [payload]
  )
  const initialData = useMemo(
    () => (payload ? buildInitialData(payload.job, homeowner) : null),
    [homeowner, payload]
  )

  if (loading) {
    return (
      <main className="p-8">
        <div className="mx-auto max-w-7xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-gray-600">Loading job details...</div>
        </div>
      </main>
    )
  }

  if (message || !payload || !initialData) {
    return (
      <main className="p-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Job detail error</h1>
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            {message || 'Job not found.'}
          </div>
        </div>
      </main>
    )
  }

  return (
    <ManagementStageGate currentStage={currentStage} stages={payload.stages}>
      <main className="p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Job Details
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
                {homeowner?.name ?? 'Unnamed Homeowner'}
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                {homeowner?.address ?? '-'}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Current Stage
              </div>
              <div className="mt-1 text-sm font-medium text-gray-900">
                {currentStage?.name ?? 'No Stage'}
              </div>
              <div className="mt-3">
                <StageSelector
                  jobId={payload.job.id}
                  currentStageId={payload.job.stage_id}
                  stages={payload.stages}
                />
              </div>
            </div>
          </div>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">Overview</h2>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Homeowner Name
                </div>
                <div className="mt-1 text-sm font-medium text-gray-900">
                  {homeowner?.name ?? '-'}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Homeowner Phone
                </div>
                <div className="mt-1 text-sm font-medium text-gray-900">
                  {homeowner?.phone ?? '-'}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Homeowner Email
                </div>
                <div className="mt-1 text-sm font-medium text-gray-900">
                  {homeowner?.email ?? '-'}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Homeowner Address
                </div>
                <div className="mt-1 text-sm font-medium text-gray-900">
                  {homeowner?.address ?? '-'}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Assigned Reps
                </div>
                <div className="mt-1 text-sm font-medium text-gray-900">
                  {assignedReps.length > 0
                    ? assignedReps.map((rep) => rep.full_name).join(', ')
                    : 'No reps assigned'}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Insurance Carrier
                </div>
                <div className="mt-1 text-sm font-medium text-gray-900">
                  {payload.job.insurance_carrier ?? '-'}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Deductible
                </div>
                <div className="mt-1 text-sm font-medium text-gray-900">
                  {formatMoney(payload.job.deductible)}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Claim Number
                </div>
                <div className="mt-1 text-sm font-medium text-gray-900">
                  {payload.job.claim_number ?? '-'}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Adjuster Name
                </div>
                <div className="mt-1 text-sm font-medium text-gray-900">
                  {payload.job.adjuster_name ?? '-'}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Adjuster Phone
                </div>
                <div className="mt-1 text-sm font-medium text-gray-900">
                  {payload.job.adjuster_phone ?? '-'}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Adjuster Email
                </div>
                <div className="mt-1 text-sm font-medium text-gray-900">
                  {payload.job.adjuster_email ?? '-'}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Date of Loss
                </div>
                <div className="mt-1 text-sm font-medium text-gray-900">
                  {formatDate(payload.job.date_of_loss)}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Type of Loss
                </div>
                <div className="mt-1 text-sm font-medium text-gray-900">
                  {payload.job.type_of_loss ?? '-'}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Install Date
                </div>
                <div className="mt-1 text-sm font-medium text-gray-900">
                  {formatDate(payload.job.install_date)}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Contract Signed Date
                </div>
                <div className="mt-1 text-sm font-medium text-gray-900">
                  {formatDate(payload.job.contract_signed_date)}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Contract Amount
                </div>
                <div className="mt-1 text-sm font-medium text-gray-900">
                  {formatMoney(payload.job.contract_amount)}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Deposit Collected
                </div>
                <div className="mt-1 text-sm font-medium text-gray-900">
                  {formatMoney(payload.job.deposit_collected)}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Remaining Balance
                </div>
                <div className="mt-1 text-sm font-medium text-gray-900">
                  {formatMoney(payload.job.remaining_balance)}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Supplemented Amount
                </div>
                <div className="mt-1 text-sm font-medium text-gray-900">
                  {formatMoney(payload.job.supplemented_amount)}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Shingle Name
                </div>
                <div className="mt-1 text-sm font-medium text-gray-900">
                  {payload.job.shingle_name ?? '-'}
                </div>
              </div>
            </div>
          </section>

          <EditJobForm
            jobId={payload.job.id}
            homeownerId={payload.job.homeowner_id}
            stages={payload.stages}
            reps={payload.reps}
            initialSelectedRepIds={payload.initialSelectedRepIds}
            initialData={initialData}
          />

          <QuickUploadSection jobId={payload.job.id} />

          <JobDetailTabs jobId={payload.job.id} initialNotes={payload.initialNotes} />
        </div>
      </main>
    </ManagementStageGate>
  )
}
