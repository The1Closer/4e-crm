'use client'

import Link from 'next/link'
import { FilePenLine, Trash2 } from 'lucide-react'
import { type JobListRow } from '@/components/jobs/job-types'

export type JobCardRow = JobListRow

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return '-'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US')
}

function formatDaysInStatus(days: number) {
  return `${days} day${days === 1 ? '' : 's'}`
}

function StagePill({ stageName }: { stageName: string }) {
  return (
    <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d6b37a]">
      {stageName}
    </div>
  )
}

export default function JobCard({
  job,
  onQuickEdit,
  canDelete,
  deletingJobId,
  onDelete,
}: {
  job: JobCardRow
  onQuickEdit?: (job: JobCardRow) => void
  canDelete?: boolean
  deletingJobId?: string | null
  onDelete?: (job: JobCardRow) => void | Promise<void>
}) {
  const noRepAssigned = job.repNames.length === 0
  const deleting = deletingJobId === job.id
  const deleteDisabled = Boolean(deletingJobId)

  return (
    <section className="group rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.25)] backdrop-blur-2xl transition duration-200 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-white">
            {job.homeownerName}
          </h2>
          <p className="mt-1 truncate text-sm text-white/55">{job.address}</p>
        </div>

        <StagePill stageName={job.stageName} />
      </div>

      <div className="mt-4 space-y-1 text-sm text-white/58">
        <div>{job.phone}</div>
        <div className="truncate">{job.email}</div>
      </div>

      <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/38">
            Assigned Team
          </div>

          {noRepAssigned ? (
            <div className="rounded-full border border-red-400/20 bg-red-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-200">
              Unassigned
            </div>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {noRepAssigned ? (
            <span className="text-sm text-white/55">No one assigned</span>
          ) : (
            job.repNames.map((rep) => (
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

      <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <InfoBlock label="Insurance" value={job.insuranceCarrier} />
        <InfoBlock label="Claim Number" value={job.claimNumber} />
        <InfoBlock label="Install Date" value={formatDate(job.installDate)} />
        <InfoBlock label="Days In Status" value={formatDaysInStatus(job.daysInStatus)} />
        <InfoBlock label="Contract Amount" value={formatCurrency(job.contractAmount)} />
        <InfoBlock
          label="Total Paid"
          value={formatCurrency(job.depositCollected)}
        />
        <InfoBlock
          label="Remaining Balance"
          value={formatCurrency(job.remainingBalance)}
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={`/jobs/${job.id}`}
          className="inline-flex flex-1 items-center justify-center rounded-2xl bg-[#d6b37a] px-4 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:bg-[#e2bf85]"
        >
          Open Job
        </Link>

        <button
          type="button"
          onClick={() => onQuickEdit?.(job)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
        >
          <FilePenLine className="h-4 w-4 text-[#d6b37a]" />
          Quick Edit
        </button>

        {canDelete ? (
          <button
            type="button"
            onClick={() => {
              void onDelete?.(job)
            }}
            disabled={deleteDisabled}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        ) : null}
      </div>
    </section>
  )
}

function InfoBlock({
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
