'use client'

import { useMemo, useState } from 'react'

type SendDocumentButtonProps = {
  documentName: string
  documentUrl: string
  defaultTo?: string | null
  triggerLabel?: string
  className?: string
  disabled?: boolean
}

function buildMailtoUrl(params: {
  to: string
  subject: string
  message: string
  documentUrl: string
}) {
  const body = `${params.message.trim()}\n\nDocument link:\n${params.documentUrl}`.trim()
  const searchParams = new URLSearchParams()

  if (params.subject.trim()) {
    searchParams.set('subject', params.subject.trim())
  }

  if (body.trim()) {
    searchParams.set('body', body)
  }

  const query = searchParams.toString()

  return `mailto:${encodeURIComponent(params.to.trim())}${query ? `?${query}` : ''}`
}

export default function SendDocumentButton({
  documentName,
  documentUrl,
  defaultTo,
  triggerLabel = 'Send / Share',
  className,
  disabled = false,
}: SendDocumentButtonProps) {
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState(defaultTo ?? '')
  const [subject, setSubject] = useState(`${documentName} from 4E CRM`)
  const [message, setMessage] = useState(
    `Please review ${documentName}.`
  )
  const [status, setStatus] = useState('')

  const canNativeShare = useMemo(
    () => typeof navigator !== 'undefined' && typeof navigator.share === 'function',
    []
  )

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(documentUrl)
      setStatus('Document link copied.')
    } catch (error) {
      console.error(error)
      setStatus('Could not copy the link on this device.')
    }
  }

  async function nativeShare() {
    if (!canNativeShare) return

    try {
      await navigator.share({
        title: documentName,
        text: message,
        url: documentUrl,
      })
      setStatus('Share sheet opened.')
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') {
        return
      }

      console.error(error)
      setStatus('Could not open the share sheet.')
    }
  }

  function openMailDraft() {
    if (!to.trim()) {
      setStatus('Add at least one email recipient first.')
      return
    }

    window.location.href = buildMailtoUrl({
      to,
      subject,
      message,
      documentUrl,
    })
    setStatus('Email draft opened in your default mail app.')
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setTo(defaultTo ?? '')
          setStatus('')
          setOpen(true)
        }}
        className={className}
      >
        {triggerLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6">
          <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-[#101722] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
                  Send Document
                </div>
                <h2 className="mt-2 text-2xl font-bold text-white">{documentName}</h2>
                <p className="mt-2 text-sm text-white/60">
                  This opens an email draft with the CRM document link already included.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                  To
                </div>
                <input
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/24 focus:border-[#d6b37a]/35"
                />
              </label>

              <label className="block">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                  Subject
                </div>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/24 focus:border-[#d6b37a]/35"
                />
              </label>

              <label className="block">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                  Message
                </div>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={5}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/24 focus:border-[#d6b37a]/35"
                />
              </label>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]/82">
                  Link Preview
                </div>
                <div className="mt-2 break-all">{documentUrl}</div>
              </div>

              {status ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/75">
                  {status}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={openMailDraft}
                  className="rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85]"
                >
                  Open Email Draft
                </button>

                <button
                  type="button"
                  onClick={copyLink}
                  className="rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
                >
                  Copy Link
                </button>

                {canNativeShare ? (
                  <button
                    type="button"
                    onClick={() => void nativeShare()}
                    className="rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
                  >
                    Share
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
