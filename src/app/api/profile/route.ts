import { NextRequest, NextResponse } from 'next/server'
import { getRouteRequester } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

type ProfileUpdateBody = {
  full_name?: string | null
  phone?: string | null
  avatar_url?: string | null
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export async function PATCH(req: NextRequest) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const body = (await req.json()) as ProfileUpdateBody

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({
      full_name: normalizeText(body.full_name),
      phone: normalizeText(body.phone),
      avatar_url: normalizeText(body.avatar_url),
    })
    .eq('id', authResult.requester.profile.id)
    .select('id, full_name, role, is_active, manager_id, rep_type_id, avatar_url, phone')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ profile: data })
}
