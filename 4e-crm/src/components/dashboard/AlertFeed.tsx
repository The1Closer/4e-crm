'use client'

export default function AlertFeed({
    rows = [],
    title = 'Alerts',
}: {
    rows: Array<{
        id: string
        title: string
        body: string
        tone: 'gold' | 'blue' | 'red'
    }>
    title?: string
}) {
    const toneClass: Record<string, string> = {
        gold: 'border-[#d6b37a]/20 bg-[#d6b37a]/10 text-[#f0d9b1]',
        blue: 'border-sky-400/20 bg-sky-500/10 text-sky-200',
        red: 'border-red-400/20 bg-red-500/10 text-red-200',
    }

    return (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
            <div className="mb-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]">
                    {title}
                </div>
                <div className="mt-2 text-xl font-bold tracking-tight text-white">
                    What needs attention
                </div>
            </div>

            <div className="space-y-3">
                {rows.map((row) => (
                    <div
                        key={row.id}
                        className={`rounded-2xl border p-4 ${toneClass[row.tone]}`}
                    >
                        <div className="text-sm font-semibold">{row.title}</div>
                        <div className="mt-2 text-sm leading-6 opacity-90">{row.body}</div>
                    </div>
                ))}
            </div>
        </section>
    )
}