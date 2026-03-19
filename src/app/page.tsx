'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  Bell,
  Briefcase,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  MapPinned,
  PenSquare,
  ShieldCheck,
  Users,
} from 'lucide-react'
import {
  getCurrentUserProfile,
  getPermissions,
  type UserProfile,
} from '@/lib/auth-helpers'

type HomeAction = {
  title: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  tone?: 'primary' | 'accent'
}

function formatRoleLabel(role: string | null | undefined) {
  return role?.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase()) || 'Team Member'
}

export default function HomePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadProfile() {
      const nextProfile = await getCurrentUserProfile()

      if (!isActive) {
        return
      }

      setProfile(nextProfile)
    }

    void loadProfile()

    return () => {
      isActive = false
    }
  }, [])

  const permissions = getPermissions(profile?.role)
  const roleLabel = formatRoleLabel(profile?.role)

  const featuredActions = useMemo<HomeAction[]>(
    () => {
      const base: HomeAction[] = [
        {
          title: 'Open Dashboard',
          description: 'See production, pace, projections, and branch visibility in one place.',
          href: '/dashboard',
          icon: LayoutDashboard,
          tone: 'primary',
        },
        {
          title: 'Open Jobs',
          description: 'Work the pipeline, update files, and keep homeowners moving forward.',
          href: '/jobs',
          icon: Briefcase,
        },
        {
          title: 'Submit Nightly Numbers',
          description: 'Log today’s activity so dashboards and coaching stay current.',
          href: '/stats/submit',
          icon: ClipboardList,
          tone: 'accent',
        },
      ]

      if (permissions.canViewManagerEntry) {
        base.push({
          title: 'Open Branch Numbers',
          description: 'Review or enter nightly numbers across the full rep roster.',
          href: '/stats/manager',
          icon: Users,
        })
      }

      return base
    },
    [permissions.canViewManagerEntry]
  )

  const workspaceActions = useMemo<HomeAction[]>(
    () => {
      const base: HomeAction[] = [
        {
          title: 'Install Calendar',
          description: 'Schedule installs and move jobs into Install Scheduled from one board.',
          href: '/calendar/installs',
          icon: CalendarDays,
        },
        {
          title: 'Templates',
          description: 'Manage the PDFs the team launches into the signer.',
          href: '/templates',
          icon: FileText,
        },
        {
          title: 'Signer',
          description: 'Open, annotate, sign, and save PDFs back into the CRM.',
          href: '/contracts/editor',
          icon: PenSquare,
        },
        {
          title: 'Notifications',
          description: 'Catch assignments, mentions, and internal updates quickly.',
          href: '/notifications',
          icon: Bell,
        },
        {
          title: 'Lead Map',
          description: 'Work visible leads on the map without jumping between tools.',
          href: '/map',
          icon: MapPinned,
        },
        {
          title: 'Commissions',
          description: 'Review payout-ready files and backend commission details.',
          href: '/commissions',
          icon: ShieldCheck,
        },
      ]

      if (permissions.canManageUsers) {
        base.push({
          title: 'Team Users',
          description: 'Manage rep assignments, roles, and active users.',
          href: '/team/users',
          icon: Users,
        })
      }

      return base
    },
    [permissions.canManageUsers]
  )

  const nextBestAction = permissions.canViewManagerEntry
    ? { href: '/stats/manager', label: 'Review branch nightly numbers' }
    : { href: '/stats/submit', label: 'Submit today’s nightly numbers' }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.4rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.11),rgba(255,255,255,0.03))] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.22),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_26%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,179,122,0.7),transparent)]" />

        <div className="relative grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b37a]">
              Home Base
            </div>

            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl">
                Start with the tools that actually move work forward.
              </h1>

              <p className="max-w-2xl text-base leading-7 text-white/68 md:text-lg">
                Jobs, nightly numbers, documents, notifications, and reporting are all one click away here. No placeholder stats. No filler.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <HeroAction href="/jobs" label="Open Jobs" primary />
              <HeroAction href="/dashboard" label="Open Dashboard" />
              <HeroAction href="/stats/submit" label="Submit Numbers" />
            </div>
          </div>

          <section className="rounded-[2rem] border border-white/10 bg-black/20 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#d6b37a]">
              Today&apos;s Focus
            </div>

            <div className="mt-4 space-y-4">
              <SummaryRow label="Signed In As" value={profile?.full_name || 'Loading profile...'} />
              <SummaryRow label="Role" value={roleLabel} />
              <SummaryRow
                label="Best Next Step"
                value={nextBestAction.label}
                href={nextBestAction.href}
              />
              <SummaryRow
                label="Priority"
                value="Keep jobs updated and nightly numbers current."
              />
            </div>
          </section>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="grid gap-4 md:grid-cols-2">
          {featuredActions.map((action) => (
            <ActionCard key={action.href} action={action} />
          ))}
        </section>

        <section className="space-y-6">
          <WorkflowPanel
            title="Daily Flow"
            description="A tighter default path for most people using the CRM."
            rows={[
              'Open jobs and clean up stage, rep, and homeowner details first.',
              'Submit nightly numbers before the day closes so reporting stays accurate.',
              'Use notifications and the signer to finish handoffs without leaving the system.',
            ]}
          />

          <WorkflowPanel
            title="More Workspace Tools"
            description="Everything else that tends to matter during a real workday."
            rows={workspaceActions.map((action) => (
              <LinkRow
                key={action.href}
                href={action.href}
                label={action.title}
                icon={action.icon}
              />
            ))}
          />
        </section>
      </section>
    </div>
  )
}

function HeroAction({
  href,
  label,
  primary = false,
}: {
  href: string
  label: string
  primary?: boolean
}) {
  return (
    <Link
      href={href}
      className={`rounded-2xl px-5 py-3 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 ${
        primary
          ? 'bg-[#d6b37a] text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] hover:bg-[#e2bf85]'
          : 'border border-white/12 bg-white/[0.05] text-white hover:bg-white/[0.10]'
      }`}
    >
      {label}
    </Link>
  )
}

function SummaryRow({
  label,
  value,
  href,
}: {
  label: string
  value: string
  href?: string
}) {
  const content = href ? (
    <Link href={href} className="text-right font-semibold text-white hover:text-[#f0ce94]">
      {value}
    </Link>
  ) : (
    <div className="text-right font-semibold text-white">{value}</div>
  )

  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
        {label}
      </div>
      {content}
    </div>
  )
}

function ActionCard({
  action,
}: {
  action: HomeAction
}) {
  const Icon = action.icon
  const toneClass =
    action.tone === 'primary'
      ? 'border-[#d6b37a]/30 bg-[linear-gradient(135deg,rgba(214,179,122,0.18),rgba(255,255,255,0.04))]'
      : action.tone === 'accent'
        ? 'border-blue-400/20 bg-[linear-gradient(135deg,rgba(59,130,246,0.16),rgba(255,255,255,0.04))]'
        : 'border-white/10 bg-white/[0.04]'

  return (
    <Link
      href={action.href}
      className={`group rounded-[2rem] border p-6 shadow-[0_25px_80px_rgba(0,0,0,0.30)] backdrop-blur-2xl transition duration-200 hover:-translate-y-1 ${toneClass}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
          <Icon className="h-5 w-5 text-[#d6b37a]" />
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45 transition group-hover:text-white/72">
          Open
        </span>
      </div>

      <h2 className="mt-4 text-xl font-semibold tracking-tight text-white">
        {action.title}
      </h2>
      <p className="mt-3 text-sm leading-6 text-white/65">{action.description}</p>
    </Link>
  )
}

function WorkflowPanel({
  title,
  description,
  rows,
}: {
  title: string
  description: string
  rows: React.ReactNode[]
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.25)] backdrop-blur-2xl">
      <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d6b37a]">
        {title}
      </div>
      <p className="mt-3 text-sm leading-6 text-white/62">{description}</p>

      <div className="mt-5 space-y-3">
        {rows.map((row, index) => (
          <div
            key={index}
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-white/74"
          >
            {row}
          </div>
        ))}
      </div>
    </section>
  )
}

function LinkRow({
  href,
  label,
  icon: Icon,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/78 transition hover:border-white/15 hover:bg-white/[0.08] hover:text-white"
    >
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-[#d6b37a]" />
        {label}
      </span>
      <span className="text-white/30">→</span>
    </Link>
  )
}
