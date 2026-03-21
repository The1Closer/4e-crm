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
  removeClaimLibraryFile,
} from '@/lib/claim-resource-library-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type RouteContext = {
  params: Promise<{
    resourceId: string
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

  const { resourceId } = await context.params
  const formData = await req.formData()
  const title = normalizeRequiredText(formData.get('title'))
  const categoryId = normalizeRequiredText(formData.get('category_id'))
  const resourceType = normalizeClaimResourceType(formData.get('resource_type'))
  const description = normalizeOptionalText(formData.get('description'))
  const externalUrl = normalizeOptionalText(formData.get('external_url'))
  const thumbnailUrl = normalizeOptionalText(formData.get('thumbnail_url'))
  const sortOrder = normalizeSortOrder(formData.get('sort_order'))
  const isActive = normalizeBoolean(formData.get('is_active'), true)
  const removeExistingFile = normalizeBoolean(formData.get('remove_existing_file'), false)
  const fileEntry = formData.get('file')
  const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null

  if (!title) {
    return NextResponse.json({ error: 'Resource title is required.' }, { status: 400 })
  }

  if (!categoryId) {
    return NextResponse.json({ error: 'Choose a category first.' }, { status: 400 })
  }

  let nextFilePath: string | null = null

  try {
    const [{ data: existing, error: existingError }, { data: category, error: categoryError }] =
      await Promise.all([
        supabaseAdmin
          .from('claim_resources')
          .select('id, file_path, resource_url, external_url')
          .eq('id', resourceId)
          .single(),
        supabaseAdmin
          .from('claim_resource_categories')
          .select('id, slug')
          .eq('id', categoryId)
          .single(),
      ])

    if (existingError || !existing) {
      throw new Error(existingError?.message || 'Resource not found.')
    }

    if (categoryError || !category) {
      throw new Error(categoryError?.message || 'Category not found.')
    }

    nextFilePath = existing.file_path
    let resourceUrl = existing.resource_url
    const nextExternalUrl = externalUrl

    if (file) {
      nextFilePath = buildClaimResourceFilePath({
        resourceType,
        categorySlug: category.slug,
        title,
        originalFileName: file.name,
      })

      const uploadRes = await supabaseAdmin.storage
        .from(CLAIM_RESOURCE_LIBRARY_BUCKET)
        .upload(nextFilePath, await file.arrayBuffer(), {
          contentType: file.type || undefined,
          upsert: false,
        })

      if (uploadRes.error) {
        throw new Error(uploadRes.error.message)
      }

      resourceUrl = getClaimLibraryPublicUrl(nextFilePath)
    } else if (removeExistingFile || !existing.file_path) {
      nextFilePath = null
      resourceUrl = externalUrl ?? ''
    } else if (externalUrl && !existing.file_path) {
      resourceUrl = externalUrl
    }

    if (!resourceUrl) {
      throw new Error('Upload a file or provide a URL for the resource.')
    }

    const { data, error } = await supabaseAdmin
      .from('claim_resources')
      .update({
        category_id: categoryId,
        title,
        description,
        resource_type: resourceType,
        resource_url: resourceUrl,
        external_url: nextExternalUrl,
        file_path: nextFilePath,
        thumbnail_url: thumbnailUrl,
        sort_order: sortOrder,
        is_active: isActive,
        updated_by: authResult.requester.profile.id,
      })
      .eq('id', resourceId)
      .select(
        'id, category_id, title, description, resource_type, resource_url, external_url, file_path, thumbnail_url, sort_order, is_active, created_at, updated_at'
      )
      .single()

    if (error || !data) {
      throw new Error(error?.message || 'Could not update the resource.')
    }

    if (file && existing.file_path && existing.file_path !== nextFilePath) {
      await removeClaimLibraryFile(existing.file_path)
    }

    if (removeExistingFile && existing.file_path && !file) {
      await removeClaimLibraryFile(existing.file_path)
    }

    return NextResponse.json({ resource: data })
  } catch (error) {
    if (file && nextFilePath) {
      await removeClaimLibraryFile(nextFilePath)
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Could not update the resource.',
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

  const { resourceId } = await context.params

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('claim_resources')
    .select('file_path')
    .eq('id', resourceId)
    .single()

  if (existingError || !existing) {
    return NextResponse.json(
      { error: existingError?.message || 'Resource not found.' },
      { status: 400 }
    )
  }

  const { error } = await supabaseAdmin
    .from('claim_resources')
    .delete()
    .eq('id', resourceId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await removeClaimLibraryFile(existing.file_path)

  return NextResponse.json({ success: true })
}
