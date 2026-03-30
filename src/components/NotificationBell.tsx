'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, BellRing } from 'lucide-react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import {
  fetchUnreadNotificationCount,
  NOTIFICATIONS_REFRESH_EVENT,
} from '@/lib/notifications-client'
import { supabase } from '@/lib/supabase'
import { useSupabaseAuthUserId } from '@/lib/use-supabase-auth-user-id'

export default function NotificationBell() {
  const [count, setCount] = useState(0)
  const userId = useSupabaseAuthUserId()

  const loadUnreadCount = useCallback(async () => {
    try {
      const nextCount = await fetchUnreadNotificationCount()
      setCount(nextCount)
    } catch {
      setCount(0)
    }
  }, [])

  useEffect(() => {
    if (!userId) {
      return
    }

    let channel: RealtimeChannel | null = null

    function handleRefresh() {
      void loadUnreadCount()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void loadUnreadCount()
      }
    }

    const loadTimer = window.setTimeout(() => {
      void loadUnreadCount()
    }, 0)

    channel = supabase
      .channel(`notifications-bell-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void loadUnreadCount()
        }
      )
      .subscribe()

    const pollInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadUnreadCount()
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
  }, [loadUnreadCount, userId])

  const effectiveCount = userId ? count : 0
  const hasUnread = effectiveCount > 0
  const BellIcon = hasUnread ? BellRing : Bell

  return (
    <Link
      href="/notifications"
      className={`relative inline-flex h-10 w-10 items-center justify-center rounded-[1rem] transition sm:h-12 sm:w-12 sm:rounded-[1.35rem] ${
        hasUnread
          ? 'border border-[#d6b37a]/35 bg-[#d6b37a]/12 text-[var(--shell-text)] shadow-[0_10px_30px_rgba(0,0,0,0.25)] hover:border-[#d6b37a]/55 hover:bg-[#d6b37a]/18'
          : 'crm-glass crm-glass-hover text-[var(--shell-text-muted)] hover:text-[var(--shell-text)]'
      }`}
      aria-label={
        effectiveCount > 0 ? `${effectiveCount} unread notifications` : 'Notifications'
      }
      title="Notifications"
    >
      <BellIcon className={`h-4 w-4 ${hasUnread ? 'text-[#f0ce94]' : 'text-[#d6b37a]'}`} />
      {effectiveCount > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-[0_10px_30px_rgba(239,68,68,0.38)] sm:min-w-[22px] sm:px-2 sm:text-[11px]">
          {effectiveCount > 99 ? '99+' : effectiveCount}
        </span>
      ) : null}
      {hasUnread ? (
        <span className="absolute bottom-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-[#f0ce94] shadow-[0_0_16px_rgba(240,206,148,0.9)]" />
      ) : null}
    </Link>
  )
}
