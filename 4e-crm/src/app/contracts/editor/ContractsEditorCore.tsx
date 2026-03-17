'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Document, Page, pdfjs } from 'react-pdf'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { Rnd } from 'react-rnd'
import SignatureCanvas from 'react-signature-canvas'
import { authorizedFetch } from '@/lib/api-client'
import { slugifyFileName } from '@/lib/file-utils'
import { supabase } from '@/lib/supabase'

import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

type AnnotationType =
  | 'text'
  | 'date'
  | 'initials'
  | 'signature'
  | 'signature-box'
  | 'check'

type Annotation = {
  id: string
  page: number
  type: AnnotationType
  x: number
  y: number
  width: number
  height: number
  value?: string
  imageDataUrl?: string
  fontSize?: number
}

type AnnotationPreset = {
  type: AnnotationType
  label: string
}

type TemplateOption = {
  id: string
  name: string
  category: string | null
  file_url: string
}

const ANNOTATION_PRESETS: AnnotationPreset[] = [
  { type: 'text', label: 'Text' },
  { type: 'date', label: 'Date' },
  { type: 'initials', label: 'Initials' },
  { type: 'signature-box', label: 'Signature Box' },
  { type: 'check', label: 'Checkmark' },
]

const SIGNATURE_PATTERNS = [
  /homeowner\s*signature/i,
  /owner\s*signature/i,
  /insured\s*signature/i,
  /customer\s*signature/i,
  /contractor\s*signature/i,
  /\bsignature\b/i,
]

const INITIALS_PATTERNS = [/\binitials\b/i, /\binit\.\b/i]
const DATE_PATTERNS = [/\bdate\b/i]
const CHECK_PATTERNS = [/\bcheck\b/i, /\baccept\b/i, /\bagree\b/i, /\byes\b/i]

const PDF_WORKER_SRC = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

const PAGE_WIDTH = 880

pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function dataURLToUint8Array(dataURL: string) {
  const base64 = dataURL.split(',')[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }

  return bytes
}

function buildDraftKey(params: {
  jobId: string | null
  templateId: string | null
  documentId: string | null
  sourceUrl: string
  localFileName: string
  initialName: string
}) {
  const sourceToken = slugifyFileName(
    params.sourceUrl || params.localFileName || params.initialName || 'document'
  ).slice(0, 120)

  return [
    '4e-crm-signer-draft',
    params.jobId ?? 'no-job',
    params.templateId ?? 'no-template',
    params.documentId ?? 'no-document',
    sourceToken,
  ].join('::')
}

function downloadPdfBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function getAnnotationDefaults(type: AnnotationType) {
  if (type === 'date') {
    return {
      width: 148,
      height: 36,
      value: new Date().toLocaleDateString('en-US'),
      fontSize: 16,
    }
  }

  if (type === 'initials') {
    return {
      width: 104,
      height: 34,
      value: 'JC',
      fontSize: 16,
    }
  }

  if (type === 'signature-box') {
    return {
      width: 178,
      height: 46,
      value: 'Signature',
      fontSize: 14,
    }
  }

  if (type === 'check') {
    return {
      width: 30,
      height: 30,
      value: '✓',
      fontSize: 22,
    }
  }

  return {
    width: 220,
    height: 42,
    value: 'Type here',
    fontSize: 16,
  }
}

function sourceLabel(params: {
  sourceUrl: string
  localFileName: string
  templateId: string | null
  documentId: string | null
}) {
  if (params.localFileName) {
    return `Local upload · ${params.localFileName}`
  }

  if (params.templateId) {
    return 'Template source'
  }

  if (params.documentId) {
    return 'Existing job document'
  }

  if (params.sourceUrl) {
    return 'Direct PDF source'
  }

  return 'No source loaded'
}

function StatusPill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'success' | 'warning'
}) {
  const toneClasses =
    tone === 'success'
      ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
      : tone === 'warning'
        ? 'border-amber-400/25 bg-amber-500/10 text-amber-100'
        : 'border-white/10 bg-white/[0.05] text-white/70'

  return (
    <div
      className={`rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${toneClasses}`}
    >
      {children}
    </div>
  )
}

function PanelTitle({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string
  title: string
  body?: string
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
        {eyebrow}
      </div>
      <h2 className="mt-2 text-xl font-bold tracking-tight text-white">{title}</h2>
      {body ? <p className="mt-2 text-sm leading-6 text-white/60">{body}</p> : null}
    </div>
  )
}

export default function ContractsEditorCore() {
  const searchParams = useSearchParams()

  const sourceUrl = searchParams.get('sourceUrl') ?? ''
  const jobId = searchParams.get('jobId')
  const templateId = searchParams.get('templateId')
  const documentId = searchParams.get('documentId')
  const initialName = searchParams.get('name') ?? 'document'

  const [loadedPdfUrl, setLoadedPdfUrl] = useState(sourceUrl)
  const [documentName, setDocumentName] = useState(initialName)
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templatePickerId, setTemplatePickerId] = useState(templateId ?? '')
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(templateId)
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(documentId)
  const [numPages, setNumPages] = useState(0)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [signatureOpen, setSignatureOpen] = useState(false)
  const [pendingSignaturePage, setPendingSignaturePage] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [detectingPage, setDetectingPage] = useState<number | null>(null)
  const [documentLoadError, setDocumentLoadError] = useState(false)
  const [localFileName, setLocalFileName] = useState('')
  const [localObjectUrl, setLocalObjectUrl] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(true)

  const signaturePadRef = useRef<SignatureCanvas | null>(null)

  const draftKey = useMemo(
    () =>
      buildDraftKey({
        jobId,
        templateId: activeTemplateId,
        documentId: activeDocumentId,
        sourceUrl: localFileName ? '' : loadedPdfUrl || sourceUrl,
        localFileName,
        initialName,
      }),
    [
      activeDocumentId,
      activeTemplateId,
      initialName,
      jobId,
      loadedPdfUrl,
      localFileName,
      sourceUrl,
    ]
  )

  const selectedAnnotation = useMemo(
    () => annotations.find((annotation) => annotation.id === selectedId) ?? null,
    [annotations, selectedId]
  )

  const annotationCounts = useMemo(() => {
    return annotations.reduce<Record<AnnotationType, number>>(
      (acc, annotation) => {
        acc[annotation.type] += 1
        return acc
      },
      {
        text: 0,
        date: 0,
        initials: 0,
        signature: 0,
        'signature-box': 0,
        check: 0,
      }
    )
  }, [annotations])

  const sourceSummary = useMemo(
    () =>
      sourceLabel({
        sourceUrl: loadedPdfUrl || sourceUrl,
        localFileName,
        templateId: activeTemplateId,
        documentId: activeDocumentId,
      }),
    [activeDocumentId, activeTemplateId, loadedPdfUrl, localFileName, sourceUrl]
  )

  const hasSource = Boolean(loadedPdfUrl)

  useEffect(() => {
    if (sourceUrl) {
      setActiveTemplateId(templateId)
      setActiveDocumentId(documentId)
      setTemplatePickerId(templateId ?? '')
      setLocalFileName('')
      setLoadedPdfUrl(sourceUrl)
      setDocumentName(initialName)
      setAnnotations([])
      setSelectedId(null)
      setDocumentLoadError(false)
      setMessage('')
      return
    }

    setActiveTemplateId(templateId)
    setActiveDocumentId(documentId)
    setTemplatePickerId(templateId ?? '')
    setLoadedPdfUrl('')
    setMessage(
      'Open this editor from Templates, from a job document, or upload a one-time PDF from your device.'
    )
  }, [documentId, initialName, sourceUrl, templateId])

  useEffect(() => {
    let isActive = true

    async function loadTemplates() {
      setTemplatesLoading(true)

      const { data, error } = await supabase
        .from('document_templates')
        .select('id, name, category, file_url')
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (!isActive) {
        return
      }

      if (error) {
        setTemplates([])
        setTemplatesLoading(false)
        return
      }

      setTemplates((data ?? []) as TemplateOption[])
      setTemplatesLoading(false)
    }

    void loadTemplates()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    return () => {
      if (localObjectUrl) {
        URL.revokeObjectURL(localObjectUrl)
      }
    }
  }, [localObjectUrl])

  useEffect(() => {
    function syncNetworkStatus() {
      setIsOnline(window.navigator.onLine)
    }

    syncNetworkStatus()

    window.addEventListener('online', syncNetworkStatus)
    window.addEventListener('offline', syncNetworkStatus)

    return () => {
      window.removeEventListener('online', syncNetworkStatus)
      window.removeEventListener('offline', syncNetworkStatus)
    }
  }, [])

  useEffect(() => {
    const rawDraft = localStorage.getItem(draftKey)

    if (!rawDraft) {
      return
    }

    try {
      const draft = JSON.parse(rawDraft) as {
        documentName?: string
        annotations?: Annotation[]
      }

      if (draft.documentName) {
        setDocumentName(draft.documentName)
      }

      if (draft.annotations?.length) {
        setAnnotations(draft.annotations)
        setMessage('Restored your saved contract draft from this device.')
      }
    } catch (error) {
      console.error('Failed to restore contract draft.', error)
    }
  }, [draftKey])

  useEffect(() => {
    if (!loadedPdfUrl) return

    localStorage.setItem(
      draftKey,
      JSON.stringify({
        documentName,
        annotations,
        updatedAt: new Date().toISOString(),
      })
    )
  }, [annotations, documentName, draftKey, loadedPdfUrl])

  useEffect(() => {
    function handleDeleteShortcut(event: KeyboardEvent) {
      if (!selectedId) return

      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        setAnnotations((current) => current.filter((annotation) => annotation.id !== selectedId))
        setSelectedId(null)
      }
    }

    window.addEventListener('keydown', handleDeleteShortcut)

    return () => {
      window.removeEventListener('keydown', handleDeleteShortcut)
    }
  }, [selectedId])

  function resetEditorForDocument(nextUrl: string, nextName: string) {
    setLoadedPdfUrl(nextUrl)
    setDocumentName(nextName)
    setAnnotations([])
    setSelectedId(null)
    setNumPages(0)
    setDocumentLoadError(false)
    setMessage('')
  }

  function handleLocalFileChange(file: File | null) {
    if (!file) return

    if (file.type !== 'application/pdf') {
      setMessage('Please choose a PDF file.')
      return
    }

    if (localObjectUrl) {
      URL.revokeObjectURL(localObjectUrl)
    }

    const nextObjectUrl = URL.createObjectURL(file)
    setLocalObjectUrl(nextObjectUrl)
    setLocalFileName(file.name)
    setActiveTemplateId(null)
    setActiveDocumentId(null)
    setTemplatePickerId('')
    resetEditorForDocument(nextObjectUrl, file.name.replace(/\.pdf$/i, ''))
  }

  function loadTemplateFromPicker() {
    const selectedTemplate = templates.find((template) => template.id === templatePickerId)

    if (!selectedTemplate) {
      setMessage('Choose a template first.')
      return
    }

    if (localObjectUrl) {
      URL.revokeObjectURL(localObjectUrl)
      setLocalObjectUrl(null)
    }

    setLocalFileName('')
    setActiveTemplateId(selectedTemplate.id)
    setActiveDocumentId(null)
    resetEditorForDocument(selectedTemplate.file_url, selectedTemplate.name)
  }

  function onLoadSuccess({ numPages: totalPages }: { numPages: number }) {
    setNumPages(totalPages)
    setDocumentLoadError(false)
    setMessage('')
  }

  function onLoadError(error: Error) {
    console.error(error)
    setDocumentLoadError(true)
    setMessage('This PDF could not be loaded. Make sure the source file is valid and reachable.')
  }

  function addAnnotation(page: number, type: AnnotationType, x = 60, y = 120) {
    const defaults = getAnnotationDefaults(type)

    const nextAnnotation: Annotation = {
      id: uid(),
      page,
      type,
      x,
      y,
      ...defaults,
    }

    setAnnotations((current) => [...current, nextAnnotation])
    setSelectedId(nextAnnotation.id)
  }

  function duplicateSelected() {
    if (!selectedAnnotation) return

    const duplicated: Annotation = {
      ...selectedAnnotation,
      id: uid(),
      x: Math.min(selectedAnnotation.x + 18, PAGE_WIDTH - selectedAnnotation.width - 8),
      y: selectedAnnotation.y + 18,
    }

    setAnnotations((current) => [...current, duplicated])
    setSelectedId(duplicated.id)
  }

  function updateAnnotation(id: string, partial: Partial<Annotation>) {
    setAnnotations((current) =>
      current.map((annotation) =>
        annotation.id === id ? { ...annotation, ...partial } : annotation
      )
    )
  }

  function deleteSelected() {
    if (!selectedId) return

    setAnnotations((current) => current.filter((annotation) => annotation.id !== selectedId))
    setSelectedId(null)
  }

  function clearLocalDraft() {
    localStorage.removeItem(draftKey)
    setAnnotations([])
    setSelectedId(null)
    setMessage('Local draft cleared for this document.')
  }

  function openSignaturePad(page: number) {
    setPendingSignaturePage(page)
    setSignatureOpen(true)
  }

  function signSelectedBox() {
    if (!selectedAnnotation || selectedAnnotation.type !== 'signature-box') {
      setMessage('Select a signature box first.')
      return
    }

    setPendingSignaturePage(selectedAnnotation.page)
    setSignatureOpen(true)
  }

  function clearSignaturePad() {
    signaturePadRef.current?.clear()
  }

  function addSignatureFromPad() {
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
      setMessage('Draw a signature first.')
      return
    }

    const dataUrl = signaturePadRef.current.toDataURL('image/png')
    const targetAnnotation = selectedId
      ? annotations.find((annotation) => annotation.id === selectedId)
      : null

    if (targetAnnotation && targetAnnotation.type === 'signature-box') {
      updateAnnotation(targetAnnotation.id, {
        type: 'signature',
        imageDataUrl: dataUrl,
        value: undefined,
      })
      setSignatureOpen(false)
      setPendingSignaturePage(null)
      signaturePadRef.current.clear()
      return
    }

    if (pendingSignaturePage === null) {
      setMessage('Pick a page for the free signature first.')
      return
    }

    const signatureAnnotation: Annotation = {
      id: uid(),
      page: pendingSignaturePage,
      type: 'signature',
      x: 60,
      y: 120,
      width: 190,
      height: 58,
      imageDataUrl: dataUrl,
    }

    setAnnotations((current) => [...current, signatureAnnotation])
    setSelectedId(signatureAnnotation.id)
    setSignatureOpen(false)
    setPendingSignaturePage(null)
    signaturePadRef.current.clear()
  }

  function hasNearbyAnnotation(page: number, x: number, y: number) {
    return annotations.some((annotation) => {
      if (annotation.page !== page) return false

      const dx = Math.abs(annotation.x - x)
      const dy = Math.abs(annotation.y - y)

      return dx < 70 && dy < 40
    })
  }

  function autoDetectFields(pageNumber: number) {
    setDetectingPage(pageNumber)
    setMessage('')

    requestAnimationFrame(() => {
      const pageRoot = document.querySelector(
        `[data-page-number="${pageNumber}"]`
      ) as HTMLElement | null

      if (!pageRoot) {
        setMessage('Could not locate the rendered PDF page.')
        setDetectingPage(null)
        return
      }

      const textLayer = pageRoot.querySelector(
        '.react-pdf__Page__textContent'
      ) as HTMLElement | null
      const canvasLayer = pageRoot.querySelector('canvas') as HTMLCanvasElement | null

      if (!textLayer || !canvasLayer) {
        setMessage('PDF text layer is not ready yet. Try again in a second.')
        setDetectingPage(null)
        return
      }

      const canvasRect = canvasLayer.getBoundingClientRect()
      const spans = Array.from(textLayer.querySelectorAll('span')) as HTMLSpanElement[]
      const detected: Annotation[] = []

      for (const span of spans) {
        const text = (span.textContent ?? '').trim()
        if (!text) continue

        const rect = span.getBoundingClientRect()
        if (!rect.width || !rect.height) continue

        const x = rect.left - canvasRect.left + rect.width + 8
        const y = rect.top - canvasRect.top - 4

        if (x < 0 || y < 0 || hasNearbyAnnotation(pageNumber, x, y)) {
          continue
        }

        if (SIGNATURE_PATTERNS.some((pattern) => pattern.test(text))) {
          detected.push({
            id: uid(),
            page: pageNumber,
            type: 'signature-box',
            x,
            y,
            ...getAnnotationDefaults('signature-box'),
          })
          continue
        }

        if (INITIALS_PATTERNS.some((pattern) => pattern.test(text))) {
          detected.push({
            id: uid(),
            page: pageNumber,
            type: 'initials',
            x,
            y,
            ...getAnnotationDefaults('initials'),
          })
          continue
        }

        if (DATE_PATTERNS.some((pattern) => pattern.test(text))) {
          detected.push({
            id: uid(),
            page: pageNumber,
            type: 'date',
            x,
            y,
            ...getAnnotationDefaults('date'),
          })
          continue
        }

        if (CHECK_PATTERNS.some((pattern) => pattern.test(text))) {
          detected.push({
            id: uid(),
            page: pageNumber,
            type: 'check',
            x,
            y,
            ...getAnnotationDefaults('check'),
          })
        }
      }

      if (detected.length === 0) {
        setMessage('No likely fields were detected on that page.')
      } else {
        setAnnotations((current) => [...current, ...detected])
        setMessage(
          `Detected ${detected.length} field${detected.length === 1 ? '' : 's'} on page ${pageNumber}.`
        )
      }

      setDetectingPage(null)
    })
  }

  async function saveAnnotatedPdf() {
    if (!loadedPdfUrl) {
      setMessage('No source PDF is loaded.')
      return
    }

    try {
      setSaving(true)
      setMessage('')

      const sourceBytes = await fetch(loadedPdfUrl).then(async (response) => {
        if (!response.ok) {
          throw new Error('The source PDF could not be loaded for saving.')
        }

        return response.arrayBuffer()
      })

      const pdfDoc = await PDFDocument.load(sourceBytes)
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const pages = pdfDoc.getPages()

      for (const annotation of annotations) {
        const page = pages[annotation.page - 1]
        if (!page) continue

        const pageSize = page.getSize()
        const renderWidth = PAGE_WIDTH
        const renderHeight = (pageSize.height / pageSize.width) * renderWidth
        const pdfX = (annotation.x / renderWidth) * pageSize.width
        const pdfWidth = (annotation.width / renderWidth) * pageSize.width
        const topY = (annotation.y / renderHeight) * pageSize.height
        const pdfHeight = (annotation.height / renderHeight) * pageSize.height
        const pdfY = pageSize.height - topY - pdfHeight

        if (annotation.type === 'signature' && annotation.imageDataUrl) {
          const pngImage = await pdfDoc.embedPng(
            dataURLToUint8Array(annotation.imageDataUrl)
          )

          page.drawImage(pngImage, {
            x: pdfX,
            y: pdfY,
            width: pdfWidth,
            height: pdfHeight,
          })

          continue
        }

        if (annotation.type === 'signature-box') {
          continue
        }

        const text = annotation.type === 'check' ? '✓' : annotation.value ?? ''
        const fontSize = annotation.fontSize ?? 16
        const scaledFontSize = (fontSize / renderWidth) * pageSize.width

        page.drawText(text, {
          x: pdfX,
          y: pdfY + pdfHeight / 2 - scaledFontSize / 2,
          size: scaledFontSize,
          font,
          color: rgb(0, 0, 0),
          maxWidth: pdfWidth,
        })
      }

      const finalPdfBytes = await pdfDoc.save()
      const finalPdfBuffer = new ArrayBuffer(finalPdfBytes.byteLength)
      new Uint8Array(finalPdfBuffer).set(finalPdfBytes)
      const blob = new Blob([finalPdfBuffer], {
        type: 'application/pdf',
      })
      const downloadName = `${documentName || 'annotated-document'}.pdf`

      if (!isOnline) {
        downloadPdfBlob(blob, downloadName)
        setMessage(
          jobId
            ? 'Offline mode: PDF downloaded locally. Reconnect to upload it back to the job.'
            : 'Offline mode: annotated PDF saved locally.'
        )
        return
      }

      if (jobId) {
        const formData = new FormData()
        formData.set('templateId', activeTemplateId ?? '')
        formData.set('documentName', documentName || 'signed-document')
        formData.set(
          'documentType',
          activeDocumentId || localFileName ? 'Edited Document' : 'Signed Document'
        )
        formData.set('file', blob, `${slugifyFileName(documentName || 'signed-document')}.pdf`)

        const response = await authorizedFetch(`/api/jobs/${jobId}/signed-documents`, {
          method: 'POST',
          body: formData,
        })

        const result = (await response.json().catch(() => null)) as
          | { error?: string }
          | null

        if (!response.ok) {
          throw new Error(result?.error || 'Failed to save the signed PDF.')
        }

        localStorage.removeItem(draftKey)
        setMessage('Signed document saved back to the job.')
        return
      }

      downloadPdfBlob(blob, downloadName)
      localStorage.removeItem(draftKey)
      setMessage('Annotated PDF downloaded.')
    } catch (error) {
      console.error(error)
      setMessage(
        error instanceof Error ? error.message : 'Failed to save the annotated PDF.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.22),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_26%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,179,122,0.7),transparent)]" />

        <div className="relative space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b37a]">
                Contracts
              </div>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
                Contract Studio
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-white/68 md:text-lg">
                Load a template, review a job document, or upload a one-off PDF. Place fields, sign in-browser, auto-detect likely signature spots, and save clean signed output back to the CRM.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={jobId ? `/jobs/${jobId}` : '/templates'}
                className="rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.1]"
              >
                {jobId ? 'Back to Job' : 'Back to Templates'}
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <StatusPill tone={isOnline ? 'success' : 'warning'}>
              {isOnline ? 'Online Sync Active' : 'Offline Mode'}
            </StatusPill>
            <StatusPill>{sourceSummary}</StatusPill>
            <StatusPill>{numPages || 0} page(s)</StatusPill>
            <StatusPill>{annotations.length} overlay item(s)</StatusPill>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)_220px_220px]">
            <input
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d6b37a]/35"
              placeholder="Document name"
              value={documentName}
              onChange={(event) => setDocumentName(event.target.value)}
            />

            <div className="flex gap-2">
              <select
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
                value={templatePickerId}
                onChange={(event) => setTemplatePickerId(event.target.value)}
                disabled={templatesLoading || templates.length === 0}
              >
                <option value="">
                  {templatesLoading
                    ? 'Loading templates...'
                    : templates.length === 0
                      ? 'No templates available'
                      : 'Choose template'}
                </option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                    {template.category ? ` • ${template.category}` : ''}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={loadTemplateFromPicker}
                disabled={!templatePickerId}
                className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08] disabled:opacity-50"
              >
                Load
              </button>
            </div>

            <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]">
              <input
                type="file"
                accept="application/pdf"
                onChange={(event) => handleLocalFileChange(event.target.files?.[0] ?? null)}
                className="hidden"
              />
              Upload Local PDF
            </label>

            <button
              type="button"
              onClick={saveAnnotatedPdf}
              disabled={saving || !hasSource}
              className="rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving...' : jobId ? 'Save Back to Job' : 'Download Signed PDF'}
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={clearLocalDraft}
              className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/75 transition hover:bg-white/[0.1]"
            >
              Clear Local Draft
            </button>

            <button
              type="button"
              onClick={deleteSelected}
              disabled={!selectedId}
              className="rounded-full border border-red-400/20 bg-red-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-red-200 transition hover:bg-red-500/20 disabled:opacity-60"
            >
              Delete Selected
            </button>

            <button
              type="button"
              onClick={signSelectedBox}
              disabled={!selectedAnnotation || selectedAnnotation.type !== 'signature-box'}
              className="rounded-full border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-100 transition hover:bg-blue-500/20 disabled:opacity-60"
            >
              Sign Selected Box
            </button>
          </div>

          {message ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/80">
              {message}
            </div>
          ) : null}

          {!hasSource ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
              No PDF source was provided. Open the editor from Templates or a job document, or upload a PDF from your device.
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
            <PanelTitle
              eyebrow="Toolbox"
              title="Insert Fields"
              body="Use page controls for exact placement, then refine the selected field here."
            />

            <div className="mt-5 grid gap-3">
              {ANNOTATION_PRESETS.map((preset) => (
                <div
                  key={preset.type}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                >
                  <div className="text-sm font-semibold text-white">{preset.label}</div>
                  <div className="text-xs uppercase tracking-[0.16em] text-white/42">
                    Add per page
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => openSignaturePad(1)}
                className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
              >
                Open Signature Pad
              </button>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
            <PanelTitle
              eyebrow="Coverage"
              title="Document Stats"
              body="Quick visibility into what has already been placed on the contract."
            />

            <div className="mt-5 grid gap-3">
              <StatRow label="Text Fields" value={annotationCounts.text} />
              <StatRow label="Dates" value={annotationCounts.date} />
              <StatRow label="Initials" value={annotationCounts.initials} />
              <StatRow label="Signatures" value={annotationCounts.signature} />
              <StatRow label="Signature Boxes" value={annotationCounts['signature-box']} />
              <StatRow label="Checks" value={annotationCounts.check} />
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
            <PanelTitle
              eyebrow="Inspector"
              title="Selected Element"
              body="Click any overlay field on the document to edit or duplicate it."
            />

            {!selectedAnnotation ? (
              <div className="mt-4 rounded-2xl border border-dashed border-white/14 p-4 text-sm text-white/55">
                Nothing selected yet.
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
                    Type
                  </div>
                  <div className="mt-1 text-sm font-semibold capitalize text-white">
                    {selectedAnnotation.type.replace('-', ' ')}
                  </div>
                </div>

                {selectedAnnotation.type !== 'signature' &&
                selectedAnnotation.type !== 'signature-box' &&
                selectedAnnotation.type !== 'check' ? (
                  <label className="block">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                      Value
                    </div>
                    <input
                      value={selectedAnnotation.value ?? ''}
                      onChange={(event) =>
                        updateAnnotation(selectedAnnotation.id, {
                          value: event.target.value,
                        })
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
                    />
                  </label>
                ) : null}

                {selectedAnnotation.type !== 'signature' &&
                selectedAnnotation.type !== 'signature-box' ? (
                  <label className="block">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                      Font Size
                    </div>
                    <input
                      type="number"
                      value={selectedAnnotation.fontSize ?? 16}
                      onChange={(event) =>
                        updateAnnotation(selectedAnnotation.id, {
                          fontSize: Number(event.target.value || 16),
                        })
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
                    />
                  </label>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <InspectorNumberField
                    label="Width"
                    value={Math.round(selectedAnnotation.width)}
                    onChange={(value) =>
                      updateAnnotation(selectedAnnotation.id, {
                        width: value,
                      })
                    }
                  />
                  <InspectorNumberField
                    label="Height"
                    value={Math.round(selectedAnnotation.height)}
                    onChange={(value) =>
                      updateAnnotation(selectedAnnotation.id, {
                        height: value,
                      })
                    }
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={duplicateSelected}
                    className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
                  >
                    Duplicate
                  </button>

                  <button
                    type="button"
                    onClick={deleteSelected}
                    className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/20"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </section>
        </aside>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          {!hasSource ? (
            <div className="rounded-2xl border border-dashed border-white/14 p-10 text-center text-sm text-white/55">
              Open this editor from a template or a job document, or upload a local PDF to begin.
            </div>
          ) : documentLoadError ? (
            <div className="rounded-2xl border border-dashed border-red-400/25 bg-red-500/10 p-10 text-center text-sm text-red-200">
              This PDF could not be rendered.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Document
                file={loadedPdfUrl}
                onLoadSuccess={onLoadSuccess}
                onLoadError={onLoadError}
              >
                <div className="space-y-8">
                  {Array.from({ length: numPages }, (_, index) => {
                    const pageNumber = index + 1
                    const pageAnnotations = annotations.filter(
                      (annotation) => annotation.page === pageNumber
                    )

                    return (
                      <div key={pageNumber} className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">
                              Page
                            </div>
                            <div className="mt-1 text-lg font-semibold text-white">
                              {pageNumber}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => autoDetectFields(pageNumber)}
                              disabled={detectingPage === pageNumber}
                              className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-white/[0.08] disabled:opacity-60"
                            >
                              {detectingPage === pageNumber ? 'Detecting...' : 'Auto Detect'}
                            </button>

                            {ANNOTATION_PRESETS.map((preset) => (
                              <button
                                key={`${pageNumber}-${preset.type}`}
                                type="button"
                                onClick={() => addAnnotation(pageNumber, preset.type)}
                                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                              >
                                {preset.label}
                              </button>
                            ))}

                            <button
                              type="button"
                              onClick={() => openSignaturePad(pageNumber)}
                              className="rounded-2xl bg-[#d6b37a] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-black transition hover:bg-[#e2bf85]"
                            >
                              Free Signature
                            </button>
                          </div>
                        </div>

                        <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-4">
                          <div
                            className="relative overflow-hidden rounded-[1.4rem] bg-white shadow-[0_16px_40px_rgba(0,0,0,0.28)]"
                            style={{ width: PAGE_WIDTH }}
                          >
                            <Page pageNumber={pageNumber} width={PAGE_WIDTH} />

                            {pageAnnotations.map((annotation) => (
                              <Rnd
                                key={annotation.id}
                                size={{
                                  width: annotation.width,
                                  height: annotation.height,
                                }}
                                position={{
                                  x: annotation.x,
                                  y: annotation.y,
                                }}
                                minWidth={annotation.type === 'check' ? 22 : 42}
                                minHeight={annotation.type === 'check' ? 22 : 24}
                                bounds="parent"
                                enableUserSelectHack={false}
                                onMouseDown={() => setSelectedId(annotation.id)}
                                onTouchStart={() => setSelectedId(annotation.id)}
                                onDragStop={(_, position) =>
                                  updateAnnotation(annotation.id, {
                                    x: position.x,
                                    y: position.y,
                                  })
                                }
                                onResizeStop={(_, __, ref, ___, position) =>
                                  updateAnnotation(annotation.id, {
                                    width: ref.offsetWidth,
                                    height: ref.offsetHeight,
                                    x: position.x,
                                    y: position.y,
                                  })
                                }
                                style={{
                                  border:
                                    selectedId === annotation.id
                                      ? '2px solid #111827'
                                      : annotation.type === 'signature-box'
                                        ? '2px dashed #2563eb'
                                        : annotation.type === 'check'
                                          ? '2px dashed #059669'
                                          : '1px dashed #6b7280',
                                  background:
                                    annotation.type === 'signature-box'
                                      ? 'rgba(219,234,254,0.92)'
                                      : annotation.type === 'check'
                                        ? 'rgba(236,253,245,0.92)'
                                        : 'rgba(255,255,255,0.92)',
                                  borderRadius: 12,
                                  padding: 8,
                                  cursor: 'move',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  overflow: 'hidden',
                                  touchAction: 'none',
                                  userSelect: 'none',
                                  zIndex: selectedId === annotation.id ? 20 : 10,
                                }}
                              >
                                {annotation.type === 'signature' && annotation.imageDataUrl ? (
                                  <img
                                    src={annotation.imageDataUrl}
                                    alt="Signature"
                                    className="pointer-events-none h-full w-full object-contain"
                                  />
                                ) : annotation.type === 'signature-box' ? (
                                  <div className="pointer-events-none flex h-full w-full items-center justify-center text-center text-xs font-semibold text-blue-700">
                                    {annotation.value ?? 'Signature'}
                                  </div>
                                ) : annotation.type === 'check' ? (
                                  <div
                                    className="pointer-events-none flex h-full w-full items-center justify-center font-bold text-green-700"
                                    style={{
                                      fontSize: annotation.fontSize ?? 22,
                                    }}
                                  >
                                    ✓
                                  </div>
                                ) : (
                                  <div
                                    className="pointer-events-none h-full w-full overflow-hidden whitespace-pre-wrap break-words text-black"
                                    style={{
                                      fontSize: annotation.fontSize ?? 16,
                                    }}
                                  >
                                    {annotation.value}
                                  </div>
                                )}
                              </Rnd>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Document>
            </div>
          )}
        </section>
      </div>

      {signatureOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6">
          <div className="flex h-full max-h-[90vh] w-full max-w-5xl flex-col rounded-[2rem] border border-white/10 bg-white p-6 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9c7a4a]">
                  Signature Pad
                </div>
                <h2 className="mt-2 text-2xl font-bold text-gray-900">Draw Signature</h2>
                <p className="mt-2 text-sm text-gray-600">
                  Sign directly on the canvas, then place it on the contract.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSignatureOpen(false)
                  setPendingSignaturePage(null)
                }}
                className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition hover:bg-gray-100"
              >
                Close
              </button>
            </div>

            <div className="mt-6 flex-1 overflow-hidden rounded-[1.5rem] border border-gray-200 bg-gray-50">
              <SignatureCanvas
                ref={(instance) => {
                  signaturePadRef.current = instance
                }}
                penColor="black"
                canvasProps={{
                  className: 'h-full w-full',
                }}
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={clearSignaturePad}
                className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition hover:bg-gray-100"
              >
                Clear
              </button>

              <button
                type="button"
                onClick={addSignatureFromPad}
                className="rounded-2xl bg-gray-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                Use Signature
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function StatRow({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="text-sm text-white/65">{label}</div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  )
}

function InspectorNumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (next: number) => void
}) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
        {label}
      </div>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value || 0))}
        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
      />
    </label>
  )
}
