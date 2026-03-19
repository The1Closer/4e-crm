'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import Link from 'next/link'
import { BellRing, X } from 'lucide-react'
import {
  fetchNotifications,
  NOTIFICATIONS_REFRESH_EVENT,
  type NotificationItem,
} from '@/lib/notifications-client'
import { supabase } from '@/lib/supabase'
import { useSupabaseAuthUserId } from '@/lib/use-supabase-auth-user-id'

type ToastItem = NotificationItem

const TOAST_LIFETIME_MS = 9000
const MAX_TOASTS = 4

function normalizeNotificationRow(
  value: Record<string, unknown> | null | undefined
): NotificationItem | null {
  if (!value || typeof value.id !== 'string' || typeof value.user_id !== 'string') {
    return null
  }

  return {
    id: value.id,
    user_id: value.user_id,
    actor_user_id:
      typeof value.actor_user_id === 'string' ? value.actor_user_id : null,
    job_id: typeof value.job_id === 'string' ? value.job_id : null,
    note_id: typeof value.note_id === 'string' ? value.note_id : null,
    title: typeof value.title === 'string' ? value.title : 'Notification',
    message: typeof value.message === 'string' ? value.message : '',
    link: typeof value.link === 'string' ? value.link : null,
    type: typeof value.type === 'string' ? value.type : 'general',
    metadata:
      value.metadata && typeof value.metadata === 'object'
        ? (value.metadata as Record<string, unknown>)
        : null,
    is_read: value.is_read === true,
    read_at: typeof value.read_at === 'string' ? value.read_at : null,
    created_at:
      typeof value.created_at === 'string'
        ? value.created_at
        : new Date().toISOString(),
  }
}

function buildNotificationPath(notificationId: string) {
  return `/notifications/${notificationId}`
}

export default function LiveNotificationToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const userId = useSupabaseAuthUserId()

  const seenIdsRef = useRef<Set<string>>(new Set())
  const initializedRef = useRef(false)
  const timeoutIdsRef = useRef<Map<string, number>>(new Map())

  const clearAllToastTimers = useCallback(() => {
    timeoutIdsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId)
    })
    timeoutIdsRef.current.clear()
  }, [])

  const dismissToast = useCallback((notificationId: string) => {
    const timeoutId = timeoutIdsRef.current.get(notificationId)

    if (timeoutId) {
      window.clearTimeout(timeoutId)
      timeoutIdsRef.current.delete(notificationId)
    }

    setToasts((current) =>
      current.filter((toast) => toast.id !== notificationId)
    )
  }, [])

  const showSystemNotification = useCallback((notification: NotificationItem) => {
    if (
      typeof window === 'undefined' ||
      typeof Notification === 'undefined' ||
      document.visibilityState === 'visible' ||
      Notification.permission !== 'granted'
    ) {
      return
    }

    const browserNotification = new Notification(notification.title, {
      body: notification.message,
      tag: `4e-crm-notification-${notification.id}`,
    })

    browserNotification.onclick = () => {
      window.focus()
      window.location.href = buildNotificationPath(notification.id)
      browserNotification.close()
    }
  }, [])

  const pushToast = useCallback(
    (notification: NotificationItem) => {
      if (notification.is_read || seenIdsRef.current.has(notification.id)) {
        return
      }

      seenIdsRef.current.add(notification.id)

      setToasts((current) => {
        const next = [notification, ...current.filter((toast) => toast.id !== notification.id)]
        return next.slice(0, MAX_TOASTS)
      })

      const existingTimeout = timeoutIdsRef.current.get(notification.id)

      if (existingTimeout) {
        window.clearTimeout(existingTimeout)
      }

      const timeoutId = window.setTimeout(() => {
        dismissToast(notification.id)
      }, TOAST_LIFETIME_MS)

      timeoutIdsRef.current.set(notification.id, timeoutId)
      showSystemNotification(notification)
    },
    [dismissToast, showSystemNotification]
  )

  const syncNotifications = useCallback(async () => {
    if (!userId) {
      return
    }

    try {
      const rows = await fetchNotifications()

      if (!initializedRef.current) {
        seenIdsRef.current = new Set(rows.map((row) => row.id))
        initializedRef.current = true
        return
      }

      rows
        .filter((row) => !row.is_read && !seenIdsRef.current.has(row.id))
        .slice()
        .reverse()
        .forEach((row) => {
          pushToast(row)
        })
    } catch {
      // Keep toast failures quiet. The bell and notifications page still provide access.
    }
  }, [pushToast, userId])

  useEffect(() => {
    if (!userId) {
      return
    }

    let channel: RealtimeChannel | null = null

    function handleRefresh() {
      void syncNotifications()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void syncNotifications()
      }
    }

    void syncNotifications()

    channel = supabase
      .channel(`notification-toasts-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notification = normalizeNotificationRow(
            payload.new as Record<string, unknown>
          )

          if (!notification) {
            return
          }

          pushToast(notification)
        }
      )
      .subscribe()

    const pollInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void syncNotifications()
      }
    }, 15000)

    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, handleRefresh)
    window.addEventListener('focus', handleRefresh)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(pollInterval)
      window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, handleRefresh)
      window.removeEventListener('focus', handleRefresh)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearAllToastTimers()
      seenIdsRef.current = new Set()
      initializedRef.current = false

      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [clearAllToastTimers, pushToast, syncNotifications, userId])

  const visibleToasts = userId
    ? toasts.filter((toast) => toast.user_id === userId)
    : []

  if (visibleToasts.length === 0) {
    return null
  }

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-[80] flex w-full max-w-sm flex-col gap-3 sm:right-6">
      {visibleToasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto overflow-hidden rounded-[1.5rem] border border-[#d6b37a]/22 bg-[#0b0f16]/96 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.34)] backdrop-blur-2xl"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-[#d6b37a]/18 bg-[#d6b37a]/12">
              <BellRing className="h-4 w-4 text-[#f0ce94]" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d6b37a]">
                New Notification
              </div>
              <div className="mt-2 text-sm font-semibold text-white">{toast.title}</div>
              <div className="mt-1 text-sm leading-6 text-white/68">{toast.message}</div>

              <div className="mt-3 flex items-center gap-3">
                <Link
                  href={buildNotificationPath(toast.id)}
                  onClick={() => dismissToast(toast.id)}
                  className="rounded-full bg-[#d6b37a] px-3 py-1.5 text-xs font-semibold text-black shadow-[0_10px_22px_rgba(214,179,122,0.2)] transition hover:bg-[#e2bf85]"
                >
                  Open
                </Link>

                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/78 transition hover:bg-white/[0.1] hover:text-white"
                >
                  Dismiss
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-white/55 transition hover:bg-white/[0.08] hover:text-white"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
