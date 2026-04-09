'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import StageSelector from './StageSelector'
import EditJobForm from './EditJobForm'
import QuickUploadSection from './QuickUploadSection'
import JobDetailTabs from './JobDetailTabs'
import NotesSection from './NotesSection'
import TasksPanel from '@/components/tasks/TasksPanel'
import { authorizedFetch } from '@/lib/api-client'
import { getCurrentUserProfile, isManagerLike } from '@/lib/auth-helpers'
import { calculateJobPaymentSummary } from '@/lib/job-payments'
import { getStageColor } from '@/lib/job-stage-access'

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
  author_name?: string | null
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
  shingle_name: string
}

const ACTION_BUTTON_CLASS_NAME =
  'rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.1]'

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
    shingle_name: job.shingle_name ?? '',
  }
}

function OverviewItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4 shadow-[0_14px_36px_rgba(0,0,0,0.16)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium leading-6 text-white/82">{value}</div>
    </div>
  )
}

function MetricTile({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[1.3rem] border border-white/10 bg-black/20 p-4 shadow-[0_14px_32px_rgba(0,0,0,0.18)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
        {label}
      </div>
      <div className="mt-2 text-xl font-bold tracking-tight text-white">{value}</div>
    </div>
  )
}

export default function JobDetailPageClient({
  jobId,
}: {
  jobId: string
}) {
  const router = useRouter()
  const [payload, setPayload] = useState<JobDetailPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [actionMessageTone, setActionMessageTone] = useState<'success' | 'error'>(
    'success'
  )
  const [viewerRole, setViewerRole] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadJobDetails = useEffectEvent(async () => {
    setLoading(true)
    setPageError('')

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
      setPageError(error instanceof Error ? error.message : 'Failed to load job.')
    } finally {
      setLoading(false)
    }
  })

  useEffect(() => {
    void loadJobDetails()
  }, [jobId])

  useEffect(() => {
    let isActive = true

    async function loadProfile() {
      const profile = await getCurrentUserProfile()

      if (!isActive) {
        return
      }

      setViewerRole(profile?.role ?? null)
    }

    void loadProfile()

    return () => {
      isActive = false
    }
  }, [])

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
  const financialSummary = useMemo(
    () =>
      payload
        ? calculateJobPaymentSummary({
            contractAmount: payload.job.contract_amount,
            supplementedAmount: payload.job.supplemented_amount,
            totalPaid: payload.job.deposit_collected,
          })
        : null,
    [payload]
  )
  const canDeleteJob = isManagerLike(viewerRole)

  async function handleDeleteJob() {
    if (!payload || deleting) return

    const confirmed = window.confirm(
      `Delete ${homeowner?.name ?? 'this job'}? This will remove the job, notes, uploads, and related records.`
    )

    if (!confirmed) return

    setDeleting(true)
    setActionMessage('')

    try {
      const response = await authorizedFetch(`/api/jobs/${jobId}`, {
        method: 'DELETE',
      })

      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null

      if (!response.ok) {
        setActionMessageTone('error')
        setActionMessage(result?.error || 'Could not delete the job.')
        return
      }

      router.replace('/jobs')
    } catch (error) {
      setActionMessageTone('error')
      setActionMessage(
        error instanceof Error ? error.message : 'Could not delete the job.'
      )
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <main className="p-6 md:p-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-[#0b0f16] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
          <div className="text-sm text-white/65">Loading job details...</div>
        </div>
      </main>
    )
  }

  if (pageError || !payload || !initialData) {
    return (
      <main className="p-6 md:p-8">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-red-400/20 bg-[#0b0f16] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
          <h1 className="text-2xl font-bold text-white">Job detail error</h1>
          <div className="mt-4 rounded-[1.4rem] border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
            {pageError || 'Job not found.'}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {actionMessage ? (
          <section
            className={
              actionMessageTone === 'error'
                ? 'rounded-[1.4rem] border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100 shadow-[0_18px_45px_rgba(0,0,0,0.18)]'
                : 'rounded-[1.4rem] border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100 shadow-[0_18px_45px_rgba(0,0,0,0.18)]'
            }
          >
            {actionMessage}
          </section>
        ) : null}

        <section className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(145deg,#1a1a1a,#090909)] p-8 shadow-[0_24px_70px_rgba(0,0,0,0.32)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.22),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.06),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_40%)]" />
          <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,179,122,0.7),transparent)]" />

          <div className="relative flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-4xl">
              <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b37a]">
                Job Details
              </div>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
                {homeowner?.name ?? 'Unnamed Homeowner'}
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-white/68 md:text-lg">
                {homeowner?.address ?? 'No address on file yet.'}
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                {homeowner?.phone ? (
                  <a
                    href={`tel:${homeowner.phone}`}
                    className={ACTION_BUTTON_CLASS_NAME}
                  >
                    Call Homeowner
                  </a>
                ) : null}

                {homeowner?.email ? (
                  <a
                    href={`mailto:${homeowner.email}`}
                    className={ACTION_BUTTON_CLASS_NAME}
                  >
                    Email Homeowner
                  </a>
                ) : null}

                <QuickUploadSection
                  jobId={payload.job.id}
                  buttonClassName={ACTION_BUTTON_CLASS_NAME}
                />

                <EditJobForm
                  jobId={payload.job.id}
                  stages={payload.stages}
                  reps={payload.reps}
                  initialSelectedRepIds={payload.initialSelectedRepIds}
                  initialData={initialData}
                  buttonClassName={ACTION_BUTTON_CLASS_NAME}
                />

                <Link
                  href="/map"
                  className="rounded-2xl bg-[#d6b37a] px-4 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85]"
                >
                  Open Lead Map
                </Link>

                {canDeleteJob ? (
                  <button
                    type="button"
                    onClick={() => {
                      void handleDeleteJob()
                    }}
                    disabled={deleting}
                    className="inline-flex items-center gap-2 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 transition hover:-translate-y-0.5 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    {deleting ? 'Deleting Job...' : 'Delete Job'}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="w-full max-w-sm rounded-[1.8rem] border border-white/10 bg-white/[0.05] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">
                Current Stage
              </div>
              <div
                className="mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                style={{
                  color: getStageColor(currentStage?.name),
                  borderColor: `${getStageColor(currentStage?.name)}55`,
                  backgroundColor: `${getStageColor(currentStage?.name)}18`,
                }}
              >
                {currentStage?.name ?? 'No Stage'}
              </div>
              <div className="mt-4 text-sm text-white/60">
                Update the pipeline stage right here without opening the full editor.
              </div>
              <div className="mt-4">
                <StageSelector
                  jobId={payload.job.id}
                  currentStageId={payload.job.stage_id}
                  installDate={payload.job.install_date}
                  stages={payload.stages}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-[#0b0f16]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
                Overview
              </div>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
                Homeowner, claim, and production snapshot
              </h2>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-4 md:grid-cols-2">
              <OverviewItem label="Homeowner" value={homeowner?.name ?? '-'} />
              <OverviewItem label="Phone" value={homeowner?.phone ?? '-'} />
              <OverviewItem label="Email" value={homeowner?.email ?? '-'} />
              <OverviewItem label="Address" value={homeowner?.address ?? '-'} />
              <OverviewItem
                label="Assigned Team"
                value={
                  assignedReps.length > 0
                    ? assignedReps.map((rep) => rep.full_name).join(', ')
                    : 'No one assigned'
                }
              />
              <OverviewItem
                label="Insurance Carrier"
                value={payload.job.insurance_carrier ?? '-'}
              />
              <OverviewItem label="Claim Number" value={payload.job.claim_number ?? '-'} />
              <OverviewItem label="Deductible" value={formatMoney(payload.job.deductible)} />
              <OverviewItem
                label="Adjuster Name"
                value={payload.job.adjuster_name ?? '-'}
              />
              <OverviewItem
                label="Adjuster Phone"
                value={payload.job.adjuster_phone ?? '-'}
              />
              <OverviewItem
                label="Adjuster Email"
                value={payload.job.adjuster_email ?? '-'}
              />
              <OverviewItem label="Type of Loss" value={payload.job.type_of_loss ?? '-'} />
            </div>

            <div className="space-y-4">
              <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Financial Snapshot
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <MetricTile
                    label="Contract Amount"
                    value={formatMoney(payload.job.contract_amount)}
                  />
                  <MetricTile
                    label="Supplemented Amount"
                    value={formatMoney(payload.job.supplemented_amount)}
                  />
                  <MetricTile
                    label="Total Job Value"
                    value={formatMoney(financialSummary?.totalDue ?? null)}
                  />
                  <MetricTile
                    label="Total Paid"
                    value={formatMoney(payload.job.deposit_collected)}
                  />
                  <MetricTile
                    label="Remaining Balance"
                    value={formatMoney(payload.job.remaining_balance)}
                  />
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Timeline
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <OverviewItem
                    label="Date of Loss"
                    value={formatDate(payload.job.date_of_loss)}
                  />
                  <OverviewItem
                    label="Install Date"
                    value={formatDate(payload.job.install_date)}
                  />
                  <OverviewItem
                    label="Contract Signed"
                    value={formatDate(payload.job.contract_signed_date)}
                  />
                  <OverviewItem
                    label="Shingle Name"
                    value={payload.job.shingle_name ?? '-'}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
          <NotesSection
            jobId={payload.job.id}
            initialNotes={payload.initialNotes}
            canDeleteNotes={canDeleteJob}
          />

          <TasksPanel
            jobId={payload.job.id}
            title="Tasks & Appointments"
            description="Compact follow-ups, site visits, and internal handoffs tied to this job."
            contextLabel={homeowner?.name ?? 'this job'}
            compact
            maxVisible={5}
          />
        </section>

        <JobDetailTabs
          jobId={payload.job.id}
          homeownerName={homeowner?.name ?? 'this job'}
          canViewMaterialOrders={canDeleteJob}
        />
      </div>
    </main>
  )
}
