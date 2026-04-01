'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import {
  ChevronRight,
  Menu,
  PlusSquare,
  X,
} from 'lucide-react'

import AuthStatus from '@/components/AuthStatus'
import BugReportButton from '@/components/BugReportButton'
import HeaderWorkspaceSearch from '@/components/HeaderWorkspaceSearch'
import LiveNotificationToasts from '@/components/LiveNotificationToasts'
import NotificationBell from '@/components/NotificationBell'
import { authorizedFetch } from '@/lib/api-client'
import { buildNavigationItems, type AppNavItem } from '@/lib/app-navigation'
import {
  getCurrentUserProfile,
  getPermissions,
  type UserProfile,
} from '@/lib/auth-helpers'

const ThemeToggle = dynamic(() => import('@/components/ThemeToggle'), {
  ssr: false,
})

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

const MOBILE_NAV_PRIMARY_HREFS = [
  '/dashboard',
  '/jobs',
  '/calendar/installs',
  '/notifications',
]

function isNavItemActive(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(href))
}

function getMobileNavLabel(item: AppNavItem) {
  if (item.href === '/calendar/installs') return 'Installs'
  if (item.href === '/notifications') return 'Alerts'
  return item.label
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

  const navItems: AppNavItem[] = buildNavigationItems(permissions)

  const visibleNavItems = navItems.filter((item) => item.show)

  const groupedNav = {
    main: visibleNavItems.filter((item) => item.group === 'main'),
    workspace: visibleNavItems.filter((item) => item.group === 'workspace'),
    admin: visibleNavItems.filter((item) => item.group === 'admin'),
    account: visibleNavItems.filter((item) => item.group === 'account'),
  }

  const mobilePrimaryItems: AppNavItem[] = []

  for (const href of MOBILE_NAV_PRIMARY_HREFS) {
    const match = visibleNavItems.find((item) => item.href === href)

    if (match) {
      mobilePrimaryItems.push(match)
    }
  }

  if (mobilePrimaryItems.length < 4) {
    for (const item of visibleNavItems) {
      if (mobilePrimaryItems.length >= 4) break
      if (item.href === '/jobs/new') continue
      if (mobilePrimaryItems.some((entry) => entry.href === item.href)) continue
      mobilePrimaryItems.push(item)
    }
  }

  const hideMobileBottomNav = pathname.startsWith('/contracts/editor')
  const mainBottomPaddingClass = hideMobileBottomNav ? 'pb-6' : 'pb-28 md:pb-6'

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--shell-text)]">
      <LiveNotificationToasts />
      <div className="app-shell-bg-primary fixed inset-0 -z-20" />
      <div className="app-shell-bg-secondary fixed inset-0 -z-10" />

      <header className="crm-shell-header sticky top-0 z-50 backdrop-blur-2xl">
        <div className="mx-auto max-w-[1500px] px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="crm-glass crm-glass-hover group inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] text-[var(--shell-text-muted)] transition duration-200 hover:border-[#d6b37a]/30 hover:text-[var(--shell-text)] sm:h-12 sm:w-12 sm:rounded-[1.35rem]"
                aria-label="Open navigation"
              >
                <span className="flex flex-col gap-1.5">
                  <span className="block h-0.5 w-5 rounded-full bg-current transition-transform duration-200 group-hover:translate-x-0.5" />
                  <span className="block h-0.5 w-5 rounded-full bg-current" />
                  <span className="block h-0.5 w-5 rounded-full bg-current transition-transform duration-200 group-hover:-translate-x-0.5" />
                </span>
              </button>

              <Link href="/" className="group flex min-w-0 items-center gap-3 sm:gap-4">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[1.2rem] border border-[#d6b37a]/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] shadow-[0_16px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/5 sm:h-24 sm:w-24 sm:rounded-[1.8rem]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(214,179,122,0.18),transparent_55%)]" />
                  <Image
                    src="/4ELogo.png"
                    alt="4 Elements CRM"
                    fill
                    className="object-contain p-2 transition duration-300 group-hover:scale-[1.03]"
                    sizes="(max-width: 639px) 56px, 96px"
                  />
                </div>

                <div className="min-w-0 leading-none">
                  <div className="truncate text-[10px] font-semibold uppercase tracking-[0.28em] text-[#d6b37a] sm:text-[12px] sm:tracking-[0.42em]">
                    4 Elements
                  </div>
                  <div className="mt-1 truncate text-[1.4rem] font-bold tracking-[0.02em] text-[var(--shell-text)] sm:mt-2 sm:text-[2.35rem] sm:tracking-[0.03em]">
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

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {permissions.canCreateJob ? (
                <Link
                  href="/jobs/new"
                  className="hidden xl:inline-flex items-center gap-2 rounded-[1.35rem] border border-[#d6b37a]/20 bg-[#d6b37a] px-4 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85]"
                >
                  <PlusSquare className="h-4 w-4" />
                  Create Job
                </Link>
              ) : null}

              <BugReportButton />
              <ThemeToggle />
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
        className={`crm-shell-sidebar fixed inset-y-0 left-0 z-[60] w-[min(88vw,360px)] sm:w-[360px] transform backdrop-blur-2xl transition duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="crm-shell-divider relative border-b px-6 py-7">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="crm-glass crm-glass-hover absolute right-5 top-5 inline-flex h-11 w-11 items-center justify-center rounded-[1.2rem] text-[var(--shell-text-soft)] hover:text-[var(--shell-text)]"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="relative h-20 w-20 overflow-hidden rounded-[1.8rem] border border-[#d6b37a]/20 bg-[var(--shell-surface)] shadow-[0_10px_30px_rgba(0,0,0,0.35)] sm:h-24 sm:w-24">
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
              <div className="mt-2 text-2xl font-bold tracking-tight text-[var(--shell-text)]">
                Workspace Menu
              </div>
            </div>

            <Link
              href="/profile"
              onClick={() => setSidebarOpen(false)}
              className="crm-glass crm-glass-hover mt-6 flex items-center gap-4 rounded-[1.75rem] px-4 py-4"
            >
              <div className="crm-glass-alt flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.2rem] text-sm font-semibold text-[#d6b37a]">
                {getInitials(profile?.full_name)}
              </div>

              <div className="min-w-0 text-left">
                <div className="truncate text-base font-semibold text-[var(--shell-text)]">
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
            <div className="crm-shell-divider border-t px-4 py-4">
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
          className="crm-shell-overlay fixed inset-0 z-40 backdrop-blur-[2px]"
          aria-label="Close navigation overlay"
        />
      ) : null}

      <main className={`mx-auto max-w-[1500px] px-4 pt-6 sm:px-6 lg:px-8 ${mainBottomPaddingClass}`}>{children}</main>

      {!hideMobileBottomNav ? (
        <nav className="crm-shell-mobile-nav fixed inset-x-0 bottom-0 z-50 px-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] pt-2 backdrop-blur-2xl md:hidden">
          <div className="mx-auto grid max-w-[1500px] grid-cols-5 gap-1">
            {mobilePrimaryItems.map((item) => {
              const Icon = item.icon
              const active = isNavItemActive(pathname, item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex min-h-[58px] flex-col items-center justify-center rounded-[1rem] px-1 py-2 text-[10px] font-semibold transition ${
                    active
                      ? 'bg-[#d6b37a] text-black shadow-[0_12px_24px_rgba(214,179,122,0.2)]'
                      : 'text-[var(--shell-text-muted)] hover:bg-[var(--shell-surface-hover)] hover:text-[var(--shell-text)]'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? 'text-black' : 'text-[#d6b37a]'}`} />
                  <span className="mt-1 truncate">{getMobileNavLabel(item)}</span>
                </Link>
              )
            })}

            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex min-h-[58px] flex-col items-center justify-center rounded-[1rem] px-1 py-2 text-[10px] font-semibold text-[var(--shell-text-muted)] transition hover:bg-[var(--shell-surface-hover)] hover:text-[var(--shell-text)]"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4 text-[#d6b37a]" />
              <span className="mt-1">Menu</span>
            </button>
          </div>
        </nav>
      ) : null}
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
  items: AppNavItem[]
  pathname: string
  onNavigate: () => void
}) {
  if (items.length === 0) return null

  return (
    <section className="mb-6">
      <div className="crm-text-faint mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.24em]">
        {title}
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const active = isNavItemActive(pathname, item.href)

          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`group flex items-center justify-between rounded-[1.4rem] px-4 py-3 text-sm font-semibold transition ${
                active
                  ? 'bg-[linear-gradient(135deg,#d6b37a,#e2bf85)] text-black shadow-[0_12px_30px_rgba(214,179,122,0.25)]'
                  : 'crm-glass-alt crm-glass-hover text-[var(--shell-text-muted)] hover:text-[var(--shell-text)]'
              }`}
            >
              <span className="flex items-center gap-3">
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-[1rem] ${
                    active
                      ? 'bg-black/10 text-black'
                      : 'crm-glass-alt text-[#d6b37a]'
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
                    : 'crm-text-faint group-hover:translate-x-0.5 group-hover:text-[var(--shell-text-soft)]'
                }`}
              />
            </Link>
          )
        })}
      </div>
    </section>
  )
}
