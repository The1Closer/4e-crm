'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { authorizedFetch } from '@/lib/api-client'
import { supabase } from '@/lib/supabase'
import {
  getCurrentUserProfile,
  getPermissions,
  type UserProfile,
} from '@/lib/auth-helpers'
import SendDocumentButton from '@/components/documents/SendDocumentButton'
import InAppFileViewerModal, {
  type FileViewerItem,
} from '@/components/media/InAppFileViewerModal'

type UploadedDocument = {
  id: string
  file_name: string
  file_path: string
  file_type: string
  created_at: string
}

type SignedJobDocument = {
  id: string
  template_id: string | null
  file_name: string
  file_url: string
  file_path: string
  document_type: string | null
  is_signed: boolean
  created_at: string
}

type TemplateRow = {
  id: string
  name: string
  category: string | null
  file_url: string
}

type DocumentsPanelData = {
  uploadedDocs: UploadedDocument[]
  signedDocs: SignedJobDocument[]
  templates: TemplateRow[]
  recipientEmail: string | null
}

function buildUploadedDocUrl(filePath: string) {
  const { data } = supabase.storage.from('job-files').getPublicUrl(filePath)
  return data.publicUrl
}

function inferPreviewType(fileName: string, url: string): FileViewerItem['previewType'] {
  const normalized = `${fileName} ${url}`.toLowerCase()

  if (normalized.includes('.pdf')) return 'pdf'
  if (
    normalized.includes('.png') ||
    normalized.includes('.jpg') ||
    normalized.includes('.jpeg') ||
    normalized.includes('.webp') ||
    normalized.includes('.gif') ||
    normalized.includes('.bmp') ||
    normalized.includes('.heic') ||
    normalized.includes('.heif')
  ) {
    return 'image'
  }

  return 'other'
}

async function fetchDocumentsPanelData(
  jobId: string
): Promise<DocumentsPanelData | { error: string }> {
  const [uploadedRes, signedRes, templatesRes, jobRes] = await Promise.all([
    supabase
      .from('documents')
      .select('id, file_name, file_path, file_type, created_at')
      .eq('job_id', jobId)
      .eq('file_type', 'document')
      .order('created_at', { ascending: false }),

    supabase
      .from('job_documents')
      .select(
        'id, template_id, file_name, file_url, file_path, document_type, is_signed, created_at'
      )
      .eq('job_id', jobId)
      .order('created_at', { ascending: false }),

    supabase
      .from('document_templates')
      .select('id, name, category, file_url')
      .eq('is_active', true)
      .order('name', { ascending: true }),

    supabase
      .from('jobs')
      .select(
        `
          homeowners (
            email
          )
        `
      )
      .eq('id', jobId)
      .maybeSingle(),
  ])

  if (uploadedRes.error) {
    return { error: uploadedRes.error.message }
  }

  if (signedRes.error) {
    return { error: signedRes.error.message }
  }

  if (templatesRes.error) {
    return { error: templatesRes.error.message }
  }

  if (jobRes.error) {
    return { error: jobRes.error.message }
  }

  const homeowner = Array.isArray(jobRes.data?.homeowners)
    ? jobRes.data?.homeowners[0] ?? null
    : jobRes.data?.homeowners ?? null

  return {
    uploadedDocs: (uploadedRes.data ?? []) as UploadedDocument[],
    signedDocs: (signedRes.data ?? []) as SignedJobDocument[],
    templates: (templatesRes.data ?? []) as TemplateRow[],
    recipientEmail: homeowner?.email ?? null,
  }
}

export default function JobDocumentsPanel({
  jobId,
}: {
  jobId: string
}) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [permissionsLoading, setPermissionsLoading] = useState(true)

  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([])
  const [signedDocs, setSignedDocs] = useState<SignedJobDocument[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [recipientEmail, setRecipientEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)

  useEffect(() => {
    async function loadProfile() {
      const nextProfile = await getCurrentUserProfile()
      setProfile(nextProfile)
      setPermissionsLoading(false)
    }

    loadProfile()
  }, [])

  const permissions = getPermissions(profile?.role)

  const applyPanelData = useCallback((data: DocumentsPanelData) => {
    setMessage('')
    setUploadedDocs(data.uploadedDocs)
    setSignedDocs(data.signedDocs)
    setTemplates(data.templates)
    setRecipientEmail(data.recipientEmail)
    setLoading(false)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)

    const result = await fetchDocumentsPanelData(jobId)

    if ('error' in result) {
      setMessage(result.error)
      setLoading(false)
      return
    }

    applyPanelData(result)
  }, [applyPanelData, jobId])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData()
    }, 0)

    return () => clearTimeout(timer)
  }, [loadData])

  useEffect(() => {
    function onDocumentsRefresh(event: Event) {
      const detail = (event as CustomEvent<{ jobId?: string }>).detail

      if (!detail?.jobId || detail.jobId !== jobId) {
        return
      }

      void loadData()
    }

    window.addEventListener('job-documents:refresh', onDocumentsRefresh)
    return () =>
      window.removeEventListener('job-documents:refresh', onDocumentsRefresh)
  }, [jobId, loadData])

  async function deleteUploadedDocument(doc: UploadedDocument) {
    if (!permissions.canManageTemplates) return

    setMessage('')

    const response = await authorizedFetch(`/api/job-files/${doc.id}`, {
      method: 'DELETE',
    })

    const result = (await response.json().catch(() => null)) as
      | { error?: string }
      | null

    if (!response.ok) {
      setMessage(result?.error || 'Delete failed.')
      return
    }

    setMessage('Document deleted.')
    void loadData()
  }

  async function deleteSignedDocument(doc: SignedJobDocument) {
    if (!permissions.canManageTemplates) return

    setMessage('')

    const response = await authorizedFetch(`/api/job-documents/${doc.id}`, {
      method: 'DELETE',
    })

    const result = (await response.json().catch(() => null)) as
      | { error?: string }
      | null

    if (!response.ok) {
      setMessage(result?.error || 'Delete failed.')
      return
    }

    setMessage('Signed/generated document deleted.')
    void loadData()
  }

  const mergedDocuments = [
    ...signedDocs.map((doc) => ({
      kind: 'generated' as const,
      id: doc.id,
      file_name: doc.file_name,
      open_url: doc.file_url,
      signer_url: `/contracts/editor?jobId=${jobId}&documentId=${doc.id}&name=${encodeURIComponent(
        doc.file_name
      )}&sourceUrl=${encodeURIComponent(doc.file_url)}`,
      subtitle: `${doc.is_signed ? 'Signed' : 'Generated'} • ${
        doc.document_type || 'Document'
      }`,
      deletable: permissions.canManageTemplates,
      onDelete: () => deleteSignedDocument(doc),
    })),

    ...uploadedDocs.map((doc) => {
      const url = buildUploadedDocUrl(doc.file_path)

      return {
        kind: 'uploaded' as const,
        id: doc.id,
        file_name: doc.file_name,
        open_url: url,
        signer_url: `/contracts/editor?jobId=${jobId}&jobFileId=${doc.id}&name=${encodeURIComponent(
          doc.file_name
        )}&sourceUrl=${encodeURIComponent(url)}`,
        subtitle: 'Uploaded document',
        deletable: permissions.canManageTemplates,
        onDelete: () => deleteUploadedDocument(doc),
      }
    }),
  ].sort((a, b) => a.file_name.localeCompare(b.file_name))

  const documentViewerItems = useMemo<FileViewerItem[]>(
    () =>
      mergedDocuments.map((doc) => ({
        id: `${doc.kind}-${doc.id}`,
        title: doc.file_name,
        url: doc.open_url,
        previewType: inferPreviewType(doc.file_name, doc.open_url),
      })),
    [mergedDocuments]
  )

  return (
    <section className="space-y-6">
      {message ? (
        <div className="rounded-[1.4rem] border border-white/10 bg-[#0b0f16]/95 p-4 text-sm text-white/78 shadow-[0_18px_45px_rgba(0,0,0,0.18)]">
          {message}
        </div>
      ) : null}

      <section className="rounded-[2rem] border border-white/10 bg-[#0b0f16]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">Templates</h2>
            <p className="mt-1 text-sm text-white/60">
              Open a master template in the signer/editor for this job.
            </p>
          </div>

          {!permissionsLoading && permissions.canManageTemplates ? (
            <Link
              href="/templates"
              className="rounded-2xl border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.1]"
            >
              Manage Templates
            </Link>
          ) : null}
        </div>

        {loading ? (
          <div className="mt-4 text-sm text-white/60">Loading templates...</div>
        ) : templates.length === 0 ? (
          <div className="mt-4 rounded-[1.4rem] border border-dashed border-white/15 p-4 text-sm text-white/60">
            No templates available yet.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4"
              >
                <div className="text-sm font-semibold text-white">
                  {template.name}
                </div>
                <div className="mt-1 text-xs text-white/45">
                  {template.category || 'Uncategorized'}
                </div>

                <div className="mt-4">
                  <Link
                    href={`/contracts/editor?jobId=${jobId}&templateId=${template.id}&name=${encodeURIComponent(
                      template.name
                    )}&sourceUrl=${encodeURIComponent(template.file_url)}`}
                    className="rounded-2xl bg-[#d6b37a] px-3 py-2 text-xs font-semibold text-black shadow-[0_10px_24px_rgba(214,179,122,0.24)] transition hover:bg-[#e2bf85]"
                  >
                    Open Template
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[#0b0f16]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
        <h2 className="text-xl font-semibold text-white">Documents</h2>
        <p className="mt-1 text-sm text-white/60">
          Uploaded documents and generated/signed documents all live here.
        </p>

        {loading ? (
          <div className="mt-4 text-sm text-white/60">Loading documents...</div>
        ) : mergedDocuments.length === 0 ? (
          <div className="mt-4 rounded-[1.4rem] border border-dashed border-white/15 p-4 text-sm text-white/60">
            No documents yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {mergedDocuments.map((doc, index) => (
              <div
                key={`${doc.kind}-${doc.id}`}
                className="flex flex-wrap items-center justify-between gap-4 rounded-[1.4rem] border border-white/10 bg-black/20 p-4"
              >
                <div>
                  <div className="text-sm font-semibold text-white">
                    {doc.file_name}
                  </div>
                  <div className="mt-1 text-xs text-white/45">
                    {doc.subtitle}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setViewerIndex(index)
                      setViewerOpen(true)
                    }}
                    className="rounded-2xl border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.1]"
                  >
                    Open
                  </button>

                  <Link
                    href={doc.signer_url}
                    className="rounded-2xl border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.1]"
                  >
                    Edit / Sign
                  </Link>

                  <SendDocumentButton
                    documentName={doc.file_name}
                    documentUrl={doc.open_url}
                    defaultTo={recipientEmail}
                    className="rounded-2xl border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.1]"
                  />

                  {doc.deletable ? (
                    <button
                      type="button"
                      onClick={doc.onDelete}
                      className="rounded-2xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/18"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <InAppFileViewerModal
        isOpen={viewerOpen}
        items={documentViewerItems}
        index={viewerIndex}
        onIndexChange={setViewerIndex}
        onClose={() => setViewerOpen(false)}
      />
    </section>
  )
}
