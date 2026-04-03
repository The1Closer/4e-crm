'use client'

import Link from 'next/link'
import { FilePenLine, Trash2 } from 'lucide-react'
import { type JobCardRow } from '@/components/jobs/JobCard'

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

export default function JobsTable({
  rows,
  onQuickEdit,
  canDelete,
  deletingJobId,
  onDelete,
}: {
  rows: JobCardRow[]
  onQuickEdit?: (job: JobCardRow) => void
  canDelete?: boolean
  deletingJobId?: string | null
  onDelete?: (job: JobCardRow) => void | Promise<void>
}) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="overflow-x-auto crm-soft-scroll-x">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-white/45">
              <th className="px-4 py-4">Homeowner</th>
              <th className="px-4 py-4">Stage</th>
              <th className="px-4 py-4">Assignees</th>
              <th className="px-4 py-4">Carrier</th>
              <th className="px-4 py-4">Install</th>
              <th className="px-4 py-4">Contract</th>
              <th className="px-4 py-4">Balance</th>
              <th className="px-4 py-4">Actions</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((job) => {
              const deleting = deletingJobId === job.id
              const deleteDisabled = Boolean(deletingJobId)

              return (
                <tr
                  key={job.id}
                  className="border-b border-white/10 last:border-b-0"
                >
                  <td className="px-4 py-4">
                    <Link href={`/jobs/${job.id}`} className="block">
                      <div className="font-semibold text-white">{job.homeownerName}</div>
                      <div className="mt-1 text-xs text-white/45">{job.address}</div>
                    </Link>
                  </td>

                  <td className="px-4 py-4 text-white/75">
                    <span
                      className="block max-w-[240px] truncate whitespace-nowrap"
                      title={job.stageName}
                    >
                      {job.stageName}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-white/75">
                    {job.repNames.length ? job.repNames.join(', ') : '—'}
                  </td>
                  <td className="px-4 py-4 text-white/75">{job.insuranceCarrier}</td>
                  <td className="px-4 py-4 text-white/75">{formatDate(job.installDate)}</td>
                  <td className="px-4 py-4 text-white">{formatCurrency(job.contractAmount)}</td>
                  <td className="px-4 py-4 text-white">{formatCurrency(job.remainingBalance)}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-nowrap gap-2 whitespace-nowrap">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.1]"
                      >
                        Open
                      </Link>
                      <button
                        type="button"
                        onClick={() => onQuickEdit?.(job)}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.1]"
                      >
                        <FilePenLine className="h-3.5 w-3.5 text-[#d6b37a]" />
                        Quick Edit
                      </button>
                      {canDelete ? (
                        <button
                          type="button"
                          onClick={() => {
                            void onDelete?.(job)
                          }}
                          disabled={deleteDisabled}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {deleting ? 'Deleting...' : 'Delete'}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
