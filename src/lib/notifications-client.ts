'use client'

import { authorizedFetch } from '@/lib/api-client'

export type NotificationItem = {
  id: string
  user_id: string
  actor_user_id: string | null
  job_id: string | null
  note_id: string | null
  title: string
  message: string
  link: string | null
  type: string
  metadata: Record<string, unknown> | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

export const NOTIFICATIONS_REFRESH_EVENT = 'notifications:refresh'

type NotificationListResponse = {
  notifications?: NotificationItem[]
  error?: string
}

type NotificationSingleResponse = {
  notification?: NotificationItem | null
  error?: string
}

type NotificationCountResponse = {
  count?: number
  error?: string
}

type NotificationPatchResponse = {
  notification?: NotificationItem | null
  updated?: number
  error?: string
}

function getErrorMessage(payload: { error?: string } | null, fallback: string) {
  return payload?.error || fallback
}

export function dispatchNotificationsRefresh() {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_REFRESH_EVENT))
}

export async function fetchNotifications() {
  const response = await authorizedFetch('/api/notifications', {
    cache: 'no-store',
  })
  const result = (await response.json().catch(() => null)) as
    | NotificationListResponse
    | null

  if (!response.ok) {
    throw new Error(getErrorMessage(result, 'Failed to load notifications.'))
  }

  return result?.notifications ?? []
}

export async function fetchNotification(notificationId: string) {
  const response = await authorizedFetch(
    `/api/notifications?notificationId=${encodeURIComponent(notificationId)}`,
    {
      cache: 'no-store',
    }
  )
  const result = (await response.json().catch(() => null)) as
    | NotificationSingleResponse
    | null

  if (!response.ok) {
    throw new Error(getErrorMessage(result, 'Failed to load the notification.'))
  }

  return result?.notification ?? null
}

export async function fetchUnreadNotificationCount() {
  const response = await authorizedFetch('/api/notifications?view=unread-count', {
    cache: 'no-store',
  })
  const result = (await response.json().catch(() => null)) as
    | NotificationCountResponse
    | null

  if (!response.ok) {
    throw new Error(getErrorMessage(result, 'Failed to load unread notifications.'))
  }

  return Number(result?.count ?? 0)
}

export async function markNotificationRead(notificationId: string) {
  const response = await authorizedFetch('/api/notifications', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      notificationId,
    }),
  })

  const result = (await response.json().catch(() => null)) as
    | NotificationPatchResponse
    | null

  if (!response.ok) {
    throw new Error(getErrorMessage(result, 'Failed to update the notification.'))
  }

  dispatchNotificationsRefresh()
  return result?.notification ?? null
}

export async function markAllNotificationsRead() {
  const response = await authorizedFetch('/api/notifications', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      markAll: true,
    }),
  })

  const result = (await response.json().catch(() => null)) as
    | NotificationPatchResponse
    | null

  if (!response.ok) {
    throw new Error(getErrorMessage(result, 'Failed to mark notifications as read.'))
  }

  dispatchNotificationsRefresh()
  return Number(result?.updated ?? 0)
}
