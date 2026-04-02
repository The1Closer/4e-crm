import { NextRequest, NextResponse } from 'next/server'
import { getRouteRequester, isManagerRole } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

type ProfileUpdateBody = {
  email?: string | null
  full_name?: string | null
  phone?: string | null
  avatar_url?: string | null
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeEmail(value: unknown) {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value !== 'string') {
    throw new Error('Invalid email.')
  }

  const trimmed = value.trim().toLowerCase()

  if (!trimmed) {
    return null
  }

  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)

  if (!looksLikeEmail) {
    throw new Error('Invalid email.')
  }

  return trimmed
}

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await getRouteRequester(req)

    if ('response' in authResult) {
      return authResult.response
    }

    const body = (await req.json()) as ProfileUpdateBody
    const nextEmail = normalizeEmail(body.email)
    const requesterRole = (authResult.requester.profile.role ?? '').trim()
    const canEditOwnEmail = requesterRole === 'rep' || isManagerRole(requesterRole)

    if (nextEmail && !canEditOwnEmail) {
      return NextResponse.json(
        { error: 'Your role cannot update email from this page.' },
        { status: 403 }
      )
    }

    if (nextEmail) {
      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
        authResult.requester.profile.id,
        {
          email: nextEmail,
          email_confirm: true,
        }
      )

      if (updateAuthError) {
        return NextResponse.json({ error: updateAuthError.message }, { status: 400 })
      }
    }

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

    return NextResponse.json({ profile: data, email: nextEmail ?? null })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not update profile.' },
      { status: 400 }
    )
  }
}
