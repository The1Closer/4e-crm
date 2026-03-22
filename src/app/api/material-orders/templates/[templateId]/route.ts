import { NextRequest, NextResponse } from 'next/server'
import { getRouteRequester, requireManager } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { replaceMaterialTemplateItems } from '@/lib/material-orders-server'
import { normalizeMaterialTemplateMutationBody } from '@/lib/material-orders-route-utils'

type RouteContext = {
  params: Promise<{
    templateId: string
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
    const { templateId } = await context.params
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const input = normalizeMaterialTemplateMutationBody(body)

    const { error: updateError } = await supabaseAdmin
      .from('material_templates')
      .update({
        name: input.name,
        category: input.category,
        description: input.description,
        is_active: input.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', templateId)

    if (updateError) {
      throw new Error(updateError.message)
    }

    await replaceMaterialTemplateItems(templateId, input.items)

    return NextResponse.json({ templateId })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Could not update the template.',
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
    const { templateId } = await context.params
    const { error } = await supabaseAdmin
      .from('material_templates')
      .delete()
      .eq('id', templateId)

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ templateId })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Could not delete the template.',
      },
      { status: 400 }
    )
  }
}

