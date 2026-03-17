'use client'

import Link from 'next/link'
import { JobCardRow } from '@/components/jobs/JobCard'

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
}: {
    rows: JobCardRow[]
}) {
    return (
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="border-b border-white/10 text-left text-white/45">
                            <th className="px-4 py-4">Homeowner</th>
                            <th className="px-4 py-4">Stage</th>
                            <th className="px-4 py-4">Reps</th>
                            <th className="px-4 py-4">Carrier</th>
                            <th className="px-4 py-4">Install</th>
                            <th className="px-4 py-4">Contract</th>
                            <th className="px-4 py-4">Balance</th>
                        </tr>
                    </thead>

                    <tbody>
                        {rows.map((job) => (
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

                                <td className="px-4 py-4 text-white/75">{job.stageName}</td>
                                <td className="px-4 py-4 text-white/75">
                                    {job.repNames.length ? job.repNames.join(', ') : '—'}
                                </td>
                                <td className="px-4 py-4 text-white/75">{job.insuranceCarrier}</td>
                                <td className="px-4 py-4 text-white/75">{formatDate(job.installDate)}</td>
                                <td className="px-4 py-4 text-white">{formatCurrency(job.contractAmount)}</td>
                                <td className="px-4 py-4 text-white">{formatCurrency(job.remainingBalance)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    )
}