import { NextRequest, NextResponse } from 'next/server'
import { getRouteRequester, requireManager } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizeMaterialPresetItemMutationBody } from '@/lib/material-orders-route-utils'

type RouteContext = {
  params: Promise<{
    presetItemId: string
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
    const { presetItemId } = await context.params
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const input = normalizeMaterialPresetItemMutationBody(body)

    const { error: updateError } = await supabaseAdmin
      .from('material_preset_items')
      .update({
        name: input.name,
        unit: input.unit,
        default_quantity: input.defaultQuantity,
        description: input.description,
        is_active: input.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', presetItemId)

    if (updateError) {
      throw new Error(updateError.message)
    }

    const { error: deleteOptionsError } = await supabaseAdmin
      .from('material_preset_item_options')
      .delete()
      .eq('preset_item_id', presetItemId)

    if (deleteOptionsError) {
      throw new Error(deleteOptionsError.message)
    }

    if (input.options.length > 0) {
      const { error: insertOptionsError } = await supabaseAdmin
        .from('material_preset_item_options')
        .insert(
          input.options.map((option) => ({
            preset_item_id: presetItemId,
            option_group: option.option_group,
            option_value: option.option_value,
            sort_order: option.sort_order,
            is_default: option.is_default,
          }))
        )

      if (insertOptionsError) {
        throw new Error(insertOptionsError.message)
      }
    }

    return NextResponse.json({ presetItemId })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not update the preset item.',
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
    const { presetItemId } = await context.params
    const { error } = await supabaseAdmin
      .from('material_preset_items')
      .delete()
      .eq('id', presetItemId)

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ presetItemId })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not delete the preset item.',
      },
      { status: 400 }
    )
  }
}
