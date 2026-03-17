'use client'

export type JobsSortKey =
    | 'newest'
    | 'contract_high'
    | 'install_soonest'
    | 'homeowner_az'

export default function JobsSortSelect({
    value,
    onChange,
}: {
    value: JobsSortKey
    onChange: (value: JobsSortKey) => void
}) {
    return (
        <select
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
            value={value}
            onChange={(e) => onChange(e.target.value as JobsSortKey)}
        >
            <option value="newest">Newest</option>
            <option value="contract_high">Contract Amount High → Low</option>
            <option value="install_soonest">Install Date Soonest</option>
            <option value="homeowner_az">Homeowner A → Z</option>
        </select>
    )
}