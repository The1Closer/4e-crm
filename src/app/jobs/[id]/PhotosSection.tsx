'use client'

import { useEffect, useState } from 'react'
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

  async function loadPhotos() {
    setLoading(true)
    setMessage('')

    const { data, error } = await supabase
      .from('documents')
      .select('id, file_name, file_path, file_type, created_at')
      .eq('job_id', jobId)
      .eq('file_type', 'photo')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    setPhotos((data ?? []) as PhotoItem[])
    setLoading(false)
  }

  useEffect(() => {
    loadPhotos()
  }, [jobId])

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Photos</h2>
      <p className="mt-1 text-sm text-gray-600">
        Photos uploaded through Quick Upload appear here automatically.
      </p>

      {message ? (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 text-sm text-gray-600">Loading photos...</div>
      ) : photos.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600">
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
                className="block overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
              >
                <img
                  src={url}
                  alt={photo.file_name}
                  className="h-56 w-full object-cover"
                />
                <div className="p-3 text-sm font-medium text-gray-900">
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