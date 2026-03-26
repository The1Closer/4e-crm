'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ManagerOnlyRoute from '../../components/ManagerOnlyRoute'
import { authorizedFetch } from '@/lib/api-client'
import { slugifyFileName } from '@/lib/file-utils'
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

const MAX_TEMPLATE_FILE_SIZE_BYTES = 50 * 1024 * 1024

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

  useEffect(() => {
    let isActive = true

    async function loadTemplates() {
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .order('created_at', { ascending: false })

      if (!isActive) return

      if (error) {
        setTemplates([])
        setMessage(error.message)
        setLoading(false)
        return
      }

      setTemplates((data ?? []) as TemplateRow[])
      setLoading(false)
    }

    void loadTemplates()

    return () => {
      isActive = false
    }
  }, [])

  async function reloadTemplates() {
    setLoading(true)

    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setTemplates([])
      setMessage(error.message)
      setLoading(false)
      return
    }

    setTemplates((data ?? []) as TemplateRow[])
    setLoading(false)
  }

  async function handleUpload() {
    if (!name.trim()) {
      setMessage('Enter a template name.')
      return
    }

    if (!file) {
      setMessage('Choose a PDF file.')
      return
    }

    if (file.type !== 'application/pdf') {
      setMessage('Only PDF uploads are supported.')
      return
    }

    if (file.size > MAX_TEMPLATE_FILE_SIZE_BYTES) {
      setMessage('File is too large. Maximum upload size is 50 MB.')
      return
    }

    setUploading(true)
    setMessage('')

    try {
      const fileNameWithoutPdf = file.name.replace(/\.pdf$/i, '')
      const normalizedFileName = `${slugifyFileName(fileNameWithoutPdf) || 'template'}.pdf`
      const createUploadResponse = await authorizedFetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create_signed_upload',
          fileName: normalizedFileName,
        }),
      })

      const createUploadResult = (await createUploadResponse.json().catch(() => null)) as
        | {
            error?: string
            upload?: {
              filePath: string
              token: string
            }
          }
        | null

      if (!createUploadResponse.ok || !createUploadResult?.upload) {
        throw new Error(createUploadResult?.error || 'Could not prepare upload.')
      }

      const storageUploadRes = await supabase.storage
        .from('documents')
        .uploadToSignedUrl(
          createUploadResult.upload.filePath,
          createUploadResult.upload.token,
          file,
          {
            contentType: 'application/pdf',
            upsert: false,
          }
        )

      if (storageUploadRes.error) {
        throw new Error(storageUploadRes.error.message)
      }

      const finalizeResponse = await authorizedFetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'finalize_signed_upload',
          name: name.trim(),
          category: category.trim(),
          filePath: createUploadResult.upload.filePath,
        }),
      })

      const finalizeResult = (await finalizeResponse.json().catch(() => null)) as
        | { error?: string }
        | null

      if (!finalizeResponse.ok) {
        throw new Error(finalizeResult?.error || 'Upload failed.')
      }

      setName('')
      setCategory('')
      setFile(null)
      setMessage('Template uploaded.')
      await reloadTemplates()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(template: TemplateRow) {
    setMessage('')

    const response = await authorizedFetch(`/api/templates/${template.id}`, {
      method: 'DELETE',
    })

    const result = (await response.json().catch(() => null)) as
      | { error?: string }
      | null

    if (!response.ok) {
      setMessage(result?.error || 'Delete failed.')
      return
    }

    setMessage('Template deleted.')
    await reloadTemplates()
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.22),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_26%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,179,122,0.7),transparent)]" />

        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b37a]">
              Templates
            </div>

            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
              Signer Source Library
            </h1>

            <p className="mt-3 max-w-3xl text-base leading-7 text-white/68 md:text-lg">
              Upload and manage the master PDFs your team launches into the signer. These templates feed live job-specific documents.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/contracts/editor"
              className="rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.1]"
            >
              Open Signer
            </Link>
            <Link
              href="/jobs"
              className="rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85]"
            >
              View Jobs
            </Link>
          </div>
        </div>
      </section>

      {message ? (
        <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/78 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          {message}
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
              Upload
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
              Add a Master PDF
            </h2>
          </div>

          <div className="mt-5 grid gap-4">
            <input
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d6b37a]/35"
              placeholder="Template name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />

            <input
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d6b37a]/35"
              placeholder="Category (Contract, COC, etc.)"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            />

            <label className="rounded-2xl border border-dashed border-white/14 bg-black/20 px-4 py-4 text-sm text-white/70">
              <span className="font-semibold text-white">Choose PDF</span>
              <input
                type="file"
                accept="application/pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="mt-3 block w-full text-sm text-white/65 file:mr-4 file:rounded-xl file:border-0 file:bg-[#d6b37a] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black"
              />
            </label>

            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? 'Uploading...' : 'Upload Template'}
            </button>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
                Library
              </div>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
                Active Templates
              </h2>
            </div>

            <div className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white">
              {templates.length} template{templates.length === 1 ? '' : 's'}
            </div>
          </div>

          {loading ? (
            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/20 p-5 text-sm text-white/60">
              Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <div className="mt-5 rounded-[1.5rem] border border-dashed border-white/14 p-5 text-sm text-white/55">
              No templates uploaded yet.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-[1.4rem] border border-white/10 bg-black/20 p-4"
                >
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {template.name}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/42">
                      {template.category || 'Uncategorized'}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/contracts/editor?templateId=${template.id}&name=${encodeURIComponent(
                        template.name
                      )}`}
                      className="rounded-xl bg-[#d6b37a] px-3 py-2 text-xs font-semibold text-black shadow-[0_10px_24px_rgba(214,179,122,0.24)] transition hover:bg-[#e2bf85]"
                    >
                      Open In Signer
                    </Link>

                    <a
                      href={template.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.1]"
                    >
                      Open
                    </a>

                    <button
                      type="button"
                      onClick={() => void handleDelete(template)}
                      className="rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>
    </div>
  )
}
