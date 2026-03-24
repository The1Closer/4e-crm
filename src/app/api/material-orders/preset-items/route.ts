import { NextRequest, NextResponse } from 'next/server'
import { getRouteRequester, requireManager } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizeMaterialPresetItemMutationBody } from '@/lib/material-orders-route-utils'

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
    const input = normalizeMaterialPresetItemMutationBody(body)

    const { data: insertedPresetItem, error: insertError } = await supabaseAdmin
      .from('material_preset_items')
      .insert({
        name: input.name,
        unit: input.unit,
        default_quantity: input.defaultQuantity,
        description: input.description,
        is_active: input.isActive,
        created_by: authResult.requester.profile.id,
      })
      .select('id')
      .single()

    if (insertError || !insertedPresetItem) {
      throw new Error(insertError?.message || 'Could not create the preset item.')
    }

    if (input.options.length > 0) {
      const { error: optionsError } = await supabaseAdmin
        .from('material_preset_item_options')
        .insert(
          input.options.map((option) => ({
            preset_item_id: insertedPresetItem.id,
            option_group: option.option_group,
            option_value: option.option_value,
            sort_order: option.sort_order,
            is_default: option.is_default,
          }))
        )

      if (optionsError) {
        throw new Error(optionsError.message)
      }
    }

    return NextResponse.json({ presetItemId: insertedPresetItem.id })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not create the preset item.',
      },
      { status: 400 }
    )
  }
}
