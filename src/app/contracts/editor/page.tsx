export const dynamic = "force-dynamic"

'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Document, Page, pdfjs } from 'react-pdf'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { Rnd } from 'react-rnd'
import SignatureCanvas from 'react-signature-canvas'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { supabase } from '../../../lib/supabase'

import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

type AnnotationType = 'text' | 'date' | 'initials' | 'signature' | 'signature-box'

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

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function dataURLToUint8Array(dataURL: string) {
  const base64 = dataURL.split(',')[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  return bytes
}

function slugifyFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-')
}

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

function ContractsEditorContent() {
  const searchParams = useSearchParams()

  const initialSourceUrl = searchParams.get('sourceUrl') ?? ''
  const jobId = searchParams.get('jobId')
  const templateId = searchParams.get('templateId')
  const documentId = searchParams.get('documentId')
  const initialName = searchParams.get('name') ?? 'document'

  const [pdfUrl, setPdfUrl] = useState(initialSourceUrl)
  const [loadedPdfUrl, setLoadedPdfUrl] = useState(initialSourceUrl)
  const [documentName, setDocumentName] = useState(initialName)
  const [numPages, setNumPages] = useState(0)
  const [pageWidth] = useState(900)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [signatureOpen, setSignatureOpen] = useState(false)
  const [pendingSignaturePage, setPendingSignaturePage] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [detectingPage, setDetectingPage] = useState<number | null>(null)

  const sigRef = useRef<SignatureCanvas | null>(null)

  function onLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages)
  }

  function loadPdf() {
    if (!pdfUrl.trim()) {
      setMessage('Enter a PDF URL first.')
      return
    }

    setLoadedPdfUrl(pdfUrl.trim())
    setAnnotations([])
    setSelectedId(null)
    setMessage('')
  }

  function addText(page: number, type: 'text' | 'date' | 'initials') {
    const defaults: Record<typeof type, string> = {
      text: 'Type here',
      date: new Date().toLocaleDateString('en-US'),
      initials: 'JC',
    }

    const item: Annotation = {
      id: uid(),
      page,
      type,
      x: 60,
      y: 60,
      width: type === 'text' ? 220 : 140,
      height: 40,
      value: defaults[type],
      fontSize: 16,
    }

    setAnnotations((prev) => [...prev, item])
    setSelectedId(item.id)
  }

  function addSignatureBox(page: number, x = 60, y = 120) {
    const item: Annotation = {
      id: uid(),
      page,
      type: 'signature-box',
      x,
      y,
      width: 220,
      height: 90,
      value: 'Drop Signature Here',
    }

    setAnnotations((prev) => [...prev, item])
    setSelectedId(item.id)
  }

  function openSignature(page: number) {
    setPendingSignaturePage(page)
    setSignatureOpen(true)
  }

  function signSelectedBox() {
    if (!selectedId) {
      setMessage('Select a signature box first.')
      return
    }

    const selected = annotations.find((a) => a.id === selectedId)
    if (!selected || selected.type !== 'signature-box') {
      setMessage('Select a signature box first.')
      return
    }

    setPendingSignaturePage(selected.page)
    setSignatureOpen(true)
  }

  function addSignatureFromPad() {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setMessage('Draw a signature first.')
      return
    }

    const dataUrl = sigRef.current.toDataURL('image/png')

    const selected = selectedId
      ? annotations.find((a) => a.id === selectedId)
      : null

    if (selected && selected.type === 'signature-box') {
      setAnnotations((prev) =>
        prev.map((item) =>
          item.id === selected.id
            ? {
                ...item,
                type: 'signature',
                imageDataUrl: dataUrl,
                value: undefined,
              }
            : item
        )
      )
      setSignatureOpen(false)
      setPendingSignaturePage(null)
      sigRef.current.clear()
      return
    }

    if (pendingSignaturePage === null) {
      setMessage('No page selected for signature.')
      return
    }

    const item: Annotation = {
      id: uid(),
      page: pendingSignaturePage,
      type: 'signature',
      x: 60,
      y: 120,
      width: 220,
      height: 90,
      imageDataUrl: dataUrl,
    }

    setAnnotations((prev) => [...prev, item])
    setSelectedId(item.id)
    setSignatureOpen(false)
    setPendingSignaturePage(null)
    sigRef.current.clear()
  }

  function clearSignaturePad() {
    sigRef.current?.clear()
  }

  function updateAnnotation(id: string, partial: Partial<Annotation>) {
    setAnnotations((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...partial } : item))
    )
  }

  function deleteSelected() {
    if (!selectedId) return
    setAnnotations((prev) => prev.filter((item) => item.id !== selectedId))
    setSelectedId(null)
  }

  function hasNearbyAnnotation(page: number, x: number, y: number) {
    return annotations.some((a) => {
      if (a.page !== page) return false
      const dx = Math.abs(a.x - x)
      const dy = Math.abs(a.y - y)
      return dx < 80 && dy < 50
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

      const textLayer = pageRoot.querySelector('.react-pdf__Page__textContent') as HTMLElement | null
      const canvasLayer = pageRoot.querySelector('canvas') as HTMLCanvasElement | null

      if (!textLayer || !canvasLayer) {
        setMessage('PDF text layer is not ready yet. Try again in a second.')
        setDetectingPage(null)
        return
      }

      const canvasRect = canvasLayer.getBoundingClientRect()
      const spans = Array.from(textLayer.querySelectorAll('span')) as HTMLSpanElement[]
      const newItems: Annotation[] = []

      for (const span of spans) {
        const text = (span.textContent ?? '').trim()
        if (!text) continue

        const rect = span.getBoundingClientRect()
        if (!rect.width || !rect.height) continue

        const x = rect.left - canvasRect.left + rect.width + 10
        const y = rect.top - canvasRect.top - 6

        if (x < 0 || y < 0) continue
        if (hasNearbyAnnotation(pageNumber, x, y)) continue

        if (SIGNATURE_PATTERNS.some((p) => p.test(text))) {
          newItems.push({
            id: uid(),
            page: pageNumber,
            type: 'signature-box',
            x,
            y,
            width: 220,
            height: 90,
            value: 'Drop Signature Here',
          })
          continue
        }

        if (INITIALS_PATTERNS.some((p) => p.test(text))) {
          newItems.push({
            id: uid(),
            page: pageNumber,
            type: 'initials',
            x,
            y,
            width: 100,
            height: 34,
            value: 'JC',
            fontSize: 16,
          })
          continue
        }

        if (DATE_PATTERNS.some((p) => p.test(text))) {
          newItems.push({
            id: uid(),
            page: pageNumber,
            type: 'date',
            x,
            y,
            width: 140,
            height: 34,
            value: new Date().toLocaleDateString('en-US'),
            fontSize: 16,
          })
        }
      }

      if (newItems.length === 0) {
        setMessage('No likely fields detected on that page.')
      } else {
        setAnnotations((prev) => [...prev, ...newItems])
        setMessage(
          `Detected ${newItems.length} field${newItems.length === 1 ? '' : 's'} on page ${pageNumber}.`
        )
      }

      setDetectingPage(null)
    })
  }

  async function saveAnnotatedPdf() {
    if (!loadedPdfUrl) {
      setMessage('Load a PDF first.')
      return
    }

    try {
      setSaving(true)
      setMessage('')

      const existingPdfBytes = await fetch(loadedPdfUrl).then((res) =>
        res.arrayBuffer()
      )

      const pdfDoc = await PDFDocument.load(existingPdfBytes)
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const pages = pdfDoc.getPages()

      for (const annotation of annotations) {
        const pageIndex = annotation.page - 1
        const page = pages[pageIndex]
        if (!page) continue

        const pageSize = page.getSize()
        const renderWidth = pageWidth
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
        } else if (annotation.type !== 'signature-box') {
          const text = annotation.value ?? ''
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
      }

      const finalPdfBytes = await pdfDoc.save()
      const pdfBuffer = finalPdfBytes.buffer.slice(
        finalPdfBytes.byteOffset,
        finalPdfBytes.byteOffset + finalPdfBytes.byteLength
      ) as ArrayBuffer

      const blob = new Blob([pdfBuffer], {
        type: 'application/pdf',
      })

      if (jobId) {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        const baseName = slugifyFileName(documentName || 'signed-document')
        const filePath = `jobs/${jobId}/${Date.now()}-${baseName}.pdf`

        const uploadRes = await supabase.storage
          .from('documents')
          .upload(filePath, blob, {
            contentType: 'application/pdf',
            upsert: false,
          })

        if (uploadRes.error) {
          throw new Error(uploadRes.error.message)
        }

        const publicUrlRes = supabase.storage
          .from('documents')
          .getPublicUrl(filePath)

        const fileUrl = publicUrlRes.data.publicUrl

        if (documentId) {
          const { error } = await supabase
            .from('job_documents')
            .insert({
              job_id: jobId,
              template_id: templateId,
              file_name: `${documentName}-signed.pdf`,
              file_url: fileUrl,
              file_path: filePath,
              document_type: 'Signed Document',
              is_signed: true,
              created_by: user?.id ?? null,
            })

          if (error) {
            throw new Error(error.message)
          }
        } else {
          const { error } = await supabase
            .from('job_documents')
            .insert({
              job_id: jobId,
              template_id: templateId,
              file_name: `${documentName}-signed.pdf`,
              file_url: fileUrl,
              file_path: filePath,
              document_type: 'Signed Document',
              is_signed: true,
              created_by: user?.id ?? null,
            })

          if (error) {
            throw new Error(error.message)
          }
        }

        setMessage('Signed document saved to this homeowner/job.')
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${documentName || 'annotated-document'}.pdf`
        a.click()
        URL.revokeObjectURL(url)
        setMessage('Annotated PDF saved.')
      }
    } catch (error) {
      console.error(error)
      setMessage(error instanceof Error ? error.message : 'Failed to save annotated PDF.')
    } finally {
      setSaving(false)
    }
  }

  const selectedAnnotation = useMemo(
    () => annotations.find((a) => a.id === selectedId) ?? null,
    [annotations, selectedId]
  )

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
                Contracts
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
                PDF Contract Editor
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-gray-600">
                Load a PDF, detect likely signature spots, add text, initials, dates,
                and signatures, drag them into place, then save the finished document.
              </p>
            </div>

            <div className="flex gap-3">
              {jobId ? (
                <Link
                  href={`/jobs/${jobId}/documents`}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
                >
                  Back to Job Documents
                </Link>
              ) : (
                <Link
                  href="/"
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
                >
                  Home
                </Link>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-[1fr_320px_auto_auto]">
            <input
              className="w-full rounded-xl border px-4 py-3 text-sm"
              placeholder="Paste PDF URL here"
              value={pdfUrl}
              onChange={(e) => setPdfUrl(e.target.value)}
            />

            <input
              className="w-full rounded-xl border px-4 py-3 text-sm"
              placeholder="Document name"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
            />

            <button
              type="button"
              onClick={loadPdf}
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
            >
              Load PDF
            </button>

            <button
              type="button"
              onClick={saveAnnotatedPdf}
              disabled={saving || !loadedPdfUrl}
              className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-100 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save PDF'}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={deleteSelected}
              disabled={!selectedId}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 transition hover:bg-gray-100 disabled:opacity-50"
            >
              Delete Selected
            </button>

            <button
              type="button"
              onClick={signSelectedBox}
              disabled={!selectedAnnotation || selectedAnnotation.type !== 'signature-box'}
              className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
            >
              Sign Selected Box
            </button>
          </div>

          {message ? (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              {message}
            </div>
          ) : null}
        </section>

        <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
          <aside className="space-y-4">
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Selected Element</h2>

              {!selectedAnnotation ? (
                <p className="mt-3 text-sm text-gray-600">
                  Click a text box or signature box to edit it.
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="text-sm text-gray-600">
                    Type:{' '}
                    <span className="font-semibold text-gray-900">
                      {selectedAnnotation.type}
                    </span>
                  </div>

                  {selectedAnnotation.type !== 'signature' &&
                  selectedAnnotation.type !== 'signature-box' ? (
                    <>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Value
                        </label>
                        <input
                          className="w-full rounded-xl border px-4 py-3 text-sm"
                          value={selectedAnnotation.value ?? ''}
                          onChange={(e) =>
                            updateAnnotation(selectedAnnotation.id, {
                              value: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Font Size
                        </label>
                        <input
                          type="number"
                          className="w-full rounded-xl border px-4 py-3 text-sm"
                          value={selectedAnnotation.fontSize ?? 16}
                          onChange={(e) =>
                            updateAnnotation(selectedAnnotation.id, {
                              fontSize: Number(e.target.value || 16),
                            })
                          }
                        />
                      </div>
                    </>
                  ) : null}

                  <button
                    type="button"
                    onClick={deleteSelected}
                    className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
                  >
                    Delete Element
                  </button>
                </div>
              )}
            </section>
          </aside>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            {!loadedPdfUrl ? (
              <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-600">
                Load a PDF to start editing.
              </div>
            ) : (
              <Document file={loadedPdfUrl} onLoadSuccess={onLoadSuccess}>
                <div className="space-y-8">
                  {Array.from({ length: numPages }, (_, i) => {
                    const pageNumber = i + 1
                    const pageAnnotations = annotations.filter((a) => a.page === pageNumber)

                    return (
                      <div key={pageNumber} className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                            Page {pageNumber}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => autoDetectFields(pageNumber)}
                              disabled={detectingPage === pageNumber}
                              className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
                            >
                              {detectingPage === pageNumber ? 'Detecting...' : 'Auto Detect Fields'}
                            </button>

                            <button
                              type="button"
                              onClick={() => addText(pageNumber, 'text')}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 transition hover:bg-gray-100"
                            >
                              Add Text
                            </button>

                            <button
                              type="button"
                              onClick={() => addText(pageNumber, 'date')}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 transition hover:bg-gray-100"
                            >
                              Add Date
                            </button>

                            <button
                              type="button"
                              onClick={() => addText(pageNumber, 'initials')}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 transition hover:bg-gray-100"
                            >
                              Add Initials
                            </button>

                            <button
                              type="button"
                              onClick={() => addSignatureBox(pageNumber)}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 transition hover:bg-gray-100"
                            >
                              Add Signature Box
                            </button>

                            <button
                              type="button"
                              onClick={() => openSignature(pageNumber)}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 transition hover:bg-gray-100"
                            >
                              Add Free Signature
                            </button>
                          </div>
                        </div>

                        <div className="relative rounded-2xl border border-gray-200 bg-gray-100 p-3">
                          <div
                            className="relative overflow-hidden rounded-2xl bg-white"
                            style={{ width: pageWidth }}
                          >
                            <Page pageNumber={pageNumber} width={pageWidth} />

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
                                onDragStop={(_, d) =>
                                  updateAnnotation(annotation.id, {
                                    x: d.x,
                                    y: d.y,
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
                                bounds="parent"
                                onClick={() => setSelectedId(annotation.id)}
                                style={{
                                  border:
                                    selectedId === annotation.id
                                      ? '2px solid #111827'
                                      : annotation.type === 'signature-box'
                                      ? '2px dashed #2563eb'
                                      : '1px dashed #6b7280',
                                  background:
                                    annotation.type === 'signature-box'
                                      ? 'rgba(219,234,254,0.9)'
                                      : 'rgba(255,255,255,0.9)',
                                  borderRadius: 10,
                                  padding: 8,
                                  cursor: 'move',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  overflow: 'hidden',
                                }}
                              >
                                {annotation.type === 'signature' && annotation.imageDataUrl ? (
                                  <img
                                    src={annotation.imageDataUrl}
                                    alt="Signature"
                                    className="h-full w-full object-contain"
                                  />
                                ) : annotation.type === 'signature-box' ? (
                                  <div className="flex h-full w-full items-center justify-center text-center text-sm font-semibold text-blue-700">
                                    {annotation.value ?? 'Drop Signature Here'}
                                  </div>
                                ) : (
                                  <div
                                    className="h-full w-full overflow-hidden whitespace-pre-wrap break-words text-black"
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
            )}
          </section>
        </div>

        {signatureOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
            <div className="flex h-full max-h-[90vh] w-full max-w-5xl flex-col rounded-3xl bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Draw Signature</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Sign the screen, then place it onto the PDF.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSignatureOpen(false)
                    setPendingSignaturePage(null)
                  }}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
                >
                  Close
                </button>
              </div>

              <div className="mt-6 flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                <SignatureCanvas
                  ref={(ref) => {
                    sigRef.current = ref
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
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
                >
                  Clear
                </button>

                <button
                  type="button"
                  onClick={addSignatureFromPad}
                  className="rounded-xl bg-gray-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
                >
                  Use Signature
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}

export default function ContractsEditorPage() {
  return (
    <ProtectedRoute>
      <ContractsEditorContent />
    </ProtectedRoute>
  )
}