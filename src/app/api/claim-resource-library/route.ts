import { NextRequest, NextResponse } from 'next/server'
import { getRouteRequester } from '@/lib/server-auth'
import { isManagerRole } from '@/lib/server-auth'
import { loadClaimResourceLibrary } from '@/lib/claim-resource-library-server'

export async function GET(req: NextRequest) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  try {
    const canManage = isManagerRole(authResult.requester.profile.role)
    const library = await loadClaimResourceLibrary({
      includeInactive: canManage,
    })

    return NextResponse.json({
      categories: library.categories,
      resources: library.resources,
      canManage,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not load the claim resource library.',
      },
      { status: 400 }
    )
  }
}
