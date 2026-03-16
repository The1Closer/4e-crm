'use client'

import { useEffect, useMemo, useState } from 'react'
import BranchDashboard from '@/components/dashboard/BranchDashboard'
import TeamDashboard from '@/components/dashboard/TeamDashboard'
import IndividualDashboard from '@/components/dashboard/IndividualDashboard'

function normalizeRole(role?: string | null) {
  return (role ?? '').trim().toLowerCase()
}

export default function DashboardTabs({
  role,
  profile,
  filters,
  activeChart,
  visibleModules,
}: {
  role?: string | null
  profile: any
  filters: { startDate: string; endDate: string }
  activeChart: 'revenue' | 'funnel' | 'leaderboard' | 'pipeline'
  visibleModules: { kpi: boolean; insights: boolean; kanban: boolean }
}) {
  const normalizedRole = normalizeRole(role)

  const showBranch = true
  const showTeam = normalizedRole === 'sales_manager'

  const availableTabs = useMemo(() => {
    const tabs: Array<'branch' | 'team' | 'individual'> = ['branch']
    if (showTeam) tabs.push('team')
    tabs.push('individual')
    return tabs
  }, [showTeam])

  const [tab, setTab] = useState<'branch' | 'team' | 'individual'>('branch')

  useEffect(() => {
    if (!availableTabs.includes(tab)) {
      setTab(availableTabs[0])
    }
  }, [availableTabs, tab])

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-[0_10px_40px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap gap-3">
          {availableTabs.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold capitalize transition ${tab === item
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-100'
                }`}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      {tab === 'branch' ? (
        <BranchDashboard
          profile={profile}
          filters={filters}
          activeChart={activeChart}
          visibleModules={visibleModules}
        />
      ) : null}

      {tab === 'team' && showTeam ? (
        <TeamDashboard
          profile={profile}
          filters={filters}
          activeChart={activeChart}
          visibleModules={visibleModules}
        />
      ) : null}

      {tab === 'individual' ? (
        <IndividualDashboard
          profile={profile}
          filters={filters}
          activeChart={activeChart}
          visibleModules={visibleModules}
        />
      ) : null}
    </div>
  )
}