import { NextRequest, NextResponse } from 'next/server'
import { getRouteRequester, requireManager } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizeVendorMutationBody } from '@/lib/material-orders-route-utils'

type RouteContext = {
  params: Promise<{
    vendorId: string
  }>
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
    const { vendorId } = await context.params
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const input = normalizeVendorMutationBody(body)

    const { error: updateError } = await supabaseAdmin
      .from('vendors')
      .update({
        name: input.name,
        contact_name: input.contactName,
        phone: input.phone,
        email: input.email,
        ordering_notes: input.orderingNotes,
        is_active: input.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vendorId)

    if (updateError) {
      throw new Error(updateError.message)
    }

    return NextResponse.json({ vendorId })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Could not update the vendor.',
      },
      { status: 400 }
    )
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const managerError = requireManager(authResult.requester)

  if (managerError) {
    return managerError
  }

  try {
    const { vendorId } = await context.params
    const { error } = await supabaseAdmin
      .from('vendors')
      .delete()
      .eq('id', vendorId)

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ vendorId })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Could not delete the vendor.',
      },
      { status: 400 }
    )
  }
}
