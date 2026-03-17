'use client'

export default function JobsStageRail({
    counts,
    activeStage,
    onStageChange,
}: {
    counts: Array<{ name: string; count: number }>
    activeStage: string
    onStageChange: (stage: string) => void
}) {
    return (
        <section className="overflow-x-auto rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
            <div className="flex min-w-max gap-3">
                <button
                    type="button"
                    onClick={() => onStageChange('')}
                    className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${activeStage === ''
                            ? 'bg-[#d6b37a] text-black'
                            : 'border border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08]'
                        }`}
                >
                    All Stages
                </button>

                {counts.map((stage) => (
                    <button
                        key={stage.name}
                        type="button"
                        onClick={() => onStageChange(stage.name)}
                        className={`rounded-2xl px-4 py-3 text-left transition ${activeStage === stage.name
                                ? 'bg-[#d6b37a] text-black'
                                : 'border border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08]'
                            }`}
                    >
                        <div className="text-sm font-semibold">{stage.name}</div>
                        <div className={`mt-1 text-xs ${activeStage === stage.name ? 'text-black/70' : 'text-white/45'}`}>
                            {stage.count} job(s)
                        </div>
                    </button>
                ))}
            </div>
        </section>
    )
}