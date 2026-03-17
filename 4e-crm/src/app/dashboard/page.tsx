'use client'

import { useEffect, useMemo, useState } from 'react'
import DashboardControls from '@/components/dashboard/DashboardControls'
import DashboardTabs from '@/components/dashboard/DashboardTabs'
import { getCurrentUserProfile, type UserProfile } from '@/lib/auth-helpers'

type DashboardPreset = 'mtd' | 'last7' | 'today' | 'custom'

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getPresetRange(preset: DashboardPreset) {
  const now = new Date()
  const today = formatDate(now)

  if (preset === 'today') {
    return {
      startDate: today,
      endDate: today,
    }
  }

  if (preset === 'last7') {
    const start = new Date(now)
    start.setDate(now.getDate() - 6)

    return {
      startDate: formatDate(start),
      endDate: today,
    }
  }

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  return {
    startDate: formatDate(monthStart),
    endDate: today,
  }
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const [preset, setPreset] = useState<DashboardPreset>('mtd')
  const [filters, setFilters] = useState(getPresetRange('mtd'))
  const [activeChart, setActiveChart] = useState<
    'revenue' | 'funnel' | 'leaderboard' | 'pipeline'
  >('revenue')

  useEffect(() => {
    async function loadProfile() {
      const currentProfile = await getCurrentUserProfile()
      setProfile(currentProfile)
      setLoading(false)
    }

    loadProfile()
  }, [])

  function handlePresetChange(next: DashboardPreset) {
    setPreset(next)

    if (next === 'custom') return
    setFilters(getPresetRange(next))
  }

  function handleFiltersChange(next: { startDate: string; endDate: string }) {
    setPreset('custom')
    setFilters(next)
  }

  const periodLabel = useMemo(() => {
    if (preset === 'mtd') return 'Month to Date'
    if (preset === 'last7') return 'Last 7 Days'
    if (preset === 'today') return 'Today'
    return `${filters.startDate} → ${filters.endDate}`
  }, [preset, filters])

  const showProjection = preset === 'mtd'

  if (loading || !profile) {
    return (
      <div className="space-y-6">
        <section className="rounded-[2.25rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <div className="text-sm text-white/60">Loading dashboard…</div>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.22),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_26%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,179,122,0.7),transparent)]" />

        <div className="relative">
          <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b37a]">
            Dashboard
          </div>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
                Performance War Room
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-white/68 md:text-lg">
                Compact, high-signal visibility across activity, pipeline movement, rep output, and operational pressure points.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4 text-right shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/38">
                Active Window
              </div>
              <div className="mt-2 text-lg font-bold text-white">{periodLabel}</div>
              <div className="mt-1 text-xs text-[#d6b37a]">
                {showProjection
                  ? 'Projections exclude Sundays.'
                  : 'Projection rail hidden outside MTD.'}
              </div>
            </div>
          </div>
        </div>
      </section>

      <DashboardControls
        filters={filters}
        preset={preset}
        onPresetChange={handlePresetChange}
        onFiltersChange={handleFiltersChange}
        activeChart={activeChart}
        onActiveChartChange={setActiveChart}
      />

      <DashboardTabs
        role={profile.role}
        profile={profile}
        filters={filters}
        activeChart={activeChart}
        onActiveChartChange={setActiveChart}
        periodLabel={periodLabel}
        showProjection={showProjection}
      />
    </div>
  )
}