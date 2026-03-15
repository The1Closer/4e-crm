'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'

export default function NotificationBell() {
  const [count, setCount] = useState(0)

  async function loadUnreadCount() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      setCount(0)
      return
    }

    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('is_read', false)

    setCount(count ?? 0)
  }

  useEffect(() => {
    loadUnreadCount()

    let channel: any

    async function subscribe() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) return

      channel = supabase
        .channel(`notifications-bell-${session.user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${session.user.id}`,
          },
          () => {
            loadUnreadCount()
          }
        )
        .subscribe()
    }

    subscribe()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadUnreadCount()
    })

    return () => {
      subscription.unsubscribe()
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [])

  return (
    <Link
      href="/notifications"
      className="relative rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
    >
      Notifications
      {count > 0 ? (
        <span className="ml-2 inline-flex min-w-[22px] items-center justify-center rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
          {count}
        </span>
      ) : null}
    </Link>
  )
}