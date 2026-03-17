import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'

export type RouteRequesterProfile = {
  id: string
  role: string | null
  full_name: string | null
  manager_id: string | null
  is_active: boolean | null
}

export type RouteRequester = {
  authUserId: string
  profile: RouteRequesterProfile
}

const MANAGER_ROLES = new Set(['admin', 'manager', 'sales_manager'])

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export function isManagerRole(role: string | null | undefined) {
  return MANAGER_ROLES.has((role ?? '').trim())
}

export async function getRouteRequester(
  req: NextRequest
): Promise<{ requester: RouteRequester } | { response: NextResponse }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    return {
      response: jsonError('Missing Supabase public environment variables.', 500),
    }
  }

  const authHeader = req.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return {
      response: jsonError('Missing authorization token.', 401),
    }
  }

  const requesterToken = authHeader.slice('Bearer '.length)

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
    return {
      response: jsonError('Unauthorized.', 401),
    }
  }

  const { data: requesterProfile, error: requesterProfileError } =
    await requesterClient
      .from('profiles')
      .select('id, role, full_name, manager_id, is_active')
      .eq('id', requesterUser.id)
      .single()

  if (requesterProfileError || !requesterProfile) {
    return {
      response: jsonError('Could not verify requester profile.', 403),
    }
  }

  return {
    requester: {
      authUserId: requesterUser.id,
      profile: requesterProfile as RouteRequesterProfile,
    },
  }
}

export function requireManager(requester: RouteRequester) {
  if (!isManagerRole(requester.profile.role)) {
    return jsonError('Forbidden.', 403)
  }

  return null
}

export async function requireJobAccess(
  requester: RouteRequester,
  jobId: string
) {
  if (isManagerRole(requester.profile.role)) {
    return null
  }

  const { data: assignment, error } = await supabaseAdmin
    .from('job_reps')
    .select('job_id')
    .eq('job_id', jobId)
    .eq('profile_id', requester.profile.id)
    .maybeSingle()

  if (error || !assignment) {
    return jsonError('Forbidden.', 403)
  }

  return null
}

export async function requireExistingJob(jobId: string) {
  const { data: job, error } = await supabaseAdmin
    .from('jobs')
    .select('id')
    .eq('id', jobId)
    .maybeSingle()

  if (error || !job) {
    return {
      response: jsonError('Job not found.', 404),
    }
  }

  return { job }
}
