'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bell,
  Briefcase,
  CalendarDays,
  ChevronRight,
  FileText,
  Home,
  LayoutDashboard,
  MapPin,
  Menu,
  PenSquare,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'

import AuthStatus from '@/components/AuthStatus'
import { supabase } from '@/lib/supabase'
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

type SearchJobRow = {
  id: string
  insurance_carrier: string | null
  homeowners:
  | {
    name: string | null
    address: string | null
  }
  | {
    name: string | null
    address: string | null
  }[]
  | null
}

type SearchResult = {
  id: string
  title: string
  subtitle: string
  href: string
}

export default function AppShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loadingRole, setLoadingRole] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [searchValue, setSearchValue] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const searchWrapRef = useRef<HTMLDivElement | null>(null)

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
    setSearchOpen(false)
  }, [pathname])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!searchWrapRef.current) return
      if (!searchWrapRef.current.contains(event.target as Node)) {
        setSearchOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const q = searchValue.trim()

    if (!q) {
      setSearchResults([])
      setSearchLoading(false)
      return
    }

    const timeout = setTimeout(async () => {
      setSearchLoading(true)

      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id,
          insurance_carrier,
          homeowners (
            name,
            address
          )
        `)
        .or(
          `insurance_carrier.ilike.%${q}%,homeowners.name.ilike.%${q}%,homeowners.address.ilike.%${q}%`
        )
        .limit(8)

      if (error) {
        console.error(error)
        setSearchResults([])
        setSearchLoading(false)
        return
      }

      const mapped = ((data ?? []) as SearchJobRow[]).map((row) => {
        const homeowner = Array.isArray(row.homeowners)
          ? row.homeowners[0] ?? null
          : row.homeowners

        return {
          id: row.id,
          title: homeowner?.name || 'Unnamed Homeowner',
          subtitle:
            homeowner?.address ||
            row.insurance_carrier ||
            'Job result',
          href: `/jobs/${row.id}`,
        }
      })

      setSearchResults(mapped)
      setSearchLoading(false)
      setSearchOpen(true)
    }, 180)

    return () => clearTimeout(timeout)
  }, [searchValue])

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
      icon: Plus,
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

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = searchValue.trim()
    if (!q) return
    router.push(`/jobs?search=${encodeURIComponent(q)}`)
    setSearchOpen(false)
  }

  function openResult(href: string) {
    setSearchOpen(false)
    setSearchValue('')
    router.push(href)
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="fixed inset-0 -z-20 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.07),transparent_24%),radial-gradient(circle_at_top_right,rgba(214,179,122,0.14),transparent_18%),linear-gradient(180deg,#151515_0%,#0b0b0b_46%,#030303_100%)]" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(135deg,rgba(255,255,255,0.02),transparent_35%,rgba(255,255,255,0.01)_62%,transparent)]" />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/45 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-3 md:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="group inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.35rem] border border-white/10 bg-white/[0.04] text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition duration-200 hover:border-[#d6b37a]/30 hover:bg-white/[0.08] hover:text-white"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5 transition duration-200 group-hover:scale-105" />
          </button>

          <Link href="/" className="group flex shrink-0 items-center gap-4">
            <div className="relative h-[4.8rem] w-[4.8rem] overflow-hidden rounded-[1.55rem] border border-[#d6b37a]/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] shadow-[0_18px_44px_rgba(0,0,0,0.42)] ring-1 ring-white/5">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(214,179,122,0.22),transparent_58%)]" />
              <Image
                src="/4ELogo.jpeg"
                alt="4 Elements Renovations CRM"
                fill
                className="object-contain p-1.5 transition duration-300 group-hover:scale-[1.04]"
                sizes="77px"
              />
            </div>

            <div className="leading-none">
              <div className="text-[10px] font-semibold uppercase tracking-[0.44em] text-[#d6b37a]">
                Exterior Restoration Platform
              </div>
              <div className="mt-1.5 text-[1.95rem] font-bold tracking-[0.01em] text-white xl:text-[2.15rem]">
                4 Elements Renovations
              </div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.34em] text-white/38">
                CRM
              </div>
            </div>
          </Link>

          <div ref={searchWrapRef} className="min-w-0 flex-1">
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <label className="group flex h-14 w-full items-center gap-3 rounded-[1.35rem] border border-white/10 bg-white/[0.045] px-4 shadow-[0_10px_30px_rgba(0,0,0,0.22)] transition duration-200 focus-within:border-[#d6b37a]/35 focus-within:bg-white/[0.07] hover:border-white/15">
                <Search className="h-4.5 w-4.5 shrink-0 text-white/35 transition group-focus-within:text-[#d6b37a]" />
                <input
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onFocus={() => {
                    if (searchResults.length > 0 || searchValue.trim()) {
                      setSearchOpen(true)
                    }
                  }}
                  placeholder="Search homeowner, address, carrier..."
                  className="w-full bg-transparent text-sm font-medium text-white placeholder:text-white/30 focus:outline-none"
                />
                {searchValue ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchValue('')
                      setSearchResults([])
                      setSearchOpen(false)
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-white/35 transition hover:bg-white/[0.06] hover:text-white/70"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </label>

              {searchOpen ? (
                <div className="absolute left-0 right-0 top-[calc(100%+0.6rem)] z-[70] overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#111111]/95 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
                  <div className="border-b border-white/10 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
                      Quick Search
                    </div>
                  </div>

                  {searchLoading ? (
                    <div className="px-4 py-4 text-sm text-white/55">
                      Searching...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="px-4 py-4 text-sm text-white/55">
                      No matching jobs found.
                    </div>
                  ) : (
                    <div className="max-h-[22rem] overflow-y-auto p-2">
                      {searchResults.map((result) => (
                        <button
                          key={result.id}
                          type="button"
                          onClick={() => openResult(result.href)}
                          className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition hover:bg-white/[0.06]"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white">
                              {result.title}
                            </div>
                            <div className="mt-1 truncate text-xs text-white/48">
                              {result.subtitle}
                            </div>
                          </div>

                          <div className="ml-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                            <MapPin className="h-4 w-4 text-[#d6b37a]" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="border-t border-white/10 px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-white/35">
                    Press enter to search all jobs
                  </div>
                </div>
              ) : null}
            </form>
          </div>

          <Link
            href="/jobs/new"
            className="hidden shrink-0 items-center gap-2 rounded-[1.35rem] bg-[#d6b37a] px-5 py-4 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.24)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#e2bf85] lg:inline-flex"
          >
            <Plus className="h-4 w-4" />
            New Job
          </Link>

          <div className="hidden shrink-0 rounded-[1.35rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-right shadow-[0_10px_30px_rgba(0,0,0,0.25)] xl:block">
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
        </div>

        <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 pb-3 md:hidden md:px-6">
          <Link
            href="/jobs/new"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#d6b37a] px-4 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.24)] transition hover:bg-[#e2bf85]"
          >
            <Plus className="h-4 w-4" />
            New Job
          </Link>
        </div>
      </header>

      <aside
        className={`fixed inset-y-0 left-0 z-[60] w-[330px] transform border-r border-white/10 bg-[#0d0d0d]/95 backdrop-blur-2xl shadow-[0_30px_80px_rgba(0,0,0,0.55)] transition duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
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

          <div className="border-t border-white/10 px-4 py-4">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
              <div className="mb-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/38">
                  Account
                </div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {profile?.full_name || 'Loading...'}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#d6b37a]">
                  {roleLabel}
                </div>
              </div>

              <AuthStatus />
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
              className={`group flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition ${active
                  ? 'bg-[linear-gradient(135deg,#d6b37a,#e2bf85)] text-black shadow-[0_12px_30px_rgba(214,179,122,0.25)]'
                  : 'border border-white/8 bg-white/[0.03] text-white/75 hover:border-white/15 hover:bg-white/[0.07] hover:text-white'
                }`}
            >
              <span className="flex items-center gap-3">
                <span
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${active
                      ? 'bg-black/10 text-black'
                      : 'border border-white/10 bg-white/[0.03] text-[#d6b37a]'
                    }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {item.label}
              </span>

              <ChevronRight
                className={`h-4 w-4 transition ${active
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