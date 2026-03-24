'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { authorizedFetch } from '@/lib/api-client'
import {
  formatMaterialOrderStatusLabel,
  getMaterialOrderStatusTone,
  type MaterialOrder,
  type MaterialOrdersDashboardPayload,
} from '@/lib/material-orders'

type DashboardResponse = MaterialOrdersDashboardPayload & {
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

export default function MaterialOrdersJobPanel({
  jobId,
  homeownerName,
}: {
  jobId: string
  homeownerName: string
}) {
  const [orders, setOrders] = useState<MaterialOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'success' | 'error'>('success')
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const response = await authorizedFetch(
        `/api/material-orders?jobId=${encodeURIComponent(jobId)}`,
        {
          cache: 'no-store',
        }
      )
      const result = (await response.json().catch(() => null)) as
        | DashboardResponse
        | null

      if (!response.ok) {
        throw new Error(result?.error || 'Could not load material orders.')
      }

      setOrders(result?.orders ?? [])
    } catch (error) {
      setOrders([])
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not load material orders.'
      )
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  async function handleDeleteOrder(orderId: string) {
    if (!window.confirm('Delete this material order?')) {
      return
    }

    setDeletingOrderId(orderId)
    setMessage('')

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

      setMessageTone('success')
      setMessage('Material order deleted.')
      await loadOrders()
    } catch (error) {
      setMessageTone('error')
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not delete the material order.'
      )
    } finally {
      setDeletingOrderId(null)
    }
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-[#0b0f16]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
            Materials
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
            Material ordering for {homeownerName}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">
            Create supplier-ready material orders from this job or jump into the
            central ordering workspace to manage templates and vendor presets.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/material-orders?jobId=${jobId}`}
            className="rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85]"
          >
            Create Material Order
          </Link>
          <Link
            href={`/material-orders?jobId=${jobId}`}
            className="rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
          >
            Open Workspace
          </Link>
        </div>
      </div>

      {message ? (
        <div
          className={
            messageTone === 'error'
              ? 'mt-5 rounded-[1.5rem] border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100'
              : 'mt-5 rounded-[1.5rem] border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100'
          }
        >
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/20 p-5 text-sm text-white/60">
          Loading material orders...
        </div>
      ) : null}

      {!loading && errorMessage ? (
        <div className="mt-5 rounded-[1.5rem] border border-red-400/20 bg-red-500/10 p-5 text-sm text-red-100">
          {errorMessage}
        </div>
      ) : null}

      {!loading && !errorMessage && orders.length === 0 ? (
        <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/20 p-5 text-sm text-white/60">
          No material orders have been created for this job yet.
        </div>
      ) : null}

      {!loading && !errorMessage && orders.length > 0 ? (
        <div className="mt-5 grid gap-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                    {order.order_number}
                  </div>
                  <div className="mt-2 text-lg font-bold text-white">
                    {order.vendor_name || 'Vendor not selected'}
                  </div>
                  <div className="mt-2 text-sm text-white/65">
                    Needed by {formatDate(order.needed_by)}
                  </div>
                </div>

                <div
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getMaterialOrderStatusTone(order.status)}`}
                >
                  {formatMaterialOrderStatusLabel(order.status)}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={`/material-orders?jobId=${jobId}&orderId=${order.id}`}
                  className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
                >
                  Manage Order
                </Link>
                <Link
                  href={`/material-orders/${order.id}/supplier`}
                  target="_blank"
                  className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
                >
                  Supplier Doc
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    void handleDeleteOrder(order.id)
                  }}
                  disabled={deletingOrderId === order.id}
                  className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/18 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {deletingOrderId === order.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
