'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  BookOpenText,
  Eye,
  EyeOff,
  FileImage,
  FileText,
  FolderPlus,
  FolderTree,
  Link2,
  MonitorPlay,
  PencilLine,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { authorizedFetch } from '@/lib/api-client'
import {
  countResourcesByType,
  formatClaimResourceTypeLabel,
  getClaimCategoryBreadcrumb,
  getClaimCategoryById,
  getClaimCategoryChildren,
  getDescendantCategoryIds,
  type ClaimResourceCategoryRow,
  type ClaimResourceItemRow,
  type ClaimResourceType,
} from '@/lib/claim-resource-library'

type ClaimResourceLibraryScreenProps = {
  focusCategoryId?: string | null
}

type LibraryResponse = {
  categories?: ClaimResourceCategoryRow[]
  resources?: ClaimResourceItemRow[]
  canManage?: boolean
  error?: string
}

type CategoryDraft = {
  id: string | null
  name: string
  description: string
  parent_id: string
  sort_order: string
  is_active: boolean
}

type ResourceDraft = {
  id: string | null
  category_id: string
  title: string
  description: string
  resource_type: ClaimResourceType
  external_url: string
  thumbnail_url: string
  sort_order: string
  is_active: boolean
  file: File | null
  remove_existing_file: boolean
  has_existing_file: boolean
}

const PANEL_CLASS_NAME =
  'rounded-[2rem] border border-white/10 bg-[#0b0f16]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]'

const FIELD_CLASS_NAME =
  'w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d6b37a]/35'

const PRIMARY_BUTTON_CLASS_NAME =
  'rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85] disabled:cursor-not-allowed disabled:opacity-45'

const SECONDARY_BUTTON_CLASS_NAME =
  'rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-45'

const DANGER_BUTTON_CLASS_NAME =
  'rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/18 disabled:cursor-not-allowed disabled:opacity-45'

const CATEGORY_HIDE_STORAGE_KEY = 'claim-resource-library-hidden-root-categories'

const RESOURCE_TYPE_META: Record<
  ClaimResourceType,
  {
    icon: typeof FileText
    viewLabel: string
  }
> = {
  document: {
    icon: FileText,
    viewLabel: 'Open',
  },
  video: {
    icon: MonitorPlay,
    viewLabel: 'Watch',
  },
  photo: {
    icon: FileImage,
    viewLabel: 'View',
  },
}

function buildEmptyCategoryDraft(parentId?: string | null): CategoryDraft {
  return {
    id: null,
    name: '',
    description: '',
    parent_id: parentId ?? '',
    sort_order: '0',
    is_active: true,
  }
}

function buildEmptyResourceDraft(categoryId?: string | null): ResourceDraft {
  return {
    id: null,
    category_id: categoryId ?? '',
    title: '',
    description: '',
    resource_type: 'document',
    external_url: '',
    thumbnail_url: '',
    sort_order: '0',
    is_active: true,
    file: null,
    remove_existing_file: false,
    has_existing_file: false,
  }
}

function LabeledField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
        {label}
      </div>
      {children}
    </label>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function ClaimResourceLibraryScreen({
  focusCategoryId = null,
}: ClaimResourceLibraryScreenProps) {
  return (
    <ProtectedRoute>
      <ClaimResourceLibraryScreenContent
        key={focusCategoryId ?? 'claim-resource-library-root'}
        focusCategoryId={focusCategoryId}
      />
    </ProtectedRoute>
  )
}

function ClaimResourceLibraryScreenContent({
  focusCategoryId,
}: ClaimResourceLibraryScreenProps) {
  const [categories, setCategories] = useState<ClaimResourceCategoryRow[]>([])
  const [resources, setResources] = useState<ClaimResourceItemRow[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingCategory, setSavingCategory] = useState(false)
  const [savingResource, setSavingResource] = useState(false)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')
  const [hiddenRootCategoryIds, setHiddenRootCategoryIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') {
      return []
    }

    try {
      const raw = window.localStorage.getItem(CATEGORY_HIDE_STORAGE_KEY)
      if (!raw) {
        return []
      }

      const parsed = JSON.parse(raw)
      return Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === 'string')
        : []
    } catch (error) {
      console.error('Could not restore hidden categories.', error)
      return []
    }
  })
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>(
    buildEmptyCategoryDraft(focusCategoryId)
  )
  const [resourceDraft, setResourceDraft] = useState<ResourceDraft>(
    buildEmptyResourceDraft(focusCategoryId)
  )

  async function loadLibrary() {
    setLoading(true)
    setMessage('')

    const response = await authorizedFetch('/api/claim-resource-library', {
      cache: 'no-store',
    })
    const result = (await response.json().catch(() => null)) as
      | LibraryResponse
      | null

    if (!response.ok) {
      setMessageType('error')
      setMessage(result?.error || 'Could not load the claim resource library.')
      setLoading(false)
      return
    }

    setCategories(result?.categories ?? [])
    setResources(result?.resources ?? [])
    setCanManage(Boolean(result?.canManage))
    setLoading(false)
  }

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadLibrary()
    }, 0)

    return () => {
      window.clearTimeout(loadTimer)
    }
  }, [])

  useEffect(() => {
    if (focusCategoryId) return
    window.localStorage.setItem(
      CATEGORY_HIDE_STORAGE_KEY,
      JSON.stringify(hiddenRootCategoryIds)
    )
  }, [focusCategoryId, hiddenRootCategoryIds])

  const focusCategory = useMemo(
    () => (focusCategoryId ? getClaimCategoryById(categories, focusCategoryId) : null),
    [categories, focusCategoryId]
  )

  const breadcrumb = useMemo(
    () => (focusCategoryId ? getClaimCategoryBreadcrumb(categories, focusCategoryId) : []),
    [categories, focusCategoryId]
  )

  const descendantCategoryIds = useMemo(
    () => (focusCategoryId ? getDescendantCategoryIds(categories, focusCategoryId) : null),
    [categories, focusCategoryId]
  )

  const topLevelCategories = useMemo(
    () => getClaimCategoryChildren(categories, null),
    [categories]
  )

  const visibleTopLevelCategories = useMemo(
    () =>
      topLevelCategories.filter((category) => !hiddenRootCategoryIds.includes(category.id)),
    [hiddenRootCategoryIds, topLevelCategories]
  )

  const hiddenTopLevelCategories = useMemo(
    () =>
      topLevelCategories.filter((category) => hiddenRootCategoryIds.includes(category.id)),
    [hiddenRootCategoryIds, topLevelCategories]
  )

  const childCategories = useMemo(
    () =>
      focusCategoryId
        ? getClaimCategoryChildren(categories, focusCategoryId)
        : visibleTopLevelCategories,
    [categories, focusCategoryId, visibleTopLevelCategories]
  )

  const visibleResources = useMemo(() => {
    if (!focusCategoryId || !descendantCategoryIds) {
      return [] as ClaimResourceItemRow[]
    }

    return resources.filter((resource) => descendantCategoryIds.has(resource.category_id))
  }, [descendantCategoryIds, focusCategoryId, resources])

  const groupedResources = useMemo(() => {
    return {
      document: visibleResources.filter((resource) => resource.resource_type === 'document'),
      video: visibleResources.filter((resource) => resource.resource_type === 'video'),
      photo: visibleResources.filter((resource) => resource.resource_type === 'photo'),
    } satisfies Record<ClaimResourceType, ClaimResourceItemRow[]>
  }, [visibleResources])

  const categoryMetrics = useMemo(() => {
    return new Map(
      categories.map((category) => {
        const categoryIds = getDescendantCategoryIds(categories, category.id)
        const categoryResources = resources.filter((resource) =>
          categoryIds.has(resource.category_id)
        )

        return [
          category.id,
          {
            total: categoryResources.length,
            childCount: categories.filter((child) => child.parent_id === category.id).length,
            counts: countResourcesByType(categoryResources),
          },
        ] as const
      })
    )
  }, [categories, resources])

  const categoryOptions = useMemo(
    () =>
      categories
        .filter((category) => {
          if (!categoryDraft.id) return true
          if (category.id === categoryDraft.id) return false

          const blockedIds = getDescendantCategoryIds(categories, categoryDraft.id)
          return !blockedIds.has(category.id)
        })
        .map((category) => ({
          value: category.id,
          label: focusCategoryId
            ? `${category.name}${category.parent_id === focusCategoryId ? ' (child)' : ''}`
            : category.name,
        })),
    [categories, categoryDraft.id, focusCategoryId]
  )

  const currentCategoryNameMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  )

  function resetCategoryDraft(nextParentId?: string | null) {
    setCategoryDraft(buildEmptyCategoryDraft(nextParentId ?? focusCategoryId))
  }

  function resetResourceDraft(nextCategoryId?: string | null) {
    setResourceDraft(buildEmptyResourceDraft(nextCategoryId ?? focusCategoryId))
  }

  function toggleRootCategoryHidden(categoryId: string) {
    setHiddenRootCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((value) => value !== categoryId)
        : [...current, categoryId]
    )
  }

  function startEditingCategory(category: ClaimResourceCategoryRow) {
    setCategoryDraft({
      id: category.id,
      name: category.name,
      description: category.description ?? '',
      parent_id: category.parent_id ?? '',
      sort_order: String(category.sort_order),
      is_active: category.is_active,
    })
  }

  function startEditingResource(resource: ClaimResourceItemRow) {
    setResourceDraft({
      id: resource.id,
      category_id: resource.category_id,
      title: resource.title,
      description: resource.description ?? '',
      resource_type: resource.resource_type,
      external_url: resource.external_url ?? '',
      thumbnail_url: resource.thumbnail_url ?? '',
      sort_order: String(resource.sort_order),
      is_active: resource.is_active,
      file: null,
      remove_existing_file: false,
      has_existing_file: Boolean(resource.file_path),
    })
  }

  async function saveCategory() {
    setSavingCategory(true)
    setMessage('')

    const response = await authorizedFetch(
      categoryDraft.id
        ? `/api/claim-resource-library/categories/${categoryDraft.id}`
        : '/api/claim-resource-library/categories',
      {
        method: categoryDraft.id ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(categoryDraft),
      }
    )

    const result = (await response.json().catch(() => null)) as
      | {
          error?: string
        }
      | null

    if (!response.ok) {
      setMessageType('error')
      setMessage(result?.error || 'Could not save the category.')
      setSavingCategory(false)
      return
    }

    setMessageType('success')
    setMessage(categoryDraft.id ? 'Category updated.' : 'Category created.')
    resetCategoryDraft()
    setSavingCategory(false)
    await loadLibrary()
  }

  async function saveResource() {
    setSavingResource(true)
    setMessage('')

    const formData = new FormData()
    formData.set('category_id', resourceDraft.category_id)
    formData.set('title', resourceDraft.title)
    formData.set('description', resourceDraft.description)
    formData.set('resource_type', resourceDraft.resource_type)
    formData.set('external_url', resourceDraft.external_url)
    formData.set('thumbnail_url', resourceDraft.thumbnail_url)
    formData.set('sort_order', resourceDraft.sort_order)
    formData.set('is_active', String(resourceDraft.is_active))
    formData.set('remove_existing_file', String(resourceDraft.remove_existing_file))

    if (resourceDraft.file) {
      formData.set('file', resourceDraft.file)
    }

    const response = await authorizedFetch(
      resourceDraft.id
        ? `/api/claim-resource-library/resources/${resourceDraft.id}`
        : '/api/claim-resource-library/resources',
      {
        method: resourceDraft.id ? 'PATCH' : 'POST',
        body: formData,
      }
    )

    const result = (await response.json().catch(() => null)) as
      | {
          error?: string
        }
      | null

    if (!response.ok) {
      setMessageType('error')
      setMessage(result?.error || 'Could not save the resource.')
      setSavingResource(false)
      return
    }

    setMessageType('success')
    setMessage(resourceDraft.id ? 'Resource updated.' : 'Resource created.')
    resetResourceDraft(resourceDraft.category_id)
    setSavingResource(false)
    await loadLibrary()
  }

  async function deleteCategory(category: ClaimResourceCategoryRow) {
    const confirmed = window.confirm(
      `Delete ${category.name}? Any child categories and resources under it will also be removed.`
    )

    if (!confirmed) {
      return
    }

    setDeletingKey(`category:${category.id}`)
    setMessage('')

    const response = await authorizedFetch(
      `/api/claim-resource-library/categories/${category.id}`,
      {
        method: 'DELETE',
      }
    )
    const result = (await response.json().catch(() => null)) as
      | {
          error?: string
        }
      | null

    if (!response.ok) {
      setMessageType('error')
      setMessage(result?.error || 'Could not delete the category.')
      setDeletingKey(null)
      return
    }

    setMessageType('success')
    setMessage('Category deleted.')
    setDeletingKey(null)
    await loadLibrary()
  }

  async function deleteResource(resource: ClaimResourceItemRow) {
    const confirmed = window.confirm(`Delete ${resource.title}?`)

    if (!confirmed) {
      return
    }

    setDeletingKey(`resource:${resource.id}`)
    setMessage('')

    const response = await authorizedFetch(
      `/api/claim-resource-library/resources/${resource.id}`,
      {
        method: 'DELETE',
      }
    )
    const result = (await response.json().catch(() => null)) as
      | {
          error?: string
        }
      | null

    if (!response.ok) {
      setMessageType('error')
      setMessage(result?.error || 'Could not delete the resource.')
      setDeletingKey(null)
      return
    }

    setMessageType('success')
    setMessage('Resource deleted.')
    setDeletingKey(null)
    await loadLibrary()
  }

  const heroTitle = focusCategory ? focusCategory.name : 'Claim Resource Library'
  const heroBody = focusCategory
    ? focusCategory.description || 'Browse the resources stored in this claim category.'
    : 'Open claim documents, videos, and photos organized by category and subcategory.'

  return (
    <main className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_25px_90px_rgba(0,0,0,0.35)] backdrop-blur-2xl md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.06),transparent_24%)]" />
        <div className="relative space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d6b37a]">
                Claims
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-5xl">
                {heroTitle}
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-white/68 md:text-lg">
                {heroBody}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {focusCategory ? (
                <Link href="/claim-resource-library" className={SECONDARY_BUTTON_CLASS_NAME}>
                  Back to Library
                </Link>
              ) : null}
              <Link href="/" className={PRIMARY_BUTTON_CLASS_NAME}>
                Home
              </Link>
            </div>
          </div>

          {breadcrumb.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-white/55">
              <Link href="/claim-resource-library" className="transition hover:text-white">
                Library
              </Link>
              {breadcrumb.map((category) => (
                <span key={category.id} className="flex items-center gap-2">
                  <span>/</span>
                  <span className="text-white/78">{category.name}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {message ? (
        <section
          className={`rounded-[1.5rem] border p-4 text-sm shadow-[0_20px_60px_rgba(0,0,0,0.22)] ${
            messageType === 'error'
              ? 'border-red-400/20 bg-red-500/10 text-red-100'
              : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
          }`}
        >
          {message}
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-6">
          <section className={PANEL_CLASS_NAME}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/82">
                  Category Browser
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {focusCategory ? 'Subcategories' : 'Top-Level Categories'}
                </h2>
              </div>

              {!focusCategory && hiddenTopLevelCategories.length > 0 ? (
                <div className="text-sm text-white/55">
                  {hiddenTopLevelCategories.length} hidden locally
                </div>
              ) : null}
            </div>

            {loading ? (
              <div className="mt-5 text-sm text-white/60">Loading library...</div>
            ) : childCategories.length === 0 ? (
              <div className="mt-5 rounded-[1.4rem] border border-dashed border-white/15 p-5 text-sm text-white/55">
                {focusCategory
                  ? 'No subcategories under this section yet.'
                  : 'No categories created yet.'}
              </div>
            ) : (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {childCategories.map((category) => {
                  const metrics = categoryMetrics.get(category.id)

                  return (
                    <div
                      key={category.id}
                      className="rounded-[1.6rem] border border-white/10 bg-black/20 p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-lg font-semibold text-white">{category.name}</div>
                          <div className="mt-1 text-sm text-white/55">
                            {category.description || 'No description added yet.'}
                          </div>
                        </div>

                        {!focusCategory ? (
                          <button
                            type="button"
                            onClick={() => toggleRootCategoryHidden(category.id)}
                            className="rounded-full border border-white/10 bg-white/[0.05] p-2 text-white/70 transition hover:bg-white/[0.08]"
                            title="Hide from this view"
                          >
                            <EyeOff className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <MetricPill label="Resources" value={String(metrics?.total ?? 0)} />
                        <MetricPill label="Subcategories" value={String(metrics?.childCount ?? 0)} />
                        <MetricPill
                          label="Docs / Videos / Photos"
                          value={`${metrics?.counts.document ?? 0} / ${metrics?.counts.video ?? 0} / ${metrics?.counts.photo ?? 0}`}
                        />
                        <MetricPill
                          label="Status"
                          value={category.is_active ? 'Live' : 'Hidden'}
                        />
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        <Link
                          href={`/claim-resource-library/${category.id}`}
                          className={SECONDARY_BUTTON_CLASS_NAME}
                        >
                          Open Category
                        </Link>

                        {canManage ? (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditingCategory(category)}
                              className={SECONDARY_BUTTON_CLASS_NAME}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteCategory(category)}
                              disabled={deletingKey === `category:${category.id}`}
                              className={DANGER_BUTTON_CLASS_NAME}
                            >
                              Delete
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {!focusCategory && hiddenTopLevelCategories.length > 0 ? (
              <div className="mt-6 rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Eye className="h-4 w-4 text-[#d6b37a]" />
                  Hidden Categories
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {hiddenTopLevelCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => toggleRootCategoryHidden(category.id)}
                      className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/75 transition hover:bg-white/[0.08]"
                    >
                      Show {category.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          {focusCategory ? (
            <section className={PANEL_CLASS_NAME}>
              <div className="flex items-center gap-3">
                <FolderTree className="h-5 w-5 text-[#d6b37a]" />
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/82">
                    Resources
                  </div>
                  <h2 className="mt-1 text-2xl font-semibold text-white">
                    Category Assets
                  </h2>
                </div>
              </div>

              <div className="mt-6 space-y-6">
                {(Object.keys(groupedResources) as ClaimResourceType[]).map((resourceType) => (
                  <div key={resourceType} className="space-y-4">
                    <div className="flex items-center gap-2">
                      {resourceType === 'document' ? (
                        <FileText className="h-4 w-4 text-[#d6b37a]" />
                      ) : resourceType === 'video' ? (
                        <MonitorPlay className="h-4 w-4 text-[#d6b37a]" />
                      ) : (
                        <FileImage className="h-4 w-4 text-[#d6b37a]" />
                      )}
                      <h3 className="text-lg font-semibold text-white">
                        {formatClaimResourceTypeLabel(resourceType)}
                      </h3>
                    </div>

                    {groupedResources[resourceType].length === 0 ? (
                      <div className="rounded-[1.4rem] border border-dashed border-white/15 p-4 text-sm text-white/55">
                        No {formatClaimResourceTypeLabel(resourceType).toLowerCase()} in this section yet.
                      </div>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2">
                        {groupedResources[resourceType].map((resource) => (
                          <ResourceCard
                            key={resource.id}
                            resource={resource}
                            categoryName={currentCategoryNameMap.get(resource.category_id) ?? 'Unknown Category'}
                            canManage={canManage}
                            onEdit={() => startEditingResource(resource)}
                            onDelete={() => void deleteResource(resource)}
                            deleting={deletingKey === `resource:${resource.id}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </section>

        <aside className="space-y-6">
          {canManage ? (
            <>
              <section className={PANEL_CLASS_NAME}>
                <div className="flex items-center gap-3">
                  <FolderPlus className="h-5 w-5 text-[#d6b37a]" />
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/82">
                      Manager Tools
                    </div>
                    <h2 className="mt-1 text-xl font-semibold text-white">
                      {categoryDraft.id ? 'Edit Category' : 'Add Category'}
                    </h2>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <LabeledField label="Category Name">
                    <input
                      value={categoryDraft.name}
                      onChange={(event) =>
                        setCategoryDraft((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      className={FIELD_CLASS_NAME}
                    />
                  </LabeledField>

                  <LabeledField label="Description">
                    <textarea
                      value={categoryDraft.description}
                      onChange={(event) =>
                        setCategoryDraft((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      rows={4}
                      className={FIELD_CLASS_NAME}
                    />
                  </LabeledField>

                  <LabeledField label="Parent Category">
                    <select
                      value={categoryDraft.parent_id}
                      onChange={(event) =>
                        setCategoryDraft((current) => ({
                          ...current,
                          parent_id: event.target.value,
                        }))
                      }
                      className={FIELD_CLASS_NAME}
                    >
                      <option value="">Top Level</option>
                      {categoryOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </LabeledField>

                  <LabeledField label="Sort Order">
                    <input
                      type="number"
                      value={categoryDraft.sort_order}
                      onChange={(event) =>
                        setCategoryDraft((current) => ({
                          ...current,
                          sort_order: event.target.value,
                        }))
                      }
                      className={FIELD_CLASS_NAME}
                    />
                  </LabeledField>

                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={categoryDraft.is_active}
                      onChange={(event) =>
                        setCategoryDraft((current) => ({
                          ...current,
                          is_active: event.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-white/20 bg-black/30 text-[#d6b37a] focus:ring-[#d6b37a]/40"
                    />
                    <span>Visible to reps</span>
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void saveCategory()}
                      disabled={savingCategory}
                      className={PRIMARY_BUTTON_CLASS_NAME}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Save className="h-4 w-4" />
                        {savingCategory ? 'Saving...' : categoryDraft.id ? 'Save Category' : 'Create Category'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => resetCategoryDraft()}
                      className={SECONDARY_BUTTON_CLASS_NAME}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </section>

              <section className={PANEL_CLASS_NAME}>
                <div className="flex items-center gap-3">
                  <Plus className="h-5 w-5 text-[#d6b37a]" />
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/82">
                      Resources
                    </div>
                    <h2 className="mt-1 text-xl font-semibold text-white">
                      {resourceDraft.id ? 'Edit Resource' : 'Add Resource'}
                    </h2>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <LabeledField label="Title">
                    <input
                      value={resourceDraft.title}
                      onChange={(event) =>
                        setResourceDraft((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      className={FIELD_CLASS_NAME}
                    />
                  </LabeledField>

                  <LabeledField label="Category">
                    <select
                      value={resourceDraft.category_id}
                      onChange={(event) =>
                        setResourceDraft((current) => ({
                          ...current,
                          category_id: event.target.value,
                        }))
                      }
                      className={FIELD_CLASS_NAME}
                    >
                      <option value="">Choose category</option>
                      {categoryOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </LabeledField>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <LabeledField label="Type">
                      <select
                        value={resourceDraft.resource_type}
                        onChange={(event) =>
                          setResourceDraft((current) => ({
                            ...current,
                            resource_type: event.target.value as ClaimResourceType,
                          }))
                        }
                        className={FIELD_CLASS_NAME}
                      >
                        <option value="document">Document</option>
                        <option value="video">Video</option>
                        <option value="photo">Photo</option>
                      </select>
                    </LabeledField>

                    <LabeledField label="Sort Order">
                      <input
                        type="number"
                        value={resourceDraft.sort_order}
                        onChange={(event) =>
                          setResourceDraft((current) => ({
                            ...current,
                            sort_order: event.target.value,
                          }))
                        }
                        className={FIELD_CLASS_NAME}
                      />
                    </LabeledField>
                  </div>

                  <LabeledField label="Description">
                    <textarea
                      value={resourceDraft.description}
                      onChange={(event) =>
                        setResourceDraft((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      rows={4}
                      className={FIELD_CLASS_NAME}
                    />
                  </LabeledField>

                  <LabeledField label="External URL">
                    <input
                      value={resourceDraft.external_url}
                      onChange={(event) =>
                        setResourceDraft((current) => ({
                          ...current,
                          external_url: event.target.value,
                        }))
                      }
                      placeholder="Use for videos or linked resources"
                      className={FIELD_CLASS_NAME}
                    />
                  </LabeledField>

                  <LabeledField label="Thumbnail URL (optional)">
                    <input
                      value={resourceDraft.thumbnail_url}
                      onChange={(event) =>
                        setResourceDraft((current) => ({
                          ...current,
                          thumbnail_url: event.target.value,
                        }))
                      }
                      className={FIELD_CLASS_NAME}
                    />
                  </LabeledField>

                  <LabeledField label="Upload File">
                    <input
                      type="file"
                      onChange={(event) =>
                        setResourceDraft((current) => ({
                          ...current,
                          file: event.target.files?.[0] ?? null,
                        }))
                      }
                      className={FIELD_CLASS_NAME}
                    />
                  </LabeledField>

                  {resourceDraft.has_existing_file ? (
                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80">
                      <input
                        type="checkbox"
                        checked={resourceDraft.remove_existing_file}
                        onChange={(event) =>
                          setResourceDraft((current) => ({
                            ...current,
                            remove_existing_file: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-white/20 bg-black/30 text-[#d6b37a] focus:ring-[#d6b37a]/40"
                      />
                      <span>Remove existing uploaded file and use the URL instead</span>
                    </label>
                  ) : null}

                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={resourceDraft.is_active}
                      onChange={(event) =>
                        setResourceDraft((current) => ({
                          ...current,
                          is_active: event.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-white/20 bg-black/30 text-[#d6b37a] focus:ring-[#d6b37a]/40"
                    />
                    <span>Visible to reps</span>
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void saveResource()}
                      disabled={savingResource}
                      className={PRIMARY_BUTTON_CLASS_NAME}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Save className="h-4 w-4" />
                        {savingResource ? 'Saving...' : resourceDraft.id ? 'Save Resource' : 'Create Resource'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => resetResourceDraft()}
                      className={SECONDARY_BUTTON_CLASS_NAME}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <section className={PANEL_CLASS_NAME}>
              <div className="flex items-start gap-3">
                <BookOpenText className="mt-1 h-5 w-5 text-[#d6b37a]" />
                <div>
                  <h2 className="text-lg font-semibold text-white">How To Use This Library</h2>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    Open a category to drill down into subcategories, then use the resource cards to view or download the files you need.
                  </p>
                </div>
              </div>
            </section>
          )}
        </aside>
      </div>
    </main>
  )
}

function MetricPill({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  )
}

function ResourceCard({
  resource,
  categoryName,
  canManage,
  onEdit,
  onDelete,
  deleting,
}: {
  resource: ClaimResourceItemRow
  categoryName: string
  canManage: boolean
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const meta = RESOURCE_TYPE_META[resource.resource_type]
  const Icon = meta.icon

  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d6b37a]/85">
            <Icon className="h-3.5 w-3.5" />
            {resource.resource_type}
          </div>
          <div className="mt-3 text-lg font-semibold text-white">{resource.title}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/42">
            {categoryName}
          </div>
        </div>

        {!resource.is_active ? (
          <div className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100">
            Hidden
          </div>
        ) : null}
      </div>

      <div className="mt-3 text-sm leading-6 text-white/60">
        {resource.description || 'No description added yet.'}
      </div>

      <div className="mt-4 text-xs text-white/42">Updated {formatDate(resource.updated_at)}</div>

      <div className="mt-5 flex flex-wrap gap-3">
        <a
          href={resource.resource_url}
          target="_blank"
          rel="noreferrer"
          className={SECONDARY_BUTTON_CLASS_NAME}
        >
          {meta.viewLabel}
        </a>

        {resource.resource_type !== 'video' ? (
          <a
            href={resource.resource_url}
            download
            className={SECONDARY_BUTTON_CLASS_NAME}
          >
            Download
          </a>
        ) : null}

        {canManage ? (
          <>
            <button type="button" onClick={onEdit} className={SECONDARY_BUTTON_CLASS_NAME}>
              <span className="inline-flex items-center gap-2">
                <PencilLine className="h-4 w-4" />
                Edit
              </span>
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className={DANGER_BUTTON_CLASS_NAME}
            >
              <span className="inline-flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                Delete
              </span>
            </button>
          </>
        ) : null}

        {resource.external_url ? (
          <a
            href={resource.external_url}
            target="_blank"
            rel="noreferrer"
            className={SECONDARY_BUTTON_CLASS_NAME}
          >
            <span className="inline-flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Source Link
            </span>
          </a>
        ) : null}
      </div>
    </div>
  )
}
