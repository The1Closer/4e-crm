'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
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

export default function PhotosSection({
  jobId,
}: {
  jobId: string
}) {
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

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
      setLoading(false)
    }

    void loadPhotos()

    return () => {
      isActive = false
    }
  }, [jobId])

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
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {photos.map((photo) => {
            const url = buildPublicUrl(photo.file_path)

            return (
              <a
                key={photo.id}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-[1.4rem] border border-white/10 bg-black/20 shadow-[0_16px_36px_rgba(0,0,0,0.18)]"
              >
                <div className="relative h-56 w-full">
                  <Image
                    src={url}
                    alt={photo.file_name}
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                  />
                </div>
                <div className="p-3 text-sm font-medium text-white">
                  {photo.file_name}
                </div>
              </a>
            )
          })}
        </div>
      )}
    </section>
  )
}
