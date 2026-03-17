'use client'

import { useEffect, useMemo, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import Link from 'next/link'
import { BellRing, CheckCheck, Home, MailOpen } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type NotificationItem = {
  id: string
  user_id: string
  job_id: string | null
  note_id: string | null
  title: string
  message: string
  link: string | null
  type: string
  is_read: boolean
  created_at: string
}

export default function NotificationsClient() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  async function loadNotifications() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setNotifications([])
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!error) {
      setNotifications((data ?? []) as NotificationItem[])
    }

    setLoading(false)
  }

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadNotifications()
    }, 0)

    let channel: RealtimeChannel | null = null

    async function subscribe() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      channel = supabase
        .channel(`notifications-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            void loadNotifications()
          }
        )
        .subscribe()
    }

    void subscribe()

    return () => {
      window.clearTimeout(loadTimer)
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [])

  async function openNotification(notification: NotificationItem) {
    await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', notification.id)

    router.push(notification.link || '/notifications')
  }

  async function markAllRead() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('is_read', false)

    void loadNotifications()
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
              className="inline-flex items-center gap-2 rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85]"
            >
              <CheckCheck className="h-4 w-4" />
              Mark All Read
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <NotificationMetric label="Unread" value={String(unread.length)} />
        <NotificationMetric label="Read" value={String(read.length)} />
        <NotificationMetric label="Total" value={String(notifications.length)} />
      </section>

      {loading ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-white/60 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          Loading notifications...
        </section>
      ) : notifications.length === 0 ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-white/60 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          No notifications yet.
        </section>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <NotificationColumn
            title="Unread"
            icon={BellRing}
            emptyText="No unread notifications."
            tone="unread"
            rows={unread}
            onOpen={openNotification}
          />

          <NotificationColumn
            title="Read"
            icon={MailOpen}
            emptyText="No read notifications yet."
            tone="read"
            rows={read}
            onOpen={openNotification}
          />
        </div>
      )}
    </main>
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
  onOpen,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  emptyText: string
  tone: 'unread' | 'read'
  rows: NotificationItem[]
  onOpen: (notification: NotificationItem) => void
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
          rows.map((notification) => (
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

                <button
                  type="button"
                  onClick={() => onOpen(notification)}
                  className="rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.1]"
                >
                  Open
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
}
