'use client'

import Link from 'next/link'
import { JobCardRow } from '@/components/jobs/JobCard'

export default function JobsKanban({
    rows,
}: {
    rows: JobCardRow[]
}) {
    const grouped = rows.reduce<Record<string, JobCardRow[]>>((acc, row) => {
        const key = row.stageName || 'No Stage'
        if (!acc[key]) acc[key] = []
        acc[key].push(row)
        return acc
    }, {})

    const stages = Object.keys(grouped)

    return (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
            <div className="overflow-x-auto pb-2">
                <div className="flex min-w-max gap-4">
                    {stages.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/50">
                            No jobs available.
                        </div>
                    ) : (
                        stages.map((stage) => (
                            <div
                                key={stage}
                                className="w-[320px] shrink-0 rounded-[1.5rem] border border-white/10 bg-black/20"
                            >
                                <div className="border-b border-white/10 px-4 py-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="text-sm font-semibold text-white">{stage}</div>
                                        <div className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-semibold text-white/60">
                                            {grouped[stage].length}
                                        </div>
                                    </div>
                                </div>

                                <div className="max-h-[520px] space-y-3 overflow-y-auto p-3">
                                    {grouped[stage].map((job) => (
                                        <Link
                                            key={job.id}
                                            href={`/jobs/${job.id}`}
                                            className="block rounded-[1.25rem] border border-white/10 bg-white/[0.05] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08]"
                                        >
                                            <div className="text-sm font-semibold text-white">
                                                {job.homeownerName}
                                            </div>

                                            <div className="mt-1 text-xs text-white/50">{job.address}</div>

                                            <div className="mt-3 space-y-1 text-xs text-white/55">
                                                <div>Insurance: {job.insuranceCarrier}</div>
                                                <div>Claim: {job.claimNumber}</div>
                                                <div>Install: {job.installDate || '—'}</div>
                                                <div>
                                                    Reps:{' '}
                                                    {job.repNames.length > 0 ? job.repNames.join(', ') : '—'}
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </section>
    )
}