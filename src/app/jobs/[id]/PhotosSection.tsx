'use client'

import { useEffect, useMemo, useState } from 'react'
import NextImage from 'next/image'
import { CheckSquare, Loader2, Merge, Square } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import { authorizedFetch } from '@/lib/api-client'
import InAppFileViewerModal, {
  type FileViewerItem,
} from '@/components/media/InAppFileViewerModal'
import { supabase } from '../../../lib/supabase'

type PhotoItem = {
  id: string
  file_name: string
  file_path: string
  file_type: string
  created_at: string
}

function buildPublicUrl(filePath: string) {
  const { data } = supabase.storage.from('job-files').getPublicUrl(filePath)
  return data.publicUrl
}

async function urlToJpegBytes(imageUrl: string) {
  const imageElement = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load one of the selected images.'))
    image.src = imageUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = imageElement.naturalWidth || imageElement.width
  canvas.height = imageElement.naturalHeight || imageElement.height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Could not process one of the selected images.')
  }

  context.drawImage(imageElement, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.92)
  })

  if (!blob) {
    throw new Error('Could not convert one of the selected images.')
  }

  return new Uint8Array(await blob.arrayBuffer())
}

export default function PhotosSection({
  jobId,
}: {
  jobId: string
}) {
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([])
  const [merging, setMerging] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)

  useEffect(() => {
    let isActive = true

    async function loadPhotos() {
      const { data, error } = await supabase
        .from('documents')
        .select('id, file_name, file_path, file_type, created_at')
        .eq('job_id', jobId)
        .eq('file_type', 'photo')
        .order('created_at', { ascending: false })

      if (!isActive) return

      if (error) {
        setMessage(error.message)
        setPhotos([])
        setLoading(false)
        return
      }

      setMessage('')
      setPhotos((data ?? []) as PhotoItem[])
      setSelectedPhotoIds((current) =>
        current.filter((id) =>
          ((data ?? []) as PhotoItem[]).some((photo) => photo.id === id)
        )
      )
      setLoading(false)
    }

    void loadPhotos()

    return () => {
      isActive = false
    }
  }, [jobId])

  const viewerItems = useMemo<FileViewerItem[]>(
    () =>
      photos.map((photo) => ({
        id: photo.id,
        title: photo.file_name,
        url: buildPublicUrl(photo.file_path),
        previewType: 'image',
      })),
    [photos]
  )

  const selectedCount = selectedPhotoIds.length

  function togglePhotoSelection(photoId: string) {
    setSelectedPhotoIds((current) =>
      current.includes(photoId)
        ? current.filter((id) => id !== photoId)
        : [...current, photoId]
    )
  }

  function toggleSelectAll() {
    if (selectedPhotoIds.length === photos.length) {
      setSelectedPhotoIds([])
      return
    }

    setSelectedPhotoIds(photos.map((photo) => photo.id))
  }

  async function mergeSelectedPhotosToDocument() {
    if (selectedCount < 2) {
      setMessage('Select at least 2 photos to merge into one document.')
      return
    }

    setMerging(true)
    setMessage('')

    try {
      const selectedPhotos = photos.filter((photo) =>
        selectedPhotoIds.includes(photo.id)
      )
      const pdf = await PDFDocument.create()

      for (const photo of selectedPhotos) {
        const url = buildPublicUrl(photo.file_path)
        const jpegBytes = await urlToJpegBytes(url)
        const embedded = await pdf.embedJpg(jpegBytes)
        const page = pdf.addPage([embedded.width, embedded.height])

        page.drawImage(embedded, {
          x: 0,
          y: 0,
          width: embedded.width,
          height: embedded.height,
        })
      }

      const pdfBytes = await pdf.save()
      const fileName = `merged-photos-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`
      const normalizedPdfBytes = new Uint8Array(pdfBytes)
      const pdfArrayBuffer = new ArrayBuffer(normalizedPdfBytes.byteLength)
      new Uint8Array(pdfArrayBuffer).set(normalizedPdfBytes)
      const blob = new Blob([pdfArrayBuffer], { type: 'application/pdf' })
      const file = new File([blob], fileName, { type: 'application/pdf' })
      const formData = new FormData()
      formData.set('file', file)

      const response = await authorizedFetch(`/api/jobs/${jobId}/uploads`, {
        method: 'POST',
        body: formData,
      })

      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null

      if (!response.ok) {
        throw new Error(result?.error || 'Could not upload merged PDF.')
      }

      setSelectedPhotoIds([])
      setMessage('Merged PDF created and added to Documents.')

      window.dispatchEvent(
        new CustomEvent('job-documents:refresh', {
          detail: { jobId },
        })
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not merge selected photos into a document.'
      )
    } finally {
      setMerging(false)
    }
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-[#0b0f16]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
      <h2 className="text-xl font-semibold text-white">Photos</h2>
      <p className="mt-1 text-sm text-white/60">
        Photos uploaded through Quick Upload appear here automatically.
      </p>

      {message ? (
        <div className="mt-4 rounded-[1.4rem] border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-100">
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 text-sm text-white/60">Loading photos...</div>
      ) : photos.length === 0 ? (
        <div className="mt-4 rounded-[1.4rem] border border-dashed border-white/15 p-4 text-sm text-white/60">
          No photos yet.
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.1]"
            >
              {selectedCount === photos.length ? (
                <CheckSquare className="h-3.5 w-3.5" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              {selectedCount === photos.length ? 'Clear Selection' : 'Select All'}
            </button>

            <button
              type="button"
              onClick={() => {
                void mergeSelectedPhotosToDocument()
              }}
              disabled={merging || selectedCount < 2}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#d6b37a] px-3 py-2 text-xs font-semibold text-black shadow-[0_10px_24px_rgba(214,179,122,0.24)] transition hover:bg-[#e2bf85] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {merging ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Merge className="h-3.5 w-3.5" />
              )}
              {merging
                ? 'Merging...'
                : `Merge Selected to PDF (${selectedCount})`}
            </button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {photos.map((photo, index) => {
              const isSelected = selectedPhotoIds.includes(photo.id)
              const url = buildPublicUrl(photo.file_path)

              return (
                <div
                  key={photo.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setViewerIndex(index)
                    setViewerOpen(true)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setViewerIndex(index)
                      setViewerOpen(true)
                    }
                  }}
                  className="group relative block overflow-hidden rounded-[1.4rem] border border-white/10 bg-black/20 text-left shadow-[0_16px_36px_rgba(0,0,0,0.18)]"
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      togglePhotoSelection(photo.id)
                    }}
                    className="absolute right-2 top-2 z-10 rounded-lg border border-black/40 bg-black/60 p-1.5 text-white transition hover:bg-black/80"
                    aria-label={
                      isSelected ? 'Deselect photo' : 'Select photo for merge'
                    }
                  >
                    {isSelected ? (
                      <CheckSquare className="h-4 w-4 text-[#d6b37a]" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>

                  <div className="relative h-56 w-full">
                    <NextImage
                      src={url}
                      alt={photo.file_name}
                      fill
                      unoptimized
                      className="object-cover transition group-hover:scale-[1.02]"
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    />
                  </div>

                  <div className="p-3 text-sm font-medium text-white">
                    {photo.file_name}
                  </div>
                </div>
              )
            })}
          </div>

          <InAppFileViewerModal
            isOpen={viewerOpen}
            items={viewerItems}
            index={viewerIndex}
            onIndexChange={setViewerIndex}
            onClose={() => setViewerOpen(false)}
          />
        </>
      )}
    </section>
  )
}
