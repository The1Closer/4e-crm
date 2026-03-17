'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export default function NotificationBell() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let isActive = true
    let channel: RealtimeChannel | null = null

    async function loadUnreadCount() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!isActive) return

      if (!session?.user) {
        setCount(0)
        return
      }

      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('is_read', false)

      if (!isActive) return

      setCount(count ?? 0)
    }

    async function subscribe() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user || !isActive) return

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
            void loadUnreadCount()
          }
        )
        .subscribe()
    }

    void loadUnreadCount()
    void subscribe()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadUnreadCount()
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [])

  return (
    <Link
      href="/notifications"
      className="relative inline-flex h-12 w-12 items-center justify-center rounded-[1.35rem] border border-white/10 bg-white/[0.04] text-white/82 shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition hover:border-white/15 hover:bg-white/[0.06] hover:text-white"
      aria-label={count > 0 ? `${count} unread notifications` : 'Notifications'}
      title="Notifications"
    >
      <Bell className="h-4 w-4 text-[#d6b37a]" />
      {count > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[22px] items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white shadow-[0_10px_30px_rgba(239,68,68,0.38)]">
          {count}
        </span>
      ) : null}
    </Link>
  )
}
