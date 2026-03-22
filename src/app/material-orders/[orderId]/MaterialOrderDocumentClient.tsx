'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { authorizedFetch } from '@/lib/api-client'
import type { MaterialOrder } from '@/lib/material-orders'

type MaterialOrderResponse = {
  order?: MaterialOrder
  error?: string
}

function formatDate(value: string | null | undefined) {
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

function formatDateTime(value: string | null | undefined) {
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

function formatQuantity(value: number) {
  if (Number.isInteger(value)) {
    return String(value)
  }

  return value.toFixed(2).replace(/\.?0+$/, '')
}

function summarizeSelections(order: MaterialOrder) {
  return order.items.map((item) => {
    const selected = item.options.filter((option) => option.is_selected)

    return {
      itemId: item.id,
      summary:
        selected.length > 0
          ? selected
              .map((option) => `${option.option_group}: ${option.option_value}`)
              .join(' | ')
          : '',
    }
  })
}

function InfoBlock({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-black/[0.03] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/45">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-black/80">{value}</div>
    </div>
  )
}

export default function MaterialOrderDocumentClient({
  orderId,
  kind,
}: {
  orderId: string
  kind: 'internal' | 'supplier'
}) {
  const [order, setOrder] = useState<MaterialOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isActive = true

    async function loadOrder() {
      setLoading(true)
      setErrorMessage('')

      try {
        const response = await authorizedFetch(`/api/material-orders/${orderId}`, {
          cache: 'no-store',
        })
        const result = (await response.json().catch(() => null)) as
          | MaterialOrderResponse
          | null

        if (!response.ok) {
          throw new Error(result?.error || 'Could not load the material order.')
        }

        if (!isActive) return

        setOrder(result?.order ?? null)
      } catch (error) {
        if (!isActive) return

        setOrder(null)
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Could not load the material order.'
        )
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    void loadOrder()

    return () => {
      isActive = false
    }
  }, [orderId])

  const selectionSummaries = useMemo(
    () => (order ? summarizeSelections(order) : []),
    [order]
  )

  const documentTitle =
    kind === 'internal' ? 'Material Pick List' : 'Supplier Purchase Order'

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f3ee] px-4 py-10 text-black">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-black/10 bg-white p-8 shadow-[0_18px_45px_rgba(0,0,0,0.08)]">
          <div className="text-sm text-black/60">Loading document...</div>
        </div>
      </main>
    )
  }

  if (errorMessage || !order) {
    return (
      <main className="min-h-screen bg-[#f5f3ee] px-4 py-10 text-black">
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-red-300 bg-white p-8 shadow-[0_18px_45px_rgba(0,0,0,0.08)]">
          <h1 className="text-2xl font-bold text-black">Document unavailable</h1>
          <p className="mt-3 text-sm text-red-700">
            {errorMessage || 'Material order not found.'}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f3ee] px-4 py-10 text-black print:bg-white print:px-0 print:py-0">
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }

          .material-order-print-toolbar {
            display: none !important;
          }
        }
      `}</style>

      <div className="material-order-print-toolbar mx-auto mb-6 flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/material-orders?orderId=${order.id}`}
            className="rounded-2xl border border-black/12 bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-black/[0.04]"
          >
            Back to Order
          </Link>
          <Link
            href="/material-orders"
            className="rounded-2xl border border-black/12 bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-black/[0.04]"
          >
            Material Orders
          </Link>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/85"
        >
          Print / Save PDF
        </button>
      </div>

      <article className="mx-auto max-w-5xl rounded-[2rem] border border-black/10 bg-white p-8 shadow-[0_18px_45px_rgba(0,0,0,0.08)] print:rounded-none print:border-0 print:shadow-none">
        <header className="border-b border-black/10 pb-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-black/45">
                4 Elements Renovations
              </div>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-black">
                {documentTitle}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-black/65">
                {kind === 'internal'
                  ? 'Production-facing material worksheet for scheduling, delivery, and crew prep.'
                  : 'Supplier-facing purchase order formatted for clean print and PDF export.'}
              </p>
            </div>

            <div className="min-w-[220px] rounded-[1.5rem] border border-black/10 bg-black/[0.03] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">
                Order Number
              </div>
              <div className="mt-2 text-xl font-bold text-black">{order.order_number}</div>
              <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">
                Status
              </div>
              <div className="mt-2 text-sm font-semibold text-black capitalize">
                {order.status}
              </div>
              <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">
                Created
              </div>
              <div className="mt-2 text-sm text-black/75">
                {formatDateTime(order.created_at)}
              </div>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InfoBlock
            label="Homeowner"
            value={order.job?.homeowner_name ?? order.ship_to_name ?? 'Not set'}
          />
          <InfoBlock
            label="Job Address"
            value={order.job?.address ?? order.ship_to_address ?? 'Not set'}
          />
          <InfoBlock
            label="Install Date"
            value={formatDate(order.job?.install_date)}
          />
          <InfoBlock label="Needed By" value={formatDate(order.needed_by)} />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <div className="rounded-[1.6rem] border border-black/10 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/45">
              {kind === 'internal' ? 'Job Context' : 'Vendor'}
            </div>
            {kind === 'internal' ? (
              <div className="mt-4 space-y-2 text-sm text-black/75">
                <p>
                  <span className="font-semibold text-black">Claim Number:</span>{' '}
                  {order.job?.claim_number ?? 'Not set'}
                </p>
                <p>
                  <span className="font-semibold text-black">Ship To:</span>{' '}
                  {order.ship_to_name ?? 'Not set'}
                </p>
                <p>
                  <span className="font-semibold text-black">Address:</span>{' '}
                  {order.ship_to_address ?? 'Not set'}
                </p>
                <p>
                  <span className="font-semibold text-black">Ordered At:</span>{' '}
                  {formatDateTime(order.ordered_at)}
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-2 text-sm text-black/75">
                <p>
                  <span className="font-semibold text-black">Vendor:</span>{' '}
                  {order.vendor_name ?? 'Not set'}
                </p>
                <p>
                  <span className="font-semibold text-black">Contact:</span>{' '}
                  {order.vendor_contact_name ?? 'Not set'}
                </p>
                <p>
                  <span className="font-semibold text-black">Phone:</span>{' '}
                  {order.vendor_phone ?? 'Not set'}
                </p>
                <p>
                  <span className="font-semibold text-black">Email:</span>{' '}
                  {order.vendor_email ?? 'Not set'}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-[1.6rem] border border-black/10 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/45">
              {kind === 'internal' ? 'Delivery Plan' : 'Ship To'}
            </div>
            <div className="mt-4 space-y-2 text-sm text-black/75">
              <p>
                <span className="font-semibold text-black">Name:</span>{' '}
                {order.ship_to_name ?? order.job?.homeowner_name ?? 'Not set'}
              </p>
              <p>
                <span className="font-semibold text-black">Address:</span>{' '}
                {order.ship_to_address ?? order.job?.address ?? 'Not set'}
              </p>
              <p>
                <span className="font-semibold text-black">Requested Date:</span>{' '}
                {formatDate(order.needed_by)}
              </p>
              <p>
                <span className="font-semibold text-black">Status:</span>{' '}
                {order.status}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-black/45">
            Materials
          </div>

          <div className="overflow-hidden rounded-[1.6rem] border border-black/10">
            <table className="min-w-full divide-y divide-black/10">
              <thead className="bg-black/[0.04]">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-black/55">
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Selections</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 bg-white">
                {order.items.map((item) => {
                  const optionSummary =
                    selectionSummaries.find((entry) => entry.itemId === item.id)
                      ?.summary ?? ''

                  return (
                    <tr key={item.id} className="align-top text-sm text-black/80">
                      <td className="px-4 py-4 font-semibold text-black">{item.item_name}</td>
                      <td className="px-4 py-4">{optionSummary || '-'}</td>
                      <td className="px-4 py-4">{formatQuantity(item.quantity)}</td>
                      <td className="px-4 py-4">{item.unit || '-'}</td>
                      <td className="px-4 py-4">
                        {kind === 'internal' ? item.notes || '-' : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <div className="rounded-[1.6rem] border border-black/10 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/45">
              {kind === 'internal' ? 'Production Notes' : 'Supplier Notes'}
            </div>
            <div className="mt-4 min-h-[120px] whitespace-pre-wrap text-sm leading-6 text-black/80">
              {kind === 'internal'
                ? order.internal_notes || 'No internal notes added.'
                : order.supplier_notes || 'No supplier notes added.'}
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-black/10 p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/45">
              {kind === 'internal' ? 'Supplier Snapshot' : 'Ordering Snapshot'}
            </div>
            <div className="mt-4 space-y-2 text-sm text-black/75">
              <p>
                <span className="font-semibold text-black">Vendor:</span>{' '}
                {order.vendor_name ?? 'Not set'}
              </p>
              <p>
                <span className="font-semibold text-black">Contact:</span>{' '}
                {order.vendor_contact_name ?? 'Not set'}
              </p>
              <p>
                <span className="font-semibold text-black">Phone:</span>{' '}
                {order.vendor_phone ?? 'Not set'}
              </p>
              <p>
                <span className="font-semibold text-black">Email:</span>{' '}
                {order.vendor_email ?? 'Not set'}
              </p>
            </div>
          </div>
        </section>
      </article>
    </main>
  )
}

