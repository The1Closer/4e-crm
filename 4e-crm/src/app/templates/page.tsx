'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ManagerOnlyRoute from '../../components/ManagerOnlyRoute'
import { supabase } from '../../lib/supabase'

type TemplateRow = {
  id: string
  name: string
  category: string | null
  file_url: string
  file_path: string
  is_active: boolean
  created_at: string
}

function slugifyFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-')
}

export default function TemplatesPage() {
  return (
    <ManagerOnlyRoute>
      <TemplatesPageContent />
    </ManagerOnlyRoute>
  )
}

function TemplatesPageContent() {
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [file, setFile] = useState<File | null>(null)

  async function loadTemplates() {
    setLoading(true)

    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    setTemplates((data ?? []) as TemplateRow[])
    setLoading(false)
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  async function handleUpload() {
    if (!name.trim()) {
      setMessage('Enter a template name.')
      return
    }

    if (!file) {
      setMessage('Choose a PDF file.')
      return
    }

    setUploading(true)
    setMessage('')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const fileName = `${Date.now()}-${slugifyFileName(file.name)}`
      const filePath = `templates/${fileName}`

      const uploadRes = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          upsert: false,
        })

      if (uploadRes.error) {
        throw new Error(uploadRes.error.message)
      }

      const publicUrlRes = supabase.storage
        .from('documents')
        .getPublicUrl(filePath)

      const fileUrl = publicUrlRes.data.publicUrl

      const { error: insertError } = await supabase
        .from('document_templates')
        .insert({
          name: name.trim(),
          category: category.trim() || null,
          file_url: fileUrl,
          file_path: filePath,
          created_by: user?.id ?? null,
        })

      if (insertError) {
        throw new Error(insertError.message)
      }

      setName('')
      setCategory('')
      setFile(null)
      setMessage('Template uploaded.')
      loadTemplates()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(template: TemplateRow) {
    setMessage('')

    const storageRes = await supabase.storage
      .from('documents')
      .remove([template.file_path])

    if (storageRes.error) {
      setMessage(storageRes.error.message)
      return
    }

    const { error } = await supabase
      .from('document_templates')
      .delete()
      .eq('id', template.id)

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Template deleted.')
    loadTemplates()
  }

  return (
    <main className="p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Document Templates</h1>
            <p className="mt-2 text-sm text-gray-600">
              Manager-only master PDF templates used to create job-specific documents.
            </p>
          </div>

          <Link
            href="/"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
          >
            Home
          </Link>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Upload Template</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <input
              className="rounded-xl border px-4 py-3 text-sm"
              placeholder="Template name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <input
              className="rounded-xl border px-4 py-3 text-sm"
              placeholder="Category (Contract, COC, etc.)"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />

          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload Template'}
          </button>

          {message ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              {message}
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Template Library</h2>

          {loading ? (
            <div className="mt-4 text-sm text-gray-600">Loading templates...</div>
          ) : templates.length === 0 ? (
            <div className="mt-4 text-sm text-gray-600">No templates uploaded yet.</div>
          ) : (
            <div className="mt-4 space-y-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 p-4"
                >
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{template.name}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {template.category || 'Uncategorized'}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <a
                      href={template.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 transition hover:bg-gray-100"
                    >
                      Open
                    </a>

                    <button
                      type="button"
                      onClick={() => handleDelete(template)}
                      className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}