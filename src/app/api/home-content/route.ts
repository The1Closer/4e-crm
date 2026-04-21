import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  getRouteRequester,
  requireManager,
} from '@/lib/server-auth'
import {
  isMissingHomeSpotlightsTableError,
  matchesAudience,
  normalizeNullableText,
  type AnnouncementContentRow,
  type SpotlightContentRow,
  type SpotlightContentType,
} from '@/lib/home-content'

const ANNOUNCEMENT_SELECT = `
  id,
  title,
  body,
  audience_role,
  audience_manager_id,
  is_active,
  created_at,
  updated_at
`

const SPOTLIGHT_SELECT = `
  id,
  title,
  body,
  content_type,
  media_url,
  quote_author,
  audience_role,
  audience_manager_id,
  is_active,
  display_date,
  created_at,
  updated_at
`

const MANAGER_ROLE_VALUES = new Set([
  'admin',
  'manager',
  'sales_manager',
  'production_manager',
  'social_media_coordinator',
])
const AUDIENCE_ROLE_VALUES = new Set([
  'admin',
  'manager',
  'sales_manager',
  'production_manager',
  'social_media_coordinator',
  'rep',
])

type ManageContentBody = {
  kind?: 'announcement' | 'spotlight'
  id?: string
  title?: string
  body?: string
  is_active?: boolean
  audience_role?: string | null
  audience_manager_id?: string | null
  content_type?: SpotlightContentType
  media_url?: string | null
  quote_author?: string | null
  display_date?: string | null
}

function normalizeAudienceRole(value: string | null | undefined) {
  const normalized = normalizeNullableText(value)

  if (!normalized) {
    return null
  }

  return AUDIENCE_ROLE_VALUES.has(normalized) ? normalized : null
}

function normalizeDisplayDate(value: string | null | undefined) {
  const normalized = normalizeNullableText(value)
  if (!normalized) {
    return null
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null
}

async function loadSpotlights() {
  const result = await supabaseAdmin
    .from('home_spotlights')
    .select(SPOTLIGHT_SELECT)
    .order('display_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (result.error && isMissingHomeSpotlightsTableError(result.error)) {
    return {
      rows: [] as SpotlightContentRow[],
      configured: false,
    }
  }

  if (result.error) {
    throw new Error(result.error.message)
  }

  return {
    rows: (result.data ?? []) as SpotlightContentRow[],
    configured: true,
  }
}

export async function GET(req: NextRequest) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const view = req.nextUrl.searchParams.get('view')?.trim() ?? ''
  const today = req.nextUrl.searchParams.get('today')?.trim() ?? ''
  const requester = authResult.requester

  if (view === 'manage') {
    const managerResponse = requireManager(requester)

    if (managerResponse) {
      return managerResponse
    }

    const [{ data: announcements, error: announcementsError }, spotlightResult, managersResult] =
      await Promise.all([
        supabaseAdmin
          .from('announcements')
          .select(ANNOUNCEMENT_SELECT)
          .order('created_at', { ascending: false }),
        loadSpotlights(),
        supabaseAdmin
          .from('profiles')
          .select('id, full_name, role')
          .in('role', [...MANAGER_ROLE_VALUES])
          .eq('is_active', true)
          .order('full_name', { ascending: true }),
      ])

    if (announcementsError) {
      return NextResponse.json(
        { error: announcementsError.message },
        { status: 400 }
      )
    }

    if (managersResult.error) {
      return NextResponse.json(
        { error: managersResult.error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      announcements: (announcements ?? []) as AnnouncementContentRow[],
      spotlights: spotlightResult.rows,
      managers: managersResult.data ?? [],
      spotlightsConfigured: spotlightResult.configured,
    })
  }

  const [{ data: announcements, error: announcementsError }, spotlightResult] =
    await Promise.all([
      supabaseAdmin
        .from('announcements')
        .select(ANNOUNCEMENT_SELECT)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(8),
      loadSpotlights(),
    ])

  if (announcementsError) {
    return NextResponse.json(
      { error: announcementsError.message },
      { status: 400 }
    )
  }

  const visibleAnnouncements = ((announcements ?? []) as AnnouncementContentRow[]).filter(
    (row) =>
      matchesAudience({
        audienceRole: row.audience_role,
        audienceManagerId: row.audience_manager_id,
        userRole: requester.profile.role,
        userManagerId: requester.profile.manager_id,
        userId: requester.profile.id,
      })
  )

  const visibleSpotlights = spotlightResult.rows.filter(
    (row) =>
      row.is_active &&
      (!row.display_date || row.display_date === today) &&
      matchesAudience({
        audienceRole: row.audience_role,
        audienceManagerId: row.audience_manager_id,
        userRole: requester.profile.role,
        userManagerId: requester.profile.manager_id,
        userId: requester.profile.id,
      })
  )

  visibleSpotlights.sort((left, right) => {
    const leftScore = left.display_date === today ? 1 : 0
    const rightScore = right.display_date === today ? 1 : 0

    if (leftScore !== rightScore) {
      return rightScore - leftScore
    }

    return right.created_at.localeCompare(left.created_at)
  })

  return NextResponse.json({
    announcements: visibleAnnouncements,
    spotlight: visibleSpotlights[0] ?? null,
    spotlights: visibleSpotlights,
    spotlightsConfigured: spotlightResult.configured,
  })
}

export async function POST(req: NextRequest) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const managerResponse = requireManager(authResult.requester)

  if (managerResponse) {
    return managerResponse
  }

  const body = (await req.json().catch(() => ({}))) as ManageContentBody
  const kind = body.kind ?? 'announcement'
  const title = (body.title ?? '').trim()
  const contentBody = (body.body ?? '').trim()

  if (kind === 'announcement' && (!title || !contentBody)) {
    return NextResponse.json(
      { error: 'Title and body are required.' },
      { status: 400 }
    )
  }

  if (kind === 'announcement') {
    const { data, error } = await supabaseAdmin
      .from('announcements')
      .insert({
        title,
        body: contentBody,
        audience_role: normalizeAudienceRole(body.audience_role),
        audience_manager_id: normalizeNullableText(body.audience_manager_id),
        is_active: body.is_active ?? true,
        created_by: authResult.requester.profile.id,
      })
      .select(ANNOUNCEMENT_SELECT)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ announcement: data })
  }

  if (kind !== 'spotlight') {
    return NextResponse.json({ error: 'Invalid content kind.' }, { status: 400 })
  }

  const contentType = body.content_type === 'video' ? 'video' : 'quote'

  if (contentType === 'video' && !normalizeNullableText(body.media_url)) {
    return NextResponse.json(
      { error: 'A video URL is required for video spotlights.' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('home_spotlights')
    .insert({
      title: title || '',
      body: contentBody || '',
      content_type: contentType,
      media_url: normalizeNullableText(body.media_url),
      quote_author: normalizeNullableText(body.quote_author),
      audience_role: normalizeAudienceRole(body.audience_role),
      audience_manager_id: normalizeNullableText(body.audience_manager_id),
      is_active: body.is_active ?? true,
      display_date: normalizeDisplayDate(body.display_date),
      created_by: authResult.requester.profile.id,
    })
    .select(SPOTLIGHT_SELECT)
    .single()

  if (error) {
    const message = isMissingHomeSpotlightsTableError(error)
      ? 'Run the home spotlights SQL migration first.'
      : error.message
    return NextResponse.json({ error: message }, { status: 400 })
  }

  return NextResponse.json({ spotlight: data })
}

export async function PATCH(req: NextRequest) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const managerResponse = requireManager(authResult.requester)

  if (managerResponse) {
    return managerResponse
  }

  const body = (await req.json().catch(() => ({}))) as ManageContentBody
  const kind = body.kind ?? 'announcement'
  const id = (body.id ?? '').trim()
  const title = (body.title ?? '').trim()
  const contentBody = (body.body ?? '').trim()

  if (!id || (kind === 'announcement' && (!title || !contentBody))) {
    return NextResponse.json(
      {
        error:
          kind === 'announcement'
            ? 'Content id, title, and body are required.'
            : 'Content id is required.',
      },
      { status: 400 }
    )
  }

  if (kind === 'announcement') {
    const { data, error } = await supabaseAdmin
      .from('announcements')
      .update({
        title,
        body: contentBody,
        audience_role: normalizeAudienceRole(body.audience_role),
        audience_manager_id: normalizeNullableText(body.audience_manager_id),
        is_active: body.is_active ?? true,
      })
      .eq('id', id)
      .select(ANNOUNCEMENT_SELECT)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ announcement: data })
  }

  if (kind !== 'spotlight') {
    return NextResponse.json({ error: 'Invalid content kind.' }, { status: 400 })
  }

  const contentType = body.content_type === 'video' ? 'video' : 'quote'

  if (contentType === 'video' && !normalizeNullableText(body.media_url)) {
    return NextResponse.json(
      { error: 'A video URL is required for video spotlights.' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('home_spotlights')
    .update({
      title: title || '',
      body: contentBody || '',
      content_type: contentType,
      media_url: normalizeNullableText(body.media_url),
      quote_author: normalizeNullableText(body.quote_author),
      audience_role: normalizeAudienceRole(body.audience_role),
      audience_manager_id: normalizeNullableText(body.audience_manager_id),
      is_active: body.is_active ?? true,
      display_date: normalizeDisplayDate(body.display_date),
    })
    .eq('id', id)
    .select(SPOTLIGHT_SELECT)
    .single()

  if (error) {
    const message = isMissingHomeSpotlightsTableError(error)
      ? 'Run the home spotlights SQL migration first.'
      : error.message
    return NextResponse.json({ error: message }, { status: 400 })
  }

  return NextResponse.json({ spotlight: data })
}

export async function DELETE(req: NextRequest) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const managerResponse = requireManager(authResult.requester)

  if (managerResponse) {
    return managerResponse
  }

  const body = (await req.json().catch(() => ({}))) as ManageContentBody
  const kind = body.kind ?? 'announcement'
  const id = (body.id ?? '').trim()

  if (!id) {
    return NextResponse.json({ error: 'Content id is required.' }, { status: 400 })
  }

  if (kind === 'announcement') {
    const { error } = await supabaseAdmin
      .from('announcements')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  }

  if (kind !== 'spotlight') {
    return NextResponse.json({ error: 'Invalid content kind.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('home_spotlights')
    .delete()
    .eq('id', id)

  if (error) {
    const message = isMissingHomeSpotlightsTableError(error)
      ? 'Run the home spotlights SQL migration first.'
      : error.message
    return NextResponse.json({ error: message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
