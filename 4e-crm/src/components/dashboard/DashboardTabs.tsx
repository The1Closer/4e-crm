'use client'

import { useMemo, useState } from 'react'
import BranchDashboard from '@/components/dashboard/BranchDashboard'
import TeamDashboard from '@/components/dashboard/TeamDashboard'
import IndividualDashboard from '@/components/dashboard/IndividualDashboard'
import type { UserProfile } from '@/lib/auth-helpers'

function normalizeRole(role?: string | null) {
  return (role ?? '').trim().toLowerCase()
}

export default function DashboardTabs({
  role,
  profile,
  filters,
  activeChart,
  onActiveChartChange,
  periodLabel,
  showProjection,
}: {
  role?: string | null
  profile: UserProfile
  filters: { startDate: string; endDate: string }
  activeChart: 'revenue' | 'funnel' | 'leaderboard' | 'pipeline'
  onActiveChartChange: (
    next: 'revenue' | 'funnel' | 'leaderboard' | 'pipeline'
  ) => void
  periodLabel: string
  showProjection: boolean
}) {
  const normalizedRole = normalizeRole(role)

  const showTeam = normalizedRole === 'sales_manager'

  const availableTabs = useMemo(() => {
    const tabs: Array<'branch' | 'team' | 'individual'> = ['branch']
    if (showTeam) tabs.push('team')
    tabs.push('individual')
    return tabs
  }, [showTeam])

  const [tab, setTab] = useState<'branch' | 'team' | 'individual'>('branch')
  const activeTab = availableTabs.includes(tab) ? tab : availableTabs[0]

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
        <div className="flex flex-wrap gap-3">
          {availableTabs.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold capitalize transition ${
                activeTab === item
                  ? 'bg-[#d6b37a] text-black'
                  : 'border border-white/10 bg-white/[0.04] text-white/72 hover:bg-white/[0.08] hover:text-white'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      {activeTab === 'branch' ? (
        <BranchDashboard
          profile={profile}
          filters={filters}
          activeChart={activeChart}
          onActiveChartChange={onActiveChartChange}
          periodLabel={periodLabel}
          showProjection={showProjection}
        />
      ) : null}

      {activeTab === 'team' && showTeam ? (
        <TeamDashboard
          profile={profile}
          filters={filters}
          activeChart={activeChart}
          onActiveChartChange={onActiveChartChange}
          periodLabel={periodLabel}
          showProjection={showProjection}
        />
      ) : null}

      {activeTab === 'individual' ? (
        <IndividualDashboard
          profile={profile}
          filters={filters}
          activeChart={activeChart}
          onActiveChartChange={onActiveChartChange}
          periodLabel={periodLabel}
          showProjection={showProjection}
        />
      ) : null}
    </div>
  )
}
