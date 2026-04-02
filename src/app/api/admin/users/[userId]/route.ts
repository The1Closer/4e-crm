import { NextRequest, NextResponse } from 'next/server'
import { isMissingNightlyNumbersColumnError } from '@/lib/nightly-numbers'
import { getRouteRequester, requireManager } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

type RouteContext = {
  params: Promise<{
    userId: string
  }>
}

type UpdateUserBody = {
  email?: string | null
  full_name?: string | null
  role?: string | null
  phone?: string | null
  manager_id?: string | null
  rep_type_id?: number | null
  is_active?: boolean
  avatar_url?: string | null
  include_in_nightly_numbers?: boolean
}

const ALLOWED_ROLES = new Set([
  'admin',
  'manager',
  'sales_manager',
  'production_manager',
  'social_media_coordinator',
  'rep',
])

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

function normalizeRole(value: unknown) {
  const normalized = normalizeText(value)

  if (!normalized) {
    return null
  }

  if (!ALLOWED_ROLES.has(normalized)) {
    throw new Error('Invalid role.')
  }

  return normalized
}

function normalizeRepTypeId(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed)) {
    throw new Error('Invalid rep type.')
  }

  return parsed
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const managerError = requireManager(authResult.requester)

  if (managerError) {
    return managerError
  }

  try {
    const { userId } = await context.params
    const body = (await req.json()) as UpdateUserBody

    const role = normalizeRole(body.role)
    const managerId = normalizeText(body.manager_id)
    const repTypeId = normalizeRepTypeId(body.rep_type_id)
    const nextEmail = normalizeEmail(body.email)
    const includeInNightlyNumbers =
      typeof body.include_in_nightly_numbers === 'boolean'
        ? body.include_in_nightly_numbers
        : undefined

    const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .single()

    if (targetProfileError || !targetProfile) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    }

    if (nextEmail) {
      const requesterRole = (authResult.requester.profile.role ?? '').trim()
      const canEditTargetEmail =
        requesterRole === 'admin' ||
        userId === authResult.requester.profile.id ||
        (targetProfile.role ?? '').trim() === 'rep'

      if (!canEditTargetEmail) {
        return NextResponse.json(
          { error: 'Managers can edit rep emails and their own email.' },
          { status: 403 }
        )
      }

      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        {
          email: nextEmail,
          email_confirm: true,
        }
      )

      if (updateAuthError) {
        return NextResponse.json({ error: updateAuthError.message }, { status: 400 })
      }
    }

    const updates: {
      full_name: string | null
      role: string | null
      phone: string | null
      manager_id: string | null
      rep_type_id: number | null
      is_active: boolean
      avatar_url: string | null
      include_in_nightly_numbers?: boolean
    } = {
      full_name: normalizeText(body.full_name),
      role,
      phone: normalizeText(body.phone),
      manager_id: managerId,
      rep_type_id: repTypeId,
      is_active: body.is_active ?? true,
      avatar_url: normalizeText(body.avatar_url),
    }

    if (includeInNightlyNumbers !== undefined) {
      updates.include_in_nightly_numbers = includeInNightlyNumbers
    }

    if (managerId) {
      const { data: managerProfile, error: managerCheckError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', managerId)
        .single()

      if (managerCheckError || !managerProfile) {
        return NextResponse.json(
          { error: 'Selected manager was not found.' },
          { status: 400 }
        )
      }
    }

    if (repTypeId !== null) {
      const { data: repType, error: repTypeError } = await supabaseAdmin
        .from('rep_types')
        .select('id')
        .eq('id', repTypeId)
        .eq('is_active', true)
        .single()

      if (repTypeError || !repType) {
        return NextResponse.json(
          { error: 'Selected rep type was not found.' },
          { status: 400 }
        )
      }
    }

    let { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select(
        'id, full_name, role, is_active, manager_id, rep_type_id, avatar_url, phone, include_in_nightly_numbers'
      )
      .single()

    if (error && isMissingNightlyNumbersColumnError(error)) {
      const fallbackUpdates = { ...updates }
      delete fallbackUpdates.include_in_nightly_numbers

      const fallbackResult = await supabaseAdmin
        .from('profiles')
        .update(fallbackUpdates)
        .eq('id', userId)
        .select('id, full_name, role, is_active, manager_id, rep_type_id, avatar_url, phone')
        .single()

      data = fallbackResult.data as typeof data
      error = fallbackResult.error
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ user: data })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Could not update the user.',
      },
      { status: 400 }
    )
  }
}
