'use client'

export type JobsQuickFilter =
  | 'all'
  | 'mine'
  | 'unassigned'
  | 'has_install'
  | 'no_install'
  | 'high_value'

export default function JobsQuickFilters({
  active,
  onChange,
}: {
  active: JobsQuickFilter
  onChange: (filter: JobsQuickFilter) => void
}) {
  const options: Array<{ key: JobsQuickFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'mine', label: 'My Jobs' },
    { key: 'unassigned', label: 'Unassigned' },
    { key: 'has_install', label: 'Has Install Date' },
    { key: 'no_install', label: 'No Install Date' },
    { key: 'high_value', label: 'High Value' },
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
            active === option.key
              ? 'bg-[#d6b37a] text-black'
              : 'border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
