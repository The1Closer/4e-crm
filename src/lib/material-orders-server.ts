import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import type {
  MaterialJobOption,
  MaterialOrder,
  MaterialOrderItem,
  MaterialOrderItemOption,
  MaterialOrdersDashboardPayload,
  MaterialPresetItem,
  MaterialPresetItemOption,
  MaterialTemplate,
  MaterialTemplateItem,
  MaterialTemplateItemOption,
  MaterialVendor,
} from '@/lib/material-orders'
import { isMaterialOrderStatus } from '@/lib/material-orders'

type MaterialOrderItemWriteInput = {
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

type MaterialTemplateItemWriteInput = {
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

type LooseRow = {
  [key: string]: unknown
}

function isLooseRow(value: unknown): value is LooseRow {
  return typeof value === 'object' && value !== null
}

function asLooseRows(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isLooseRow)
}

function pickFirstRow(value: unknown): LooseRow | null {
  if (Array.isArray(value)) {
    return value.find(isLooseRow) ?? null
  }

  return isLooseRow(value) ? value : null
}

function toStringOrNull(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function toStringValue(value: unknown) {
  return typeof value === 'string' ? value : String(value ?? '')
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function mapJobRow(row: LooseRow): MaterialJobOption {
  const homeowner = pickFirstRow(row.homeowners)
  const stage = pickFirstRow(row.pipeline_stages)

  return {
    id: toStringValue(row.id),
    homeowner_name: toStringOrNull(homeowner?.name) ?? 'Unnamed homeowner',
    address: toStringOrNull(homeowner?.address) ?? 'No address on file',
    install_date: toStringOrNull(row.install_date),
    claim_number: toStringOrNull(row.claim_number),
    stage_name: toStringOrNull(stage?.name),
  }
}

function mapTemplateOptionRow(row: LooseRow): MaterialTemplateItemOption {
  return {
    id: toStringValue(row.id),
    option_group: toStringValue(row.option_group),
    option_value: toStringValue(row.option_value),
    sort_order: toNumber(row.sort_order),
    is_default: Boolean(row.is_default),
  }
}

function mapPresetItemOptionRow(row: LooseRow): MaterialPresetItemOption {
  return {
    id: toStringValue(row.id),
    option_group: toStringValue(row.option_group),
    option_value: toStringValue(row.option_value),
    sort_order: toNumber(row.sort_order),
    is_default: Boolean(row.is_default),
  }
}

function mapTemplateItemRow(row: LooseRow): MaterialTemplateItem {
  return {
    id: toStringValue(row.id),
    sort_order: toNumber(row.sort_order),
    item_name: toStringValue(row.item_name),
    unit: toStringOrNull(row.unit),
    default_quantity: toNumber(row.default_quantity),
    notes: toStringOrNull(row.notes),
    options: asLooseRows(row.material_template_item_options)
      .map(mapTemplateOptionRow)
      .sort((left, right) => {
        if (left.option_group !== right.option_group) {
          return left.option_group.localeCompare(right.option_group)
        }

        if (left.sort_order !== right.sort_order) {
          return left.sort_order - right.sort_order
        }

        return left.option_value.localeCompare(right.option_value)
      }),
  }
}

function mapTemplateRow(row: LooseRow): MaterialTemplate {
  return {
    id: toStringValue(row.id),
    name: toStringValue(row.name),
    category: toStringOrNull(row.category),
    description: toStringOrNull(row.description),
    is_active: Boolean(row.is_active),
    created_at: toStringValue(row.created_at),
    updated_at: toStringValue(row.updated_at),
    items: asLooseRows(row.material_template_items)
      .map(mapTemplateItemRow)
      .sort((left, right) => left.sort_order - right.sort_order),
  }
}

function mapOrderItemOptionRow(row: LooseRow): MaterialOrderItemOption {
  return {
    id: toStringValue(row.id),
    option_group: toStringValue(row.option_group),
    option_value: toStringValue(row.option_value),
    sort_order: toNumber(row.sort_order),
    is_selected: Boolean(row.is_selected),
  }
}

function mapOrderItemRow(row: LooseRow): MaterialOrderItem {
  return {
    id: toStringValue(row.id),
    sort_order: toNumber(row.sort_order),
    item_name: toStringValue(row.item_name),
    unit: toStringOrNull(row.unit),
    quantity: toNumber(row.quantity),
    notes: toStringOrNull(row.notes),
    options: asLooseRows(row.material_order_item_options)
      .map(mapOrderItemOptionRow)
      .sort((left, right) => {
        if (left.option_group !== right.option_group) {
          return left.option_group.localeCompare(right.option_group)
        }

        if (left.sort_order !== right.sort_order) {
          return left.sort_order - right.sort_order
        }

        return left.option_value.localeCompare(right.option_value)
      }),
  }
}

function mapOrderRow(row: LooseRow): MaterialOrder {
  const job = pickFirstRow(row.jobs)
  const statusValue = toStringOrNull(row.status)

  return {
    id: toStringValue(row.id),
    order_number: toStringValue(row.order_number),
    job_id: toStringValue(row.job_id),
    template_id: toStringOrNull(row.template_id),
    vendor_id: toStringOrNull(row.vendor_id),
    status: isMaterialOrderStatus(statusValue) ? statusValue : 'draft',
    vendor_name: toStringOrNull(row.vendor_name),
    vendor_contact_name: toStringOrNull(row.vendor_contact_name),
    vendor_phone: toStringOrNull(row.vendor_phone),
    vendor_email: toStringOrNull(row.vendor_email),
    ship_to_name: toStringOrNull(row.ship_to_name),
    ship_to_address: toStringOrNull(row.ship_to_address),
    needed_by: toStringOrNull(row.needed_by),
    ordered_at: toStringOrNull(row.ordered_at),
    internal_notes: toStringOrNull(row.internal_notes),
    supplier_notes: toStringOrNull(row.supplier_notes),
    generated_internal_at: toStringOrNull(row.generated_internal_at),
    generated_supplier_at: toStringOrNull(row.generated_supplier_at),
    created_at: toStringValue(row.created_at),
    updated_at: toStringValue(row.updated_at),
    job: job ? mapJobRow(job) : null,
    items: asLooseRows(row.material_order_items)
      .map(mapOrderItemRow)
      .sort((left, right) => left.sort_order - right.sort_order),
  }
}

export function buildMaterialOrderNumber() {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = `${now.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${now.getUTCDate()}`.padStart(2, '0')
  const hours = `${now.getUTCHours()}`.padStart(2, '0')
  const minutes = `${now.getUTCMinutes()}`.padStart(2, '0')
  const seconds = `${now.getUTCSeconds()}`.padStart(2, '0')
  const millis = `${now.getUTCMilliseconds()}`.padStart(3, '0')
  const random = `${Math.floor(Math.random() * 900) + 100}`

  return `MO-${year}${month}${day}-${hours}${minutes}${seconds}${millis}-${random}`
}

export async function loadMaterialJobs() {
  const { data, error } = await supabaseAdmin
    .from('jobs')
    .select(`
      id,
      install_date,
      claim_number,
      pipeline_stages (
        name
      ),
      homeowners (
        name,
        address
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return asLooseRows(data)
    .map(mapJobRow)
    .sort((left, right) => left.homeowner_name.localeCompare(right.homeowner_name))
}

export async function loadMaterialVendors() {
  const { data, error } = await supabaseAdmin
    .from('vendors')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return asLooseRows(data).map(
    (row): MaterialVendor => ({
      id: toStringValue(row.id),
      name: toStringValue(row.name),
      contact_name: toStringOrNull(row.contact_name),
      phone: toStringOrNull(row.phone),
      email: toStringOrNull(row.email),
      ordering_notes: toStringOrNull(row.ordering_notes),
      is_active: Boolean(row.is_active),
      created_at: toStringValue(row.created_at),
      updated_at: toStringValue(row.updated_at),
    })
  )
}

export async function loadMaterialTemplates() {
  const { data, error } = await supabaseAdmin.from('material_templates').select(`
      id,
      name,
      category,
      description,
      is_active,
      created_at,
      updated_at,
      material_template_items (
        id,
        sort_order,
        item_name,
        unit,
        default_quantity,
        notes,
        material_template_item_options (
          id,
          option_group,
          option_value,
          sort_order,
          is_default
        )
      )
    `)

  if (error) {
    throw new Error(error.message)
  }

  return asLooseRows(data)
    .map(mapTemplateRow)
    .sort((left, right) => left.name.localeCompare(right.name))
}

export async function loadMaterialPresetItems() {
  const { data, error } = await supabaseAdmin.from('material_preset_items').select(`
      id,
      name,
      unit,
      default_quantity,
      description,
      is_active,
      created_at,
      updated_at,
      material_preset_item_options (
        id,
        option_group,
        option_value,
        sort_order,
        is_default
      )
    `)

  if (error) {
    throw new Error(error.message)
  }

  return asLooseRows(data)
    .map(
      (row): MaterialPresetItem => ({
        id: toStringValue(row.id),
        name: toStringValue(row.name),
        unit: toStringOrNull(row.unit),
        default_quantity: toNumber(row.default_quantity),
        description: toStringOrNull(row.description),
        is_active: Boolean(row.is_active),
        created_at: toStringValue(row.created_at),
        updated_at: toStringValue(row.updated_at),
        options: asLooseRows(row.material_preset_item_options)
          .map(mapPresetItemOptionRow)
          .sort((left, right) => {
            if (left.option_group !== right.option_group) {
              return left.option_group.localeCompare(right.option_group)
            }

            if (left.sort_order !== right.sort_order) {
              return left.sort_order - right.sort_order
            }

            return left.option_value.localeCompare(right.option_value)
          }),
      })
    )
    .sort((left, right) => left.name.localeCompare(right.name))
}

export async function loadMaterialOrders(params?: { jobId?: string | null }) {
  let query = supabaseAdmin.from('material_orders').select(`
      id,
      order_number,
      job_id,
      template_id,
      vendor_id,
      status,
      vendor_name,
      vendor_contact_name,
      vendor_phone,
      vendor_email,
      ship_to_name,
      ship_to_address,
      needed_by,
      ordered_at,
      internal_notes,
      supplier_notes,
      generated_internal_at,
      generated_supplier_at,
      created_at,
      updated_at,
      jobs (
        id,
        install_date,
        claim_number,
        homeowners (
          name,
          address
        )
      ),
      material_order_items (
        id,
        sort_order,
        item_name,
        unit,
        quantity,
        notes,
        material_order_item_options (
          id,
          option_group,
          option_value,
          sort_order,
          is_selected
        )
      )
    `)

  if (params?.jobId) {
    query = query.eq('job_id', params.jobId)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return asLooseRows(data).map(mapOrderRow)
}

export async function loadMaterialOrdersDashboard(params?: {
  jobId?: string | null
}): Promise<MaterialOrdersDashboardPayload> {
  const [orders, templates, vendors, jobs, presetItems] = await Promise.all([
    loadMaterialOrders(params),
    loadMaterialTemplates(),
    loadMaterialVendors(),
    loadMaterialJobs(),
    loadMaterialPresetItems(),
  ])

  return {
    orders,
    templates,
    vendors,
    jobs,
    presetItems,
  }
}

export async function loadMaterialOrderById(orderId: string) {
  const { data, error } = await supabaseAdmin
    .from('material_orders')
    .select(`
      id,
      order_number,
      job_id,
      template_id,
      vendor_id,
      status,
      vendor_name,
      vendor_contact_name,
      vendor_phone,
      vendor_email,
      ship_to_name,
      ship_to_address,
      needed_by,
      ordered_at,
      internal_notes,
      supplier_notes,
      generated_internal_at,
      generated_supplier_at,
      created_at,
      updated_at,
      jobs (
        id,
        install_date,
        claim_number,
        homeowners (
          name,
          address
        )
      ),
      material_order_items (
        id,
        sort_order,
        item_name,
        unit,
        quantity,
        notes,
        material_order_item_options (
          id,
          option_group,
          option_value,
          sort_order,
          is_selected
        )
      )
    `)
    .eq('id', orderId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    return null
  }

  return mapOrderRow(data)
}

export async function loadMaterialJobDefaults(jobId: string) {
  const { data, error } = await supabaseAdmin
    .from('jobs')
    .select(`
      id,
      homeowners (
        name,
        address
      )
    `)
    .eq('id', jobId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    return null
  }

  const homeowner = pickFirstRow(data.homeowners)

  return {
    ship_to_name: toStringOrNull(homeowner?.name),
    ship_to_address: toStringOrNull(homeowner?.address),
  }
}

export async function loadVendorSnapshot(vendorId: string) {
  const { data, error } = await supabaseAdmin
    .from('vendors')
    .select('id, name, contact_name, phone, email')
    .eq('id', vendorId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    return null
  }

  return {
    vendor_id: toStringValue(data.id),
    vendor_name: toStringValue(data.name),
    vendor_contact_name: toStringOrNull(data.contact_name),
    vendor_phone: toStringOrNull(data.phone),
    vendor_email: toStringOrNull(data.email),
  }
}

export async function loadTemplateCloneItems(templateId: string) {
  const { data, error } = await supabaseAdmin
    .from('material_template_items')
    .select(`
      id,
      sort_order,
      item_name,
      unit,
      default_quantity,
      notes,
      material_template_item_options (
        id,
        option_group,
        option_value,
        sort_order,
        is_default
      )
    `)
    .eq('template_id', templateId)

  if (error) {
    throw new Error(error.message)
  }

  return asLooseRows(data)
    .map(mapTemplateItemRow)
    .sort((left, right) => left.sort_order - right.sort_order)
}

export async function replaceMaterialTemplateItems(
  templateId: string,
  items: MaterialTemplateItemWriteInput[]
) {
  const { data: existingItems, error: existingItemsError } = await supabaseAdmin
    .from('material_template_items')
    .select('id')
    .eq('template_id', templateId)

  if (existingItemsError) {
    throw new Error(existingItemsError.message)
  }

  const existingItemIds = (existingItems ?? [])
    .map((row) => row.id)
    .filter((value): value is string => typeof value === 'string')

  if (existingItemIds.length > 0) {
    const { error: deleteOptionsError } = await supabaseAdmin
      .from('material_template_item_options')
      .delete()
      .in('template_item_id', existingItemIds)

    if (deleteOptionsError) {
      throw new Error(deleteOptionsError.message)
    }

    const { error: deleteItemsError } = await supabaseAdmin
      .from('material_template_items')
      .delete()
      .eq('template_id', templateId)

    if (deleteItemsError) {
      throw new Error(deleteItemsError.message)
    }
  }

  for (const item of items) {
    const { data: insertedItem, error: itemError } = await supabaseAdmin
      .from('material_template_items')
      .insert({
        template_id: templateId,
        sort_order: item.sort_order,
        item_name: item.item_name,
        unit: item.unit,
        default_quantity: item.default_quantity,
        notes: item.notes,
      })
      .select('id')
      .single()

    if (itemError || !insertedItem) {
      throw new Error(itemError?.message || 'Could not save template item.')
    }

    if (item.options.length > 0) {
      const { error: optionsError } = await supabaseAdmin
        .from('material_template_item_options')
        .insert(
          item.options.map((option) => ({
            template_item_id: insertedItem.id,
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
  }
}

export async function replaceMaterialOrderItems(
  orderId: string,
  items: MaterialOrderItemWriteInput[]
) {
  const { data: existingItems, error: existingItemsError } = await supabaseAdmin
    .from('material_order_items')
    .select('id')
    .eq('order_id', orderId)

  if (existingItemsError) {
    throw new Error(existingItemsError.message)
  }

  const existingItemIds = (existingItems ?? [])
    .map((row) => row.id)
    .filter((value): value is string => typeof value === 'string')

  if (existingItemIds.length > 0) {
    const { error: deleteOptionsError } = await supabaseAdmin
      .from('material_order_item_options')
      .delete()
      .in('order_item_id', existingItemIds)

    if (deleteOptionsError) {
      throw new Error(deleteOptionsError.message)
    }

    const { error: deleteItemsError } = await supabaseAdmin
      .from('material_order_items')
      .delete()
      .eq('order_id', orderId)

    if (deleteItemsError) {
      throw new Error(deleteItemsError.message)
    }
  }

  for (const item of items) {
    const { data: insertedItem, error: itemError } = await supabaseAdmin
      .from('material_order_items')
      .insert({
        order_id: orderId,
        sort_order: item.sort_order,
        item_name: item.item_name,
        unit: item.unit,
        quantity: item.quantity,
        notes: item.notes,
      })
      .select('id')
      .single()

    if (itemError || !insertedItem) {
      throw new Error(itemError?.message || 'Could not save order item.')
    }

    if (item.options.length > 0) {
      const { error: optionsError } = await supabaseAdmin
        .from('material_order_item_options')
        .insert(
          item.options.map((option) => ({
            order_item_id: insertedItem.id,
            option_group: option.option_group,
            option_value: option.option_value,
            sort_order: option.sort_order,
            is_selected: option.is_selected,
          }))
        )

      if (optionsError) {
        throw new Error(optionsError.message)
      }
    }
  }
}
