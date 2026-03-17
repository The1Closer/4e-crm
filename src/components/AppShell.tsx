'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bell,
  Briefcase,
  CalendarDays,
  ChevronRight,
  FileText,
  Home,
  LayoutDashboard,
  PenSquare,
  PlusSquare,
  Settings2,
  ShieldCheck,
  Users,
} from 'lucide-react'

import AuthStatus from '@/components/AuthStatus'
import NotificationBell from '@/components/NotificationBell'
import {
  getCurrentUserProfile,
  getPermissions,
  type UserProfile,
} from '@/lib/auth-helpers'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  show: boolean
  group: 'main' | 'workspace' | 'admin'
}

export default function AppShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loadingRole, setLoadingRole] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isAuthPage = pathname === '/sign-in'

  useEffect(() => {
    async function loadProfile() {
      const nextProfile = await getCurrentUserProfile()
      setProfile(nextProfile)
      setLoadingRole(false)
    }

    loadProfile()
  }, [])

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  if (isAuthPage) {
    return <>{children}</>
  }

  const permissions = getPermissions(profile?.role)

  const navItems: NavItem[] = [
    {
      href: '/',
      label: 'Home',
      icon: Home,
      show: permissions.canViewHome,
      group: 'main',
    },
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      show: permissions.canViewDashboard,
      group: 'main',
    },
    {
      href: '/jobs',
      label: 'Jobs',
      icon: Briefcase,
      show: permissions.canViewJobs,
      group: 'workspace',
    },
    {
      href: '/jobs/new',
      label: 'New Job',
      icon: PlusSquare,
      show: permissions.canCreateJob,
      group: 'workspace',
    },
    {
      href: '/calendar/installs',
      label: 'Calendar',
      icon: CalendarDays,
      show: permissions.canViewInstallCalendar,
      group: 'workspace',
    },
    {
      href: '/commissions',
      label: 'Commissions',
      icon: ShieldCheck,
      show: permissions.canViewCommissions,
      group: 'workspace',
    },
    {
      href: '/templates',
      label: 'Templates',
      icon: FileText,
      show: permissions.canViewTemplates,
      group: 'workspace',
    },
    {
      href: '/contracts/editor',
      label: 'Signer',
      icon: PenSquare,
      show: permissions.canUseSigner,
      group: 'workspace',
    },
    {
      href: '/notifications',
      label: 'Notifications',
      icon: Bell,
      show: permissions.canViewNotifications,
      group: 'workspace',
    },
    {
      href: '/team/users',
      label: 'Users',
      icon: Users,
      show: permissions.canManageUsers,
      group: 'admin',
    },
    {
      href: '/stats/manager',
      label: 'Manager',
      icon: Settings2,
      show: permissions.canViewManagerEntry,
      group: 'admin',
    },
  ]

  const visibleNavItems = useMemo(
    () => navItems.filter((item) => item.show),
    [loadingRole, profile?.role]
  )

  const groupedNav = {
    main: visibleNavItems.filter((item) => item.group === 'main'),
    workspace: visibleNavItems.filter((item) => item.group === 'workspace'),
    admin: visibleNavItems.filter((item) => item.group === 'admin'),
  }

  const roleLabel =
    profile?.role?.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ||
    'User'

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="fixed inset-0 -z-20 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.07),transparent_24%),radial-gradient(circle_at_top_right,rgba(214,179,122,0.14),transparent_18%),linear-gradient(180deg,#151515_0%,#0b0b0b_46%,#030303_100%)]" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(135deg,rgba(255,255,255,0.02),transparent_35%,rgba(255,255,255,0.01)_62%,transparent)]" />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/40 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="group inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition duration-200 hover:border-[#d6b37a]/30 hover:bg-white/[0.08] hover:text-white"
              aria-label="Open navigation"
            >
              <span className="flex flex-col gap-1.5">
                <span className="block h-0.5 w-5 rounded-full bg-current transition-transform duration-200 group-hover:translate-x-0.5" />
                <span className="block h-0.5 w-5 rounded-full bg-current" />
                <span className="block h-0.5 w-5 rounded-full bg-current transition-transform duration-200 group-hover:-translate-x-0.5" />
              </span>
            </button>

            <Link href="/" className="group flex items-center gap-4">
              <div className="relative h-15 w-15 overflow-hidden rounded-[1.35rem] border border-[#d6b37a]/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] shadow-[0_16px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/5">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(214,179,122,0.18),transparent_55%)]" />
                <Image
                  src="/4ELogo.jpeg"
                  alt="4 Elements CRM"
                  fill
                  className="object-contain p-1.5 transition duration-300 group-hover:scale-[1.03]"
                  sizes="60px"
                />
              </div>

              <div className="leading-none">
                <div className="text-[11px] font-semibold uppercase tracking-[0.42em] text-[#d6b37a]">
                  4 Elements
                </div>
                <div className="mt-1.5 text-[1.95rem] font-bold tracking-[0.01em] text-white">
                  CRM
                </div>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-right shadow-[0_10px_30px_rgba(0,0,0,0.25)] lg:block">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
                Signed In
              </div>
              <div className="mt-1 text-sm font-semibold text-white/90">
                {profile?.full_name || 'Loading...'}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#d6b37a]">
                {roleLabel}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition hover:border-white/15 hover:bg-white/[0.06]">
              <NotificationBell />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition hover:border-white/15 hover:bg-white/[0.06]">
              <AuthStatus />
            </div>
          </div>
        </div>
      </header>

      <aside
        className={`fixed inset-y-0 left-0 z-[60] w-[330px] transform border-r border-white/10 bg-[#0d0d0d]/95 backdrop-blur-2xl shadow-[0_30px_80px_rgba(0,0,0,0.55)] transition duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 overflow-hidden rounded-[1rem] border border-[#d6b37a]/20 bg-white/[0.04] shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                    <img
                      src="/4ELogo.jpeg"
                      alt="4 Elements CRM"
                      className="h-full w-full object-contain p-1.5"
                    />
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b37a]">
                      Navigation
                    </div>
                    <div className="mt-1 text-lg font-bold text-white">
                      Workspace
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/38">
                    Current Profile
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {profile?.full_name || 'Loading...'}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#d6b37a]">
                    {roleLabel}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/70 transition hover:border-white/15 hover:bg-white/[0.08] hover:text-white"
                aria-label="Close navigation"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <NavGroup title="Overview" items={groupedNav.main} pathname={pathname} />
            <NavGroup title="Workspace" items={groupedNav.workspace} pathname={pathname} />
            {groupedNav.admin.length > 0 ? (
              <NavGroup title="Management" items={groupedNav.admin} pathname={pathname} />
            ) : null}
          </div>
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
          aria-label="Close navigation overlay"
        />
      ) : null}

      <main className="mx-auto max-w-7xl px-5 py-8 md:px-6">{children}</main>
    </div>
  )
}

function NavGroup({
  title,
  items,
  pathname,
}: {
  title: string
  items: NavItem[]
  pathname: string
}) {
  if (items.length === 0) return null

  return (
    <section className="mb-6">
      <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">
        {title}
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))

          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                active
                  ? 'bg-[linear-gradient(135deg,#d6b37a,#e2bf85)] text-black shadow-[0_12px_30px_rgba(214,179,122,0.25)]'
                  : 'border border-white/8 bg-white/[0.03] text-white/75 hover:border-white/15 hover:bg-white/[0.07] hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3">
                <span
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${
                    active
                      ? 'bg-black/10 text-black'
                      : 'border border-white/10 bg-white/[0.03] text-[#d6b37a]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {item.label}
              </span>

              <ChevronRight
                className={`h-4 w-4 transition ${
                  active
                    ? 'text-black/70'
                    : 'text-white/22 group-hover:translate-x-0.5 group-hover:text-white/45'
                }`}
              />
            </Link>
          )
        })}
      </div>
    </section>
  )
}