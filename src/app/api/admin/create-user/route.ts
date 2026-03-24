import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getDefaultNightlyNumbersInclusion,
  isMissingNightlyNumbersColumnError,
} from '@/lib/nightly-numbers'
import { supabaseAdmin } from '@/lib/supabase-admin'

type CreateUserBody = {
  full_name: string
  email: string
  phone?: string | null
  password: string
  role: string
  manager_id?: string | null
  rep_type_id?: number | null
  is_active?: boolean
  avatar_url?: string | null
  include_in_nightly_numbers?: boolean
}

const ALLOWED_ROLES = [
  'manager',
  'sales_manager',
  'production_manager',
  'social_media_coordinator',
  'rep',
  'admin',
]

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateUserBody

    const fullName = body.full_name?.trim()
    const email = body.email?.trim().toLowerCase()
    const phone = body.phone?.trim() || null
    const password = body.password
    const role = body.role?.trim()
    const managerId = body.manager_id || null
    const repTypeId = body.rep_type_id ?? null
    const isActive = body.is_active ?? true
    const avatarUrl = body.avatar_url?.trim() || null
    const includeInNightlyNumbers =
      body.include_in_nightly_numbers ?? getDefaultNightlyNumbersInclusion(role)

    if (!fullName) {
      return NextResponse.json({ error: 'Full name is required.' }, { status: 400 })
    }

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: 'Temporary password must be at least 8 characters.' },
        { status: 400 }
      )
    }

    if (!role || !ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Invalid role.' }, { status: 400 })
    }

    // Use anon client + requester bearer token to identify the caller safely
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json(
        { error: 'Missing Supabase public environment variables.' },
        { status: 500 }
      )
    }

    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization token.' }, { status: 401 })
    }

    const requesterToken = authHeader.replace('Bearer ', '')

    const requesterClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${requesterToken}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const {
      data: { user: requesterUser },
      error: requesterAuthError,
    } = await requesterClient.auth.getUser()

    if (requesterAuthError || !requesterUser) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const { data: requesterProfile, error: requesterProfileError } = await requesterClient
      .from('profiles')
      .select('id, role')
      .eq('id', requesterUser.id)
      .single()

    if (requesterProfileError || !requesterProfile) {
      return NextResponse.json({ error: 'Could not verify requester profile.' }, { status: 403 })
    }

    const managerRoles = new Set([
      'manager',
      'sales_manager',
      'production_manager',
      'social_media_coordinator',
      'admin',
    ])

    if (!managerRoles.has(requesterProfile.role)) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    // Optional validation: make sure manager_id exists if supplied
    if (managerId) {
      const { data: managerProfile, error: managerCheckError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', managerId)
        .single()

      if (managerCheckError || !managerProfile) {
        return NextResponse.json({ error: 'Selected manager was not found.' }, { status: 400 })
      }
    }

    // Optional validation: make sure rep_type_id exists if supplied
    if (repTypeId !== null) {
      const { data: repType, error: repTypeError } = await supabaseAdmin
        .from('rep_types')
        .select('id')
        .eq('id', repTypeId)
        .eq('is_active', true)
        .single()

      if (repTypeError || !repType) {
        return NextResponse.json({ error: 'Selected rep type was not found.' }, { status: 400 })
      }
    }

    const { data: createdAuthUser, error: createAuthError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        phone: phone || undefined,
        user_metadata: {
          full_name: fullName,
        },
      })

    if (createAuthError || !createdAuthUser.user) {
      return NextResponse.json(
        { error: createAuthError?.message || 'Failed to create auth user.' },
        { status: 400 }
      )
    }

    const newUserId = createdAuthUser.user.id

    const profilePayload = {
      id: newUserId,
      full_name: fullName,
      role,
      is_active: isActive,
      manager_id: managerId,
      rep_type_id: repTypeId,
      avatar_url: avatarUrl,
      phone,
    }

    let { error: profileInsertError } = await supabaseAdmin.from('profiles').insert({
      ...profilePayload,
      include_in_nightly_numbers: includeInNightlyNumbers,
    })

    if (profileInsertError && isMissingNightlyNumbersColumnError(profileInsertError)) {
      const fallbackResult = await supabaseAdmin.from('profiles').insert(profilePayload)
      profileInsertError = fallbackResult.error
    }

    if (profileInsertError) {
      // Best-effort cleanup so you do not leave orphaned auth users
      await supabaseAdmin.auth.admin.deleteUser(newUserId)

      return NextResponse.json(
        { error: profileInsertError.message || 'Failed to create profile row.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUserId,
        email,
        full_name: fullName,
        role,
        manager_id: managerId,
        rep_type_id: repTypeId,
        is_active: isActive,
        avatar_url: avatarUrl,
        phone,
        include_in_nightly_numbers: includeInNightlyNumbers,
      },
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unexpected server error.',
      },
      { status: 500 }
    )
  }
}
