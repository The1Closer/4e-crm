export type MaterialOrderStatus =
  | 'draft'
  | 'ready'
  | 'ordered'
  | 'received'
  | 'cancelled'

export type MaterialJobOption = {
  id: string
  homeowner_name: string
  address: string
  install_date: string | null
  claim_number: string | null
}

export type MaterialVendor = {
  id: string
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  ordering_notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type MaterialTemplateItemOption = {
  id: string
  option_group: string
  option_value: string
  sort_order: number
  is_default: boolean
}

export type MaterialTemplateItem = {
  id: string
  sort_order: number
  item_name: string
  unit: string | null
  default_quantity: number
  notes: string | null
  options: MaterialTemplateItemOption[]
}

export type MaterialTemplate = {
  id: string
  name: string
  category: string | null
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  items: MaterialTemplateItem[]
}

export type MaterialOrderItemOption = {
  id: string
  option_group: string
  option_value: string
  sort_order: number
  is_selected: boolean
}

export type MaterialOrderItem = {
  id: string
  sort_order: number
  item_name: string
  unit: string | null
  quantity: number
  notes: string | null
  options: MaterialOrderItemOption[]
}

export type MaterialOrder = {
  id: string
  order_number: string
  job_id: string
  template_id: string | null
  vendor_id: string | null
  status: MaterialOrderStatus
  vendor_name: string | null
  vendor_contact_name: string | null
  vendor_phone: string | null
  vendor_email: string | null
  ship_to_name: string | null
  ship_to_address: string | null
  needed_by: string | null
  ordered_at: string | null
  internal_notes: string | null
  supplier_notes: string | null
  generated_internal_at: string | null
  generated_supplier_at: string | null
  created_at: string
  updated_at: string
  job: MaterialJobOption | null
  items: MaterialOrderItem[]
}

export type MaterialOrdersDashboardPayload = {
  orders: MaterialOrder[]
  templates: MaterialTemplate[]
  vendors: MaterialVendor[]
  jobs: MaterialJobOption[]
}

export const MATERIAL_ORDER_STATUS_OPTIONS: MaterialOrderStatus[] = [
  'draft',
  'ready',
  'ordered',
  'received',
  'cancelled',
]

export const MATERIAL_ORDER_STATUS_LABEL: Record<MaterialOrderStatus, string> = {
  draft: 'Draft',
  ready: 'Ready',
  ordered: 'Ordered',
  received: 'Received',
  cancelled: 'Cancelled',
}

export function isMaterialOrderStatus(
  value: string | null | undefined
): value is MaterialOrderStatus {
  return MATERIAL_ORDER_STATUS_OPTIONS.includes(
    (value ?? '') as MaterialOrderStatus
  )
}

export function formatMaterialOrderStatusLabel(
  status: MaterialOrderStatus | string | null | undefined
) {
  if (status && isMaterialOrderStatus(status)) {
    return MATERIAL_ORDER_STATUS_LABEL[status]
  }

  return 'Draft'
}

export function getMaterialOrderStatusTone(status: MaterialOrderStatus) {
  switch (status) {
    case 'ready':
      return 'border-sky-400/25 bg-sky-500/10 text-sky-100'
    case 'ordered':
      return 'border-amber-400/25 bg-amber-500/10 text-amber-100'
    case 'received':
      return 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
    case 'cancelled':
      return 'border-red-400/25 bg-red-500/10 text-red-100'
    case 'draft':
    default:
      return 'border-white/12 bg-white/[0.05] text-white/80'
  }
}

