import { NextRequest, NextResponse } from 'next/server'
import { getRouteRequester, requireManager } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function DELETE(
  req: NextRequest,
  context: {
    params: Promise<{
      presetId: string
    }>
  }
) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const managerResponse = requireManager(authResult.requester)

  if (managerResponse) {
    return managerResponse
  }

  try {
    const { presetId } = await context.params

    const { error } = await supabaseAdmin
      .from('task_presets')
      .delete()
      .eq('id', presetId)

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Could not delete the task preset.',
      },
      { status: 400 }
    )
  }
}
