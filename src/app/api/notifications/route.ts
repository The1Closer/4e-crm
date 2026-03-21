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

type NotificationPatchBody = {
  notificationId?: string
  markAll?: boolean
}

const NOTIFICATION_SELECT = `
  id,
  user_id,
  actor_user_id,
  job_id,
  note_id,
  title,
  message,
  link,
  type,
  metadata,
  is_read,
  read_at,
  created_at
`

const ALLOWED_NOTIFICATION_TYPES = new Set([
  'assignment',
  'stage_change',
  'note_mention',
])

export async function GET(req: NextRequest) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const view = req.nextUrl.searchParams.get('view')?.trim() ?? ''
  const notificationId =
    req.nextUrl.searchParams.get('notificationId')?.trim() ?? ''

  if (view === 'unread-count') {
    const { count, error } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', authResult.requester.profile.id)
      .eq('is_read', false)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ count: count ?? 0 })
  }

  if (notificationId) {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select(NOTIFICATION_SELECT)
      .eq('user_id', authResult.requester.profile.id)
      .eq('id', notificationId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Notification not found.' }, { status: 404 })
    }

    return NextResponse.json({ notification: data })
  }

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select(NOTIFICATION_SELECT)
    .eq('user_id', authResult.requester.profile.id)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ notifications: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const body = (await req.json().catch(() => ({}))) as NotificationPatchBody
  const notificationId = (body.notificationId ?? '').trim()
  const markAll = body.markAll === true
  const readAt = new Date().toISOString()

  if (!notificationId && !markAll) {
    return NextResponse.json(
      { error: 'Notification id or markAll is required.' },
      { status: 400 }
    )
  }

  if (markAll) {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({
        is_read: true,
        read_at: readAt,
      })
      .eq('user_id', authResult.requester.profile.id)
      .eq('is_read', false)
      .select('id')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, updated: data?.length ?? 0 })
  }

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .update({
      is_read: true,
      read_at: readAt,
    })
    .eq('user_id', authResult.requester.profile.id)
    .eq('id', notificationId)
    .select(NOTIFICATION_SELECT)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Notification not found.' }, { status: 404 })
  }

  return NextResponse.json({ success: true, notification: data })
}

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
