import { NextRequest, NextResponse } from 'next/server'
import { getRouteRequester, requireManager } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  replaceMaterialTemplateItems,
} from '@/lib/material-orders-server'
import { normalizeMaterialTemplateMutationBody } from '@/lib/material-orders-route-utils'

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
    const input = normalizeMaterialTemplateMutationBody(body)

    const { data: insertedTemplate, error: insertError } = await supabaseAdmin
      .from('material_templates')
      .insert({
        name: input.name,
        category: input.category,
        description: input.description,
        is_active: input.isActive,
        created_by: authResult.requester.profile.id,
      })
      .select('id')
      .single()

    if (insertError || !insertedTemplate) {
      throw new Error(insertError?.message || 'Could not create the template.')
    }

    await replaceMaterialTemplateItems(insertedTemplate.id, input.items)

    return NextResponse.json({ templateId: insertedTemplate.id })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Could not create the template.',
      },
      { status: 400 }
    )
  }
}

