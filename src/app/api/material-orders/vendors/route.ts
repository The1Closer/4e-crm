import { NextRequest, NextResponse } from 'next/server'
import { getRouteRequester, requireManager } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizeVendorMutationBody } from '@/lib/material-orders-route-utils'

export async function POST(req: NextRequest) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const managerError = requireManager(authResult.requester)

  if (managerError) {
    return managerError
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const input = normalizeVendorMutationBody(body)

    const { data: insertedVendor, error: insertError } = await supabaseAdmin
      .from('vendors')
      .insert({
        name: input.name,
        contact_name: input.contactName,
        phone: input.phone,
        email: input.email,
        ordering_notes: input.orderingNotes,
        is_active: input.isActive,
        created_by: authResult.requester.profile.id,
      })
      .select('id')
      .single()

    if (insertError || !insertedVendor) {
      throw new Error(insertError?.message || 'Could not create the vendor.')
    }

    return NextResponse.json({ vendorId: insertedVendor.id })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Could not create the vendor.',
      },
      { status: 400 }
    )
  }
}

