import { slugifyFileName } from '@/lib/file-utils'

export type ClaimResourceType = 'document' | 'video' | 'photo'

export type ClaimResourceCategoryRow = {
  id: string
  name: string
  slug: string
  description: string | null
  parent_id: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type ClaimResourceItemRow = {
  id: string
  category_id: string
  title: string
  description: string | null
  resource_type: ClaimResourceType
  resource_url: string
  external_url: string | null
  file_path: string | null
  thumbnail_url: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type ClaimResourceTreeNode = ClaimResourceCategoryRow & {
  children: ClaimResourceTreeNode[]
  resources: ClaimResourceItemRow[]
}

export function createCategorySlug(value: string) {
  return slugifyFileName(value.toLowerCase().replace(/\s+/g, '-'))
}

export function formatClaimResourceTypeLabel(value: ClaimResourceType) {
  if (value === 'document') return 'Documents'
  if (value === 'video') return 'Videos'
  return 'Photos'
}

export function buildClaimResourceTree(
  categories: ClaimResourceCategoryRow[],
  resources: ClaimResourceItemRow[]
) {
  const nodeMap = new Map<string, ClaimResourceTreeNode>()

  categories.forEach((category) => {
    nodeMap.set(category.id, {
      ...category,
      children: [],
      resources: resources
        .filter((resource) => resource.category_id === category.id)
        .sort((left, right) => left.sort_order - right.sort_order || left.title.localeCompare(right.title)),
    })
  })

  const roots: ClaimResourceTreeNode[] = []

  categories
    .slice()
    .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name))
    .forEach((category) => {
      const node = nodeMap.get(category.id)
      if (!node) return

      if (category.parent_id) {
        const parentNode = nodeMap.get(category.parent_id)
        if (parentNode) {
          parentNode.children.push(node)
          return
        }
      }

      roots.push(node)
    })

  return roots
}

export function getClaimCategoryById(
  categories: ClaimResourceCategoryRow[],
  categoryId: string
) {
  return categories.find((category) => category.id === categoryId) ?? null
}

export function getClaimCategoryChildren(
  categories: ClaimResourceCategoryRow[],
  parentId: string | null
) {
  return categories
    .filter((category) => category.parent_id === parentId)
    .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name))
}

export function getClaimCategoryBreadcrumb(
  categories: ClaimResourceCategoryRow[],
  categoryId: string
) {
  const categoryMap = new Map(categories.map((category) => [category.id, category]))
  const breadcrumb: ClaimResourceCategoryRow[] = []
  let currentId: string | null = categoryId

  while (currentId) {
    const current = categoryMap.get(currentId)
    if (!current) break
    breadcrumb.unshift(current)
    currentId = current.parent_id
  }

  return breadcrumb
}

export function getDescendantCategoryIds(
  categories: ClaimResourceCategoryRow[],
  rootCategoryId: string
) {
  const ids = new Set<string>([rootCategoryId])
  let changed = true

  while (changed) {
    changed = false

    categories.forEach((category) => {
      if (category.parent_id && ids.has(category.parent_id) && !ids.has(category.id)) {
        ids.add(category.id)
        changed = true
      }
    })
  }

  return ids
}

export function countResourcesByType(resources: ClaimResourceItemRow[]) {
  return resources.reduce(
    (counts, resource) => {
      counts[resource.resource_type] += 1
      return counts
    },
    {
      document: 0,
      video: 0,
      photo: 0,
    } satisfies Record<ClaimResourceType, number>
  )
}
