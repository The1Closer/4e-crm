import { NextRequest, NextResponse } from 'next/server'
import { getRouteRequester, requireManager } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  loadMaterialJobDefaults,
  loadMaterialOrderById,
  loadVendorSnapshot,
  replaceMaterialOrderItems,
} from '@/lib/material-orders-server'
import { normalizeMaterialOrderMutationBody } from '@/lib/material-orders-route-utils'

type RouteContext = {
  params: Promise<{
    orderId: string
  }>
}

export async function GET(req: NextRequest, context: RouteContext) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const managerError = requireManager(authResult.requester)

  if (managerError) {
    return managerError
  }

  try {
    const { orderId } = await context.params
    const order = await loadMaterialOrderById(orderId)

    if (!order) {
      return NextResponse.json({ error: 'Material order not found.' }, { status: 404 })
    }

    return NextResponse.json({ order })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Could not load the material order.',
      },
      { status: 400 }
    )
  }
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
    const { orderId } = await context.params
    const existingOrder = await loadMaterialOrderById(orderId)

    if (!existingOrder) {
      return NextResponse.json({ error: 'Material order not found.' }, { status: 404 })
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const input = normalizeMaterialOrderMutationBody(body)

    const [jobDefaults, vendorSnapshot] = await Promise.all([
      loadMaterialJobDefaults(input.jobId),
      input.vendorId ? loadVendorSnapshot(input.vendorId) : Promise.resolve(null),
    ])

    const vendorName = input.vendorName ?? vendorSnapshot?.vendor_name ?? null
    const vendorContactName =
      input.vendorContactName ?? vendorSnapshot?.vendor_contact_name ?? null
    const vendorPhone = input.vendorPhone ?? vendorSnapshot?.vendor_phone ?? null
    const vendorEmail = input.vendorEmail ?? vendorSnapshot?.vendor_email ?? null

    const generatedInternalAt = input.markGeneratedInternal
      ? new Date().toISOString()
      : existingOrder.generated_internal_at
    const generatedSupplierAt = input.markGeneratedSupplier
      ? new Date().toISOString()
      : existingOrder.generated_supplier_at

    const { error: updateError } = await supabaseAdmin
      .from('material_orders')
      .update({
        job_id: input.jobId,
        template_id: input.templateId,
        vendor_id: vendorSnapshot?.vendor_id ?? input.vendorId,
        status: input.status,
        vendor_name: vendorName,
        vendor_contact_name: vendorContactName,
        vendor_phone: vendorPhone,
        vendor_email: vendorEmail,
        ship_to_name: input.shipToName ?? jobDefaults?.ship_to_name ?? null,
        ship_to_address:
          input.shipToAddress ?? jobDefaults?.ship_to_address ?? null,
        needed_by: input.neededBy,
        ordered_at: input.orderedAt,
        internal_notes: input.internalNotes,
        supplier_notes: input.supplierNotes,
        generated_internal_at: generatedInternalAt,
        generated_supplier_at: generatedSupplierAt,
        updated_by: authResult.requester.profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    if (updateError) {
      throw new Error(updateError.message)
    }

    await replaceMaterialOrderItems(orderId, input.items)

    return NextResponse.json({ orderId })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Could not update the material order.',
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
    const { orderId } = await context.params
    const { error } = await supabaseAdmin
      .from('material_orders')
      .delete()
      .eq('id', orderId)

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ orderId })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Could not delete the material order.',
      },
      { status: 400 }
    )
  }
}

