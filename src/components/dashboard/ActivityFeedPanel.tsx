'use client'

import Link from 'next/link'

export default function ActivityFeedPanel({
    rows = [],
    title = 'Recent Activity',
}: {
    rows: Array<{
        id: string
        jobId: string
        eventLabel: string
        homeownerName: string
        address: string
        createdAt: string
    }>
    title?: string
}) {
    return (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
            <div className="mb-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]">
                    Activity Feed
                </div>
                <div className="mt-2 text-xl font-bold tracking-tight text-white">
                    {title}
                </div>
            </div>

            <div className="space-y-3">
                {rows.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/50">
                        No recent activity logged.
                    </div>
                ) : (
                    rows.map((row) => (
                        <Link
                            key={row.id}
                            href={`/jobs/${row.jobId}`}
                            className="block rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-white/20 hover:bg-white/[0.06]"
                        >
                            <div className="text-sm font-semibold text-white">{row.eventLabel}</div>
                            <div className="mt-1 text-sm text-white/66">{row.homeownerName}</div>
                            <div className="mt-1 text-xs text-white/45">{row.address}</div>
                            <div className="mt-2 text-[11px] uppercase tracking-[0.14em] text-[#d6b37a]">
                                {new Date(row.createdAt).toLocaleString()}
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </section>
    )
}