'use client'

import Link from 'next/link'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useSearchParams } from 'next/navigation'
import SearchableSelect from '@/components/forms/SearchableSelect'
import { authorizedFetch } from '@/lib/api-client'
import {
  formatMaterialOrderStatusLabel,
  getMaterialOrderStatusTone,
  type MaterialJobOption,
  type MaterialOrder,
  type MaterialOrderStatus,
  type MaterialOrdersDashboardPayload,
  type MaterialPresetItem,
  type MaterialTemplate,
  type MaterialTemplateItem,
  type MaterialVendor,
} from '@/lib/material-orders'
import { toLocalDateTimeInputValue } from '@/lib/tasks'

type DashboardResponse = MaterialOrdersDashboardPayload & {
  error?: string
}

type TemplateOptionValueDraft = {
  id: string
  value: string
  isDefault: boolean
}

type TemplateOptionGroupDraft = {
  id: string
  name: string
  values: TemplateOptionValueDraft[]
}

type TemplateItemDraft = {
  id: string
  itemName: string
  unit: string
  defaultQuantity: string
  notes: string
  optionGroups: TemplateOptionGroupDraft[]
}

type TemplateDraft = {
  id: string | null
  name: string
  category: string
  description: string
  isActive: boolean
  items: TemplateItemDraft[]
}

type OrderOptionValueDraft = {
  id: string
  value: string
}

type OrderOptionGroupDraft = {
  id: string
  name: string
  selectedValue: string
  values: OrderOptionValueDraft[]
}

type OrderItemDraft = {
  id: string
  itemName: string
  unit: string
  quantity: string
  notes: string
  optionGroups: OrderOptionGroupDraft[]
}

type OrderDraft = {
  id: string | null
  jobId: string
  templateId: string
  vendorId: string
  status: MaterialOrderStatus
  vendorName: string
  vendorContactName: string
  vendorPhone: string
  vendorEmail: string
  shipToName: string
  shipToAddress: string
  neededBy: string
  orderedAt: string
  internalNotes: string
  supplierNotes: string
  items: OrderItemDraft[]
}

type VendorDraft = {
  id: string | null
  name: string
  contactName: string
  phone: string
  email: string
  orderingNotes: string
  isActive: boolean
}

type PresetItemOptionValueDraft = {
  id: string
  value: string
  isDefault: boolean
}

type PresetItemOptionGroupDraft = {
  id: string
  name: string
  values: PresetItemOptionValueDraft[]
}

type PresetItemDraft = {
  id: string | null
  name: string
  unit: string
  defaultQuantity: string
  description: string
  isActive: boolean
  optionGroups: PresetItemOptionGroupDraft[]
}

const PANEL_CLASS_NAME =
  'rounded-[2rem] border border-white/10 bg-[#0b0f16]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]'

const FIELD_CLASS_NAME =
  'w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d6b37a]/35'

const TEXTAREA_CLASS_NAME = `${FIELD_CLASS_NAME} min-h-[110px] resize-y`

const PRIMARY_BUTTON_CLASS_NAME =
  'rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85] disabled:cursor-not-allowed disabled:opacity-45'

const SECONDARY_BUTTON_CLASS_NAME =
  'rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-45'

const DANGER_BUTTON_CLASS_NAME =
  'rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/18 disabled:cursor-not-allowed disabled:opacity-45'

function createLocalId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `local-${Math.random().toString(36).slice(2, 10)}`
}

function formatDisplayDate(value: string | null | undefined) {
  if (!value) return 'Not set'

  const parsed = new Date(`${value}T12:00:00`)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDisplayDateTime(value: string | null | undefined) {
  if (!value) return 'Not set'

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function toDisplayNumber(value: number) {
  if (Number.isInteger(value)) {
    return String(value)
  }

  return value.toFixed(2).replace(/\.?0+$/, '')
}

function getFirstNonEmptyOptionValue(values: Array<{ value: string }>) {
  const firstNonEmpty = values.find((entry) => entry.value.trim().length > 0)
  return firstNonEmpty?.value ?? values[0]?.value ?? ''
}

function buildEmptyTemplateDraft(): TemplateDraft {
  return {
    id: null,
    name: '',
    category: '',
    description: '',
    isActive: true,
    items: [],
  }
}

function buildEmptyVendorDraft(): VendorDraft {
  return {
    id: null,
    name: '',
    contactName: '',
    phone: '',
    email: '',
    orderingNotes: '',
    isActive: true,
  }
}

function buildEmptyPresetItemDraft(): PresetItemDraft {
  return {
    id: null,
    name: '',
    unit: '',
    defaultQuantity: '',
    description: '',
    isActive: true,
    optionGroups: [],
  }
}

function buildEmptyOrderItemDraft(): OrderItemDraft {
  return {
    id: createLocalId(),
    itemName: '',
    unit: '',
    quantity: '',
    notes: '',
    optionGroups: [],
  }
}

function buildEmptyOrderDraft(job?: MaterialJobOption | null): OrderDraft {
  return {
    id: null,
    jobId: job?.id ?? '',
    templateId: '',
    vendorId: '',
    status: 'draft',
    vendorName: '',
    vendorContactName: '',
    vendorPhone: '',
    vendorEmail: '',
    shipToName: job?.homeowner_name ?? '',
    shipToAddress: job?.address ?? '',
    neededBy: job?.install_date ?? '',
    orderedAt: '',
    internalNotes: '',
    supplierNotes: '',
    items: [],
  }
}

function buildTemplateOptionGroups(item: MaterialTemplateItem) {
  const groups = new Map<string, TemplateOptionGroupDraft>()

  item.options.forEach((option) => {
    const existing =
      groups.get(option.option_group) ??
      {
        id: createLocalId(),
        name: option.option_group,
        values: [],
      }

    existing.values.push({
      id: createLocalId(),
      value: option.option_value,
      isDefault: option.is_default,
    })

    groups.set(option.option_group, existing)
  })

  return [...groups.values()]
}

function buildPresetOptionGroups(item: MaterialPresetItem): PresetItemOptionGroupDraft[] {
  const groups = new Map<string, PresetItemOptionGroupDraft>()

  item.options.forEach((option) => {
    const existing =
      groups.get(option.option_group) ??
      {
        id: createLocalId(),
        name: option.option_group,
        values: [],
      }

    existing.values.push({
      id: createLocalId(),
      value: option.option_value,
      isDefault: option.is_default,
    })

    groups.set(option.option_group, existing)
  })

  return [...groups.values()]
}

function buildOrderOptionGroups(
  item: MaterialOrder['items'][number]
): OrderOptionGroupDraft[] {
  const groups = new Map<string, OrderOptionGroupDraft>()

  item.options.forEach((option) => {
    const existing =
      groups.get(option.option_group) ??
      {
        id: createLocalId(),
        name: option.option_group,
        selectedValue: '',
        values: [],
      }

    existing.values.push({
      id: createLocalId(),
      value: option.option_value,
    })

    if (option.is_selected) {
      existing.selectedValue = option.option_value
    }

    groups.set(option.option_group, existing)
  })

  return [...groups.values()].map((group) => ({
    ...group,
    selectedValue: group.selectedValue || group.values[0]?.value || '',
  }))
}

function buildOrderItemDraftsFromTemplate(template: MaterialTemplate) {
  return template.items.map((item) => {
    const optionGroups = buildTemplateOptionGroups(item).map((group) => ({
      id: createLocalId(),
      name: group.name,
      selectedValue: (() => {
        const defaultValue = group.values.find((value) => value.isDefault)?.value ?? ''
        return defaultValue || getFirstNonEmptyOptionValue(group.values)
      })(),
      values: group.values.map((value) => ({
        id: createLocalId(),
        value: value.value,
      })),
    }))

    return {
      id: createLocalId(),
      itemName: item.item_name,
      unit: item.unit ?? '',
      quantity: toDisplayNumber(item.default_quantity),
      notes: item.notes ?? '',
      optionGroups,
    } satisfies OrderItemDraft
  })
}

function buildOrderItemDraftFromPresetItem(presetItem: MaterialPresetItem): OrderItemDraft {
  const optionGroups = buildPresetOptionGroups(presetItem).map((group) => ({
    id: createLocalId(),
    name: group.name,
    selectedValue: (() => {
      const defaultValue = group.values.find((value) => value.isDefault)?.value ?? ''
      return defaultValue || getFirstNonEmptyOptionValue(group.values)
    })(),
    values: group.values.map((value) => ({
      id: createLocalId(),
      value: value.value,
    })),
  }))

  return {
    id: createLocalId(),
    itemName: presetItem.name,
    unit: presetItem.unit ?? '',
    quantity: toDisplayNumber(presetItem.default_quantity),
    notes: presetItem.description ?? '',
    optionGroups,
  }
}

function buildTemplateDraftFromTemplate(template: MaterialTemplate): TemplateDraft {
  return {
    id: template.id,
    name: template.name,
    category: template.category ?? '',
    description: template.description ?? '',
    isActive: template.is_active,
    items: template.items.map((item) => ({
      id: createLocalId(),
      itemName: item.item_name,
      unit: item.unit ?? '',
      defaultQuantity: toDisplayNumber(item.default_quantity),
      notes: item.notes ?? '',
      optionGroups: buildTemplateOptionGroups(item),
    })),
  }
}

function buildVendorDraftFromVendor(vendor: MaterialVendor): VendorDraft {
  return {
    id: vendor.id,
    name: vendor.name,
    contactName: vendor.contact_name ?? '',
    phone: vendor.phone ?? '',
    email: vendor.email ?? '',
    orderingNotes: vendor.ordering_notes ?? '',
    isActive: vendor.is_active,
  }
}

function buildPresetItemDraftFromPresetItem(item: MaterialPresetItem): PresetItemDraft {
  return {
    id: item.id,
    name: item.name,
    unit: item.unit ?? '',
    defaultQuantity: toDisplayNumber(item.default_quantity),
    description: item.description ?? '',
    isActive: item.is_active,
    optionGroups: buildPresetOptionGroups(item),
  }
}

function buildOrderDraftFromOrder(order: MaterialOrder): OrderDraft {
  return {
    id: order.id,
    jobId: order.job_id,
    templateId: order.template_id ?? '',
    vendorId: order.vendor_id ?? '',
    status: order.status,
    vendorName: order.vendor_name ?? '',
    vendorContactName: order.vendor_contact_name ?? '',
    vendorPhone: order.vendor_phone ?? '',
    vendorEmail: order.vendor_email ?? '',
    shipToName: order.ship_to_name ?? '',
    shipToAddress: order.ship_to_address ?? '',
    neededBy: order.needed_by ?? '',
    orderedAt: toLocalDateTimeInputValue(order.ordered_at),
    internalNotes: order.internal_notes ?? '',
    supplierNotes: order.supplier_notes ?? '',
    items: order.items.map((item) => ({
      id: createLocalId(),
      itemName: item.item_name,
      unit: item.unit ?? '',
      quantity: toDisplayNumber(item.quantity),
      notes: item.notes ?? '',
      optionGroups: buildOrderOptionGroups(item),
    })),
  }
}

function serializeTemplateDraft(templateDraft: TemplateDraft) {
  return {
    name: templateDraft.name,
    category: templateDraft.category,
    description: templateDraft.description,
    isActive: templateDraft.isActive,
    items: templateDraft.items.map((item, itemIndex) => ({
      itemName: item.itemName,
      unit: item.unit,
      defaultQuantity: item.defaultQuantity,
      notes: item.notes,
      sortOrder: itemIndex,
      options: item.optionGroups.flatMap((group) =>
        group.values.map((value, valueIndex) => ({
          optionGroup: group.name,
          optionValue: value.value,
          sortOrder: valueIndex,
          isDefault: value.isDefault,
        }))
      ),
    })),
  }
}

function serializeVendorDraft(vendorDraft: VendorDraft) {
  return {
    name: vendorDraft.name,
    contactName: vendorDraft.contactName,
    phone: vendorDraft.phone,
    email: vendorDraft.email,
    orderingNotes: vendorDraft.orderingNotes,
    isActive: vendorDraft.isActive,
  }
}

function serializePresetItemDraft(presetItemDraft: PresetItemDraft) {
  return {
    name: presetItemDraft.name,
    unit: presetItemDraft.unit,
    defaultQuantity: presetItemDraft.defaultQuantity,
    description: presetItemDraft.description,
    isActive: presetItemDraft.isActive,
    options: presetItemDraft.optionGroups.flatMap((group) =>
      group.values.map((value, valueIndex) => ({
        optionGroup: group.name,
        optionValue: value.value,
        sortOrder: valueIndex,
        isDefault: value.isDefault,
      }))
    ),
  }
}

function serializeOrderDraft(
  orderDraft: OrderDraft,
  options?: {
    markGeneratedInternal?: boolean
    markGeneratedSupplier?: boolean
  }
) {
  return {
    jobId: orderDraft.jobId,
    templateId: orderDraft.templateId || null,
    vendorId: orderDraft.vendorId || null,
    status: orderDraft.status,
    vendorName: orderDraft.vendorName,
    vendorContactName: orderDraft.vendorContactName,
    vendorPhone: orderDraft.vendorPhone,
    vendorEmail: orderDraft.vendorEmail,
    shipToName: orderDraft.shipToName,
    shipToAddress: orderDraft.shipToAddress,
    neededBy: orderDraft.neededBy || null,
    orderedAt: orderDraft.orderedAt || null,
    internalNotes: orderDraft.internalNotes,
    supplierNotes: orderDraft.supplierNotes,
    markGeneratedInternal: Boolean(options?.markGeneratedInternal),
    markGeneratedSupplier: Boolean(options?.markGeneratedSupplier),
    items: orderDraft.items.map((item, itemIndex) => ({
      itemName: item.itemName,
      unit: item.unit,
      quantity: item.quantity,
      notes: item.notes,
      sortOrder: itemIndex,
      options: item.optionGroups.flatMap((group) =>
        group.values.map((value, valueIndex) => ({
          optionGroup: group.name,
          optionValue: value.value,
          sortOrder: valueIndex,
          isSelected: group.selectedValue === value.value,
        }))
      ),
    })),
  }
}

function LabeledField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
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

function SectionNotice({
  tone,
  children,
}: {
  tone: 'success' | 'error'
  children: React.ReactNode
}) {
  return (
    <section
      className={
        tone === 'error'
          ? 'rounded-[1.5rem] border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100'
          : 'rounded-[1.5rem] border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100'
      }
    >
      {children}
    </section>
  )
}

function OrderStat({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">
        {label}
      </div>
      <div className="mt-2 text-lg font-bold text-white">{value}</div>
    </div>
  )
}

export default function MaterialOrdersScreen() {
  const searchParams = useSearchParams()
  const requestedJobId = searchParams.get('jobId')?.trim() ?? ''
  const requestedOrderId = searchParams.get('orderId')?.trim() ?? ''

  const [orders, setOrders] = useState<MaterialOrder[]>([])
  const [templates, setTemplates] = useState<MaterialTemplate[]>([])
  const [vendors, setVendors] = useState<MaterialVendor[]>([])
  const [presetItems, setPresetItems] = useState<MaterialPresetItem[]>([])
  const [jobs, setJobs] = useState<MaterialJobOption[]>([])

  const [loading, setLoading] = useState(true)
  const [pageMessage, setPageMessage] = useState('')
  const [pageMessageTone, setPageMessageTone] = useState<'success' | 'error'>(
    'success'
  )
  const [savingOrder, setSavingOrder] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [savingVendor, setSavingVendor] = useState(false)
  const [savingPresetItem, setSavingPresetItem] = useState(false)

  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)
  const [activeVendorId, setActiveVendorId] = useState<string | null>(null)
  const [activePresetItemId, setActivePresetItemId] = useState<string | null>(null)
  const [showTemplatePanel, setShowTemplatePanel] = useState(false)
  const [showPresetItemsPanel, setShowPresetItemsPanel] = useState(false)
  const [showVendorsPanel, setShowVendorsPanel] = useState(false)

  const [orderDraft, setOrderDraft] = useState<OrderDraft>(buildEmptyOrderDraft())
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>(
    buildEmptyTemplateDraft()
  )
  const [vendorDraft, setVendorDraft] = useState<VendorDraft>(buildEmptyVendorDraft())
  const [presetItemDraft, setPresetItemDraft] = useState<PresetItemDraft>(
    buildEmptyPresetItemDraft()
  )

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [sendingOrderId, setSendingOrderId] = useState<string | null>(null)
  const [sendStatusByOrderId, setSendStatusByOrderId] = useState<
    Record<string, { tone: 'success' | 'error'; message: string }>
  >({})

  const requestedJob = useMemo(
    () => jobs.find((job) => job.id === requestedJobId) ?? null,
    [jobs, requestedJobId]
  )

  const filteredOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      const haystack = [
        order.order_number,
        order.vendor_name ?? '',
        order.job?.homeowner_name ?? '',
        order.job?.address ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedSearch)
    })
  }, [orders, search, statusFilter])

  const activeOrder = useMemo(
    () => orders.find((order) => order.id === activeOrderId) ?? null,
    [activeOrderId, orders]
  )

  function resetOrderDraft(job?: MaterialJobOption | null) {
    setActiveOrderId(null)
    setOrderDraft(buildEmptyOrderDraft(job))
  }

  function applyDashboardData(
    payload: MaterialOrdersDashboardPayload,
    options?: {
      selectOrderId?: string | null
      selectTemplateId?: string | null
      selectVendorId?: string | null
      selectPresetItemId?: string | null
    }
  ) {
    setOrders(payload.orders)
    setTemplates(payload.templates)
    setVendors(payload.vendors)
    setPresetItems(payload.presetItems)
    setJobs(payload.jobs)

    const nextSelectedOrderId =
      (options?.selectOrderId ?? requestedOrderId) || activeOrderId
    const nextSelectedTemplateId = options?.selectTemplateId ?? activeTemplateId
    const nextSelectedVendorId = options?.selectVendorId ?? activeVendorId
    const nextSelectedPresetItemId =
      options?.selectPresetItemId ?? activePresetItemId
    const nextRequestedJob =
      payload.jobs.find((job) => job.id === requestedJobId) ?? null

    if (nextSelectedOrderId) {
      const matchedOrder =
        payload.orders.find((order) => order.id === nextSelectedOrderId) ?? null

      if (matchedOrder) {
        setActiveOrderId(matchedOrder.id)
        setOrderDraft(buildOrderDraftFromOrder(matchedOrder))
      } else {
        resetOrderDraft(nextRequestedJob)
      }
    } else if (!activeOrderId) {
      resetOrderDraft(nextRequestedJob)
    }

    if (nextSelectedTemplateId) {
      const matchedTemplate =
        payload.templates.find((template) => template.id === nextSelectedTemplateId) ??
        null

      if (matchedTemplate) {
        setActiveTemplateId(matchedTemplate.id)
        setTemplateDraft(buildTemplateDraftFromTemplate(matchedTemplate))
      } else {
        setActiveTemplateId(null)
        setTemplateDraft(buildEmptyTemplateDraft())
      }
    } else {
      setActiveTemplateId(null)
      setTemplateDraft(buildEmptyTemplateDraft())
    }

    if (nextSelectedVendorId) {
      const matchedVendor =
        payload.vendors.find((vendor) => vendor.id === nextSelectedVendorId) ?? null

      if (matchedVendor) {
        setActiveVendorId(matchedVendor.id)
        setVendorDraft(buildVendorDraftFromVendor(matchedVendor))
      } else {
        setActiveVendorId(null)
        setVendorDraft(buildEmptyVendorDraft())
      }
    } else {
      setActiveVendorId(null)
      setVendorDraft(buildEmptyVendorDraft())
    }

    if (nextSelectedPresetItemId) {
      const matchedPresetItem =
        payload.presetItems.find((item) => item.id === nextSelectedPresetItemId) ??
        null

      if (matchedPresetItem) {
        setActivePresetItemId(matchedPresetItem.id)
        setPresetItemDraft(buildPresetItemDraftFromPresetItem(matchedPresetItem))
      } else {
        setActivePresetItemId(null)
        setPresetItemDraft(buildEmptyPresetItemDraft())
      }
    } else {
      setActivePresetItemId(null)
      setPresetItemDraft(buildEmptyPresetItemDraft())
    }
  }

  const applyDashboardDataRef = useRef(applyDashboardData)
  applyDashboardDataRef.current = applyDashboardData

  async function fetchDashboardData(jobIdFilter: string) {
    const query = jobIdFilter ? `?jobId=${encodeURIComponent(jobIdFilter)}` : ''
    const response = await authorizedFetch(`/api/material-orders${query}`, {
      cache: 'no-store',
    })
    const result = (await response.json().catch(() => null)) as
      | DashboardResponse
      | null

    if (!response.ok) {
      throw new Error(result?.error || 'Could not load material orders.')
    }

    return {
      orders: result?.orders ?? [],
      templates: result?.templates ?? [],
      vendors: result?.vendors ?? [],
      jobs: result?.jobs ?? [],
      presetItems: result?.presetItems ?? [],
    } satisfies MaterialOrdersDashboardPayload
  }

  async function reloadDashboard(options?: {
    selectOrderId?: string | null
    selectTemplateId?: string | null
    selectVendorId?: string | null
    selectPresetItemId?: string | null
  }) {
    setLoading(true)

    try {
      const payload = await fetchDashboardData(requestedJobId)

      applyDashboardData(payload, {
        selectOrderId: options?.selectOrderId ?? activeOrderId,
        selectTemplateId: options?.selectTemplateId ?? activeTemplateId,
        selectVendorId: options?.selectVendorId ?? activeVendorId,
        selectPresetItemId: options?.selectPresetItemId ?? activePresetItemId,
      })
    } catch (error) {
      setPageMessageTone('error')
      setPageMessage(
        error instanceof Error ? error.message : 'Could not load material orders.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isActive = true

    async function loadInitialDashboard() {
      setLoading(true)

      try {
        const payload = await fetchDashboardData(requestedJobId)

        if (!isActive) {
          return
        }

        applyDashboardDataRef.current(payload, {
          selectOrderId: requestedOrderId || null,
        })
      } catch (error) {
        if (!isActive) {
          return
        }

        setPageMessageTone('error')
        setPageMessage(
          error instanceof Error ? error.message : 'Could not load material orders.'
        )
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    void loadInitialDashboard()

    return () => {
      isActive = false
    }
  }, [requestedOrderId, requestedJobId])

  function updateOrderDraft(patch: Partial<OrderDraft>) {
    setOrderDraft((current) => ({
      ...current,
      ...patch,
    }))
  }

  function updateOrderItem(itemId: string, patch: Partial<OrderItemDraft>) {
    setOrderDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item
      ),
    }))
  }

  function updateOrderItemGroupSelection(
    itemId: string,
    groupId: string,
    selectedValue: string
  ) {
    setOrderDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id !== itemId
          ? item
          : {
              ...item,
              optionGroups: item.optionGroups.map((group) =>
                group.id === groupId ? { ...group, selectedValue } : group
              ),
            }
      ),
    }))
  }

  function handleOrderJobChange(nextJobId: string) {
    const nextJob = jobs.find((job) => job.id === nextJobId) ?? null

    updateOrderDraft({
      jobId: nextJobId,
      shipToName: nextJob?.homeowner_name ?? '',
      shipToAddress: nextJob?.address ?? '',
      neededBy: nextJob?.install_date ?? orderDraft.neededBy,
    })
  }

  function handleOrderVendorChange(nextVendorId: string) {
    const nextVendor = vendors.find((vendor) => vendor.id === nextVendorId) ?? null

    updateOrderDraft({
      vendorId: nextVendorId,
      vendorName: nextVendor?.name ?? '',
      vendorContactName: nextVendor?.contact_name ?? '',
      vendorPhone: nextVendor?.phone ?? '',
      vendorEmail: nextVendor?.email ?? '',
      supplierNotes:
        orderDraft.supplierNotes || !nextVendor?.ordering_notes
          ? orderDraft.supplierNotes
          : nextVendor.ordering_notes,
    })
  }

  function handleLoadTemplateIntoOrder() {
    if (!orderDraft.templateId) {
      setPageMessageTone('error')
      setPageMessage('Choose a template first.')
      return
    }

    const selectedTemplate =
      templates.find((template) => template.id === orderDraft.templateId) ?? null

    if (!selectedTemplate) {
      setPageMessageTone('error')
      setPageMessage('Template not found.')
      return
    }

    if (
      orderDraft.items.length > 0 &&
      !window.confirm(
        'Replace the current order items with the selected template items?'
      )
    ) {
      return
    }

    updateOrderDraft({
      items: buildOrderItemDraftsFromTemplate(selectedTemplate),
    })
    setPageMessageTone('success')
    setPageMessage(`Loaded ${selectedTemplate.name} into the order.`)
  }

  function addOrderItem() {
    setOrderDraft((current) => ({
      ...current,
      items: [...current.items, buildEmptyOrderItemDraft()],
    }))
  }

  function removeOrderItem(itemId: string) {
    setOrderDraft((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== itemId),
    }))
  }

  function buildEmptyTemplateItemDraft(): TemplateItemDraft {
    return {
      id: createLocalId(),
      itemName: '',
      unit: '',
      defaultQuantity: '',
      notes: '',
      optionGroups: [],
    }
  }

  function addTemplateItem() {
    setTemplateDraft((current) => ({
      ...current,
      items: [...current.items, buildEmptyTemplateItemDraft()],
    }))
  }

  function updateTemplateItem(itemId: string, patch: Partial<TemplateItemDraft>) {
    setTemplateDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item
      ),
    }))
  }

  function removeTemplateItem(itemId: string) {
    setTemplateDraft((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== itemId),
    }))
  }

  function addTemplateOptionGroup(itemId: string) {
    setTemplateDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id !== itemId
          ? item
          : {
              ...item,
              optionGroups: [
                ...item.optionGroups,
                {
                  id: createLocalId(),
                  name: '',
                  values: [],
                },
              ],
            }
      ),
    }))
  }

  function addTemplateNamedOptionGroup(itemId: string, groupName: string) {
    setTemplateDraft((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== itemId) {
          return item
        }

        const alreadyExists = item.optionGroups.some(
          (group) => group.name.trim().toLowerCase() === groupName.trim().toLowerCase()
        )

        if (alreadyExists) {
          return item
        }

        return {
          ...item,
          optionGroups: [
            ...item.optionGroups,
            {
              id: createLocalId(),
              name: groupName,
              values: [],
            },
          ],
        }
      }),
    }))
  }

  function updateTemplateOptionGroup(
    itemId: string,
    groupId: string,
    patch: Partial<TemplateOptionGroupDraft>
  ) {
    setTemplateDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id !== itemId
          ? item
          : {
              ...item,
              optionGroups: item.optionGroups.map((group) =>
                group.id === groupId ? { ...group, ...patch } : group
              ),
            }
      ),
    }))
  }

  function removeTemplateOptionGroup(itemId: string, groupId: string) {
    setTemplateDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id !== itemId
          ? item
          : {
              ...item,
              optionGroups: item.optionGroups.filter((group) => group.id !== groupId),
            }
      ),
    }))
  }

  function addTemplateOptionValue(itemId: string, groupId: string) {
    setTemplateDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id !== itemId
          ? item
          : {
              ...item,
              optionGroups: item.optionGroups.map((group) =>
                group.id !== groupId
                  ? group
                  : {
                      ...group,
                      values: [
                        ...group.values,
                        {
                          id: createLocalId(),
                          value: '',
                          isDefault: group.values.length === 0,
                        },
                      ],
                    }
              ),
            }
      ),
    }))
  }

  function updateTemplateOptionValue(
    itemId: string,
    groupId: string,
    valueId: string,
    patch: Partial<TemplateOptionValueDraft>
  ) {
    setTemplateDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id !== itemId
          ? item
          : {
              ...item,
              optionGroups: item.optionGroups.map((group) => {
                if (group.id !== groupId) {
                  return group
                }

                if (patch.isDefault) {
                  return {
                    ...group,
                    values: group.values.map((value) =>
                      value.id === valueId
                        ? { ...value, ...patch, isDefault: true }
                        : { ...value, isDefault: false }
                    ),
                  }
                }

                return {
                  ...group,
                  values: group.values.map((value) =>
                    value.id === valueId ? { ...value, ...patch } : value
                  ),
                }
              }),
            }
      ),
    }))
  }

  function removeTemplateOptionValue(itemId: string, groupId: string, valueId: string) {
    setTemplateDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id !== itemId
          ? item
          : {
              ...item,
              optionGroups: item.optionGroups.map((group) => {
                if (group.id !== groupId) {
                  return group
                }

                const nextValues = group.values.filter((value) => value.id !== valueId)

                return {
                  ...group,
                  values: nextValues.map((value, index) => ({
                    ...value,
                    isDefault: nextValues.some((entry) => entry.isDefault)
                      ? value.isDefault
                      : index === 0,
                  })),
                }
              }),
            }
      ),
    }))
  }

  function addPresetOptionGroup() {
    setPresetItemDraft((current) => ({
      ...current,
      optionGroups: [
        ...current.optionGroups,
        {
          id: createLocalId(),
          name: '',
          values: [],
        },
      ],
    }))
  }

  function addPresetNamedOptionGroup(groupName: string) {
    setPresetItemDraft((current) => {
      const alreadyExists = current.optionGroups.some(
        (group) => group.name.trim().toLowerCase() === groupName.trim().toLowerCase()
      )

      if (alreadyExists) {
        return current
      }

      return {
        ...current,
        optionGroups: [
          ...current.optionGroups,
          {
            id: createLocalId(),
            name: groupName,
            values: [],
          },
        ],
      }
    })
  }

  function updatePresetOptionGroup(groupId: string, patch: Partial<PresetItemOptionGroupDraft>) {
    setPresetItemDraft((current) => ({
      ...current,
      optionGroups: current.optionGroups.map((group) =>
        group.id === groupId ? { ...group, ...patch } : group
      ),
    }))
  }

  function removePresetOptionGroup(groupId: string) {
    setPresetItemDraft((current) => ({
      ...current,
      optionGroups: current.optionGroups.filter((group) => group.id !== groupId),
    }))
  }

  function addPresetOptionValue(groupId: string) {
    setPresetItemDraft((current) => ({
      ...current,
      optionGroups: current.optionGroups.map((group) =>
        group.id !== groupId
          ? group
          : {
              ...group,
              values: [
                ...group.values,
                {
                  id: createLocalId(),
                  value: '',
                  isDefault: group.values.length === 0,
                },
              ],
            }
      ),
    }))
  }

  function updatePresetOptionValue(
    groupId: string,
    valueId: string,
    patch: Partial<PresetItemOptionValueDraft>
  ) {
    setPresetItemDraft((current) => ({
      ...current,
      optionGroups: current.optionGroups.map((group) => {
        if (group.id !== groupId) {
          return group
        }

        if (patch.isDefault) {
          return {
            ...group,
            values: group.values.map((value) =>
              value.id === valueId
                ? { ...value, ...patch, isDefault: true }
                : { ...value, isDefault: false }
            ),
          }
        }

        return {
          ...group,
          values: group.values.map((value) =>
            value.id === valueId ? { ...value, ...patch } : value
          ),
        }
      }),
    }))
  }

  function removePresetOptionValue(groupId: string, valueId: string) {
    setPresetItemDraft((current) => ({
      ...current,
      optionGroups: current.optionGroups.map((group) => {
        if (group.id !== groupId) {
          return group
        }

        const nextValues = group.values.filter((value) => value.id !== valueId)

        return {
          ...group,
          values: nextValues.map((value, index) => ({
            ...value,
            isDefault: nextValues.some((entry) => entry.isDefault)
              ? value.isDefault
              : index === 0,
          })),
        }
      }),
    }))
  }

  function selectTemplateForEditing(template: MaterialTemplate | null) {
    if (!template) {
      setActiveTemplateId(null)
      setTemplateDraft(buildEmptyTemplateDraft())
      return
    }

    setActiveTemplateId(template.id)
    setTemplateDraft(buildTemplateDraftFromTemplate(template))
  }

  function selectVendorForEditing(vendor: MaterialVendor | null) {
    if (!vendor) {
      setActiveVendorId(null)
      setVendorDraft(buildEmptyVendorDraft())
      return
    }

    setActiveVendorId(vendor.id)
    setVendorDraft(buildVendorDraftFromVendor(vendor))
  }

  function selectPresetItemForEditing(item: MaterialPresetItem | null) {
    if (!item) {
      setActivePresetItemId(null)
      setPresetItemDraft(buildEmptyPresetItemDraft())
      return
    }

    setActivePresetItemId(item.id)
    setPresetItemDraft(buildPresetItemDraftFromPresetItem(item))
  }

  function addPresetItemToTemplate(presetItem: MaterialPresetItem) {
    setTemplateDraft((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: createLocalId(),
          itemName: presetItem.name,
          unit: presetItem.unit ?? '',
          defaultQuantity: toDisplayNumber(presetItem.default_quantity),
          notes: presetItem.description ?? '',
          optionGroups: buildPresetOptionGroups(presetItem).map((group) => ({
            id: createLocalId(),
            name: group.name,
            values: group.values.map((value) => ({
              id: createLocalId(),
              value: value.value,
              isDefault: value.isDefault,
            })),
          })),
        },
      ],
    }))

    setPageMessageTone('success')
    setPageMessage(`Added ${presetItem.name} to template items.`)
  }

  function addPresetItemToOrder(presetItem: MaterialPresetItem) {
    setOrderDraft((current) => ({
      ...current,
      items: [...current.items, buildOrderItemDraftFromPresetItem(presetItem)],
    }))

    setPageMessageTone('success')
    setPageMessage(`Added ${presetItem.name} to order items.`)
  }

  async function saveTemplate() {
    setSavingTemplate(true)
    setPageMessage('')

    try {
      const response = await authorizedFetch(
        templateDraft.id
          ? `/api/material-orders/templates/${templateDraft.id}`
          : '/api/material-orders/templates',
        {
          method: templateDraft.id ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(serializeTemplateDraft(templateDraft)),
        }
      )
      const result = (await response.json().catch(() => null)) as
        | { templateId?: string; error?: string }
        | null

      if (!response.ok) {
        throw new Error(result?.error || 'Could not save the template.')
      }

      setPageMessageTone('success')
      setPageMessage('Template saved.')
      await reloadDashboard({
        selectTemplateId: result?.templateId ?? templateDraft.id,
      })
    } catch (error) {
      setPageMessageTone('error')
      setPageMessage(
        error instanceof Error ? error.message : 'Could not save the template.'
      )
    } finally {
      setSavingTemplate(false)
    }
  }

  async function deleteTemplate() {
    if (!templateDraft.id) {
      selectTemplateForEditing(null)
      return
    }

    if (!window.confirm(`Delete ${templateDraft.name || 'this template'}?`)) {
      return
    }

    setSavingTemplate(true)
    setPageMessage('')

    try {
      const response = await authorizedFetch(
        `/api/material-orders/templates/${templateDraft.id}`,
        {
          method: 'DELETE',
        }
      )
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null

      if (!response.ok) {
        throw new Error(result?.error || 'Could not delete the template.')
      }

      setPageMessageTone('success')
      setPageMessage('Template deleted.')
      await reloadDashboard()
    } catch (error) {
      setPageMessageTone('error')
      setPageMessage(
        error instanceof Error ? error.message : 'Could not delete the template.'
      )
    } finally {
      setSavingTemplate(false)
    }
  }

  async function saveVendor() {
    setSavingVendor(true)
    setPageMessage('')

    try {
      const response = await authorizedFetch(
        vendorDraft.id
          ? `/api/material-orders/vendors/${vendorDraft.id}`
          : '/api/material-orders/vendors',
        {
          method: vendorDraft.id ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(serializeVendorDraft(vendorDraft)),
        }
      )
      const result = (await response.json().catch(() => null)) as
        | { vendorId?: string; error?: string }
        | null

      if (!response.ok) {
        throw new Error(result?.error || 'Could not save the vendor.')
      }

      setPageMessageTone('success')
      setPageMessage('Vendor saved.')
      await reloadDashboard({
        selectVendorId: result?.vendorId ?? vendorDraft.id,
      })
    } catch (error) {
      setPageMessageTone('error')
      setPageMessage(
        error instanceof Error ? error.message : 'Could not save the vendor.'
      )
    } finally {
      setSavingVendor(false)
    }
  }

  async function deleteVendor() {
    if (!vendorDraft.id) {
      selectVendorForEditing(null)
      return
    }

    if (!window.confirm(`Delete ${vendorDraft.name || 'this vendor'}?`)) {
      return
    }

    setSavingVendor(true)
    setPageMessage('')

    try {
      const response = await authorizedFetch(
        `/api/material-orders/vendors/${vendorDraft.id}`,
        {
          method: 'DELETE',
        }
      )
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null

      if (!response.ok) {
        throw new Error(result?.error || 'Could not delete the vendor.')
      }

      setPageMessageTone('success')
      setPageMessage('Vendor deleted.')
      await reloadDashboard()
    } catch (error) {
      setPageMessageTone('error')
      setPageMessage(
        error instanceof Error ? error.message : 'Could not delete the vendor.'
      )
    } finally {
      setSavingVendor(false)
    }
  }

  async function savePresetItem() {
    setSavingPresetItem(true)
    setPageMessage('')

    try {
      const response = await authorizedFetch(
        presetItemDraft.id
          ? `/api/material-orders/preset-items/${presetItemDraft.id}`
          : '/api/material-orders/preset-items',
        {
          method: presetItemDraft.id ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(serializePresetItemDraft(presetItemDraft)),
        }
      )
      const result = (await response.json().catch(() => null)) as
        | { presetItemId?: string; error?: string }
        | null

      if (!response.ok) {
        throw new Error(result?.error || 'Could not save the preset item.')
      }

      setPageMessageTone('success')
      setPageMessage('Preset item saved.')
      await reloadDashboard({
        selectPresetItemId: result?.presetItemId ?? presetItemDraft.id,
      })
    } catch (error) {
      setPageMessageTone('error')
      setPageMessage(
        error instanceof Error ? error.message : 'Could not save the preset item.'
      )
    } finally {
      setSavingPresetItem(false)
    }
  }

  async function deletePresetItem() {
    if (!presetItemDraft.id) {
      selectPresetItemForEditing(null)
      return
    }

    if (!window.confirm(`Delete ${presetItemDraft.name || 'this preset item'}?`)) {
      return
    }

    setSavingPresetItem(true)
    setPageMessage('')

    try {
      const response = await authorizedFetch(
        `/api/material-orders/preset-items/${presetItemDraft.id}`,
        {
          method: 'DELETE',
        }
      )
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null

      if (!response.ok) {
        throw new Error(result?.error || 'Could not delete the preset item.')
      }

      setPageMessageTone('success')
      setPageMessage('Preset item deleted.')
      await reloadDashboard()
    } catch (error) {
      setPageMessageTone('error')
      setPageMessage(
        error instanceof Error ? error.message : 'Could not delete the preset item.'
      )
    } finally {
      setSavingPresetItem(false)
    }
  }

  async function saveOrder(options?: {
    markGeneratedSupplier?: boolean
    openDocument?: 'supplier'
  }) {
    setSavingOrder(true)
    setPageMessage('')

    try {
      if (!orderDraft.jobId) {
        throw new Error('Select a job before saving the order.')
      }

      const response = await authorizedFetch(
        orderDraft.id
          ? `/api/material-orders/${orderDraft.id}`
          : '/api/material-orders',
        {
          method: orderDraft.id ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            serializeOrderDraft(orderDraft, {
              markGeneratedSupplier: options?.markGeneratedSupplier,
            })
          ),
        }
      )
      const result = (await response.json().catch(() => null)) as
        | { orderId?: string; error?: string }
        | null

      if (!response.ok) {
        throw new Error(result?.error || 'Could not save the material order.')
      }

      const savedOrderId = result?.orderId ?? orderDraft.id

      if (options?.openDocument && savedOrderId) {
        window.open(
          `/material-orders/${savedOrderId}/${options.openDocument}`,
          '_blank',
          'noopener,noreferrer'
        )
      }

      setPageMessageTone('success')
      setPageMessage(
        options?.openDocument
          ? 'Material order saved and document opened.'
          : 'Material order saved.'
      )

      await reloadDashboard({ selectOrderId: savedOrderId ?? null })
    } catch (error) {
      setPageMessageTone('error')
      setPageMessage(
        error instanceof Error
          ? error.message
          : 'Could not save the material order.'
      )
    } finally {
      setSavingOrder(false)
    }
  }

  async function deleteOrderById(orderId: string) {
    if (!window.confirm('Delete this material order?')) {
      return
    }

    setSavingOrder(true)
    setPageMessage('')

    try {
      const response = await authorizedFetch(`/api/material-orders/${orderId}`, {
        method: 'DELETE',
      })
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null

      if (!response.ok) {
        throw new Error(result?.error || 'Could not delete the material order.')
      }

      setPageMessageTone('success')
      setPageMessage('Material order deleted.')
      await reloadDashboard()
    } catch (error) {
      setPageMessageTone('error')
      setPageMessage(
        error instanceof Error
          ? error.message
          : 'Could not delete the material order.'
      )
    } finally {
      setSavingOrder(false)
    }
  }

  async function deleteOrder() {
    if (!orderDraft.id) {
      resetOrderDraft(requestedJob)
      return
    }

    await deleteOrderById(orderDraft.id)
  }

  async function handleSendOrder(order: MaterialOrder) {
    if (!order.vendor_email?.trim()) {
      setSendStatusByOrderId((current) => ({
        ...current,
        [order.id]: {
          tone: 'error',
          message: 'Add vendor email before sending.',
        },
      }))
      return
    }

    setSendingOrderId(order.id)
    try {
      const response = await authorizedFetch(
        `/api/material-orders/${order.id}/send-supplier-email`,
        {
          method: 'POST',
        }
      )
      const result = (await response.json().catch(() => null)) as
        | {
            ok?: boolean
            sentAt?: string
            error?: string
          }
        | null

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'Could not send supplier email.')
      }

      const sentAt = result.sentAt ? new Date(result.sentAt).toLocaleString() : 'just now'
      setSendStatusByOrderId((current) => ({
        ...current,
        [order.id]: {
          tone: 'success',
          message: `Sent successfully at ${sentAt}.`,
        },
      }))
      window.open('https://outlook.office.com/mail/sentitems', '_blank', 'noopener,noreferrer')
    } catch (error) {
      setSendStatusByOrderId((current) => ({
        ...current,
        [order.id]: {
          tone: 'error',
          message:
            error instanceof Error ? error.message : 'Could not send supplier email.',
        },
      }))
    } finally {
      setSendingOrderId(null)
    }
  }

  const orderCountLabel = `${orders.length} order${orders.length === 1 ? '' : 's'}`

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.22),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_26%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,179,122,0.7),transparent)]" />

        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b37a]">
              Materials
            </div>

            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
              Material Orders Command Center
            </h1>

            <p className="mt-3 max-w-3xl text-base leading-7 text-white/68 md:text-lg">
              Build order-ready material lists from jobs, load reusable templates,
              manage vendor presets, and generate supplier documents without leaving
              the CRM.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => resetOrderDraft(requestedJob)}
              className={SECONDARY_BUTTON_CLASS_NAME}
            >
              New Order
            </button>
            <button
              type="button"
              onClick={() => {
                void reloadDashboard({ selectOrderId: activeOrderId })
              }}
              className={SECONDARY_BUTTON_CLASS_NAME}
            >
              Refresh
            </button>
          </div>
        </div>
      </section>

      {pageMessage ? (
        <SectionNotice tone={pageMessageTone}>{pageMessage}</SectionNotice>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className={PANEL_CLASS_NAME}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
                Order Editor
              </div>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
                {activeOrder
                  ? `Editing ${activeOrder.order_number}`
                  : 'Create a Material Order'}
              </h2>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  void saveOrder()
                }}
                disabled={savingOrder}
                className={PRIMARY_BUTTON_CLASS_NAME}
              >
                {savingOrder ? 'Saving...' : 'Save Order'}
              </button>
              <button
                type="button"
                onClick={() => {
                  void saveOrder({
                    markGeneratedSupplier: true,
                    openDocument: 'supplier',
                  })
                }}
                disabled={savingOrder}
                className={SECONDARY_BUTTON_CLASS_NAME}
              >
                Supplier Doc
              </button>
              <button
                type="button"
                onClick={() => {
                  void deleteOrder()
                }}
                disabled={savingOrder}
                className={DANGER_BUTTON_CLASS_NAME}
              >
                Delete
              </button>
            </div>
          </div>

          {loading ? (
            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/20 p-5 text-sm text-white/60">
              Loading material orders...
            </div>
          ) : null}

          {!loading ? (
            <>
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <SearchableSelect
                  label="Job"
                  value={orderDraft.jobId}
                  options={jobs.map((job) => ({
                    value: job.id,
                    label: `${job.homeowner_name} - ${job.address}`,
                  }))}
                  onChange={handleOrderJobChange}
                  placeholder="Select a job"
                />

                <SearchableSelect
                  label="Vendor Preset"
                  value={orderDraft.vendorId}
                  options={vendors
                    .filter((vendor) => vendor.is_active)
                    .map((vendor) => ({
                      value: vendor.id,
                      label: vendor.name,
                    }))}
                  onChange={handleOrderVendorChange}
                  placeholder="Select a vendor"
                />

                <LabeledField label="Template">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                    <SearchableSelect
                      label="Template Search"
                      value={orderDraft.templateId}
                      options={templates
                        .filter((template) => template.is_active)
                        .map((template) => ({
                          value: template.id,
                          label: template.name,
                        }))}
                      onChange={(value) => updateOrderDraft({ templateId: value })}
                      placeholder="Select a template"
                    />
                    <button
                      type="button"
                      onClick={handleLoadTemplateIntoOrder}
                      className={`${SECONDARY_BUTTON_CLASS_NAME} self-end`}
                    >
                      Load Template
                    </button>
                  </div>
                </LabeledField>

                <LabeledField label="Status">
                  <select
                    value={orderDraft.status}
                    onChange={(event) =>
                      updateOrderDraft({
                        status: event.target.value as MaterialOrderStatus,
                      })
                    }
                    className={FIELD_CLASS_NAME}
                  >
                    <option value="draft">Draft</option>
                    <option value="ready">Ready</option>
                    <option value="ordered">Ordered</option>
                    <option value="received">Received</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </LabeledField>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <LabeledField label="Ship To Name">
                  <input
                    className={FIELD_CLASS_NAME}
                    value={orderDraft.shipToName}
                    onChange={(event) =>
                      updateOrderDraft({ shipToName: event.target.value })
                    }
                    placeholder="Homeowner or jobsite contact"
                  />
                </LabeledField>

                <LabeledField label="Ship To Address">
                  <input
                    className={FIELD_CLASS_NAME}
                    value={orderDraft.shipToAddress}
                    onChange={(event) =>
                      updateOrderDraft({ shipToAddress: event.target.value })
                    }
                    placeholder="Delivery address"
                  />
                </LabeledField>

                <LabeledField label="Needed By">
                  <input
                    type="date"
                    className={FIELD_CLASS_NAME}
                    value={orderDraft.neededBy}
                    onChange={(event) =>
                      updateOrderDraft({ neededBy: event.target.value })
                    }
                  />
                </LabeledField>

                <LabeledField label="Ordered At">
                  <input
                    type="datetime-local"
                    className={FIELD_CLASS_NAME}
                    value={orderDraft.orderedAt}
                    onChange={(event) =>
                      updateOrderDraft({ orderedAt: event.target.value })
                    }
                  />
                </LabeledField>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <LabeledField label="Vendor Name">
                  <input
                    className={FIELD_CLASS_NAME}
                    value={orderDraft.vendorName}
                    onChange={(event) =>
                      updateOrderDraft({ vendorName: event.target.value })
                    }
                    placeholder="Supplier name"
                  />
                </LabeledField>

                <LabeledField label="Vendor Contact">
                  <input
                    className={FIELD_CLASS_NAME}
                    value={orderDraft.vendorContactName}
                    onChange={(event) =>
                      updateOrderDraft({ vendorContactName: event.target.value })
                    }
                    placeholder="Contact name"
                  />
                </LabeledField>

                <LabeledField label="Vendor Phone">
                  <input
                    className={FIELD_CLASS_NAME}
                    value={orderDraft.vendorPhone}
                    onChange={(event) =>
                      updateOrderDraft({ vendorPhone: event.target.value })
                    }
                    placeholder="Phone number"
                  />
                </LabeledField>

                <LabeledField label="Vendor Email">
                  <input
                    className={FIELD_CLASS_NAME}
                    value={orderDraft.vendorEmail}
                    onChange={(event) =>
                      updateOrderDraft({ vendorEmail: event.target.value })
                    }
                    placeholder="Email"
                  />
                </LabeledField>
              </div>

              <div className="mt-6 grid gap-4">
                <LabeledField label="Supplier Notes">
                  <textarea
                    className={TEXTAREA_CLASS_NAME}
                    value={orderDraft.supplierNotes}
                    onChange={(event) =>
                      updateOrderDraft({ supplierNotes: event.target.value })
                    }
                    placeholder="Delivery notes that should appear on the supplier PO."
                  />
                </LabeledField>
              </div>

              <div className="mt-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
                      Line Items
                    </div>
                    <h3 className="mt-2 text-xl font-bold text-white">
                      Materials for this order
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={addOrderItem}
                    className={SECONDARY_BUTTON_CLASS_NAME}
                  >
                    Add Line Item
                  </button>
                </div>

                <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/48">
                    Add from preset library
                  </div>
                  {presetItems.filter((item) => item.is_active).length === 0 ? (
                    <div className="mt-2 text-sm text-white/55">
                      No active preset items yet. Build one in the Preset Items panel below.
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {presetItems
                        .filter((item) => item.is_active)
                        .map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => addPresetItemToOrder(item)}
                            className="rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.1]"
                          >
                            {item.name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {orderDraft.items.length === 0 ? (
                  <div className="mt-4 rounded-[1.5rem] border border-dashed border-white/14 bg-black/20 p-5 text-sm text-white/55">
                    No line items yet. Add one manually or load a template.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4">
                    {orderDraft.items.map((item, index) => (
                      <div
                        key={item.id}
                        className="rounded-[1.1rem] border border-white/10 bg-white/[0.04] p-3"
                      >
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d6b37a]">
                            Item {index + 1}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeOrderItem(item.id)}
                            className="rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/18"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="grid gap-2 lg:grid-cols-[1.25fr_130px_110px]">
                          <LabeledField label="Item Name">
                            <input
                              className={FIELD_CLASS_NAME}
                              value={item.itemName}
                              onChange={(event) =>
                                updateOrderItem(item.id, {
                                  itemName: event.target.value,
                                })
                              }
                              placeholder="Shingles, drip edge, etc."
                            />
                          </LabeledField>

                          <LabeledField label="Unit">
                            <input
                              className={FIELD_CLASS_NAME}
                              value={item.unit}
                              onChange={(event) =>
                                updateOrderItem(item.id, {
                                  unit: event.target.value,
                                })
                              }
                              placeholder="Bundle, roll, box"
                            />
                          </LabeledField>

                          <LabeledField label="Quantity">
                            <input
                              className={FIELD_CLASS_NAME}
                              value={item.quantity}
                              onChange={(event) =>
                                updateOrderItem(item.id, {
                                  quantity: event.target.value,
                                })
                              }
                              placeholder="0"
                            />
                          </LabeledField>
                        </div>

                        {item.optionGroups.length > 0 ? (
                          <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {item.optionGroups.map((group) => {
                              const values = group.values
                              const selectedValue = values.some(
                                (entry) => entry.value === group.selectedValue
                              )
                                ? group.selectedValue
                                : getFirstNonEmptyOptionValue(values)

                              return (
                                <LabeledField key={group.id} label={group.name || 'Option'}>
                                  <select
                                    className={FIELD_CLASS_NAME}
                                    value={selectedValue}
                                    onChange={(event) =>
                                      updateOrderItemGroupSelection(
                                        item.id,
                                        group.id,
                                        event.target.value
                                      )
                                    }
                                  >
                                    {group.values.length === 0 ? (
                                      <option value="">No values available</option>
                                    ) : null}
                                    {group.values.map((value) => (
                                      <option key={value.id} value={value.value}>
                                        {value.value || 'Untitled option'}
                                      </option>
                                    ))}
                                  </select>
                                </LabeledField>
                              )
                            })}
                          </div>
                        ) : null}

                        <div className="mt-2">
                          <LabeledField label="Notes">
                            <textarea
                              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d6b37a]/35"
                              value={item.notes}
                              onChange={(event) =>
                                updateOrderItem(item.id, {
                                  notes: event.target.value,
                                })
                              }
                              placeholder="Optional notes"
                              rows={2}
                            />
                          </LabeledField>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </section>

        <section className={PANEL_CLASS_NAME}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
                Queue
              </div>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
                Material order activity
              </h2>
            </div>

            <div className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white">
              {orderCountLabel}
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <OrderStat
              label="Draft"
              value={String(orders.filter((order) => order.status === 'draft').length)}
            />
            <OrderStat
              label="Ready / Ordered"
              value={String(
                orders.filter(
                  (order) => order.status === 'ready' || order.status === 'ordered'
                ).length
              )}
            />
            <OrderStat
              label="Received"
              value={String(
                orders.filter((order) => order.status === 'received').length
              )}
            />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <LabeledField label="Search">
              <input
                className={FIELD_CLASS_NAME}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Order number, vendor, homeowner, or address"
              />
            </LabeledField>

            <LabeledField label="Status Filter">
              <select
                className={FIELD_CLASS_NAME}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="ready">Ready</option>
                <option value="ordered">Ordered</option>
                <option value="received">Received</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </LabeledField>
          </div>

          <div className="mt-6 grid gap-4">
            {filteredOrders.length === 0 ? (
              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5 text-sm text-white/55">
                No material orders match the current filters.
              </div>
            ) : (
              filteredOrders.map((order) => (
                <div
                  key={order.id}
                  id={`order-${order.id}`}
                  onClick={() => {
                    setActiveOrderId(order.id)
                    setOrderDraft(buildOrderDraftFromOrder(order))
                  }}
                  className={`rounded-[1.6rem] border p-5 text-left transition ${
                    activeOrderId === order.id
                      ? 'border-[#d6b37a]/40 bg-[#d6b37a]/10'
                      : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                        {order.order_number}
                      </div>
                      <div className="mt-2 text-lg font-bold text-white">
                        {order.job?.homeowner_name ?? 'Unnamed homeowner'}
                      </div>
                      <div className="mt-2 text-sm text-white/65">
                        {order.job?.address ?? 'No address on file'}
                      </div>
                      <div className="mt-2 text-sm text-white/55">
                        Vendor: {order.vendor_name || 'Not selected'}
                      </div>
                    </div>

                    <div
                      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getMaterialOrderStatusTone(order.status)}`}
                    >
                      {formatMaterialOrderStatusLabel(order.status)}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-4 text-xs uppercase tracking-[0.16em] text-white/45">
                    <span>Needed {formatDisplayDate(order.needed_by)}</span>
                    <span>Updated {formatDisplayDateTime(order.updated_at)}</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={`/material-orders/${order.id}/supplier`}
                      target="_blank"
                      onClick={(event) => event.stopPropagation()}
                      className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
                    >
                      Supplier Doc
                    </Link>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleSendOrder(order)
                      }}
                      disabled={sendingOrderId === order.id}
                      className={SECONDARY_BUTTON_CLASS_NAME}
                    >
                      {sendingOrderId === order.id ? 'Sending...' : 'Send'}
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        void deleteOrderById(order.id)
                      }}
                      disabled={savingOrder}
                      className={DANGER_BUTTON_CLASS_NAME}
                    >
                      Delete
                    </button>
                  </div>

                  {sendStatusByOrderId[order.id] ? (
                    <div
                      className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${
                        sendStatusByOrderId[order.id].tone === 'error'
                          ? 'border border-red-400/20 bg-red-500/10 text-red-100'
                          : 'border border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
                      }`}
                    >
                      {sendStatusByOrderId[order.id].message}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>
      </section>

      <section className={PANEL_CLASS_NAME}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d6b37a]">
              Workspace Tools
            </div>
            <div className="mt-1 text-sm text-white/60">
              Open only the sections you want to work in.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowTemplatePanel((current) => !current)}
              className={SECONDARY_BUTTON_CLASS_NAME}
            >
              {showTemplatePanel ? 'Hide Template Builder' : 'Open Template Builder'}
            </button>
            <button
              type="button"
              onClick={() => setShowPresetItemsPanel((current) => !current)}
              className={SECONDARY_BUTTON_CLASS_NAME}
            >
              {showPresetItemsPanel ? 'Hide Item Library' : 'Open Item Library'}
            </button>
            <button
              type="button"
              onClick={() => setShowVendorsPanel((current) => !current)}
              className={SECONDARY_BUTTON_CLASS_NAME}
            >
              {showVendorsPanel ? 'Hide Vendor Directory' : 'Open Vendor Directory'}
            </button>
          </div>
        </div>
      </section>

      {showTemplatePanel || showPresetItemsPanel || showVendorsPanel ? (
      <section
        className={`grid gap-6 ${
          showTemplatePanel && showPresetItemsPanel && showVendorsPanel
            ? 'xl:grid-cols-3'
            : (showTemplatePanel && showPresetItemsPanel) ||
                (showTemplatePanel && showVendorsPanel) ||
                (showPresetItemsPanel && showVendorsPanel)
              ? 'xl:grid-cols-2'
              : 'xl:grid-cols-1'
        }`}
      >
        {showPresetItemsPanel ? (
        <section className={PANEL_CLASS_NAME}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
                Preset Items
              </div>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
                Reusable item library
              </h2>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => selectPresetItemForEditing(null)}
                className={SECONDARY_BUTTON_CLASS_NAME}
              >
                New Preset
              </button>
              <button
                type="button"
                onClick={() => {
                  void savePresetItem()
                }}
                disabled={savingPresetItem}
                className={PRIMARY_BUTTON_CLASS_NAME}
              >
                {savingPresetItem ? 'Saving...' : 'Save Preset'}
              </button>
              <button
                type="button"
                onClick={() => {
                  void deletePresetItem()
                }}
                disabled={savingPresetItem}
                className={DANGER_BUTTON_CLASS_NAME}
              >
                Delete
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[0.44fr_0.56fr]">
            <div className="space-y-3">
              {presetItems.length === 0 ? (
                <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5 text-sm text-white/55">
                  No preset items saved yet.
                </div>
              ) : (
                presetItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectPresetItemForEditing(item)}
                    className={`w-full rounded-[1.5rem] border p-4 text-left transition ${
                      activePresetItemId === item.id
                        ? 'border-[#d6b37a]/40 bg-[#d6b37a]/10'
                        : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="text-sm font-semibold text-white">{item.name}</div>
                    <div className="mt-2 text-xs uppercase tracking-[0.16em] text-white/45">
                      {item.is_active ? 'Active' : 'Inactive'}
                    </div>
                    {item.description ? (
                      <div className="mt-2 text-sm text-white/60">{item.description}</div>
                    ) : null}
                  </button>
                ))
              )}
            </div>

            <div className="space-y-4">
              <div className="grid gap-4">
                <LabeledField label="Preset Item Name">
                  <input
                    className={FIELD_CLASS_NAME}
                    value={presetItemDraft.name}
                    onChange={(event) =>
                      setPresetItemDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Shingles"
                  />
                </LabeledField>

                <div className="grid gap-4 md:grid-cols-2">
                  <LabeledField label="Unit">
                    <input
                      className={FIELD_CLASS_NAME}
                      value={presetItemDraft.unit}
                      onChange={(event) =>
                        setPresetItemDraft((current) => ({
                          ...current,
                          unit: event.target.value,
                        }))
                      }
                      placeholder="Bundle"
                    />
                  </LabeledField>

                  <LabeledField label="Default Qty">
                    <input
                      className={FIELD_CLASS_NAME}
                      value={presetItemDraft.defaultQuantity}
                      onChange={(event) =>
                        setPresetItemDraft((current) => ({
                          ...current,
                          defaultQuantity: event.target.value,
                        }))
                      }
                      placeholder="0"
                    />
                  </LabeledField>
                </div>

                <LabeledField label="Description">
                  <textarea
                    className={TEXTAREA_CLASS_NAME}
                    value={presetItemDraft.description}
                    onChange={(event) =>
                      setPresetItemDraft((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Optional notes for this preset item."
                  />
                </LabeledField>

                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white">
                  <input
                    type="checkbox"
                    checked={presetItemDraft.isActive}
                    onChange={(event) =>
                      setPresetItemDraft((current) => ({
                        ...current,
                        isActive: event.target.checked,
                      }))
                    }
                  />
                  Active preset item
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">Option Groups</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => addPresetNamedOptionGroup('Grade')}
                    className={SECONDARY_BUTTON_CLASS_NAME}
                  >
                    Add Grade
                  </button>
                  <button
                    type="button"
                    onClick={() => addPresetNamedOptionGroup('Color')}
                    className={SECONDARY_BUTTON_CLASS_NAME}
                  >
                    Add Color
                  </button>
                  <button
                    type="button"
                    onClick={addPresetOptionGroup}
                    className={SECONDARY_BUTTON_CLASS_NAME}
                  >
                    Add Custom Group
                  </button>
                </div>
              </div>

              {presetItemDraft.optionGroups.length === 0 ? (
                <div className="rounded-[1.4rem] border border-dashed border-white/14 bg-black/20 p-4 text-sm text-white/55">
                  No selections yet. Add groups like Grade or Color.
                </div>
              ) : (
                <div className="grid gap-3">
                  {presetItemDraft.optionGroups.map((group) => (
                    <div
                      key={group.id}
                      className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <input
                          className={`${FIELD_CLASS_NAME} max-w-sm`}
                          value={group.name}
                          onChange={(event) =>
                            updatePresetOptionGroup(group.id, {
                              name: event.target.value,
                            })
                          }
                          placeholder="Group name (Grade, Color)"
                        />
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => addPresetOptionValue(group.id)}
                            className={SECONDARY_BUTTON_CLASS_NAME}
                          >
                            Add Value
                          </button>
                          <button
                            type="button"
                            onClick={() => removePresetOptionGroup(group.id)}
                            className={DANGER_BUTTON_CLASS_NAME}
                          >
                            Remove Group
                          </button>
                        </div>
                      </div>

                      {group.values.length === 0 ? (
                        <div className="mt-3 rounded-[1.2rem] border border-dashed border-white/14 p-4 text-sm text-white/55">
                          Add values for this group.
                        </div>
                      ) : (
                        <div className="mt-3 grid gap-3">
                          {group.values.map((value) => (
                            <div
                              key={value.id}
                              className="grid gap-3 rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-3 md:grid-cols-[minmax(0,1fr)_auto_auto]"
                            >
                              <input
                                className={FIELD_CLASS_NAME}
                                value={value.value}
                                onChange={(event) =>
                                  updatePresetOptionValue(group.id, value.id, {
                                    value: event.target.value,
                                  })
                                }
                                placeholder="Option value"
                              />
                              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white">
                                <input
                                  type="checkbox"
                                  checked={value.isDefault}
                                  onChange={(event) =>
                                    updatePresetOptionValue(group.id, value.id, {
                                      isDefault: event.target.checked,
                                    })
                                  }
                                />
                                Default
                              </label>
                              <button
                                type="button"
                                onClick={() => removePresetOptionValue(group.id, value.id)}
                                className={DANGER_BUTTON_CLASS_NAME}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
        ) : null}

        {showTemplatePanel ? (
        <section className={PANEL_CLASS_NAME}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
                Templates
              </div>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
                Material template builder
              </h2>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => selectTemplateForEditing(null)}
                className={SECONDARY_BUTTON_CLASS_NAME}
              >
                New Template
              </button>
              <button
                type="button"
                onClick={() => {
                  void saveTemplate()
                }}
                disabled={savingTemplate}
                className={PRIMARY_BUTTON_CLASS_NAME}
              >
                {savingTemplate ? 'Saving...' : 'Save Template'}
              </button>
              <button
                type="button"
                onClick={() => {
                  void deleteTemplate()
                }}
                disabled={savingTemplate}
                className={DANGER_BUTTON_CLASS_NAME}
              >
                Delete
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[0.42fr_0.58fr]">
            <div className="space-y-3">
              {templates.length === 0 ? (
                <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5 text-sm text-white/55">
                  No templates saved yet.
                </div>
              ) : (
                templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => selectTemplateForEditing(template)}
                    className={`w-full rounded-[1.5rem] border p-4 text-left transition ${
                      activeTemplateId === template.id
                        ? 'border-[#d6b37a]/40 bg-[#d6b37a]/10'
                        : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="text-sm font-semibold text-white">{template.name}</div>
                    <div className="mt-2 text-xs uppercase tracking-[0.16em] text-white/45">
                      {template.items.length} line item
                      {template.items.length === 1 ? '' : 's'}
                    </div>
                    {template.category ? (
                      <div className="mt-2 text-sm text-white/60">{template.category}</div>
                    ) : null}
                  </button>
                ))
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4 text-sm text-white/62">
                Keep templates simple: add your base items, then optional variant groups
                like Grade and Color where needed.
              </div>

              <div className="grid gap-4">
                <LabeledField label="Template Name">
                  <input
                    className={FIELD_CLASS_NAME}
                    value={templateDraft.name}
                    onChange={(event) =>
                      setTemplateDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Asphalt Roof - Standard"
                  />
                </LabeledField>

                <LabeledField label="Description">
                  <textarea
                    className={TEXTAREA_CLASS_NAME}
                    value={templateDraft.description}
                    onChange={(event) =>
                      setTemplateDraft((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="What this template is typically used for."
                  />
                </LabeledField>

                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white">
                  <input
                    type="checkbox"
                    checked={templateDraft.isActive}
                    onChange={(event) =>
                      setTemplateDraft((current) => ({
                        ...current,
                        isActive: event.target.checked,
                      }))
                    }
                  />
                  Active template
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">Line Items</div>
                <button
                  type="button"
                  onClick={addTemplateItem}
                  className={SECONDARY_BUTTON_CLASS_NAME}
                >
                  Add Template Item
                </button>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/48">
                  Add from preset library
                </div>
                {presetItems.filter((item) => item.is_active).length === 0 ? (
                  <div className="mt-2 text-sm text-white/55">
                    No active preset items yet. Build one in the Preset Items panel.
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {presetItems
                      .filter((item) => item.is_active)
                      .map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => addPresetItemToTemplate(item)}
                          className="rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.1]"
                        >
                          {item.name}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {templateDraft.items.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-white/14 bg-black/20 p-5 text-sm text-white/55">
                  Add template items here, then define quality or color options for each item as needed.
                </div>
              ) : (
                <div className="grid gap-4">
                  {templateDraft.items.map((item, itemIndex) => (
                    <div
                      key={item.id}
                      className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[#d6b37a]">
                          Template Item {itemIndex + 1}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeTemplateItem(item.id)}
                          className={DANGER_BUTTON_CLASS_NAME}
                        >
                          Remove
                        </button>
                      </div>

                      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.45fr_0.45fr]">
                        <LabeledField label="Item Name">
                          <input
                            className={FIELD_CLASS_NAME}
                            value={item.itemName}
                            onChange={(event) =>
                              updateTemplateItem(item.id, {
                                itemName: event.target.value,
                              })
                            }
                            placeholder="Shingles"
                          />
                        </LabeledField>

                        <LabeledField label="Unit">
                          <input
                            className={FIELD_CLASS_NAME}
                            value={item.unit}
                            onChange={(event) =>
                              updateTemplateItem(item.id, {
                                unit: event.target.value,
                              })
                            }
                            placeholder="Bundle"
                          />
                        </LabeledField>

                        <LabeledField label="Default Qty">
                          <input
                            className={FIELD_CLASS_NAME}
                            value={item.defaultQuantity}
                            onChange={(event) =>
                              updateTemplateItem(item.id, {
                                defaultQuantity: event.target.value,
                              })
                            }
                            placeholder="0"
                          />
                        </LabeledField>
                      </div>

                      <div className="mt-4">
                        <LabeledField label="Notes">
                          <textarea
                            className={TEXTAREA_CLASS_NAME}
                            value={item.notes}
                            onChange={(event) =>
                              updateTemplateItem(item.id, {
                                notes: event.target.value,
                              })
                            }
                            placeholder="Optional notes for this template line."
                          />
                        </LabeledField>
                      </div>

                      <div className="mt-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-white">
                            Option Groups
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => addTemplateNamedOptionGroup(item.id, 'Grade')}
                              className={SECONDARY_BUTTON_CLASS_NAME}
                            >
                              Add Grade
                            </button>
                            <button
                              type="button"
                              onClick={() => addTemplateNamedOptionGroup(item.id, 'Color')}
                              className={SECONDARY_BUTTON_CLASS_NAME}
                            >
                              Add Color
                            </button>
                            <button
                              type="button"
                              onClick={() => addTemplateOptionGroup(item.id)}
                              className={SECONDARY_BUTTON_CLASS_NAME}
                            >
                              Add Custom Group
                            </button>
                          </div>
                        </div>

                        {item.optionGroups.length === 0 ? (
                          <div className="mt-3 rounded-[1.4rem] border border-dashed border-white/14 bg-black/20 p-4 text-sm text-white/55">
                            No selections yet. Add groups like Quality or Color.
                          </div>
                        ) : (
                          <div className="mt-3 grid gap-3">
                            {item.optionGroups.map((group) => (
                              <div
                                key={group.id}
                                className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <input
                                    className={`${FIELD_CLASS_NAME} max-w-sm`}
                                    value={group.name}
                                    onChange={(event) =>
                                      updateTemplateOptionGroup(item.id, group.id, {
                                        name: event.target.value,
                                      })
                                    }
                                    placeholder="Option group name (Quality, Color)"
                                  />
                                  <div className="flex flex-wrap gap-3">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        addTemplateOptionValue(item.id, group.id)
                                      }
                                      className={SECONDARY_BUTTON_CLASS_NAME}
                                    >
                                      Add Value
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeTemplateOptionGroup(item.id, group.id)
                                      }
                                      className={DANGER_BUTTON_CLASS_NAME}
                                    >
                                      Remove Group
                                    </button>
                                  </div>
                                </div>

                                {group.values.length === 0 ? (
                                  <div className="mt-3 rounded-[1.2rem] border border-dashed border-white/14 p-4 text-sm text-white/55">
                                    Add values for this selection group.
                                  </div>
                                ) : (
                                  <div className="mt-3 grid gap-3">
                                    {group.values.map((value) => (
                                      <div
                                        key={value.id}
                                        className="grid gap-3 rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-3 md:grid-cols-[minmax(0,1fr)_auto_auto]"
                                      >
                                        <input
                                          className={FIELD_CLASS_NAME}
                                          value={value.value}
                                          onChange={(event) =>
                                            updateTemplateOptionValue(
                                              item.id,
                                              group.id,
                                              value.id,
                                              {
                                                value: event.target.value,
                                              }
                                            )
                                          }
                                          placeholder="Option value"
                                        />
                                        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white">
                                          <input
                                            type="checkbox"
                                            checked={value.isDefault}
                                            onChange={(event) =>
                                              updateTemplateOptionValue(
                                                item.id,
                                                group.id,
                                                value.id,
                                                {
                                                  isDefault: event.target.checked,
                                                }
                                              )
                                            }
                                          />
                                          Default
                                        </label>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            removeTemplateOptionValue(
                                              item.id,
                                              group.id,
                                              value.id
                                            )
                                          }
                                          className={DANGER_BUTTON_CLASS_NAME}
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
        ) : null}

        {showVendorsPanel ? (
        <section className={PANEL_CLASS_NAME}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
                Vendors
              </div>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
                Preset vendor directory
              </h2>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => selectVendorForEditing(null)}
                className={SECONDARY_BUTTON_CLASS_NAME}
              >
                New Vendor
              </button>
              <button
                type="button"
                onClick={() => {
                  void saveVendor()
                }}
                disabled={savingVendor}
                className={PRIMARY_BUTTON_CLASS_NAME}
              >
                {savingVendor ? 'Saving...' : 'Save Vendor'}
              </button>
              <button
                type="button"
                onClick={() => {
                  void deleteVendor()
                }}
                disabled={savingVendor}
                className={DANGER_BUTTON_CLASS_NAME}
              >
                Delete
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[0.42fr_0.58fr]">
            <div className="space-y-3">
              {vendors.length === 0 ? (
                <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5 text-sm text-white/55">
                  No vendors saved yet.
                </div>
              ) : (
                vendors.map((vendor) => (
                  <button
                    key={vendor.id}
                    type="button"
                    onClick={() => selectVendorForEditing(vendor)}
                    className={`w-full rounded-[1.5rem] border p-4 text-left transition ${
                      activeVendorId === vendor.id
                        ? 'border-[#d6b37a]/40 bg-[#d6b37a]/10'
                        : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="text-sm font-semibold text-white">{vendor.name}</div>
                    <div className="mt-2 text-sm text-white/60">
                      {vendor.contact_name || 'No contact name'}
                    </div>
                    <div className="mt-2 text-xs uppercase tracking-[0.16em] text-white/45">
                      {vendor.is_active ? 'Active' : 'Inactive'}
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="grid gap-4">
              <LabeledField label="Vendor Name">
                <input
                  className={FIELD_CLASS_NAME}
                  value={vendorDraft.name}
                  onChange={(event) =>
                    setVendorDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="ABC Supply"
                />
              </LabeledField>

              <LabeledField label="Contact Name">
                <input
                  className={FIELD_CLASS_NAME}
                  value={vendorDraft.contactName}
                  onChange={(event) =>
                    setVendorDraft((current) => ({
                      ...current,
                      contactName: event.target.value,
                    }))
                  }
                  placeholder="Rep or branch contact"
                />
              </LabeledField>

              <div className="grid gap-4 md:grid-cols-2">
                <LabeledField label="Phone">
                  <input
                    className={FIELD_CLASS_NAME}
                    value={vendorDraft.phone}
                    onChange={(event) =>
                      setVendorDraft((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                    placeholder="Phone number"
                  />
                </LabeledField>

                <LabeledField label="Email">
                  <input
                    className={FIELD_CLASS_NAME}
                    value={vendorDraft.email}
                    onChange={(event) =>
                      setVendorDraft((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    placeholder="Email"
                  />
                </LabeledField>
              </div>

              <LabeledField label="Ordering Notes">
                <textarea
                  className={TEXTAREA_CLASS_NAME}
                  value={vendorDraft.orderingNotes}
                  onChange={(event) =>
                    setVendorDraft((current) => ({
                      ...current,
                      orderingNotes: event.target.value,
                    }))
                  }
                  placeholder="Delivery window, branch notes, or ordering instructions."
                />
              </LabeledField>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white">
                <input
                  type="checkbox"
                  checked={vendorDraft.isActive}
                  onChange={(event) =>
                    setVendorDraft((current) => ({
                      ...current,
                      isActive: event.target.checked,
                    }))
                  }
                />
                Active preset vendor
              </label>
            </div>
          </div>
        </section>
        ) : null}
      </section>
      ) : null}
    </div>
  )
}
