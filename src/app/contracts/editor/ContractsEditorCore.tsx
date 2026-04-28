'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Document, Page, pdfjs } from 'react-pdf'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { Rnd } from 'react-rnd'
import SignatureCanvas from 'react-signature-canvas'
import { authorizedFetch } from '@/lib/api-client'
import { slugifyFileName } from '@/lib/file-utils'
import { supabase } from '@/lib/supabase'
import SendDocumentButton from '@/components/documents/SendDocumentButton'

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

const PDF_WORKER_SRC = '/pdfjs/pdf.worker.min.mjs'
const PDF_STANDARD_FONT_DATA_URL = '/pdfjs/standard_fonts/'
const PDF_CMAP_URL = '/pdfjs/cmaps/'

const PAGE_PADDING = 8

pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function isPdfLikeFile(file: File) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
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

function arrayBufferToUint8Array(value: ArrayBuffer) {
  return new Uint8Array(value)
}

function cloneUint8Array(value: Uint8Array) {
  const copy = new Uint8Array(value.byteLength)
  copy.set(value)
  return copy
}

function uint8ArrayToArrayBuffer(value: Uint8Array) {
  return value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength
  ) as ArrayBuffer
}

function buildDraftKey(params: {
  jobId: string | null
  templateId: string | null
  documentId: string | null
  jobFileId: string | null
  sourceIdentifier: string
  localFileName: string
  initialName: string
}) {
  const sourceToken = slugifyFileName(
    params.templateId
      ? `template-${params.templateId}`
      : params.documentId
        ? `job-document-${params.documentId}`
        : params.jobFileId
          ? `job-file-${params.jobFileId}`
          : params.localFileName || params.sourceIdentifier || params.initialName || 'document'
  ).slice(0, 120)

  return [
    '4e-crm-signer-draft',
    params.jobId ?? 'no-job',
    params.templateId ?? 'no-template',
    params.documentId ?? 'no-document',
    params.jobFileId ?? 'no-job-file',
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
      width: 180,
      height: 48,
      value: new Date().toLocaleDateString('en-US'),
      fontSize: 18,
    }
  }

  if (type === 'initials') {
    return {
      width: 132,
      height: 48,
      value: 'JC',
      fontSize: 20,
    }
  }

  if (type === 'signature-box') {
    return {
      width: 240,
      height: 80,
      value: 'Tap to sign',
      fontSize: 22,
    }
  }

  if (type === 'check') {
    return {
      width: 42,
      height: 42,
      value: '✓',
      fontSize: 26,
    }
  }

  return {
    width: 260,
    height: 52,
    value: 'Type here',
    fontSize: 18,
  }
}

function getAnnotationTypeLabel(type: AnnotationType) {
  return ANNOTATION_PRESETS.find((preset) => preset.type === type)?.label ??
    (type === 'signature' ? 'Signature' : type.replace('-', ' '))
}

function getAnnotationDisplayValue(annotation: Annotation) {
  if (annotation.type === 'signature') {
    return annotation.imageDataUrl ? 'Signature ready' : 'Signature needed'
  }

  if (annotation.type === 'signature-box') {
    return annotation.value ?? 'Click to sign'
  }

  if (annotation.type === 'check') {
    return 'Checkmark'
  }

  return annotation.value?.trim() || 'Empty'
}

function getFittedOverlayFontSize(annotation: Annotation) {
  const baseSize =
    annotation.fontSize ??
    (annotation.type === 'signature-box' ? 22 : annotation.type === 'check' ? 26 : 18)

  if (annotation.type === 'signature-box') {
    return clamp(
      Math.min(baseSize, annotation.height * 0.34, annotation.width / 5.8),
      14,
      28
    )
  }

  if (annotation.type === 'check') {
    return clamp(
      Math.min(baseSize, annotation.height * 0.82, annotation.width * 0.78),
      16,
      34
    )
  }

  const lines = (annotation.value ?? ' ').split(/\n+/).filter(Boolean)
  const longestLine = lines.reduce(
    (maxLength, line) => Math.max(maxLength, line.length),
    1
  )
  const lineCount = Math.max(lines.length, 1)
  const maxByHeight = (annotation.height - 10) / lineCount
  const maxByWidth = (annotation.width - 12) / Math.max(longestLine * 0.58, 1)

  return clamp(Math.min(baseSize, maxByHeight, maxByWidth), 8, 28)
}

function buildTypedSignatureDataUrl(value: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 1600
  canvas.height = 420

  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Could not create the signature preview.')
  }

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#111111'
  context.textBaseline = 'middle'

  let fontSize = 180

  while (fontSize > 84) {
    context.font = `italic ${fontSize}px "Brush Script MT", "Segoe Script", "Snell Roundhand", cursive`

    if (context.measureText(value).width <= canvas.width - 120) {
      break
    }

    fontSize -= 8
  }

  context.font = `italic ${fontSize}px "Brush Script MT", "Segoe Script", "Snell Roundhand", cursive`
  context.fillText(value, 48, canvas.height / 2)

  return canvas.toDataURL('image/png')
}

function sourceLabel(params: {
  sourceUrl: string
  localFileName: string
  templateId: string | null
  documentId: string | null
  jobFileId: string | null
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

  if (params.jobFileId) {
    return 'Uploaded job document'
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
  const jobFileId = searchParams.get('jobFileId')
  const initialName = searchParams.get('name') ?? 'document'

  const [loadedPdfData, setLoadedPdfData] = useState<Uint8Array | null>(null)
  const [loadedPdfUrl, setLoadedPdfUrl] = useState<string | null>(null)
  const [documentName, setDocumentName] = useState(initialName)
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templatePickerId, setTemplatePickerId] = useState(templateId ?? '')
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(templateId)
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(documentId)
  const [activeJobFileId, setActiveJobFileId] = useState<string | null>(jobFileId)
  const [numPages, setNumPages] = useState(0)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeInsertionType, setActiveInsertionType] = useState<AnnotationType | null>(null)
  const [signatureOpen, setSignatureOpen] = useState(false)
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>('draw')
  const [typedSignature, setTypedSignature] = useState('')
  const [pendingSignaturePage, setPendingSignaturePage] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [detectingPage, setDetectingPage] = useState<number | null>(null)
  const [documentLoadError, setDocumentLoadError] = useState(false)
  const [localFileName, setLocalFileName] = useState('')
  const [isOnline, setIsOnline] = useState(true)
  const [sourceLoading, setSourceLoading] = useState(false)
  const [recipientEmail, setRecipientEmail] = useState<string | null>(null)
  const [shareableDocumentUrl, setShareableDocumentUrl] = useState<string | null>(
    sourceUrl || null
  )

  const signaturePadRef = useRef<SignatureCanvas | null>(null)
  const pdfContainerRef = useRef<HTMLDivElement | null>(null)
  const pageWidthRef = useRef(880)
  const [pageWidth, setPageWidth] = useState(880)
  const [savedSignatureDataUrl, setSavedSignatureDataUrl] = useState<string | null>(null)

  const draftKey = useMemo(
    () =>
      buildDraftKey({
        jobId,
        templateId: activeTemplateId,
        documentId: activeDocumentId,
        jobFileId: activeJobFileId,
        sourceIdentifier: sourceUrl,
        localFileName,
        initialName,
      }),
    [
      activeDocumentId,
      activeJobFileId,
      activeTemplateId,
      initialName,
      jobId,
      localFileName,
      sourceUrl,
    ]
  )

  const selectedAnnotation = useMemo(
    () => annotations.find((annotation) => annotation.id === selectedId) ?? null,
    [annotations, selectedId]
  )

  const orderedAnnotations = useMemo(
    () =>
      [...annotations].sort(
        (left, right) =>
          left.page - right.page || left.y - right.y || left.x - right.x
      ),
    [annotations]
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
        sourceUrl,
        localFileName,
        templateId: activeTemplateId,
        documentId: activeDocumentId,
        jobFileId: activeJobFileId,
      }),
    [activeDocumentId, activeJobFileId, activeTemplateId, localFileName, sourceUrl]
  )

  const hasSource = Boolean(loadedPdfData)
  const pdfDocumentOptions = useMemo(
    () => ({
      cMapPacked: true,
      cMapUrl: PDF_CMAP_URL,
      standardFontDataUrl: PDF_STANDARD_FONT_DATA_URL,
    }),
    []
  )

  useEffect(() => {
    if (!loadedPdfData) {
      setLoadedPdfUrl(null)
      return
    }

    const nextUrl = URL.createObjectURL(
      new Blob([uint8ArrayToArrayBuffer(cloneUint8Array(loadedPdfData))], {
        type: 'application/pdf',
      })
    )

    setLoadedPdfUrl(nextUrl)

    return () => {
      URL.revokeObjectURL(nextUrl)
    }
  }, [loadedPdfData])

  useEffect(() => {
    let isActive = true

    async function resolveInitialSource() {
      setActiveTemplateId(templateId)
      setActiveDocumentId(documentId)
      setActiveJobFileId(jobFileId)
      setTemplatePickerId(templateId ?? '')
      setLocalFileName('')
      setShareableDocumentUrl(sourceUrl || null)

      if (!templateId && !documentId && !jobFileId && !sourceUrl) {
        setSourceLoading(false)
        setLoadedPdfData(null)
        setDocumentName(initialName)
        setAnnotations([])
        setSelectedId(null)
        setNumPages(0)
        setDocumentLoadError(false)
        setMessage(
          'Open this editor from Templates, from a job document, or upload a one-time PDF from your device.'
        )
        return
      }

      const endpoint = documentId
        ? `/api/job-documents/${documentId}`
        : jobFileId
          ? `/api/job-files/${jobFileId}`
          : templateId
            ? `/api/templates/${templateId}`
            : ''

      setSourceLoading(true)
      setLoadedPdfData(null)
      setDocumentName(initialName)
      setAnnotations([])
      setSelectedId(null)
      setNumPages(0)
      setDocumentLoadError(false)
      setMessage('')

      try {
        const fetchPdfBytes = async (target: string, secured: boolean) => {
          const response = secured
            ? await authorizedFetch(target)
            : await fetch(target, { cache: 'no-store' })

          const result = secured
            ? ((await response.clone().json().catch(() => null)) as
                | {
                    error?: string
                  }
                | null)
            : null

          if (!response.ok) {
            throw new Error(result?.error || 'Could not load this PDF source.')
          }

          return arrayBufferToUint8Array(await response.arrayBuffer())
        }

        const pdfBytes = endpoint
          ? await fetchPdfBytes(endpoint, true)
          : sourceUrl
            ? await fetchPdfBytes(sourceUrl, false)
            : null

        if (!isActive || !pdfBytes) {
          return
        }

        setLoadedPdfData(pdfBytes)
      } catch (error) {
        console.error(error)

        if (!isActive) {
          return
        }

        if (endpoint && sourceUrl) {
          try {
            const fallbackResponse = await fetch(sourceUrl, { cache: 'no-store' })

            if (!fallbackResponse.ok) {
              throw new Error('Could not load the fallback PDF source.')
            }

            const fallbackBytes = arrayBufferToUint8Array(
              await fallbackResponse.arrayBuffer()
            )

            if (!isActive) {
              return
            }

            setLoadedPdfData(fallbackBytes)
            setMessage('Loaded the fallback PDF source after the secured source failed.')
            return
          } catch (fallbackError) {
            console.error(fallbackError)
          }
        }

        setLoadedPdfData(null)
        setDocumentLoadError(true)
        setMessage(
          error instanceof Error ? error.message : 'Could not load this PDF source.'
        )
      } finally {
        if (isActive) {
          setSourceLoading(false)
        }
      }
    }

    void resolveInitialSource()

    return () => {
      isActive = false
    }
  }, [documentId, initialName, jobFileId, sourceUrl, templateId])

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
    let isActive = true

    async function loadRecipientEmail() {
      if (!jobId) {
        setRecipientEmail(null)
        return
      }

      const { data, error } = await supabase
        .from('jobs')
        .select(
          `
            homeowners (
              email
            )
          `
        )
        .eq('id', jobId)
        .maybeSingle()

      if (!isActive) {
        return
      }

      if (error) {
        setRecipientEmail(null)
        return
      }

      const homeowner = Array.isArray(data?.homeowners)
        ? data.homeowners[0] ?? null
        : data?.homeowners ?? null

      setRecipientEmail(homeowner?.email ?? null)
    }

    void loadRecipientEmail()

    return () => {
      isActive = false
    }
  }, [jobId])

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
    if (!loadedPdfData) return

    localStorage.setItem(
      draftKey,
      JSON.stringify({
        documentName,
        annotations,
        updatedAt: new Date().toISOString(),
      })
    )
  }, [annotations, documentName, draftKey, loadedPdfData])

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

  useEffect(() => {
    const el = pdfContainerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width)
      if (w > 100) {
        setPageWidth(w)
        pageWidthRef.current = w
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [numPages])

  useEffect(() => {
    if (!signatureOpen || signatureMode !== 'draw') return
    const canvas = signaturePadRef.current?.getCanvas()
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.getContext('2d')?.scale(dpr, dpr)
    signaturePadRef.current?.clear()
  }, [signatureOpen, signatureMode])

  function resetEditorForDocument(nextData: Uint8Array | null, nextName: string) {
    setLoadedPdfData(nextData)
    setDocumentName(nextName)
    setAnnotations([])
    setSelectedId(null)
    setNumPages(0)
    setDocumentLoadError(false)
    setMessage('')
  }

  async function handleLocalFileChange(file: File | null) {
    if (!file) return

    if (!isPdfLikeFile(file)) {
      setMessage('Please choose a PDF file.')
      return
    }

    const nextFileData = arrayBufferToUint8Array(await file.arrayBuffer())
    setLocalFileName(file.name)
    setActiveTemplateId(null)
    setActiveDocumentId(null)
    setActiveJobFileId(null)
    setTemplatePickerId('')
    setShareableDocumentUrl(null)
    resetEditorForDocument(nextFileData, file.name.replace(/\.pdf$/i, ''))
  }

  async function loadTemplateFromPicker() {
    const selectedTemplate = templates.find((template) => template.id === templatePickerId)

    if (!selectedTemplate) {
      setMessage('Choose a template first.')
      return
    }

    setLocalFileName('')
    setActiveTemplateId(selectedTemplate.id)
    setActiveDocumentId(null)
    setActiveJobFileId(null)
    setShareableDocumentUrl(selectedTemplate.file_url || null)
    setSourceLoading(true)
    resetEditorForDocument(null, selectedTemplate.name)

    try {
      const response = await authorizedFetch(`/api/templates/${selectedTemplate.id}`)
      const result = (await response.clone().json().catch(() => null)) as
        | {
            error?: string
          }
        | null

      if (!response.ok) {
        throw new Error(result?.error || 'Could not load the selected template.')
      }

      setLoadedPdfData(arrayBufferToUint8Array(await response.arrayBuffer()))
      setMessage('')
    } catch (error) {
      console.error(error)

      try {
        if (!selectedTemplate.file_url) {
          throw error
        }

        const fallbackResponse = await fetch(selectedTemplate.file_url, {
          cache: 'no-store',
        })

        if (!fallbackResponse.ok) {
          throw new Error('Could not load the public template source.')
        }

        setLoadedPdfData(
          arrayBufferToUint8Array(await fallbackResponse.arrayBuffer())
        )
        setMessage(
          error instanceof Error
            ? `${error.message} Loaded the public template source instead.`
            : 'Loaded the public template source instead.'
        )
      } catch (fallbackError) {
        console.error(fallbackError)
        setDocumentLoadError(true)
        setMessage(
          error instanceof Error
            ? error.message
            : 'Could not load the selected template.'
        )
      }
    } finally {
      setSourceLoading(false)
    }
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

  function queueAnnotationPlacement(type: AnnotationType) {
    setActiveInsertionType((current) => {
      const nextType = current === type ? null : type

      if (nextType) {
        setMessage(`Click anywhere on a page to place a ${getAnnotationTypeLabel(type)} field.`)
      } else {
        setMessage('Field placement cancelled.')
      }

      return nextType
    })
  }

  function placeAnnotationFromPointer(
    page: number,
    type: AnnotationType,
    event: ReactMouseEvent<HTMLDivElement>
  ) {
    const surface = event.currentTarget.getBoundingClientRect()
    const defaults = getAnnotationDefaults(type)
    const nextX = clamp(
      event.clientX - surface.left - defaults.width / 2,
      PAGE_PADDING,
      pageWidthRef.current - defaults.width - PAGE_PADDING
    )
    const nextY = clamp(
      event.clientY - surface.top - defaults.height / 2,
      PAGE_PADDING,
      surface.height - defaults.height - PAGE_PADDING
    )

    addAnnotation(page, type, nextX, nextY)
    setActiveInsertionType(null)
    setMessage(`${getAnnotationTypeLabel(type)} field added on page ${page}.`)
  }

  function duplicateSelected() {
    if (!selectedAnnotation) return

    const duplicated: Annotation = {
      ...selectedAnnotation,
      id: uid(),
      x: Math.min(selectedAnnotation.x + 18, pageWidthRef.current - selectedAnnotation.width - 8),
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
    setSignatureMode('draw')
    setSignatureOpen(true)
  }

  function clearSignaturePad() {
    signaturePadRef.current?.clear()
  }

  function placeSignatureDataUrl(dataUrl: string) {
    setSavedSignatureDataUrl(dataUrl)

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
      width: 240,
      height: 90,
      imageDataUrl: dataUrl,
    }

    setAnnotations((current) => [...current, signatureAnnotation])
    setSelectedId(signatureAnnotation.id)
    setSignatureOpen(false)
    setPendingSignaturePage(null)
  }

  function applySignatureToAll(dataUrl: string) {
    setSavedSignatureDataUrl(dataUrl)
    setAnnotations((current) =>
      current.map((annotation) =>
        annotation.type === 'signature-box' && !annotation.imageDataUrl
          ? { ...annotation, type: 'signature' as AnnotationType, imageDataUrl: dataUrl, value: undefined }
          : annotation
      )
    )
    setSignatureOpen(false)
    setPendingSignaturePage(null)
    setMessage('Signature applied to all unsigned boxes.')
  }

  function addSignatureFromPad() {
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
      setMessage('Draw a signature first.')
      return
    }

    const dataUrl = signaturePadRef.current.toDataURL('image/png')
    placeSignatureDataUrl(dataUrl)
    signaturePadRef.current.clear()
  }

  function addSignatureFromPadToAll() {
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
      setMessage('Draw a signature first.')
      return
    }

    const dataUrl = signaturePadRef.current.toDataURL('image/png')
    applySignatureToAll(dataUrl)
    signaturePadRef.current.clear()
  }

  function addTypedSignature() {
    if (!typedSignature.trim()) {
      setMessage('Type a signature first.')
      return
    }

    const dataUrl = buildTypedSignatureDataUrl(typedSignature.trim())
    placeSignatureDataUrl(dataUrl)
  }

  function addTypedSignatureToAll() {
    if (!typedSignature.trim()) {
      setMessage('Type a signature first.')
      return
    }

    const dataUrl = buildTypedSignatureDataUrl(typedSignature.trim())
    applySignatureToAll(dataUrl)
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
    if (!loadedPdfData) {
      setMessage('No source PDF is loaded.')
      return
    }

    try {
      setSaving(true)
      setMessage('')

      const pdfDoc = await PDFDocument.load(cloneUint8Array(loadedPdfData))
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const pages = pdfDoc.getPages()

      for (const annotation of annotations) {
        const page = pages[annotation.page - 1]
        if (!page) continue

        const pageSize = page.getSize()
        const renderWidth = pageWidthRef.current
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
        const fontSize = getFittedOverlayFontSize(annotation)
        const scaledFontSize = (fontSize / renderWidth) * pageSize.width

        page.drawText(text, {
          x: pdfX + 2,
          y: pdfY + Math.max((pdfHeight - scaledFontSize) / 2, 0),
          size: scaledFontSize,
          font,
          color: rgb(0, 0, 0),
          lineHeight: scaledFontSize * 1.08,
          maxWidth: Math.max(pdfWidth - 4, scaledFontSize),
        })
      }

      const finalPdfBytes = await pdfDoc.save()
      const blob = new Blob([uint8ArrayToArrayBuffer(finalPdfBytes)], {
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
          activeDocumentId || activeJobFileId || localFileName
            ? 'Edited Document'
            : 'Signed Document'
        )
        formData.set('file', blob, `${slugifyFileName(documentName || 'signed-document')}.pdf`)

        const response = await authorizedFetch(`/api/jobs/${jobId}/signed-documents`, {
          method: 'POST',
          body: formData,
        })

        const result = (await response.json().catch(() => null)) as
          | {
              error?: string
              document?: {
                file_url?: string | null
                file_name?: string | null
              }
            }
          | null

        if (!response.ok) {
          throw new Error(result?.error || 'Failed to save the signed PDF.')
        }

        localStorage.removeItem(draftKey)
        setShareableDocumentUrl(result?.document?.file_url ?? null)
        if (result?.document?.file_name) {
          setDocumentName(result.document.file_name.replace(/\.pdf$/i, ''))
        }
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
    <div className="space-y-6 pb-24">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:p-8 md:rounded-[2.5rem]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.22),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_26%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,179,122,0.7),transparent)]" />

        <div className="relative space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b37a]">
                Contracts
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white md:text-2xl">
                Contract Studio
              </h1>
            </div>

            <Link
              href={jobId ? `/jobs/${jobId}` : '/templates'}
              className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.1]"
            >
              {jobId ? '← Back to Job' : '← Templates'}
            </Link>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusPill tone={isOnline ? 'success' : 'warning'}>
              {isOnline ? 'Online' : 'Offline'}
            </StatusPill>
            <StatusPill>{sourceSummary}</StatusPill>
            {numPages > 0 && <StatusPill>{numPages} page{numPages !== 1 ? 's' : ''}</StatusPill>}
            {annotations.length > 0 && <StatusPill>{annotations.length} field{annotations.length !== 1 ? 's' : ''}</StatusPill>}
          </div>

          <div className="crm-grid-safe grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d6b37a]/35"
              placeholder="Document name"
              value={documentName}
              onChange={(event) => setDocumentName(event.target.value)}
            />

            <div className="flex gap-2">
              <select
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
                value={templatePickerId}
                onChange={(event) => setTemplatePickerId(event.target.value)}
                disabled={templatesLoading || templates.length === 0}
              >
                <option value="">
                  {templatesLoading
                    ? 'Loading templates...'
                    : templates.length === 0
                      ? 'No templates'
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
                disabled={!templatePickerId || sourceLoading}
                className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.08] disabled:opacity-50"
              >
                Load
              </button>
            </div>

            <div className="flex gap-2">
              <label className="flex flex-1 cursor-pointer items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.08]">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => handleLocalFileChange(event.target.files?.[0] ?? null)}
                  className="hidden"
                />
                Upload PDF
              </label>

              <SendDocumentButton
                documentName={`${documentName || 'document'}.pdf`}
                documentUrl={shareableDocumentUrl ?? ''}
                defaultTo={recipientEmail}
                disabled={!shareableDocumentUrl}
                className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
                triggerLabel="Share"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={clearLocalDraft}
              className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/75 transition hover:bg-white/[0.1]"
            >
              Clear Draft
            </button>

            <button
              type="button"
              onClick={deleteSelected}
              disabled={!selectedId}
              className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-red-200 transition hover:bg-red-500/20 disabled:opacity-60"
            >
              Delete Selected
            </button>

            {activeInsertionType ? (
              <button
                type="button"
                onClick={() => {
                  setActiveInsertionType(null)
                  setMessage('Field placement cancelled.')
                }}
                className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100 transition hover:bg-amber-500/18"
              >
                Cancel Insert
              </button>
            ) : null}
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

      <div className="crm-grid-safe grid gap-6 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4">
          <section className="order-2 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl md:sticky md:top-6">
            <div className="flex items-center justify-between">
              <PanelTitle eyebrow="Toolbox" title="Insert Fields" />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {ANNOTATION_PRESETS.map((preset) => (
                <button
                  key={preset.type}
                  type="button"
                  onClick={() => queueAnnotationPlacement(preset.type)}
                  className={`rounded-2xl px-3 py-2 text-xs font-semibold transition ${
                    activeInsertionType === preset.type
                      ? 'border border-[#d6b37a]/35 bg-[#d6b37a]/12 text-[#f6e7c7]'
                      : 'border border-white/10 bg-black/20 text-white hover:bg-white/[0.06]'
                  }`}
                >
                  {preset.label}
                  {activeInsertionType === preset.type ? ' ✓' : ''}
                </button>
              ))}

              <button
                type="button"
                onClick={() => openSignaturePad(selectedAnnotation?.page ?? 1)}
                className="rounded-2xl border border-[#d6b37a]/30 bg-[#d6b37a]/10 px-3 py-2 text-xs font-semibold text-[#f6e7c7] transition hover:bg-[#d6b37a]/18"
              >
                ✍ Signature
              </button>
            </div>

            {activeInsertionType && (
              <div className="mt-3 rounded-2xl border border-[#d6b37a]/20 bg-[#d6b37a]/8 p-3 text-xs text-[#f6e7c7]">
                Tap anywhere on the PDF to place a {getAnnotationTypeLabel(activeInsertionType)} field.
              </div>
            )}
          </section>

          <section className="order-1 hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl md:block">
            <PanelTitle
              eyebrow="Coverage"
              title="Document Stats"
            />

            <div className="mt-4 grid gap-2">
              <StatRow label="Text" value={annotationCounts.text} />
              <StatRow label="Dates" value={annotationCounts.date} />
              <StatRow label="Initials" value={annotationCounts.initials} />
              <StatRow label="Signatures" value={annotationCounts.signature} />
              <StatRow label="Sig Boxes" value={annotationCounts['signature-box']} />
              <StatRow label="Checks" value={annotationCounts.check} />
            </div>
          </section>

          <section className="order-4 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
            <PanelTitle
              eyebrow="Field Map"
              title="Placed Fields"
              body="Select fields from a readable list instead of hunting for tiny boxes."
            />

            {orderedAnnotations.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-white/14 p-4 text-sm text-white/55">
                No fields placed yet.
              </div>
            ) : (
              <div className="mt-5 space-y-2">
                {orderedAnnotations.map((annotation) => (
                  <button
                    key={annotation.id}
                    type="button"
                    onClick={() => setSelectedId(annotation.id)}
                    className={`block w-full rounded-2xl border px-4 py-3 text-left transition ${
                      selectedId === annotation.id
                        ? 'border-[#d6b37a]/35 bg-[#d6b37a]/10'
                        : 'border-white/10 bg-black/20 hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">
                        {getAnnotationTypeLabel(annotation.type)}
                      </div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">
                        Page {annotation.page}
                      </div>
                    </div>
                    <div className="mt-1 truncate text-xs text-white/55">
                      {getAnnotationDisplayValue(annotation)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="order-3 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl md:sticky md:top-[23rem]">
            <PanelTitle
              eyebrow="Inspector"
              title="Selected Element"
              body="Update values, sizes, or signatures from here once a field is selected."
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
          {sourceLoading ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-10 text-center text-sm text-white/60">
              Loading PDF source...
            </div>
          ) : !hasSource ? (
            <div className="rounded-2xl border border-dashed border-white/14 p-10 text-center text-sm text-white/55">
              Open this editor from a template or a job document, or upload a local PDF to begin.
            </div>
          ) : documentLoadError ? (
            <div className="rounded-2xl border border-dashed border-red-400/25 bg-red-500/10 p-10 text-center text-sm text-red-200">
              This PDF could not be rendered.
            </div>
          ) : (
            <div className="overflow-hidden">
              <Document
                key={`${activeTemplateId ?? 'template-none'}:${activeDocumentId ?? 'document-none'}:${activeJobFileId ?? 'job-file-none'}:${localFileName || 'local-none'}:${loadedPdfData?.byteLength ?? 0}:${sourceUrl || 'no-source'}`}
                file={loadedPdfUrl ?? undefined}
                options={pdfDocumentOptions}
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

                            {activeInsertionType ? (
                              <div className="rounded-2xl border border-[#d6b37a]/25 bg-[#d6b37a]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#f6e7c7]">
                                Click page to place {getAnnotationTypeLabel(activeInsertionType)}
                              </div>
                            ) : null}

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
                            ref={pageNumber === 1 ? pdfContainerRef : undefined}
                            className={`relative overflow-hidden rounded-[1.4rem] bg-white shadow-[0_16px_40px_rgba(0,0,0,0.28)] ${
                              activeInsertionType ? 'cursor-crosshair' : ''
                            }`}
                            style={{ width: '100%' }}
                            onClick={(event) => {
                              if (activeInsertionType) {
                                placeAnnotationFromPointer(pageNumber, activeInsertionType, event)
                              } else {
                                setSelectedId(null)
                              }
                            }}
                          >
                            <Page pageNumber={pageNumber} width={pageWidth || undefined} />

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
                                minWidth={annotation.type === 'check' ? 30 : 48}
                                minHeight={annotation.type === 'check' ? 30 : 28}
                                bounds="parent"
                                disableDragging={false}
                                enableUserSelectHack={false}
                                resizeHandleStyles={{
                                  bottomRight: { width: 22, height: 22, right: -5, bottom: -5, borderRadius: 6, background: 'rgba(100,100,100,0.35)' },
                                  bottomLeft: { width: 22, height: 22, left: -5, bottom: -5, borderRadius: 6, background: 'rgba(100,100,100,0.35)' },
                                  topRight: { width: 22, height: 22, right: -5, top: -5, borderRadius: 6, background: 'rgba(100,100,100,0.35)' },
                                  topLeft: { width: 22, height: 22, left: -5, top: -5, borderRadius: 6, background: 'rgba(100,100,100,0.35)' },
                                }}
                                onMouseDown={(event) => {
                                  event.stopPropagation()
                                  setSelectedId(annotation.id)
                                }}
                                onTouchStart={(event: ReactTouchEvent) => {
                                  event.stopPropagation()
                                  setSelectedId(annotation.id)
                                }}
                                onDoubleClick={(event) => {
                                  event.stopPropagation()
                                  if (annotation.type === 'signature-box') {
                                    openSignaturePad(annotation.page)
                                  }
                                }}
                                onDragStart={(event) => {
                                  event.stopPropagation()
                                  setSelectedId(annotation.id)
                                }}
                                onDrag={(_, position) =>
                                  updateAnnotation(annotation.id, {
                                    x: position.x,
                                    y: position.y,
                                  })
                                }
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
                                  position: 'relative',
                                  zIndex: selectedId === annotation.id ? 20 : 10,
                                }}
                              >
                                {annotation.type === 'signature' && annotation.imageDataUrl ? (
                                  <Image
                                    src={annotation.imageDataUrl}
                                    alt="Signature"
                                    fill
                                    unoptimized
                                    className="pointer-events-none h-full w-full object-contain"
                                  />
                                ) : annotation.type === 'signature-box' ? (
                                  <div className="pointer-events-none flex h-full w-full items-center justify-center text-center text-xs font-semibold text-blue-700">
                                    {annotation.value ?? 'Click to sign'}
                                  </div>
                                ) : annotation.type === 'check' ? (
                                  <div
                                    className="pointer-events-none flex h-full w-full items-center justify-center font-bold text-green-700"
                                    style={{
                                      fontSize: getFittedOverlayFontSize(annotation),
                                    }}
                                  >
                                    ✓
                                  </div>
                                ) : (
                                  <div
                                    className="pointer-events-none h-full w-full overflow-hidden whitespace-pre-wrap break-words text-black"
                                    style={{
                                      fontSize: getFittedOverlayFontSize(annotation),
                                      lineHeight: 1.05,
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 lg:items-center lg:p-6">
          <div className="flex max-h-[95vh] w-full flex-col rounded-t-[1.5rem] bg-white shadow-2xl lg:max-w-3xl lg:rounded-[2rem]">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9c7a4a]">
                  Signature
                </div>
                <h2 className="mt-0.5 text-xl font-bold text-gray-900">
                  {signatureMode === 'draw' ? 'Draw Your Signature' : 'Type Your Signature'}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSignatureOpen(false)
                  setPendingSignaturePage(null)
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-lg font-semibold text-gray-700 transition hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            {savedSignatureDataUrl ? (
              <div className="flex items-center gap-4 border-b border-gray-100 px-6 py-3">
                <Image
                  src={savedSignatureDataUrl}
                  alt="Saved signature"
                  width={120}
                  height={40}
                  unoptimized
                  className="h-10 w-[120px] rounded-lg border border-gray-200 bg-gray-50 object-contain"
                />
                <button
                  type="button"
                  onClick={() => {
                    placeSignatureDataUrl(savedSignatureDataUrl)
                  }}
                  className="rounded-2xl border border-[#9c7a4a]/30 bg-[#9c7a4a]/10 px-4 py-2.5 text-sm font-semibold text-[#7a5c30] transition hover:bg-[#9c7a4a]/18"
                >
                  Use Saved Signature
                </button>
                <button
                  type="button"
                  onClick={() => applySignatureToAll(savedSignatureDataUrl)}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                >
                  Apply to All Boxes
                </button>
              </div>
            ) : null}

            <div className="flex gap-2 px-6 pt-4">
              <button
                type="button"
                onClick={() => setSignatureMode('draw')}
                className={`rounded-2xl px-5 py-2.5 text-sm font-semibold transition ${
                  signatureMode === 'draw'
                    ? 'bg-gray-900 text-white'
                    : 'border border-gray-300 bg-white text-gray-900 hover:bg-gray-100'
                }`}
              >
                Draw
              </button>
              <button
                type="button"
                onClick={() => setSignatureMode('type')}
                className={`rounded-2xl px-5 py-2.5 text-sm font-semibold transition ${
                  signatureMode === 'type'
                    ? 'bg-gray-900 text-white'
                    : 'border border-gray-300 bg-white text-gray-900 hover:bg-gray-100'
                }`}
              >
                Type
              </button>
            </div>

            {signatureMode === 'draw' ? (
              <div
                className="mx-6 mt-4 min-h-[240px] flex-1 overflow-hidden rounded-[1.5rem] border-2 border-dashed border-gray-200 bg-gray-50"
                style={{ touchAction: 'none' }}
              >
                <SignatureCanvas
                  ref={(instance) => {
                    signaturePadRef.current = instance
                  }}
                  penColor="#111111"
                  canvasProps={{
                    className: 'h-full w-full',
                    style: { minHeight: 240 },
                  }}
                />
              </div>
            ) : (
              <div className="mx-6 mt-4 space-y-4 rounded-[1.5rem] border border-gray-200 bg-gray-50 p-5">
                <input
                  value={typedSignature}
                  onChange={(event) => setTypedSignature(event.target.value)}
                  placeholder="Type your full name"
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none transition focus:border-[#9c7a4a]"
                  autoFocus
                />

                <div className="rounded-[1.5rem] border border-dashed border-gray-300 bg-white px-5 py-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                    Preview
                  </div>
                  <div
                    className="mt-2 min-h-[120px] overflow-hidden text-gray-900"
                    style={{
                      fontFamily: '"Brush Script MT", "Segoe Script", "Snell Roundhand", cursive',
                      fontSize: 'clamp(2.5rem, 7vw, 5rem)',
                      lineHeight: 1.1,
                    }}
                  >
                    {typedSignature || 'Your Name'}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 px-6 py-5">
              {signatureMode === 'draw' ? (
                <button
                  type="button"
                  onClick={clearSignaturePad}
                  className="rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-100"
                >
                  Clear
                </button>
              ) : null}

              <button
                type="button"
                onClick={signatureMode === 'draw' ? addSignatureFromPad : addTypedSignature}
                className="rounded-2xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                Use Signature
              </button>

              <button
                type="button"
                onClick={signatureMode === 'draw' ? addSignatureFromPadToAll : addTypedSignatureToAll}
                className="rounded-2xl border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
              >
                Apply to All Boxes
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {hasSource &&
      !signatureOpen ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center">
          <button
            type="button"
            className="pointer-events-auto rounded-full bg-[#d6b37a] px-8 py-4 text-sm font-bold text-black shadow-[0_8px_32px_rgba(214,179,122,0.45)] transition hover:bg-[#e2bf85] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={saveAnnotatedPdf}
            disabled={saving || sourceLoading}
          >
            {saving ? 'Saving…' : jobId ? 'Save Back to Job' : 'Download Signed PDF'}
          </button>
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

