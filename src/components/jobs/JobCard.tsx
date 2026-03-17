'use client'

import Link from 'next/link'

export type JobCardRow = {
    id: string
    homeownerName: string
    phone: string
    email: string
    address: string
    stageName: string
    repNames: string[]
    insuranceCarrier: string
    claimNumber: string
    installDate: string | null
    contractAmount: number | null
    depositCollected: number | null
    remainingBalance: number | null
}

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

function StagePill({ stageName }: { stageName: string }) {
    return (
        <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d6b37a]">
            {stageName}
        </div>
    )
}

export default function JobCard({ job }: { job: JobCardRow }) {
    const noRepAssigned = job.repNames.length === 0

    return (
        <Link
            href={`/jobs/${job.id}`}
            className="group block rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.25)] backdrop-blur-2xl transition duration-200 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]"
        >
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
                        Assigned Reps
                    </div>

                    {noRepAssigned ? (
                        <div className="rounded-full border border-red-400/20 bg-red-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-200">
                            Unassigned
                        </div>
                    ) : null}
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                    {noRepAssigned ? (
                        <span className="text-sm text-white/55">No reps assigned</span>
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
                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
                        Insurance
                    </div>
                    <div className="mt-1 font-medium text-white">{job.insuranceCarrier}</div>
                </div>

                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
                        Claim Number
                    </div>
                    <div className="mt-1 font-medium text-white">{job.claimNumber}</div>
                </div>

                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
                        Install Date
                    </div>
                    <div className="mt-1 font-medium text-white">{formatDate(job.installDate)}</div>
                </div>

                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
                        Contract Amount
                    </div>
                    <div className="mt-1 font-medium text-white">
                        {formatCurrency(job.contractAmount)}
                    </div>
                </div>

                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
                        Deposit Collected
                    </div>
                    <div className="mt-1 font-medium text-white">
                        {formatCurrency(job.depositCollected)}
                    </div>
                </div>

                <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
                        Remaining Balance
                    </div>
                    <div className="mt-1 font-medium text-white">
                        {formatCurrency(job.remainingBalance)}
                    </div>
                </div>
            </div>
        </Link>
    )
}