'use client'

export default function AnnouncementsPanel({
    rows,
}: {
    rows: Array<{
        id: string
        title: string
        body: string
        created_at?: string
    }>
}) {
    return (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
            <div className="mb-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]">
                    Manager Announcements
                </div>
                <div className="mt-2 text-xl font-bold tracking-tight text-white">
                    Broadcasts and updates
                </div>
            </div>

            <div className="space-y-3">
                {rows.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/50">
                        No active announcements right now.
                    </div>
                ) : (
                    rows.map((row) => (
                        <div
                            key={row.id}
                            className="rounded-2xl border border-white/10 bg-black/20 p-4"
                        >
                            <div className="text-sm font-semibold text-white">{row.title}</div>
                            <div className="mt-2 text-sm leading-6 text-white/66">{row.body}</div>
                        </div>
                    ))
                )}
            </div>
        </section>
    )
}