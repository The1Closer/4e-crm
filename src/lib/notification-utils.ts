import { authorizedFetch } from '@/lib/api-client'
import { dispatchNotificationsRefresh } from '@/lib/notifications-client'
import {
  buildMentionHandle,
  extractMentionNames,
  profileMatchesMention,
} from './mention-utils'
import { supabase } from './supabase'

export { buildMentionHandle, extractMentionNames, profileMatchesMention }

export async function getActiveProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_active')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  if (error) return []
  return data ?? []
}

export async function createNotifications(params: {
  userIds: string[]
  actorUserId?: string | null
  type: string
  title: string
  message: string
  link?: string | null
  jobId?: string | null
  noteId?: string | null
  metadata?: Record<string, unknown>
  skipActor?: boolean
}) {
  const {
    userIds,
    actorUserId = null,
    type,
    title,
    message,
    link = null,
    jobId = null,
    noteId = null,
    metadata = {},
    skipActor = true,
  } = params

  const uniqueUserIds = [...new Set(userIds)].filter(Boolean)
  const finalUserIds = skipActor && actorUserId
    ? uniqueUserIds.filter((id) => id !== actorUserId)
    : uniqueUserIds

  if (finalUserIds.length === 0) return

  const response = await authorizedFetch('/api/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userIds: finalUserIds,
      actorUserId,
      type,
      title,
      message,
      link,
      jobId,
      noteId,
      metadata,
      skipActor: false,
    }),
  })

  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as
      | { error?: string }
      | null

    throw new Error(result?.error || 'Failed to create notifications.')
  }

  dispatchNotificationsRefresh()
}
