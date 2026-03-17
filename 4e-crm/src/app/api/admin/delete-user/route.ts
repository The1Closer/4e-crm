import { NextRequest, NextResponse } from 'next/server'
import { getRouteRequester, requireManager } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

type DeleteUserBody = {
  user_id?: string
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await getRouteRequester(req)

    if ('response' in authResult) {
      return authResult.response
    }

    const managerError = requireManager(authResult.requester)

    if (managerError) {
      return managerError
    }

    const body = (await req.json()) as DeleteUserBody
    const userId = body.user_id?.trim()

    if (!userId) {
      return NextResponse.json({ error: 'User id is required.' }, { status: 400 })
    }

    if (userId === authResult.requester.profile.id) {
      return NextResponse.json(
        { error: 'You cannot delete your own account from the CRM.' },
        { status: 400 }
      )
    }

    await supabaseAdmin.from('profiles').delete().eq('id', userId)

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unexpected server error.',
      },
      { status: 500 }
    )
  }
}
