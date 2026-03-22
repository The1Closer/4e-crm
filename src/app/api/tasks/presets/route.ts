import { NextRequest, NextResponse } from 'next/server'
import { getRouteRequester, requireManager } from '@/lib/server-auth'
import { normalizeTaskPresetBody } from '@/lib/tasks-route-utils'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const managerResponse = requireManager(authResult.requester)

  if (managerResponse) {
    return managerResponse
  }

  try {
    const body = await req.json().catch(() => ({}))
    const input = normalizeTaskPresetBody(body)

    const { data, error } = await supabaseAdmin
      .from('task_presets')
      .insert({
        title: input.title,
        description: input.description || null,
        kind: input.kind,
        created_by: authResult.requester.profile.id,
      })
      .select('id')
      .single()

    if (error || !data) {
      throw new Error(error?.message || 'Could not create the task preset.')
    }

    return NextResponse.json({ presetId: data.id })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Could not create the task preset.',
      },
      { status: 400 }
    )
  }
}
