'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Upload, X } from 'lucide-react'
import { authorizedFetch } from '@/lib/api-client'
import { supabase } from '@/lib/supabase'

const BUTTON_CLASS_NAME =
  'rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-45'

const INPUT_CLASS_NAME =
  'mt-4 block w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white file:mr-4 file:rounded-full file:border-0 file:bg-[#d6b37a] file:px-4 file:py-2 file:text-xs file:font-semibold file:text-black hover:file:bg-[#e2bf85]'

export default function QuickUploadSection({
  jobId,
  buttonLabel = 'Quick Upload',
  buttonClassName,
}: {
  jobId: string
  buttonLabel?: string
  buttonClassName?: string
}) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadingIndex, setUploadingIndex] = useState(0)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'success' | 'error' | ''>('')

  function handleOpen() {
    setMessage('')
    setMessageTone('')
    setIsOpen(true)
  }

  function handleClose() {
    if (uploading) return

    setIsOpen(false)
    setFiles([])
    setUploadingIndex(0)
    setMessage('')
    setMessageTone('')
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (files.length === 0) return

    setUploading(true)
    setUploadingIndex(0)
    setMessage('')
    setMessageTone('')

    try {
      let photoCount = 0
      let documentCount = 0
      const failedUploads: string[] = []

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]
        setUploadingIndex(index + 1)

        const prepareResponse = await authorizedFetch(`/api/jobs/${jobId}/uploads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'create_signed_upload',
            fileName: file.name,
            mimeType: file.type,
          }),
        })

        const prepareResult = (await prepareResponse.json().catch(() => null)) as
          | {
              error?: string
              upload?: {
                filePath?: string
                token?: string
                fileType?: string
                fileName?: string
              }
            }
          | null

        if (!prepareResponse.ok) {
          failedUploads.push(
            `${file.name}: ${prepareResult?.error || 'Could not start upload.'}`
          )
          continue
        }

        const uploadData = prepareResult?.upload
        const filePath = uploadData?.filePath ?? ''
        const token = uploadData?.token ?? ''

        if (!filePath || !token) {
          failedUploads.push(`${file.name}: Upload token was not returned.`)
          continue
        }

        const storageUploadRes = await supabase.storage
          .from('job-files')
          .uploadToSignedUrl(filePath, token, file)

        if (storageUploadRes.error) {
          failedUploads.push(`${file.name}: ${storageUploadRes.error.message}`)
          continue
        }

        const finalizeResponse = await authorizedFetch(`/api/jobs/${jobId}/uploads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'finalize_signed_upload',
            fileName: file.name,
            filePath,
            fileType: uploadData?.fileType,
          }),
        })

        const finalizeResult = (await finalizeResponse.json().catch(() => null)) as
          | { error?: string; document?: { file_type?: string } }
          | null

        if (!finalizeResponse.ok) {
          failedUploads.push(
            `${file.name}: ${finalizeResult?.error || 'Could not finalize upload.'}`
          )
          continue
        }

        const uploadedType = finalizeResult?.document?.file_type
        if (uploadedType === 'photo') {
          photoCount += 1
        } else {
          documentCount += 1
        }
      }

      const uploadedCount = photoCount + documentCount

      if (uploadedCount > 0) {
        const summaryParts: string[] = []

        if (photoCount > 0) {
          summaryParts.push(`${photoCount} photo${photoCount === 1 ? '' : 's'}`)
        }

        if (documentCount > 0) {
          summaryParts.push(
            `${documentCount} document${documentCount === 1 ? '' : 's'}`
          )
        }

        const summary = summaryParts.join(' and ')

        if (failedUploads.length > 0) {
          setMessageTone('error')
          setMessage(
            `Uploaded ${summary}. ${failedUploads.length} file${
              failedUploads.length === 1 ? '' : 's'
            } failed.`
          )
        } else {
          setMessageTone('success')
          setMessage(`Uploaded ${summary}.`)
        }

        setFiles([])

        window.dispatchEvent(
          new CustomEvent('job-detail:refresh', {
            detail: { jobId },
          })
        )
        window.dispatchEvent(
          new CustomEvent('job-documents:refresh', {
            detail: { jobId },
          })
        )
        router.refresh()
        return
      }

      setMessageTone('error')
      setMessage(
        failedUploads[0] || 'Upload failed. No files were uploaded.'
      )
    } catch (error) {
      setMessageTone('error')
      setMessage(error instanceof Error ? error.message : 'Upload failed.')
    } finally {
      setUploading(false)
      setUploadingIndex(0)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={buttonClassName || BUTTON_CLASS_NAME}
      >
        <span className="inline-flex items-center gap-2">
          <Upload className="h-4 w-4 text-[#d6b37a]" />
          {buttonLabel}
        </span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/72 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleUpload}
            className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-[#0a0a0a] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.55)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
                  Quick Upload
                </div>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">
                  Add photos or documents
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Upload anything here. Images land in Photos, and everything else
                  is filed into Documents for this job.
                </p>
              </div>

              <button
                type="button"
                onClick={handleClose}
                disabled={uploading}
                className="inline-flex h-11 w-11 items-center justify-center rounded-[1.2rem] border border-white/10 bg-white/[0.04] text-white/70 transition hover:border-white/15 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                aria-label="Close quick upload"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {message ? (
              <div
                className={`mt-5 rounded-[1.4rem] border p-4 text-sm ${
                  messageTone === 'success'
                    ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
                    : 'border-red-400/20 bg-red-500/10 text-red-200'
                }`}
              >
                {message}
              </div>
            ) : null}

            <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
                Upload File
              </div>
              <h3 className="mt-2 text-xl font-bold tracking-tight text-white">
                Choose file(s) to attach
              </h3>
              <p className="mt-2 text-sm leading-6 text-white/55">
                PNG, JPG, HEIC, PDFs, and other common job files all work here.
              </p>

              <input
                type="file"
                multiple
                onChange={(event) =>
                  setFiles(Array.from(event.target.files ?? []))
                }
                className={INPUT_CLASS_NAME}
              />

              {files.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/78">
                  Selected {files.length} file{files.length === 1 ? '' : 's'}:{' '}
                  <span className="font-semibold text-white">
                    {files.slice(0, 3).map((file) => file.name).join(', ')}
                    {files.length > 3 ? `, +${files.length - 3} more` : ''}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={uploading}
                className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={uploading || files.length === 0}
                className="rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span className="inline-flex items-center gap-2">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading
                    ? `Uploading ${uploadingIndex}/${files.length}...`
                    : `Upload ${files.length > 1 ? 'Files' : 'File'}`}
                </span>
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  )
}
