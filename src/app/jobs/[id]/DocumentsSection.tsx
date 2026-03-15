'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type DocumentItem = {
  id: string
  file_name: string
  file_path: string
  file_type: string | null
  created_at: string
}

export default function DocumentsSection({
  jobId,
  initialDocuments,
}: {
  jobId: string
  initialDocuments: DocumentItem[]
}) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return

    setUploading(true)
    setMessage('')

    const path = `${jobId}/${Date.now()}-${file.name.replaceAll(' ', '_')}`

    const { error: uploadError } = await supabase.storage
      .from('job-files')
      .upload(path, file, { upsert: false })

    if (uploadError) {
      setMessage(uploadError.message)
      setUploading(false)
      return
    }

    const { error: dbError } = await supabase
      .from('documents')
      .insert({
        job_id: jobId,
        file_name: file.name,
        file_path: path,
        file_type: 'document',
      })

    if (dbError) {
      setMessage(dbError.message)
      setUploading(false)
      return
    }

    setUploading(false)
    setFile(null)
    setMessage('Uploaded')
    router.refresh()
  }

  async function handleDelete(doc: DocumentItem) {
    const confirmed = window.confirm(`Delete "${doc.file_name}"?`)
    if (!confirmed) return

    setDeletingId(doc.id)
    setMessage('')

    const { error: storageError } = await supabase.storage
      .from('job-files')
      .remove([doc.file_path])

    if (storageError) {
      setMessage(storageError.message)
      setDeletingId(null)
      return
    }

    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .eq('id', doc.id)

    if (dbError) {
      setMessage(dbError.message)
      setDeletingId(null)
      return
    }

    setDeletingId(null)
    setMessage('Deleted')
    router.refresh()
  }

  function getPublicUrl(path: string) {
    const { data } = supabase.storage.from('job-files').getPublicUrl(path)
    return data.publicUrl
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Documents</h2>

      <form
        onSubmit={handleUpload}
        className="mt-4 flex flex-col gap-3 md:flex-row md:items-center"
      >
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
          {uploading ? 'Uploading...' : 'Upload Document'}
        </button>
      </form>

      {message ? (
        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          {message}
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        {initialDocuments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600">
            No documents uploaded yet.
          </div>
        ) : (
          initialDocuments.map((doc) => {
            const url = getPublicUrl(doc.file_path)
            const isDeleting = deletingId === doc.id

            return (
              <div
                key={doc.id}
                className="rounded-xl border border-gray-200 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="block min-w-0"
                  >
                    <div className="text-sm font-medium text-gray-900">
                      {doc.file_name}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-wide text-gray-500">
                      {doc.file_type ?? 'document'}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {new Date(doc.created_at).toLocaleString('en-US')}
                    </div>
                  </a>

                  <button
                    type="button"
                    onClick={() => handleDelete(doc)}
                    disabled={isDeleting}
                    className="rounded-lg border border-red-300 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}