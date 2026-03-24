import { NextRequest, NextResponse } from 'next/server'
import { getRouteRequester, requireManager } from '@/lib/server-auth'
import { loadMaterialOrderById } from '@/lib/material-orders-server'
import { generateMaterialOrderSupplierPdf } from '@/lib/material-order-supplier-pdf'
import { sendMailViaMicrosoftGraph } from '@/lib/microsoft-graph-mail'
import { supabaseAdmin } from '@/lib/supabase-admin'

type RouteContext = {
  params: Promise<{
    orderId: string
  }>
}

export const runtime = 'nodejs'

function getProductionManagerEmail() {
  const email = process.env.MATERIAL_ORDERS_SENDER_EMAIL?.trim() ?? ''

  if (!email) {
    throw new Error(
      'Missing MATERIAL_ORDERS_SENDER_EMAIL environment variable.'
    )
  }

  return email
}

export async function POST(req: NextRequest, context: RouteContext) {
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

    const vendorEmail = order.vendor_email?.trim() ?? ''

    if (!vendorEmail) {
      return NextResponse.json(
        { error: 'Add vendor email before sending.' },
        { status: 400 }
      )
    }

    const homeownerName = order.job?.homeowner_name?.trim() ?? ''
    const subject = homeownerName
      ? `Material Order(${homeownerName})`
      : 'Material Order'
    const supplierDocUrl = `${req.nextUrl.origin}/material-orders/${order.id}/supplier`
    const bodyText = [
      'Please review the attached supplier purchase order PDF.',
      '',
      `Order Number: ${order.order_number}`,
      `Homeowner: ${homeownerName || 'Not set'}`,
      '',
      `Supplier document link: ${supplierDocUrl}`,
    ].join('\n')

    const { pdfBytes, fileName } = await generateMaterialOrderSupplierPdf(order)
    const attachmentBase64 = Buffer.from(pdfBytes).toString('base64')
    const senderEmail = getProductionManagerEmail()

    await sendMailViaMicrosoftGraph({
      fromEmail: senderEmail,
      toEmail: vendorEmail,
      subject,
      bodyText,
      attachments: [
        {
          name: fileName,
          contentBytesBase64: attachmentBase64,
          contentType: 'application/pdf',
        },
      ],
    })

    const { error: updateError } = await supabaseAdmin
      .from('material_orders')
      .update({
        generated_supplier_at: new Date().toISOString(),
        updated_by: authResult.requester.profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)

    if (updateError) {
      throw new Error(updateError.message)
    }

    return NextResponse.json({
      ok: true,
      subject,
      sentAt: new Date().toISOString(),
      fromEmail: senderEmail,
      toEmail: vendorEmail,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not send supplier email.',
      },
      { status: 400 }
    )
  }
}
