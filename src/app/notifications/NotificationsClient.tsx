'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import Link from 'next/link'
import { BellRing, CheckCheck, Home, MailOpen, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import TasksPanel from '@/components/tasks/TasksPanel'
import {
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  NOTIFICATIONS_REFRESH_EVENT,
  type NotificationItem,
} from '@/lib/notifications-client'
import { supabase } from '@/lib/supabase'
import { useSupabaseAuthUserId } from '@/lib/use-supabase-auth-user-id'

export default function NotificationsClient() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingIds, setUpdatingIds] = useState<string[]>([])
  const [deletingIds, setDeletingIds] = useState<string[]>([])
  const userId = useSupabaseAuthUserId()

  const loadNotifications = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setLoading(true)
      }

      try {
        const rows = await fetchNotifications()
        setNotifications(rows)
      } catch {
        if (!options?.silent) {
          setNotifications([])
        }
      } finally {
        if (!options?.silent) {
          setLoading(false)
        }
      }
    },
    []
  )

  useEffect(() => {
    if (!userId) {
      setNotifications([])
      setLoading(false)
      return
    }

    const loadTimer = window.setTimeout(() => {
      void loadNotifications()
    }, 0)

    let channel: RealtimeChannel | null = null

    channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void loadNotifications({ silent: true })
        }
      )
      .subscribe()

    function handleRefresh() {
      void loadNotifications({ silent: true })
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void loadNotifications({ silent: true })
      }
    }

    const pollInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadNotifications({ silent: true })
      }
    }, 30000)

    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, handleRefresh)
    window.addEventListener('focus', handleRefresh)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearTimeout(loadTimer)
      window.clearInterval(pollInterval)
      window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, handleRefresh)
      window.removeEventListener('focus', handleRefresh)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [loadNotifications, userId])

  async function openNotification(notification: NotificationItem) {
    try {
      if (!notification.is_read) {
        const updated = await markNotificationRead(notification.id)
        setNotifications((current) =>
          current.map((item) => (item.id === notification.id ? updated ?? item : item))
        )
      }
    } catch {
      void loadNotifications({ silent: true })
    }

    router.push(notification.link || (notification.job_id ? `/jobs/${notification.job_id}` : '/notifications'))
  }

  async function toggleReadState(notification: NotificationItem) {
    setUpdatingIds((current) => [...current, notification.id])

    try {
      const updated = notification.is_read
        ? await markNotificationUnread(notification.id)
        : await markNotificationRead(notification.id)

      setNotifications((current) =>
        current.map((item) => (item.id === notification.id ? updated ?? item : item))
      )
    } catch {
      void loadNotifications({ silent: true })
    } finally {
      setUpdatingIds((current) => current.filter((id) => id !== notification.id))
    }
  }

  async function markAllRead() {
    try {
      await markAllNotificationsRead()
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          is_read: true,
        }))
      )
    } catch {
      void loadNotifications({ silent: true })
    }
  }

  async function handleDeleteNotification(notification: NotificationItem) {
    const confirmed = window.confirm(`Delete notification "${notification.title}"?`)

    if (!confirmed) {
      return
    }

    setDeletingIds((current) => [...current, notification.id])

    try {
      await deleteNotification(notification.id)
      setNotifications((current) =>
        current.filter((item) => item.id !== notification.id)
      )
    } catch {
      void loadNotifications({ silent: true })
    } finally {
      setDeletingIds((current) => current.filter((id) => id !== notification.id))
    }
  }

  const unread = useMemo(
    () => notifications.filter((notification) => !notification.is_read),
    [notifications]
  )
  const read = useMemo(
    () => notifications.filter((notification) => notification.is_read),
    [notifications]
  )

  return (
    <main className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.22),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_26%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,179,122,0.7),transparent)]" />

        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b37a]">
              Notifications
            </div>

            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
              Alerts and Activity
            </h1>

            <p className="mt-3 max-w-3xl text-base leading-7 text-white/68 md:text-lg">
              Mentions, assignments, and internal updates for you in one cleaner queue.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.1]"
            >
              <Home className="h-4 w-4" />
              Home
            </Link>

            <button
              type="button"
              onClick={markAllRead}
              disabled={unread.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <CheckCheck className="h-4 w-4" />
              Mark All Read
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <NotificationPermissionCard />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <NotificationMetric label="Unread" value={String(unread.length)} />
        <NotificationMetric label="Read" value={String(read.length)} />
        <NotificationMetric label="Total" value={String(notifications.length)} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <TasksPanel
          title="Open Tasks And Appointments"
          description="Everything still in play for you, including general work and job-linked appointments that have not been completed yet."
          contextLabel="your notification desk"
          density="micro"
        />

        <div className="space-y-6">
          {loading ? (
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-white/60 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
              Loading notifications...
            </section>
          ) : notifications.length === 0 ? (
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-white/60 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
              No notifications yet.
            </section>
          ) : (
            <div className="space-y-6">
              <NotificationColumn
                title="Unread"
                icon={BellRing}
                emptyText="No unread notifications."
                tone="unread"
                rows={unread}
                updatingIds={updatingIds}
                deletingIds={deletingIds}
                onOpen={openNotification}
                onToggleReadState={toggleReadState}
                onDelete={handleDeleteNotification}
              />

              <NotificationColumn
                title="Read"
                icon={MailOpen}
                emptyText="No read notifications yet."
                tone="read"
                rows={read}
                updatingIds={updatingIds}
                deletingIds={deletingIds}
                onOpen={openNotification}
                onToggleReadState={toggleReadState}
                onDelete={handleDeleteNotification}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

function NotificationPermissionCard() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    'unsupported'
  )
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    if (typeof Notification === 'undefined') {
      setPermission('unsupported')
      return
    }

    setPermission(Notification.permission)
  }, [])

  async function enableNotifications() {
    if (typeof Notification === 'undefined') {
      setPermission('unsupported')
      return
    }

    setRequesting(true)

    try {
      const nextPermission = await Notification.requestPermission()
      setPermission(nextPermission)
    } finally {
      setRequesting(false)
    }
  }

  const description =
    permission === 'granted'
      ? 'Browser alerts are enabled for new CRM notifications.'
      : permission === 'denied'
        ? 'Browser alerts are blocked in this browser. Re-enable them from site permissions if needed.'
        : permission === 'default'
          ? 'Enable browser alerts so notifications can break through even when this tab is not frontmost.'
          : 'This browser does not support the Notification API.'

  return (
    <section className="md:col-span-3 rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">
            Browser Alerts
          </div>
          <div className="mt-2 text-sm font-medium text-white">{description}</div>
        </div>

        {permission === 'default' ? (
          <button
            type="button"
            onClick={() => {
              void enableNotifications()
            }}
            disabled={requesting}
            className="rounded-2xl bg-[#d6b37a] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#e2bf85] disabled:opacity-60"
          >
            {requesting ? 'Enabling...' : 'Enable Alerts'}
          </button>
        ) : (
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
            {permission === 'granted'
              ? 'Enabled'
              : permission === 'denied'
                ? 'Blocked'
                : 'Unsupported'}
          </div>
        )}
      </div>
    </section>
  )
}

function NotificationMetric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-white">{value}</div>
    </div>
  )
}

function NotificationColumn({
  title,
  icon: Icon,
  emptyText,
  tone,
  rows,
  updatingIds,
  deletingIds,
  onOpen,
  onToggleReadState,
  onDelete,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  emptyText: string
  tone: 'unread' | 'read'
  rows: NotificationItem[]
  updatingIds: string[]
  deletingIds: string[]
  onOpen: (notification: NotificationItem) => void
  onToggleReadState: (notification: NotificationItem) => void
  onDelete: (notification: NotificationItem) => void
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-[1.1rem] border border-white/10 bg-black/20">
          <Icon className="h-4 w-4 text-[#d6b37a]" />
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
            {title}
          </div>
          <div className="mt-1 text-lg font-semibold text-white">{rows.length} item(s)</div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-[1.4rem] border border-dashed border-white/14 p-4 text-sm text-white/55">
            {emptyText}
          </div>
        ) : (
          rows.map((notification) => {
            const isUpdating = updatingIds.includes(notification.id)
            const isDeleting = deletingIds.includes(notification.id)

            return (
              <article
                key={notification.id}
                className={`rounded-[1.4rem] border p-4 shadow-[0_12px_35px_rgba(0,0,0,0.2)] ${
                  tone === 'unread'
                    ? 'border-[#d6b37a]/20 bg-[#d6b37a]/10'
                    : 'border-white/10 bg-black/20'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-white">
                      {notification.title}
                    </div>
                    <div className="text-sm leading-6 text-white/72">
                      {notification.message}
                    </div>
                    <div className="text-xs text-white/42">
                      {new Date(notification.created_at).toLocaleString('en-US')}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleReadState(notification)}
                      disabled={isUpdating || isDeleting}
                      className="rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.1] disabled:opacity-50"
                    >
                      {notification.is_read ? 'Mark Unread' : 'Mark Read'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpen(notification)}
                      disabled={isDeleting}
                      className="rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.1] disabled:opacity-50"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(notification)}
                      disabled={isDeleting || isUpdating}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/18 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}
