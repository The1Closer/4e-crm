'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import Image from 'next/image'

export type FileViewerItem = {
  id: string
  title: string
  url: string
  previewType: 'image' | 'pdf' | 'other'
}

export default function InAppFileViewerModal({
  isOpen,
  items,
  index,
  onIndexChange,
  onClose,
}: {
  isOpen: boolean
  items: FileViewerItem[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
}) {
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [touchEndX, setTouchEndX] = useState<number | null>(null)

  const canNavigate = items.length > 1
  const current = items[index] ?? null

  function goPrev() {
    if (!canNavigate) return
    onIndexChange(index === 0 ? items.length - 1 : index - 1)
  }

  function goNext() {
    if (!canNavigate) return
    onIndexChange(index === items.length - 1 ? 0 : index + 1)
  }

  useEffect(() => {
    if (!isOpen) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key === 'ArrowLeft') {
        goPrev()
      }

      if (event.key === 'ArrowRight') {
        goNext()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  const progressLabel = useMemo(() => {
    if (!current) return ''
    return `${index + 1} of ${items.length}`
  }, [current, index, items.length])

  if (!isOpen || !current) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm md:p-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative flex h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-[1.8rem] border border-white/12 bg-[#0b0f16]"
        onClick={(event) => event.stopPropagation()}
        onTouchStart={(event) => {
          setTouchStartX(event.touches[0]?.clientX ?? null)
          setTouchEndX(null)
        }}
        onTouchMove={(event) => {
          setTouchEndX(event.touches[0]?.clientX ?? null)
        }}
        onTouchEnd={() => {
          if (touchStartX === null || touchEndX === null) return
          const delta = touchStartX - touchEndX

          if (Math.abs(delta) < 50) return
          if (delta > 0) {
            goNext()
          } else {
            goPrev()
          }
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 md:px-5">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">
              {current.title}
            </div>
            <div className="text-xs text-white/50">{progressLabel}</div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={current.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.1]"
            >
              <Download className="h-3.5 w-3.5" />
              Open Original
            </a>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-xl border border-white/12 bg-white/[0.05] p-2 text-white transition hover:bg-white/[0.1]"
              aria-label="Close viewer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative flex-1 bg-black/35">
          {current.previewType === 'image' ? (
            <div className="relative h-full w-full">
              <Image
                src={current.url}
                alt={current.title}
                fill
                unoptimized
                className="object-contain"
                sizes="100vw"
              />
            </div>
          ) : null}

          {current.previewType === 'pdf' ? (
            <iframe
              title={current.title}
              src={current.url}
              className="h-full w-full"
            />
          ) : null}

          {current.previewType === 'other' ? (
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-md rounded-2xl border border-white/12 bg-white/[0.04] p-5 text-center">
                <div className="text-sm font-semibold text-white">
                  Preview not available for this file type.
                </div>
                <p className="mt-2 text-xs text-white/60">
                  You can still open the original file in a new tab.
                </p>
                <a
                  href={current.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.12]"
                >
                  <Download className="h-3.5 w-3.5" />
                  Open Original
                </a>
              </div>
            </div>
          ) : null}

          {canNavigate ? (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/14 bg-black/55 p-2.5 text-white transition hover:bg-black/75"
                aria-label="Previous file"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={goNext}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/14 bg-black/55 p-2.5 text-white transition hover:bg-black/75"
                aria-label="Next file"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
