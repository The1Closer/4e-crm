'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Archive,
  Bell,
  BookOpenText,
  Briefcase,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FileText,
  Home,
  LayoutDashboard,
  MapPinned,
  PenSquare,
  PlusSquare,
  Settings2,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from 'lucide-react'

import AuthStatus from '@/components/AuthStatus'
import HeaderWorkspaceSearch from '@/components/HeaderWorkspaceSearch'
import LiveNotificationToasts from '@/components/LiveNotificationToasts'
import NotificationBell from '@/components/NotificationBell'
import { authorizedFetch } from '@/lib/api-client'
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
  group: 'main' | 'workspace' | 'admin' | 'account'
}

function formatRoleLabel(role: string | null | undefined) {
  return role?.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase()) || 'Team Member'
}

function getInitials(name: string | null | undefined) {
  if (!name?.trim()) return '4E'

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export default function AppShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isAuthPage = pathname === '/sign-in'

  useEffect(() => {
    let isActive = true

    async function loadProfile() {
      const nextProfile = await getCurrentUserProfile()

      if (!isActive) return

      setProfile(nextProfile)
    }

    function handleProfileUpdated() {
      void loadProfile()
    }

    void loadProfile()
    window.addEventListener('profile:updated', handleProfileUpdated)

    return () => {
      isActive = false
      window.removeEventListener('profile:updated', handleProfileUpdated)
    }
  }, [])

  useEffect(() => {
    if (isAuthPage || !profile?.id) {
      return
    }

    void authorizedFetch('/api/notifications/archive-sync', {
      method: 'POST',
    }).catch((error) => {
      console.error('Could not sync archive notifications.', error)
    })
  }, [isAuthPage, profile?.id])

  if (isAuthPage) {
    return <>{children}</>
  }

  const permissions = getPermissions(profile?.role)
  const roleLabel = formatRoleLabel(profile?.role)

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
      label: 'Create Job',
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
      href: '/stats/submit',
      label: 'Submit Numbers',
      icon: ClipboardList,
      show: true,
      group: 'workspace',
    },
    {
      href: '/map',
      label: 'Lead Map',
      icon: MapPinned,
      show: permissions.canViewLeadMap,
      group: 'workspace',
    },
    {
      href: '/training',
      label: 'Training',
      icon: BookOpenText,
      show: true,
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
      label: 'Branch Numbers',
      icon: Settings2,
      show: permissions.canViewManagerEntry,
      group: 'admin',
    },
    {
      href: '/profile',
      label: 'Profile',
      icon: UserRound,
      show: true,
      group: 'account',
    },
    {
      href: '/archive',
      label: 'Archive',
      icon: Archive,
      show: permissions.canViewArchive,
      group: 'account',
    },
  ]

  const visibleNavItems = navItems.filter((item) => item.show)

  const groupedNav = {
    main: visibleNavItems.filter((item) => item.group === 'main'),
    workspace: visibleNavItems.filter((item) => item.group === 'workspace'),
    admin: visibleNavItems.filter((item) => item.group === 'admin'),
    account: visibleNavItems.filter((item) => item.group === 'account'),
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <LiveNotificationToasts />
      <div className="fixed inset-0 -z-20 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.07),transparent_24%),radial-gradient(circle_at_top_right,rgba(214,179,122,0.14),transparent_18%),linear-gradient(180deg,#151515_0%,#0b0b0b_46%,#030303_100%)]" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(135deg,rgba(255,255,255,0.02),transparent_35%,rgba(255,255,255,0.01)_62%,transparent)]" />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/40 backdrop-blur-2xl">
        <div className="mx-auto max-w-[1500px] px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="group inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.35rem] border border-white/10 bg-white/[0.04] text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition duration-200 hover:border-[#d6b37a]/30 hover:bg-white/[0.08] hover:text-white"
                aria-label="Open navigation"
              >
                <span className="flex flex-col gap-1.5">
                  <span className="block h-0.5 w-5 rounded-full bg-current transition-transform duration-200 group-hover:translate-x-0.5" />
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                  <span className="block h-0.5 w-5 rounded-full bg-current transition-transform duration-200 group-hover:-translate-x-0.5" />
                </span>
              </button>

              <Link href="/" className="group flex min-w-0 items-center gap-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[1.8rem] border border-[#d6b37a]/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] shadow-[0_16px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/5 sm:h-24 sm:w-24">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(214,179,122,0.18),transparent_55%)]" />
                  <Image
                    src="/4ELogo.png"
                    alt="4 Elements CRM"
                    fill
                    className="object-contain p-2 transition duration-300 group-hover:scale-[1.03]"
                    sizes="96px"
                  />
                </div>

                <div className="min-w-0 leading-none">
                  <div className="truncate text-[11px] font-semibold uppercase tracking-[0.42em] text-[#d6b37a] sm:text-[12px]">
                    4 Elements
                  </div>
                  <div className="mt-2 truncate text-[2rem] font-bold tracking-[0.03em] text-white sm:text-[2.35rem]">
                    CRM
                  </div>
                </div>
              </Link>
            </div>

            <div className="hidden min-w-0 flex-1 xl:flex xl:justify-center">
              <HeaderWorkspaceSearch
                profile={profile}
                className="w-full max-w-3xl"
              />
            </div>

            <div className="flex shrink-0 items-center gap-3">
              {permissions.canCreateJob ? (
                <Link
                  href="/jobs/new"
                  className="hidden xl:inline-flex items-center gap-2 rounded-[1.35rem] border border-[#d6b37a]/20 bg-[#d6b37a] px-4 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85]"
                >
                  <PlusSquare className="h-4 w-4" />
                  Create Job
                </Link>
              ) : null}

              <NotificationBell />
              <AuthStatus />
            </div>
          </div>

          <div
            className={`mt-4 gap-3 ${
              permissions.canCreateJob
                ? 'grid xl:hidden sm:grid-cols-[minmax(0,1fr)_auto]'
                : 'xl:hidden'
            }`}
          >
            <HeaderWorkspaceSearch profile={profile} className="w-full" />

            {permissions.canCreateJob ? (
              <Link
                href="/jobs/new"
                className="inline-flex items-center justify-center gap-2 rounded-[1.45rem] border border-[#d6b37a]/20 bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85] xl:hidden"
              >
                <PlusSquare className="h-4 w-4" />
                Create Job
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <aside
        className={`fixed inset-y-0 left-0 z-[60] w-[360px] transform border-r border-white/10 bg-[#0d0d0d]/95 backdrop-blur-2xl shadow-[0_30px_80px_rgba(0,0,0,0.55)] transition duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="relative border-b border-white/10 px-6 py-7">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="absolute right-5 top-5 inline-flex h-11 w-11 items-center justify-center rounded-[1.2rem] border border-white/10 bg-white/[0.04] text-white/70 transition hover:border-white/15 hover:bg-white/[0.08] hover:text-white"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="relative h-20 w-20 overflow-hidden rounded-[1.8rem] border border-[#d6b37a]/20 bg-white/[0.04] shadow-[0_10px_30px_rgba(0,0,0,0.35)] sm:h-24 sm:w-24">
                <Image
                  src="/4ELogo.png"
                  alt="4 Elements CRM"
                  fill
                  className="object-contain p-2"
                  sizes="96px"
                />
              </div>

              <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b37a]">
                Navigation
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-white">
                Workspace Menu
              </div>
            </div>

            <Link
              href="/profile"
              onClick={() => setSidebarOpen(false)}
              className="mt-6 flex items-center gap-4 rounded-[1.75rem] border border-white/10 bg-white/[0.04] px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)] transition hover:border-white/15 hover:bg-white/[0.06]"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.2rem] border border-white/10 bg-black/25 text-sm font-semibold text-[#d6b37a]">
                {getInitials(profile?.full_name)}
              </div>

              <div className="min-w-0 text-left">
                <div className="truncate text-base font-semibold text-white">
                  {profile?.full_name || 'Loading profile...'}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-[#d6b37a]">
                  {roleLabel}
                </div>
              </div>
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5">
            <NavGroup
              title="Overview"
              items={groupedNav.main}
              pathname={pathname}
              onNavigate={() => setSidebarOpen(false)}
            />
            <NavGroup
              title="Workspace"
              items={groupedNav.workspace}
              pathname={pathname}
              onNavigate={() => setSidebarOpen(false)}
            />
            {groupedNav.admin.length > 0 ? (
              <NavGroup
                title="Management"
                items={groupedNav.admin}
                pathname={pathname}
                onNavigate={() => setSidebarOpen(false)}
              />
            ) : null}
          </div>

          {groupedNav.account.length > 0 ? (
            <div className="border-t border-white/10 px-4 py-4">
              <NavGroup
                title="Account"
                items={groupedNav.account}
                pathname={pathname}
                onNavigate={() => setSidebarOpen(false)}
              />
            </div>
          ) : null}
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

      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}

function NavGroup({
  title,
  items,
  pathname,
  onNavigate,
}: {
  title: string
  items: NavItem[]
  pathname: string
  onNavigate: () => void
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
              onClick={onNavigate}
              className={`group flex items-center justify-between rounded-[1.4rem] px-4 py-3 text-sm font-semibold transition ${
                active
                  ? 'bg-[linear-gradient(135deg,#d6b37a,#e2bf85)] text-black shadow-[0_12px_30px_rgba(214,179,122,0.25)]'
                  : 'border border-white/8 bg-white/[0.03] text-white/75 hover:border-white/15 hover:bg-white/[0.07] hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3">
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-[1rem] ${
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
