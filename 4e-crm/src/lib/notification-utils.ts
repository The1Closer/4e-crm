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
  metadata?: Record<string, any>
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

  const rows = finalUserIds.map((userId) => ({
    user_id: userId,
    actor_user_id: actorUserId,
    type,
    title,
    message,
    link,
    job_id: jobId,
    note_id: noteId,
    metadata,
  }))

  await supabase.from('notifications').insert(rows)
}