import 'server-only'

import { slugifyFileName } from '@/lib/file-utils'
import type {
  ClaimResourceCategoryRow,
  ClaimResourceItemRow,
  ClaimResourceType,
} from '@/lib/claim-resource-library'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const CLAIM_RESOURCE_LIBRARY_BUCKET = 'claim-resource-library'

export function normalizeOptionalText(value: FormDataEntryValue | string | null | undefined) {
  const normalized = String(value ?? '').trim()
  return normalized ? normalized : null
}

export function normalizeRequiredText(
  value: FormDataEntryValue | string | null | undefined,
  fallback = ''
) {
  return String(value ?? fallback).trim()
}

export function normalizeBoolean(
  value: FormDataEntryValue | string | boolean | null | undefined,
  fallback = true
) {
  if (typeof value === 'boolean') return value

  const normalized = String(value ?? '').trim().toLowerCase()

  if (!normalized) return fallback
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false
  return fallback
}

export function normalizeSortOrder(
  value: FormDataEntryValue | string | number | null | undefined
) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export function normalizeClaimResourceType(
  value: FormDataEntryValue | string | null | undefined
): ClaimResourceType {
  const normalized = String(value ?? '').trim().toLowerCase()

  if (normalized === 'video') return 'video'
  if (normalized === 'photo') return 'photo'
  return 'document'
}

export async function loadClaimResourceLibrary(options?: {
  includeInactive?: boolean
}) {
  const includeInactive = options?.includeInactive ?? false

  let categoryQuery = supabaseAdmin
    .from('claim_resource_categories')
    .select('id, name, slug, description, parent_id, sort_order, is_active, created_at, updated_at')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  let resourceQuery = supabaseAdmin
    .from('claim_resources')
    .select(
      'id, category_id, title, description, resource_type, resource_url, external_url, file_path, thumbnail_url, sort_order, is_active, created_at, updated_at'
    )
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true })

  if (!includeInactive) {
    categoryQuery = categoryQuery.eq('is_active', true)
    resourceQuery = resourceQuery.eq('is_active', true)
  }

  const [categoriesRes, resourcesRes] = await Promise.all([categoryQuery, resourceQuery])

  if (categoriesRes.error) {
    throw new Error(categoriesRes.error.message)
  }

  if (resourcesRes.error) {
    throw new Error(resourcesRes.error.message)
  }

  return {
    categories: (categoriesRes.data ?? []) as ClaimResourceCategoryRow[],
    resources: (resourcesRes.data ?? []) as ClaimResourceItemRow[],
  }
}

export function buildClaimResourceFilePath(params: {
  resourceType: ClaimResourceType
  categorySlug: string
  title: string
  originalFileName: string
}) {
  const originalName = params.originalFileName || 'file'
  const extensionMatch = originalName.match(/\.[a-z0-9]+$/i)
  const extension = extensionMatch?.[0] ?? ''
  const safeTitle = slugifyFileName(params.title || originalName || 'resource') || 'resource'
  const safeCategory = slugifyFileName(params.categorySlug || 'general') || 'general'

  return `claim-resource-library/${params.resourceType}/${safeCategory}/${Date.now()}-${safeTitle}${extension}`
}

export async function generateUniqueClaimCategorySlug(
  name: string,
  excludeId?: string | null
) {
  const baseSlug = slugifyFileName(name.toLowerCase().replace(/\s+/g, '-')) || 'category'

  const { data, error } = await supabaseAdmin
    .from('claim_resource_categories')
    .select('id, slug')
    .ilike('slug', `${baseSlug}%`)

  if (error) {
    throw new Error(error.message)
  }

  const takenSlugs = new Set(
    (data ?? [])
      .filter((row) => row.id !== excludeId)
      .map((row) => String(row.slug))
  )

  if (!takenSlugs.has(baseSlug)) {
    return baseSlug
  }

  let attempt = 2

  while (takenSlugs.has(`${baseSlug}-${attempt}`)) {
    attempt += 1
  }

  return `${baseSlug}-${attempt}`
}

export function getClaimLibraryPublicUrl(filePath: string) {
  const { data } = supabaseAdmin.storage
    .from(CLAIM_RESOURCE_LIBRARY_BUCKET)
    .getPublicUrl(filePath)

  return data.publicUrl
}

export async function removeClaimLibraryFile(filePath: string | null | undefined) {
  if (!filePath) return

  const { error } = await supabaseAdmin.storage
    .from(CLAIM_RESOURCE_LIBRARY_BUCKET)
    .remove([filePath])

  if (error) {
    console.error('Failed to remove claim library file.', error)
  }
}
