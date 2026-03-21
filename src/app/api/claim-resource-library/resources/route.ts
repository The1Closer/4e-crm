import { NextRequest, NextResponse } from 'next/server'
import { getRouteRequester, requireManager } from '@/lib/server-auth'
import {
  buildClaimResourceFilePath,
  CLAIM_RESOURCE_LIBRARY_BUCKET,
  getClaimLibraryPublicUrl,
  normalizeBoolean,
  normalizeClaimResourceType,
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

  const formData = await req.formData()
  const title = normalizeRequiredText(formData.get('title'))
  const categoryId = normalizeRequiredText(formData.get('category_id'))
  const resourceType = normalizeClaimResourceType(formData.get('resource_type'))
  const description = normalizeOptionalText(formData.get('description'))
  const externalUrl = normalizeOptionalText(formData.get('external_url'))
  const thumbnailUrl = normalizeOptionalText(formData.get('thumbnail_url'))
  const sortOrder = normalizeSortOrder(formData.get('sort_order'))
  const isActive = normalizeBoolean(formData.get('is_active'), true)
  const fileEntry = formData.get('file')
  const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null

  if (!title) {
    return NextResponse.json({ error: 'Resource title is required.' }, { status: 400 })
  }

  if (!categoryId) {
    return NextResponse.json({ error: 'Choose a category first.' }, { status: 400 })
  }

  if (!file && !externalUrl) {
    return NextResponse.json(
      { error: 'Upload a file or provide a URL for the resource.' },
      { status: 400 }
    )
  }

  let uploadedFilePath: string | null = null

  try {
    const { data: category, error: categoryError } = await supabaseAdmin
      .from('claim_resource_categories')
      .select('id, slug')
      .eq('id', categoryId)
      .single()

    if (categoryError || !category) {
      throw new Error(categoryError?.message || 'Category not found.')
    }

    let resourceUrl = externalUrl ?? ''

    if (file) {
      uploadedFilePath = buildClaimResourceFilePath({
        resourceType,
        categorySlug: category.slug,
        title,
        originalFileName: file.name,
      })

      const uploadRes = await supabaseAdmin.storage
        .from(CLAIM_RESOURCE_LIBRARY_BUCKET)
        .upload(uploadedFilePath, await file.arrayBuffer(), {
          contentType: file.type || undefined,
          upsert: false,
        })

      if (uploadRes.error) {
        throw new Error(uploadRes.error.message)
      }

      resourceUrl = getClaimLibraryPublicUrl(uploadedFilePath)
    }

    const { data, error } = await supabaseAdmin
      .from('claim_resources')
      .insert({
        category_id: categoryId,
        title,
        description,
        resource_type: resourceType,
        resource_url: resourceUrl,
        external_url: externalUrl,
        file_path: uploadedFilePath,
        thumbnail_url: thumbnailUrl,
        sort_order: sortOrder,
        is_active: isActive,
        created_by: authResult.requester.profile.id,
        updated_by: authResult.requester.profile.id,
      })
      .select(
        'id, category_id, title, description, resource_type, resource_url, external_url, file_path, thumbnail_url, sort_order, is_active, created_at, updated_at'
      )
      .single()

    if (error || !data) {
      throw new Error(error?.message || 'Could not create the resource.')
    }

    return NextResponse.json({ resource: data })
  } catch (error) {
    if (uploadedFilePath) {
      await supabaseAdmin.storage
        .from(CLAIM_RESOURCE_LIBRARY_BUCKET)
        .remove([uploadedFilePath])
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Could not create the resource.',
      },
      { status: 400 }
    )
  }
}
