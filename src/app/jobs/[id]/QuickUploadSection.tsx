'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function QuickUploadSection({
  jobId,
}: {
  jobId: string
}) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  function inferFileType(file: File) {
    if (file.type.startsWith('image/')) return 'photo'
    return 'document'
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return

    setUploading(true)
    setMessage('')

    const safeName = file.name.replaceAll(' ', '_')
    const path = `${jobId}/${Date.now()}-${safeName}`
    const fileType = inferFileType(file)

    const { error: storageError } = await supabase.storage
      .from('job-files')
      .upload(path, file, { upsert: false })

    if (storageError) {
      setMessage(storageError.message)
      setUploading(false)
      return
    }

    const { error: dbError } = await supabase
      .from('documents')
      .insert({
        job_id: jobId,
        file_name: file.name,
        file_path: path,
        file_type: fileType,
      })

    if (dbError) {
      setMessage(dbError.message)
      setUploading(false)
      return
    }

    setFile(null)
    setUploading(false)
    setMessage(
      fileType === 'photo'
        ? 'Photo uploaded'
        : 'Document uploaded'
    )

    router.refresh()
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Quick Upload</h2>
      <p className="mt-1 text-sm text-gray-600">
        Upload any file here. Images go to Photos. Everything else goes to Documents.
      </p>

      <form onSubmit={handleUpload} className="mt-4 space-y-3">
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full rounded-xl border px-4 py-3 text-sm"
        />

        <button
          type="submit"
          disabled={uploading || !file}
          className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-60"
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </form>

      {message ? (
        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          {message}
        </div>
      ) : null}
    </section>
  )
}