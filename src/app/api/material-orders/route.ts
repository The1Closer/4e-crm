import { NextRequest, NextResponse } from 'next/server'
import {
  getRouteRequester,
  requireExistingJob,
  requireManager,
} from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  buildMaterialOrderNumber,
  loadMaterialJobDefaults,
  loadMaterialOrdersDashboard,
  loadVendorSnapshot,
  replaceMaterialOrderItems,
} from '@/lib/material-orders-server'
import { normalizeMaterialOrderMutationBody } from '@/lib/material-orders-route-utils'

export async function GET(req: NextRequest) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const managerError = requireManager(authResult.requester)

  if (managerError) {
    return managerError
  }

  try {
    const jobId = req.nextUrl.searchParams.get('jobId')?.trim() || null
    const payload = await loadMaterialOrdersDashboard({ jobId })

    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not load material orders.',
      },
      { status: 400 }
    )
  }
}

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
    const input = normalizeMaterialOrderMutationBody(body)
    const existingJobResult = await requireExistingJob(input.jobId)

    if ('response' in existingJobResult) {
      return existingJobResult.response
    }

    const [jobDefaults, vendorSnapshot] = await Promise.all([
      loadMaterialJobDefaults(input.jobId),
      input.vendorId ? loadVendorSnapshot(input.vendorId) : Promise.resolve(null),
    ])

    const vendorName = input.vendorName ?? vendorSnapshot?.vendor_name ?? null
    const vendorContactName =
      input.vendorContactName ?? vendorSnapshot?.vendor_contact_name ?? null
    const vendorPhone = input.vendorPhone ?? vendorSnapshot?.vendor_phone ?? null
    const vendorEmail = input.vendorEmail ?? vendorSnapshot?.vendor_email ?? null

    const { data: insertedOrder, error: insertError } = await supabaseAdmin
      .from('material_orders')
      .insert({
        order_number: buildMaterialOrderNumber(),
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
        generated_internal_at: input.markGeneratedInternal ? new Date().toISOString() : null,
        generated_supplier_at: input.markGeneratedSupplier ? new Date().toISOString() : null,
        created_by: authResult.requester.profile.id,
        updated_by: authResult.requester.profile.id,
      })
      .select('id')
      .single()

    if (insertError || !insertedOrder) {
      throw new Error(insertError?.message || 'Could not create the material order.')
    }

    await replaceMaterialOrderItems(insertedOrder.id, input.items)

    return NextResponse.json({ orderId: insertedOrder.id })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not create the material order.',
      },
      { status: 400 }
    )
  }
}

