'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Bell,
  CalendarRange,
  Clock3,
  Megaphone,
  PlayCircle,
  Quote,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import TasksPanel from '@/components/tasks/TasksPanel'
import { buildNavigationItems, type AppNavItem } from '@/lib/app-navigation'
import { authorizedFetch } from '@/lib/api-client'
import {
  getCurrentUserProfile,
  getPermissions,
  isManagerLike,
  type UserProfile,
} from '@/lib/auth-helpers'
import {
  getEmbeddableVideoUrl,
  type AnnouncementContentRow,
  type SpotlightContentRow,
} from '@/lib/home-content'
import {
  fetchNotifications,
  NOTIFICATIONS_REFRESH_EVENT,
  type NotificationItem,
} from '@/lib/notifications-client'
import { isIncludedInNightlyNumbers } from '@/lib/nightly-numbers'
import { supabase } from '@/lib/supabase'

type WeeklyNumbersSummary = {
  startDate: string
  endDate: string
  submittedDays: number
  totals: {
    knocks: number
    talks: number
    walks: number
    inspections: number
    contingencies: number
    contracts_with_deposit: number
    revenue_signed: number
  }
}

type HomeContentResponse = {
  announcements?: AnnouncementContentRow[]
  spotlight?: SpotlightContentRow | null
  error?: string
}

function getTodayLocalDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDaysToDateString(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, (month || 1) - 1, day || 1)
  date.setDate(date.getDate() + days)

  const nextYear = date.getFullYear()
  const nextMonth = `${date.getMonth() + 1}`.padStart(2, '0')
  const nextDay = `${date.getDate()}`.padStart(2, '0')
  return `${nextYear}-${nextMonth}-${nextDay}`
}

function getWeekStartLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, (month || 1) - 1, day || 1)
  const offset = date.getDay()
  date.setDate(date.getDate() - offset)

  const nextYear = date.getFullYear()
  const nextMonth = `${date.getMonth() + 1}`.padStart(2, '0')
  const nextDay = `${date.getDate()}`.padStart(2, '0')
  return `${nextYear}-${nextMonth}-${nextDay}`
}

function formatRoleLabel(role: string | null | undefined) {
  return role?.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase()) || 'Team Member'
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) {
    return ''
  }

  const parsed = new Date(`${value}T12:00:00`)
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return 'Just now'
  }

  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

async function loadWeeklyNumbers(profileId: string, todayLocalDate: string) {
  const startDate = getWeekStartLocalDate(todayLocalDate)
  const endDate = addDaysToDateString(startDate, 6)

  const { data, error } = await supabase
    .from('rep_daily_stats')
    .select(`
      report_date,
      knocks,
      talks,
      walks,
      inspections,
      contingencies,
      contracts_with_deposit,
      revenue_signed
    `)
    .eq('rep_id', profileId)
    .gte('report_date', startDate)
    .lte('report_date', endDate)

  if (error) {
    throw new Error(error.message)
  }

  const submittedDays = new Set<string>()

  const totals = (data ?? []).reduce(
    (accumulator, row) => {
      if (row.report_date) {
        submittedDays.add(row.report_date)
      }

      accumulator.knocks += Number(row.knocks ?? 0)
      accumulator.talks += Number(row.talks ?? 0)
      accumulator.walks += Number(row.walks ?? 0)
      accumulator.inspections += Number(row.inspections ?? 0)
      accumulator.contingencies += Number(row.contingencies ?? 0)
      accumulator.contracts_with_deposit += Number(row.contracts_with_deposit ?? 0)
      accumulator.revenue_signed += Number(row.revenue_signed ?? 0)
      return accumulator
    },
    {
      knocks: 0,
      talks: 0,
      walks: 0,
      inspections: 0,
      contingencies: 0,
      contracts_with_deposit: 0,
      revenue_signed: 0,
    }
  )

  return {
    startDate,
    endDate,
    submittedDays: submittedDays.size,
    totals,
  } satisfies WeeklyNumbersSummary
}

function HomePageContent() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [homeError, setHomeError] = useState('')
  const [announcements, setAnnouncements] = useState<AnnouncementContentRow[]>([])
  const [spotlight, setSpotlight] = useState<SpotlightContentRow | null>(null)
  const [unreadNotifications, setUnreadNotifications] = useState<NotificationItem[]>([])
  const [weeklyNumbers, setWeeklyNumbers] = useState<WeeklyNumbersSummary | null>(null)

  const permissions = useMemo(
    () => getPermissions(profile?.role),
    [profile?.role]
  )
  const navigationItems = useMemo(
    () => buildNavigationItems(permissions).filter((item) => item.show),
    [permissions]
  )

  const quickLinks = useMemo(
    () => navigationItems.filter((item) => item.href !== '/'),
    [navigationItems]
  )

  const quickLinkGroups = useMemo(
    () => ({
      main: quickLinks.filter((item) => item.group === 'main'),
      workspace: quickLinks.filter((item) => item.group === 'workspace'),
      admin: quickLinks.filter((item) => item.group === 'admin'),
      account: quickLinks.filter((item) => item.group === 'account'),
    }),
    [quickLinks]
  )

  const nextAction = useMemo(() => {
    if (permissions.canViewManagerEntry && isManagerLike(profile?.role)) {
      return {
        href: '/stats/manager',
        label: 'Review branch nightly numbers',
      }
    }

    return {
      href: '/stats/submit',
      label: 'Submit today’s nightly numbers',
    }
  }, [permissions.canViewManagerEntry, profile?.role])

  useEffect(() => {
    let isActive = true

    async function loadHome() {
      setLoading(true)
      setHomeError('')

      try {
        const currentProfile = await getCurrentUserProfile()

        if (!isActive) {
          return
        }

        setProfile(currentProfile)

        if (!currentProfile?.id) {
          setLoading(false)
          return
        }

        const todayLocalDate = getTodayLocalDate()

        const [contentResult, notificationsResult, weeklyNumbersResult] =
          await Promise.all([
            authorizedFetch(
              `/api/home-content?today=${encodeURIComponent(todayLocalDate)}`,
              {
                cache: 'no-store',
              }
            )
              .then(async (response) => {
                const payload = (await response.json().catch(() => null)) as
                  | HomeContentResponse
                  | null

                if (!response.ok) {
                  throw new Error(payload?.error || 'Failed to load home content.')
                }

                return payload
              }),
            fetchNotifications(),
            isIncludedInNightlyNumbers(currentProfile)
              ? loadWeeklyNumbers(currentProfile.id, todayLocalDate)
              : Promise.resolve(null),
          ])

        if (!isActive) {
          return
        }

        setAnnouncements(contentResult?.announcements ?? [])
        setSpotlight(contentResult?.spotlight ?? null)
        setUnreadNotifications(
          notificationsResult.filter((notification) => !notification.is_read).slice(0, 5)
        )
        setWeeklyNumbers(weeklyNumbersResult)
        setLoading(false)
      } catch (error) {
        if (!isActive) {
          return
        }

        setHomeError(
          error instanceof Error ? error.message : 'Could not load the home page.'
        )
        setLoading(false)
      }
    }

    function handleNotificationRefresh() {
      void fetchNotifications()
        .then((notificationsResult) => {
          if (!isActive) {
            return
          }

          setUnreadNotifications(
            notificationsResult
              .filter((notification) => !notification.is_read)
              .slice(0, 5)
          )
        })
        .catch(() => {
          if (!isActive) {
            return
          }

          setUnreadNotifications([])
        })
    }

    void loadHome()
    window.addEventListener(
      NOTIFICATIONS_REFRESH_EVENT,
      handleNotificationRefresh as EventListener
    )

    return () => {
      isActive = false
      window.removeEventListener(
        NOTIFICATIONS_REFRESH_EVENT,
        handleNotificationRefresh as EventListener
      )
    }
  }, [])

  return (
    <main className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.4rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03))] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.24),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.06),transparent_22%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,179,122,0.7),transparent)]" />

        <div className="relative grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b37a]">
              CRM Home
            </div>

            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl">
                Work the day from one clean starting point.
              </h1>

              <p className="max-w-2xl text-base leading-7 text-white/68 md:text-lg">
                Open the right page fast, keep your numbers current, catch unread notifications,
                and push team updates without bouncing across the CRM.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <HomeHeroAction href="/jobs" label="Open Jobs" primary />
              <HomeHeroAction href={nextAction.href} label={nextAction.label} />
              <HomeHeroAction href="/notifications" label="Unread Alerts" />
            </div>
          </div>

          <section className="rounded-[2rem] border border-white/10 bg-black/20 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#d6b37a]">
              Today&apos;s Snapshot
            </div>

            <div className="mt-4 space-y-4">
              <SummaryRow label="Signed In As" value={profile?.full_name || 'Loading profile...'} />
              <SummaryRow label="Role" value={formatRoleLabel(profile?.role)} />
              <SummaryRow label="Unread Notifications" value={String(unreadNotifications.length)} href="/notifications" />
              <SummaryRow
                label="Weekly Numbers"
                value={
                  isIncludedInNightlyNumbers(profile)
                    ? `${weeklyNumbers?.submittedDays ?? 0} day(s) logged`
                    : 'Not enabled on nightly roster'
                }
              />
            </div>
          </section>
        </div>
      </section>

      {homeError ? (
        <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {homeError}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <section className="rounded-[2rem] border border-white/10 bg-[#0b0f16]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
            <SectionHeader
              eyebrow="Updates"
              title="Announcements & spotlight"
              description="Manager-posted updates land here first, with room for a quote or daily video when you want to push a message harder."
            />

            {loading ? (
              <div className="mt-6 text-sm text-white/55">Loading updates…</div>
            ) : announcements.length === 0 && !spotlight ? (
              <div className="mt-6 rounded-[1.6rem] border border-dashed border-white/12 bg-white/[0.03] px-4 py-5 text-sm text-white/50">
                No announcements or spotlight content are active right now.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {announcements.map((announcement) => (
                  <article
                    key={announcement.id}
                    className="rounded-[1.7rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-5"
                  >
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]">
                      <Megaphone className="h-3.5 w-3.5" />
                      <span>{formatDateTime(announcement.created_at)}</span>
                    </div>
                    <h3 className="mt-3 text-xl font-semibold text-white">
                      {announcement.title}
                    </h3>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/70">
                      {announcement.body}
                    </p>
                  </article>
                ))}

                {spotlight ? <SpotlightCard spotlight={spotlight} /> : null}
              </div>
            )}
          </section>

          <TasksPanel
            title="My Tasks"
            description="Upcoming tasks and appointments assigned to you or created by you, with quick access right from the home screen."
            contextLabel={profile?.full_name || 'you'}
            maxVisible={3}
            compact
          />
        </div>

        <div className="space-y-6">
          {isIncludedInNightlyNumbers(profile) ? (
            <section className="rounded-[2rem] border border-white/10 bg-[#0b0f16]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
              <SectionHeader
                eyebrow="Weekly Numbers"
                title="This week’s totals"
                description={
                  weeklyNumbers
                    ? `${formatDateLabel(weeklyNumbers.startDate)} - ${formatDateLabel(weeklyNumbers.endDate)}`
                    : 'Current week'
                }
              />

              {loading ? (
                <div className="mt-6 text-sm text-white/55">Loading weekly numbers…</div>
              ) : (
                <div className="mt-6 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MetricCard label="Knocks" value={String(weeklyNumbers?.totals.knocks ?? 0)} />
                    <MetricCard label="Talks" value={String(weeklyNumbers?.totals.talks ?? 0)} />
                    <MetricCard label="Walks" value={String(weeklyNumbers?.totals.walks ?? 0)} />
                    <MetricCard label="Inspections" value={String(weeklyNumbers?.totals.inspections ?? 0)} />
                    <MetricCard
                      label="Contingencies"
                      value={String(weeklyNumbers?.totals.contingencies ?? 0)}
                    />
                    <MetricCard
                      label="Contracts w/ Deposit"
                      value={String(weeklyNumbers?.totals.contracts_with_deposit ?? 0)}
                    />
                  </div>

                  <div className="rounded-[1.6rem] border border-[#d6b37a]/20 bg-[#d6b37a]/8 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d6b37a]">
                      Revenue Signed
                    </div>
                    <div className="mt-2 text-3xl font-semibold text-white">
                      {formatCurrency(weeklyNumbers?.totals.revenue_signed ?? 0)}
                    </div>
                    <div className="mt-2 text-sm text-white/60">
                      {weeklyNumbers?.submittedDays ?? 0} day(s) logged this week
                    </div>
                  </div>
                </div>
              )}
            </section>
          ) : null}

          <section className="rounded-[2rem] border border-white/10 bg-[#0b0f16]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
            <SectionHeader
              eyebrow="Notifications"
              title="Unread right now"
              description="The newest unread alerts waiting on you."
            />

            {loading ? (
              <div className="mt-6 text-sm text-white/55">Loading notifications…</div>
            ) : unreadNotifications.length === 0 ? (
              <div className="mt-6 rounded-[1.6rem] border border-dashed border-white/12 bg-white/[0.03] px-4 py-5 text-sm text-white/50">
                You&apos;re caught up. No unread notifications right now.
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {unreadNotifications.map((notification) => (
                  <Link
                    key={notification.id}
                    href={`/notifications/${notification.id}`}
                    className="block rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-[#d6b37a]/30 hover:bg-white/[0.06]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]">
                          <Bell className="h-3.5 w-3.5" />
                          <span>{notification.title}</span>
                        </div>
                        <p className="text-sm leading-6 text-white/72">
                          {notification.message}
                        </p>
                      </div>
                      <div className="shrink-0 text-xs text-white/40">
                        {formatDateTime(notification.created_at)}
                      </div>
                    </div>
                  </Link>
                ))}

                <Link
                  href="/notifications"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#d6b37a] transition hover:text-[#e2bf85]"
                >
                  Open full notifications
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </section>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[#0b0f16]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
        <SectionHeader
          eyebrow="Quick Menu"
          title="Everything you can access"
          description="Every page currently available to your role, grouped the same way the CRM navigation sees it."
        />

        {loading ? (
          <div className="mt-6 text-sm text-white/55">Loading quick links…</div>
        ) : (
          <div className="mt-6 space-y-6">
            <QuickLinkGroup title="Main" items={quickLinkGroups.main} />
            <QuickLinkGroup title="Workspace" items={quickLinkGroups.workspace} />
            {quickLinkGroups.admin.length > 0 ? (
              <QuickLinkGroup title="Manager" items={quickLinkGroups.admin} />
            ) : null}
            <QuickLinkGroup title="Account" items={quickLinkGroups.account} />
          </div>
        )}
      </section>

    </main>
  )
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d6b37a]">
        {eyebrow}
      </div>
      <h2 className="text-2xl font-semibold text-white">{title}</h2>
      <p className="max-w-3xl text-sm leading-7 text-white/60">{description}</p>
    </div>
  )
}

function HomeHeroAction({
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
          : 'border border-white/10 bg-white/[0.05] text-white hover:border-[#d6b37a]/30 hover:bg-white/[0.08]'
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
  const content = (
    <>
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-white">{value}</div>
    </>
  )

  if (!href) {
    return <div>{content}</div>
  }

  return (
    <Link
      href={href}
      className="block rounded-2xl border border-transparent p-2 -m-2 transition hover:border-white/10 hover:bg-white/[0.04]"
    >
      {content}
    </Link>
  )
}

function QuickLinkGroup({
  title,
  items,
}: {
  title: string
  items: AppNavItem[]
}) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/38">
        {title}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center justify-between gap-3 rounded-[1.2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-4 py-3 transition duration-200 hover:-translate-y-0.5 hover:border-[#d6b37a]/30 hover:bg-white/[0.06]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-[#d6b37a]">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="truncate text-sm font-semibold text-white">
                  {item.label}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-white/28 transition group-hover:translate-x-0.5 group-hover:text-[#d6b37a]" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  )
}

function SpotlightCard({
  spotlight,
}: {
  spotlight: SpotlightContentRow
}) {
  const embedUrl = spotlight.content_type === 'video'
    ? getEmbeddableVideoUrl(spotlight.media_url)
    : null

  return (
    <div className="rounded-[1.9rem] border border-[#d6b37a]/20 bg-[linear-gradient(160deg,rgba(214,179,122,0.1),rgba(255,255,255,0.03))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.25)]">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]">
        {spotlight.content_type === 'video' ? (
          <PlayCircle className="h-4 w-4" />
        ) : (
          <Quote className="h-4 w-4" />
        )}
        <span>Featured Spotlight</span>
        {spotlight.display_date ? (
          <span className="inline-flex items-center gap-1 text-white/55">
            <CalendarRange className="h-3.5 w-3.5" />
            {formatDateLabel(spotlight.display_date)}
          </span>
        ) : null}
      </div>

      <h3 className="mt-4 text-2xl font-semibold text-white">
        {spotlight.title}
      </h3>

      {spotlight.content_type === 'quote' ? (
        <div className="mt-5 space-y-4">
          <blockquote className="rounded-[1.6rem] border border-white/10 bg-black/20 p-5 text-lg leading-8 text-white/78">
            “{spotlight.body}”
          </blockquote>
          {spotlight.quote_author ? (
            <div className="text-sm font-semibold uppercase tracking-[0.16em] text-white/48">
              {spotlight.quote_author}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {embedUrl ? (
            <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-black/30">
              <iframe
                src={embedUrl}
                title={spotlight.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                loading="lazy"
                className="aspect-video w-full"
              />
            </div>
          ) : spotlight.media_url ? (
            <a
              href={spotlight.media_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
            >
              Open video
              <ArrowRight className="h-4 w-4" />
            </a>
          ) : null}

          <p className="text-sm leading-7 text-white/68">{spotlight.body}</p>
        </div>
      )}

      <div className="mt-5 inline-flex items-center gap-2 text-xs text-white/40">
        <Clock3 className="h-3.5 w-3.5" />
        Posted {formatDateTime(spotlight.created_at)}
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <ProtectedRoute>
      <HomePageContent />
    </ProtectedRoute>
  )
}
