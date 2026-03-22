import {
  MATERIAL_ORDER_STATUS_OPTIONS,
  isMaterialOrderStatus,
  type MaterialOrderStatus,
} from '@/lib/material-orders'

export type MaterialOrderItemWriteInput = {
  item_name: string
  unit: string | null
  quantity: number
  notes: string | null
  sort_order: number
  options: Array<{
    option_group: string
    option_value: string
    sort_order: number
    is_selected: boolean
  }>
}

export type MaterialTemplateItemWriteInput = {
  item_name: string
  unit: string | null
  default_quantity: number
  notes: string | null
  sort_order: number
  options: Array<{
    option_group: string
    option_value: string
    sort_order: number
    is_default: boolean
  }>
}

export type MaterialOrderMutationInput = {
  jobId: string
  templateId: string | null
  vendorId: string | null
  status: MaterialOrderStatus
  vendorName: string | null
  vendorContactName: string | null
  vendorPhone: string | null
  vendorEmail: string | null
  shipToName: string | null
  shipToAddress: string | null
  neededBy: string | null
  orderedAt: string | null
  internalNotes: string | null
  supplierNotes: string | null
  items: MaterialOrderItemWriteInput[]
  markGeneratedInternal: boolean
  markGeneratedSupplier: boolean
}

export type MaterialTemplateMutationInput = {
  name: string
  category: string | null
  description: string | null
  isActive: boolean
  items: MaterialTemplateItemWriteInput[]
}

export type VendorMutationInput = {
  name: string
  contactName: string | null
  phone: string | null
  email: string | null
  orderingNotes: string | null
  isActive: boolean
}

export function normalizeText(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function normalizeRequiredId(value: unknown, fieldLabel: string) {
  const normalized = normalizeText(value)

  if (!normalized) {
    throw new Error(`${fieldLabel} is required.`)
  }

  return normalized
}

export function normalizeOptionalId(value: unknown) {
  return normalizeText(value)
}

export function normalizeDate(value: unknown) {
  const normalized = normalizeText(value)

  if (!normalized) {
    return null
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error('One of the dates is invalid.')
  }

  return normalized
}

export function normalizeDateTime(value: unknown) {
  const normalized = normalizeText(value)

  if (!normalized) {
    return null
  }

  const parsed = new Date(normalized)

  if (Number.isNaN(parsed.getTime())) {
    throw new Error('One of the timestamps is invalid.')
  }

  return parsed.toISOString()
}

export function normalizeBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  return fallback
}

export function normalizeNumber(value: unknown, fieldLabel: string, fallback = 0) {
  if (value === null || value === undefined || value === '') {
    return fallback
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldLabel} is invalid.`)
  }

  return parsed
}

function normalizeOrderItemOptions(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((option, index) => {
      const optionGroup = normalizeText(option?.optionGroup ?? option?.option_group)
      const optionValue = normalizeText(option?.optionValue ?? option?.option_value)

      if (!optionGroup || !optionValue) {
        return null
      }

      return {
        option_group: optionGroup,
        option_value: optionValue,
        sort_order: normalizeNumber(
          option?.sortOrder ?? option?.sort_order,
          'Item option sort order',
          index
        ),
        is_selected: normalizeBoolean(
          option?.isSelected ?? option?.is_selected,
          false
        ),
      }
    })
    .filter(
      (
        option
      ): option is {
        option_group: string
        option_value: string
        sort_order: number
        is_selected: boolean
      } => Boolean(option)
    )
}

function normalizeTemplateItemOptions(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((option, index) => {
      const optionGroup = normalizeText(option?.optionGroup ?? option?.option_group)
      const optionValue = normalizeText(option?.optionValue ?? option?.option_value)

      if (!optionGroup || !optionValue) {
        return null
      }

      return {
        option_group: optionGroup,
        option_value: optionValue,
        sort_order: normalizeNumber(
          option?.sortOrder ?? option?.sort_order,
          'Template option sort order',
          index
        ),
        is_default: normalizeBoolean(
          option?.isDefault ?? option?.is_default,
          false
        ),
      }
    })
    .filter(
      (
        option
      ): option is {
        option_group: string
        option_value: string
        sort_order: number
        is_default: boolean
      } => Boolean(option)
    )
}

export function normalizeMaterialOrderItems(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item, index) => {
      const itemName = normalizeText(item?.itemName ?? item?.item_name)

      if (!itemName) {
        return null
      }

      return {
        item_name: itemName,
        unit: normalizeText(item?.unit),
        quantity: normalizeNumber(item?.quantity, `${itemName} quantity`, 0),
        notes: normalizeText(item?.notes),
        sort_order: normalizeNumber(item?.sortOrder ?? item?.sort_order, 'Item sort order', index),
        options: normalizeOrderItemOptions(item?.options),
      }
    })
    .filter((item): item is MaterialOrderItemWriteInput => Boolean(item))
}

export function normalizeMaterialTemplateItems(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item, index) => {
      const itemName = normalizeText(item?.itemName ?? item?.item_name)

      if (!itemName) {
        return null
      }

      return {
        item_name: itemName,
        unit: normalizeText(item?.unit),
        default_quantity: normalizeNumber(
          item?.defaultQuantity ?? item?.default_quantity,
          `${itemName} default quantity`,
          0
        ),
        notes: normalizeText(item?.notes),
        sort_order: normalizeNumber(
          item?.sortOrder ?? item?.sort_order,
          'Template item sort order',
          index
        ),
        options: normalizeTemplateItemOptions(item?.options),
      }
    })
    .filter((item): item is MaterialTemplateItemWriteInput => Boolean(item))
}

export function normalizeMaterialOrderMutationBody(
  body: Record<string, unknown>
): MaterialOrderMutationInput {
  const statusValue = normalizeText(body.status) ?? 'draft'

  if (!isMaterialOrderStatus(statusValue)) {
    throw new Error(
      `Status is invalid. Expected one of: ${MATERIAL_ORDER_STATUS_OPTIONS.join(', ')}.`
    )
  }

  return {
    jobId: normalizeRequiredId(body.jobId ?? body.job_id, 'Job'),
    templateId: normalizeOptionalId(body.templateId ?? body.template_id),
    vendorId: normalizeOptionalId(body.vendorId ?? body.vendor_id),
    status: statusValue,
    vendorName: normalizeText(body.vendorName ?? body.vendor_name),
    vendorContactName: normalizeText(
      body.vendorContactName ?? body.vendor_contact_name
    ),
    vendorPhone: normalizeText(body.vendorPhone ?? body.vendor_phone),
    vendorEmail: normalizeText(body.vendorEmail ?? body.vendor_email),
    shipToName: normalizeText(body.shipToName ?? body.ship_to_name),
    shipToAddress: normalizeText(body.shipToAddress ?? body.ship_to_address),
    neededBy: normalizeDate(body.neededBy ?? body.needed_by),
    orderedAt: normalizeDateTime(body.orderedAt ?? body.ordered_at),
    internalNotes: normalizeText(body.internalNotes ?? body.internal_notes),
    supplierNotes: normalizeText(body.supplierNotes ?? body.supplier_notes),
    items: normalizeMaterialOrderItems(body.items),
    markGeneratedInternal: normalizeBoolean(
      body.markGeneratedInternal ?? body.mark_generated_internal
    ),
    markGeneratedSupplier: normalizeBoolean(
      body.markGeneratedSupplier ?? body.mark_generated_supplier
    ),
  }
}

export function normalizeMaterialTemplateMutationBody(
  body: Record<string, unknown>
): MaterialTemplateMutationInput {
  const name = normalizeText(body.name)

  if (!name) {
    throw new Error('Template name is required.')
  }

  return {
    name,
    category: normalizeText(body.category),
    description: normalizeText(body.description),
    isActive: normalizeBoolean(body.isActive ?? body.is_active, true),
    items: normalizeMaterialTemplateItems(body.items),
  }
}

export function normalizeVendorMutationBody(
  body: Record<string, unknown>
): VendorMutationInput {
  const name = normalizeText(body.name)

  if (!name) {
    throw new Error('Vendor name is required.')
  }

  return {
    name,
    contactName: normalizeText(body.contactName ?? body.contact_name),
    phone: normalizeText(body.phone),
    email: normalizeText(body.email),
    orderingNotes: normalizeText(body.orderingNotes ?? body.ordering_notes),
    isActive: normalizeBoolean(body.isActive ?? body.is_active, true),
  }
}

