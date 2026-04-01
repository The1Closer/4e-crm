import { NextRequest, NextResponse } from 'next/server'
import { getRouteRequester } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

type BugReportBody = {
  description?: string
  contextPath?: string
}

type ProfileLookupRow = {
  id: string
  full_name: string | null
  is_active: boolean | null
}

const JACOB_FULL_NAME = 'Jacob Castillo'
const MAX_DESCRIPTION_LENGTH = 2000
const NOTIFICATIONS_COMPAT_TYPE = 'assignment'

function buildNotificationTitle(description: string) {
  const compact = description.replace(/\s+/g, ' ').trim()

  if (compact.length <= 72) {
    return `Bug Report: ${compact}`
  }

  return `Bug Report: ${compact.slice(0, 69)}...`
}

async function findJacobProfileId() {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, is_active')
    .ilike('full_name', JACOB_FULL_NAME)
    .limit(10)

  if (error) {
    throw new Error(error.message)
  }

  const candidates = (data ?? []) as ProfileLookupRow[]

  if (candidates.length === 0) {
    return null
  }

  const normalizedTarget = JACOB_FULL_NAME.toLowerCase()
  const exactActiveMatch = candidates.find(
    (profile) =>
      profile.is_active !== false &&
      (profile.full_name ?? '').trim().toLowerCase() === normalizedTarget
  )

  if (exactActiveMatch) {
    return exactActiveMatch.id
  }

  const exactMatch = candidates.find(
    (profile) => (profile.full_name ?? '').trim().toLowerCase() === normalizedTarget
  )

  if (exactMatch) {
    return exactMatch.id
  }

  const activeFallback = candidates.find((profile) => profile.is_active !== false)
  return activeFallback?.id ?? candidates[0]?.id ?? null
}

export async function POST(req: NextRequest) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const body = (await req.json().catch(() => ({}))) as BugReportBody
  const description = (body.description ?? '').trim().slice(0, MAX_DESCRIPTION_LENGTH)
  const contextPath = (body.contextPath ?? '').trim()

  if (!description) {
    return NextResponse.json({ error: 'Bug description is required.' }, { status: 400 })
  }

  const jacobProfileId = await findJacobProfileId()

  if (!jacobProfileId) {
    return NextResponse.json(
      { error: 'Could not find Jacob Castillo profile to receive bug reports.' },
      { status: 404 }
    )
  }

  const reporterName = authResult.requester.profile.full_name || 'Unknown user'
  const pathLabel = contextPath || 'unknown page'

  const { error } = await supabaseAdmin.from('notifications').insert({
    user_id: jacobProfileId,
    actor_user_id: authResult.requester.profile.id,
    type: NOTIFICATIONS_COMPAT_TYPE,
    title: buildNotificationTitle(description),
    message: `${reporterName} reported a bug on ${pathLabel}.`,
    link: '/notifications',
    job_id: null,
    note_id: null,
    metadata: {
      notification_kind: 'bug_report',
      description,
      context_path: pathLabel,
      reporter_id: authResult.requester.profile.id,
      reporter_name: reporterName,
      reporter_role: authResult.requester.profile.role ?? null,
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
