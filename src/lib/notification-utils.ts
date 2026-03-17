import { authorizedFetch } from '@/lib/api-client'
import { supabase } from './supabase'

export function extractMentionNames(text: string): string[] {
  const matches = text.match(/@([a-zA-Z0-9._-]+)/g) || []
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))]
}

export function profileMatchesMention(fullName: string, mention: string) {
  const lowered = fullName.toLowerCase().trim()
  const parts = lowered.split(/\s+/)
  return lowered === mention || parts.some((part) => part === mention)
}

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
}
