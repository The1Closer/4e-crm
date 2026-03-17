import { NextRequest, NextResponse } from 'next/server'
import { getRouteRequester } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

type NotificationBody = {
  userIds?: string[]
  type?: string
  title?: string
  message?: string
  link?: string | null
  jobId?: string | null
  noteId?: string | null
  metadata?: Record<string, unknown>
  skipActor?: boolean
}

const ALLOWED_NOTIFICATION_TYPES = new Set([
  'assignment',
  'stage_change',
  'chess_invite',
  'chess_bot_invite',
  'note_mention',
])

export async function POST(req: NextRequest) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const body = (await req.json()) as NotificationBody
  const userIds = [...new Set(body.userIds ?? [])].filter(Boolean)
  const type = (body.type ?? '').trim()
  const title = (body.title ?? '').trim()
  const message = (body.message ?? '').trim()
  const skipActor = body.skipActor ?? true

  if (!ALLOWED_NOTIFICATION_TYPES.has(type)) {
    return NextResponse.json({ error: 'Invalid notification type.' }, { status: 400 })
  }

  if (!title || !message) {
    return NextResponse.json(
      { error: 'Notification title and message are required.' },
      { status: 400 }
    )
  }

  const finalUserIds = skipActor
    ? userIds.filter((id) => id !== authResult.requester.profile.id)
    : userIds

  if (finalUserIds.length === 0) {
    return NextResponse.json({ success: true, inserted: 0 })
  }

  const rows = finalUserIds.map((userId) => ({
    user_id: userId,
    actor_user_id: authResult.requester.profile.id,
    type,
    title,
    message,
    link: body.link ?? null,
    job_id: body.jobId ?? null,
    note_id: body.noteId ?? null,
    metadata:
      body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
  }))

  const { error } = await supabaseAdmin.from('notifications').insert(rows)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, inserted: rows.length })
}
