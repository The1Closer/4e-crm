'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function JobsPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  itemLabel,
  onPageChange,
}: {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  itemLabel: string
  onPageChange: (page: number) => void
}) {
  if (totalPages <= 1) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalItems)

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-[1.6rem] border border-white/10 bg-white/[0.04] px-5 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="text-sm text-white/58">
        Showing <span className="font-semibold text-white">{start}</span> to{' '}
        <span className="font-semibold text-white">{end}</span> of{' '}
        <span className="font-semibold text-white">{totalItems}</span> {itemLabel}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.1] disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </button>

        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm font-semibold text-white">
          Page {page} / {totalPages}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.1] disabled:opacity-50"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  )
}
