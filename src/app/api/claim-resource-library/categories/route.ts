import { NextRequest, NextResponse } from 'next/server'
import { requireManager, getRouteRequester } from '@/lib/server-auth'
import {
  generateUniqueClaimCategorySlug,
  normalizeBoolean,
  normalizeOptionalText,
  normalizeRequiredText,
  normalizeSortOrder,
} from '@/lib/claim-resource-library-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const managerError = requireManager(authResult.requester)

  if (managerError) {
    return managerError
  }

  const body = (await req.json().catch(() => null)) as
    | {
        name?: string
        description?: string | null
        parent_id?: string | null
        sort_order?: number | string | null
        is_active?: boolean | string | null
      }
    | null

  const name = normalizeRequiredText(body?.name)

  if (!name) {
    return NextResponse.json({ error: 'Category name is required.' }, { status: 400 })
  }

  try {
    const slug = await generateUniqueClaimCategorySlug(name)

    const { data, error } = await supabaseAdmin
      .from('claim_resource_categories')
      .insert({
        name,
        slug,
        description: normalizeOptionalText(body?.description),
        parent_id: normalizeOptionalText(body?.parent_id),
        sort_order: normalizeSortOrder(body?.sort_order),
        is_active: normalizeBoolean(body?.is_active, true),
        created_by: authResult.requester.profile.id,
        updated_by: authResult.requester.profile.id,
      })
      .select('id, name, slug, description, parent_id, sort_order, is_active, created_at, updated_at')
      .single()

    if (error || !data) {
      throw new Error(error?.message || 'Could not create the category.')
    }

    return NextResponse.json({ category: data })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Could not create the category.',
      },
      { status: 400 }
    )
  }
}
