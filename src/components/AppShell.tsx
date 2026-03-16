'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import AuthStatus from '@/components/AuthStatus'
import NotificationBell from '@/components/NotificationBell'
import {
  getCurrentUserProfile,
  getPermissions,
  type UserProfile,
} from '@/lib/auth-helpers'

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

  const navItems = [
    { href: '/', label: 'Home', show: permissions.canViewHome },
    { href: '/dashboard', label: 'Dashboard', show: permissions.canViewDashboard },
    { href: '/jobs', label: 'Jobs', show: permissions.canViewJobs },
    { href: '/jobs/new', label: 'New Job', show: permissions.canCreateJob },
    { href: '/calendar/installs', label: 'Calendar', show: permissions.canViewInstallCalendar },
    { href: '/commissions', label: 'Commissions', show: permissions.canViewCommissions },
    { href: '/templates', label: 'Templates', show: permissions.canViewTemplates },
    { href: '/contracts/editor', label: 'Signer', show: permissions.canUseSigner },
    { href: '/notifications', label: 'Notifications', show: permissions.canViewNotifications },
    { href: '/team/users', label: 'Users', show: permissions.canManageUsers },
    { href: '/stats/manager', label: 'Manager', show: permissions.canViewManagerEntry },
  ]

  const visibleNavItems = useMemo(
    () => navItems.filter((item) => item.show),
    [loadingRole, profile?.role]
  )

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="fixed inset-0 -z-20 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_28%),radial-gradient(circle_at_top_right,rgba(245,208,138,0.10),transparent_22%),linear-gradient(180deg,#111111_0%,#0a0a0a_45%,#050505_100%)]" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(135deg,rgba(255,255,255,0.02),transparent_35%,rgba(255,255,255,0.015)_65%,transparent)]" />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/45 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/80 transition hover:bg-white/[0.08] hover:text-white"
              aria-label="Open navigation"
            >
              <span className="flex flex-col gap-1.5">
                <span className="block h-0.5 w-5 rounded-full bg-current" />
                <span className="block h-0.5 w-5 rounded-full bg-current" />
                <span className="block h-0.5 w-5 rounded-full bg-current" />
              </span>
            </button>

            <Link href="/" className="flex items-center gap-4">
              <div className="relative h-14 w-14 overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/[0.04] shadow-[0_12px_35px_rgba(0,0,0,0.45)]">
                <Image
                  src="/4ELogo.jpeg"
                  alt="4 Elements CRM"
                  fill
                  className="object-contain p-1.5"
                  sizes="56px"
                />
              </div>

              <div className="leading-none">
                <div className="text-[11px] font-semibold uppercase tracking-[0.38em] text-[#d6b37a]">
                  4 Elements
                </div>
                <div className="mt-1 text-2xl font-bold tracking-[0.02em] text-white">
                  CRM
                </div>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
              <NotificationBell />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
              <AuthStatus />
            </div>
          </div>
        </div>
      </header>

      <aside
        className={`fixed inset-y-0 left-0 z-[60] w-[310px] transform border-r border-white/10 bg-[#0f0f0f]/95 backdrop-blur-2xl shadow-[0_30px_80px_rgba(0,0,0,0.55)] transition duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b37a]">
                Navigation
              </div>
              <div className="mt-1 text-lg font-bold text-white">Workspace</div>
            </div>

            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] hover:text-white"
              aria-label="Close navigation"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-2">
              {visibleNavItems.map((item) => {
                const active = pathname === item.href

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition ${active
                      ? 'bg-[#d6b37a] text-black shadow-[0_12px_30px_rgba(214,179,122,0.25)]'
                      : 'border border-white/8 bg-white/[0.03] text-white/75 hover:border-white/15 hover:bg-white/[0.07] hover:text-white'
                      }`}
                  >
                    <span>{item.label}</span>
                    <span className={active ? 'text-black/70' : 'text-white/25'}>→</span>
                  </Link>
                )
              })}
            </div>
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