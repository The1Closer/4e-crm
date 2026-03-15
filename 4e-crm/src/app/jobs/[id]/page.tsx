import StageSelector from './StageSelector'
import EditJobForm from './EditJobForm'
import QuickUploadSection from './QuickUploadSection'
import JobDetailTabs from './JobDetailTabs'
import { supabase } from '../../../lib/supabase'

type JobPageProps = {
  params: Promise<{
    id: string
  }>
}

function getHomeowner(
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
) {
  if (!homeowners) return null
  return Array.isArray(homeowners) ? homeowners[0] ?? null : homeowners
}

function getStage(
  stages:
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
) {
  if (!stages) return null
  return Array.isArray(stages) ? stages[0] ?? null : stages
}

function getReps(
  jobReps:
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
) {
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

export default async function JobDetailPage({ params }: JobPageProps) {
  const { id: jobId } = await params

  const [jobRes, stagesRes, repsRes, jobRepsRes, notesRes] = await Promise.all([
    supabase
      .from('jobs')
      .select(`
        id,
        homeowner_id,
        stage_id,
        insurance_carrier,
        deductible,
        claim_number,
        adjuster_name,
        adjuster_phone,
        adjuster_email,
        date_of_loss,
        type_of_loss,
        install_date,
        contract_signed_date,
        contract_amount,
        deposit_collected,
        remaining_balance,
        supplemented_amount,
        shingle_name,
        created_at,
        updated_at,
        homeowners (
          id,
          name,
          phone,
          address,
          email,
          created_at,
          updated_at
        ),
        pipeline_stages (
          id,
          name,
          sort_order,
          created_at
        ),
        job_reps (
          id,
          job_id,
          profile_id,
          created_at,
          profiles (
            id,
            full_name
          )
        )
      `)
      .eq('id', jobId)
      .single(),

    supabase
      .from('pipeline_stages')
      .select('id, name, sort_order')
      .order('sort_order', { ascending: true }),

    supabase
      .from('profiles')
      .select('id, full_name, role, is_active')
      .eq('is_active', true)
      .order('full_name', { ascending: true }),

    supabase
      .from('job_reps')
      .select('profile_id')
      .eq('job_id', jobId),

    supabase
      .from('notes')
      .select('id, body, created_at, updated_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false }),
  ])

  if (jobRes.error || !jobRes.data) {
    return (
      <main className="p-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Job detail error</h1>
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            {jobRes.error?.message ?? 'Job not found.'}
          </div>
        </div>
      </main>
    )
  }

  const job = jobRes.data as {
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

  const homeowner = getHomeowner(job.homeowners)
  const currentStage = getStage(job.pipeline_stages)
  const assignedReps = getReps(job.job_reps)

  const stages = (stagesRes.data ?? []) as Array<{
    id: number
    name: string
    sort_order?: number | null
  }>

  const reps = (repsRes.data ?? []) as Array<{
    id: string
    full_name: string
    role?: string
    is_active?: boolean
  }>

  const initialSelectedRepIds = (jobRepsRes.data ?? []).map(
    (row: { profile_id: string }) => row.profile_id
  )

  const initialNotes = (notesRes.data ?? []) as Array<{
    id: string
    body: string
    created_at: string
    updated_at?: string
  }>

  const initialData = {
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

  return (
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
                jobId={job.id}
                currentStageId={job.stage_id}
                stages={stages}
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
                {job.insurance_carrier ?? '-'}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Deductible
              </div>
              <div className="mt-1 text-sm font-medium text-gray-900">
                {formatMoney(job.deductible)}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Claim Number
              </div>
              <div className="mt-1 text-sm font-medium text-gray-900">
                {job.claim_number ?? '-'}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Adjuster Name
              </div>
              <div className="mt-1 text-sm font-medium text-gray-900">
                {job.adjuster_name ?? '-'}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Adjuster Phone
              </div>
              <div className="mt-1 text-sm font-medium text-gray-900">
                {job.adjuster_phone ?? '-'}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Adjuster Email
              </div>
              <div className="mt-1 text-sm font-medium text-gray-900">
                {job.adjuster_email ?? '-'}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Date of Loss
              </div>
              <div className="mt-1 text-sm font-medium text-gray-900">
                {formatDate(job.date_of_loss)}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Type of Loss
              </div>
              <div className="mt-1 text-sm font-medium text-gray-900">
                {job.type_of_loss ?? '-'}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Install Date
              </div>
              <div className="mt-1 text-sm font-medium text-gray-900">
                {formatDate(job.install_date)}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Contract Signed Date
              </div>
              <div className="mt-1 text-sm font-medium text-gray-900">
                {formatDate(job.contract_signed_date)}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Contract Amount
              </div>
              <div className="mt-1 text-sm font-medium text-gray-900">
                {formatMoney(job.contract_amount)}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Deposit Collected
              </div>
              <div className="mt-1 text-sm font-medium text-gray-900">
                {formatMoney(job.deposit_collected)}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Remaining Balance
              </div>
              <div className="mt-1 text-sm font-medium text-gray-900">
                {formatMoney(job.remaining_balance)}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Supplemented Amount
              </div>
              <div className="mt-1 text-sm font-medium text-gray-900">
                {formatMoney(job.supplemented_amount)}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Shingle Name
              </div>
              <div className="mt-1 text-sm font-medium text-gray-900">
                {job.shingle_name ?? '-'}
              </div>
            </div>
          </div>
        </section>

        <EditJobForm
          jobId={job.id}
          homeownerId={job.homeowner_id}
          stages={stages}
          reps={reps}
          initialSelectedRepIds={initialSelectedRepIds}
          initialData={initialData}
        />

        <QuickUploadSection jobId={job.id} />

        <JobDetailTabs jobId={job.id} initialNotes={initialNotes} />
      </div>
    </main>
  )
}