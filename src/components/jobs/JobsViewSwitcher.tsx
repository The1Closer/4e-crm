'use client'

export type JobsViewMode = 'cards' | 'table' | 'kanban'

export default function JobsViewSwitcher({
    view,
    onViewChange,
}: {
    view: JobsViewMode
    onViewChange: (view: JobsViewMode) => void
}) {
    const options: JobsViewMode[] = ['cards', 'table', 'kanban']

    return (
        <div className="flex flex-wrap gap-2">
            {options.map((option) => (
                <button
                    key={option}
                    type="button"
                    onClick={() => onViewChange(option)}
                    className={`rounded-2xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${view === option
                            ? 'bg-[#d6b37a] text-black'
                            : 'border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white'
                        }`}
                >
                    {option}
                </button>
            ))}
        </div>
    )
}