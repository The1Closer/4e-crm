
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

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
    loadNotifications()

    let channel: any

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
            loadNotifications()
          }
        )
        .subscribe()
    }

    subscribe()

    return () => {
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

    loadNotifications()
  }

  const unread = notifications.filter((n) => !n.is_read)
  const read = notifications.filter((n) => n.is_read)

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
            <p className="mt-2 text-sm text-gray-600">
              Mentions, assignments, and activity for you.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/"
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm transition hover:bg-gray-100"
            >
              Home
            </Link>

            <button
              type="button"
              onClick={markAllRead}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm transition hover:bg-gray-100"
            >
              Mark All Read
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border bg-white p-6 text-gray-600 shadow-sm">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-gray-600 shadow-sm">
            No notifications yet.
          </div>
        ) : (
          <>
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Unread</h2>

              {unread.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600">
                  No unread notifications.
                </div>
              ) : (
                unread.map((notification) => (
                  <div
                    key={notification.id}
                    className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-gray-900">
                          {notification.title}
                        </div>
                        <div className="text-sm text-gray-700">
                          {notification.message}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(notification.created_at).toLocaleString('en-US')}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openNotification(notification)}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 transition hover:bg-gray-100"
                      >
                        Open
                      </button>
                    </div>
                  </div>
                ))
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Read</h2>

              {read.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600">
                  No read notifications yet.
                </div>
              ) : (
                read.map((notification) => (
                  <div
                    key={notification.id}
                    className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-gray-900">
                          {notification.title}
                        </div>
                        <div className="text-sm text-gray-700">
                          {notification.message}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(notification.created_at).toLocaleString('en-US')}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openNotification(notification)}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 transition hover:bg-gray-100"
                      >
                        Open
                      </button>
                    </div>
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}