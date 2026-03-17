'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { authorizedFetch } from '@/lib/api-client'
import { supabase } from '@/lib/supabase'
import {
  getCurrentUserProfile,
  getPermissions,
  type UserProfile,
} from '@/lib/auth-helpers'

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
}

function buildUploadedDocUrl(filePath: string) {
  const { data } = supabase.storage.from('job-files').getPublicUrl(filePath)
  return data.publicUrl
}

async function fetchDocumentsPanelData(
  jobId: string
): Promise<DocumentsPanelData | { error: string }> {
  const [uploadedRes, signedRes, templatesRes] = await Promise.all([
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

  return {
    uploadedDocs: (uploadedRes.data ?? []) as UploadedDocument[],
    signedDocs: (signedRes.data ?? []) as SignedJobDocument[],
    templates: (templatesRes.data ?? []) as TemplateRow[],
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
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function loadProfile() {
      const nextProfile = await getCurrentUserProfile()
      setProfile(nextProfile)
      setPermissionsLoading(false)
    }

    loadProfile()
  }, [])

  const permissions = getPermissions(profile?.role)

  function applyPanelData(data: DocumentsPanelData) {
    setMessage('')
    setUploadedDocs(data.uploadedDocs)
    setSignedDocs(data.signedDocs)
    setTemplates(data.templates)
    setLoading(false)
  }

  useEffect(() => {
    let isActive = true

    async function loadInitialData() {
      const result = await fetchDocumentsPanelData(jobId)

      if (!isActive) return

      if ('error' in result) {
        setMessage(result.error)
        setUploadedDocs([])
        setSignedDocs([])
        setTemplates([])
        setLoading(false)
        return
      }

      applyPanelData(result)
    }

    void loadInitialData()

    return () => {
      isActive = false
    }
  }, [jobId])

  async function loadData() {
    setLoading(true)

    const result = await fetchDocumentsPanelData(jobId)

    if ('error' in result) {
      setMessage(result.error)
      setLoading(false)
      return
    }

    applyPanelData(result)
  }

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
      signer_url: `/contracts/editor?jobId=${jobId}&documentId=${doc.id}&sourceUrl=${encodeURIComponent(
        doc.file_url
      )}&name=${encodeURIComponent(doc.file_name)}`,
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
        signer_url: `/contracts/editor?jobId=${jobId}&sourceUrl=${encodeURIComponent(
          url
        )}&name=${encodeURIComponent(doc.file_name)}`,
        subtitle: 'Uploaded document',
        deletable: permissions.canManageTemplates,
        onDelete: () => deleteUploadedDocument(doc),
      }
    }),
  ].sort((a, b) => a.file_name.localeCompare(b.file_name))

  return (
    <section className="space-y-6">
      {message ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 shadow-sm">
          {message}
        </div>
      ) : null}

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Templates</h2>
            <p className="mt-1 text-sm text-gray-600">
              Open a master template in the signer/editor for this job.
            </p>
          </div>

          {!permissionsLoading && permissions.canManageTemplates ? (
            <Link
              href="/templates"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 transition hover:bg-gray-100"
            >
              Manage Templates
            </Link>
          ) : null}
        </div>

        {loading ? (
          <div className="mt-4 text-sm text-gray-600">Loading templates...</div>
        ) : templates.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600">
            No templates available yet.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className="rounded-xl border border-gray-200 p-4"
              >
                <div className="text-sm font-semibold text-gray-900">
                  {template.name}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {template.category || 'Uncategorized'}
                </div>

                <div className="mt-4">
                  <Link
                    href={`/contracts/editor?jobId=${jobId}&templateId=${template.id}&sourceUrl=${encodeURIComponent(
                      template.file_url
                    )}&name=${encodeURIComponent(template.name)}`}
                    className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-gray-800"
                  >
                    Open Template
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">Documents</h2>
        <p className="mt-1 text-sm text-gray-600">
          Uploaded documents and generated/signed documents all live here.
        </p>

        {loading ? (
          <div className="mt-4 text-sm text-gray-600">Loading documents...</div>
        ) : mergedDocuments.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600">
            No documents yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {mergedDocuments.map((doc) => (
              <div
                key={`${doc.kind}-${doc.id}`}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 p-4"
              >
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {doc.file_name}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {doc.subtitle}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={doc.open_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 transition hover:bg-gray-100"
                  >
                    Open
                  </a>

                  <Link
                    href={doc.signer_url}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 transition hover:bg-gray-100"
                  >
                    Edit / Sign
                  </Link>

                  {doc.deletable ? (
                    <button
                      type="button"
                      onClick={doc.onDelete}
                      className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-50"
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
    </section>
  )
}
