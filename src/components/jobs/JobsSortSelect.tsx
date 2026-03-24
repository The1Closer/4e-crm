'use client'

export type JobsSortKey =
    | 'smart_priority'
    | 'newest_created'
    | 'oldest_created'
    | 'recently_updated'
    | 'least_recently_updated'
    | 'pipeline_stage_order'
    | 'install_soonest'
    | 'balance_high'
    | 'homeowner_az'
    | 'homeowner_za'
    | 'address_az'
    | 'address_za'
    | 'assigned_rep'

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
            <option value="smart_priority">Smart Priority (Default)</option>
            <option value="newest_created">Newest Created</option>
            <option value="oldest_created">Oldest Created</option>
            <option value="recently_updated">Recently Updated</option>
            <option value="least_recently_updated">Least Recently Updated</option>
            <option value="pipeline_stage_order">Pipeline Stage Order (Lead → Paid in Full)</option>
            <option value="install_soonest">Install Date Soonest</option>
            <option value="balance_high">Outstanding Balance High → Low</option>
            <option value="homeowner_az">Homeowner Name (A → Z)</option>
            <option value="homeowner_za">Homeowner Name (Z → A)</option>
            <option value="address_az">Address (A → Z)</option>
            <option value="address_za">Address (Z → A)</option>
            <option value="assigned_rep">Assigned Rep</option>
        </select>
    )
}
