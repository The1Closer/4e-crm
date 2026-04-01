'use client'

import { Bug } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { authorizedFetch } from '@/lib/api-client'

type BugReportResponse = {
  success?: boolean
  error?: string
}

const MAX_DESCRIPTION_LENGTH = 2000

export default function BugReportButton() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')

  async function submitBugReport() {
    const trimmed = description.trim()

    if (!trimmed) {
      setMessageType('error')
      setMessage('Please describe the bug first.')
      return
    }

    setSubmitting(true)
    setMessage('')
    setMessageType('')

    try {
      const response = await authorizedFetch('/api/bug-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: trimmed.slice(0, MAX_DESCRIPTION_LENGTH),
          contextPath: pathname || '/',
        }),
      })

      const result = (await response.json().catch(() => null)) as
        | BugReportResponse
        | null

      if (!response.ok) {
        throw new Error(result?.error || 'Could not send bug report.')
      }

      setMessageType('success')
      setMessage('Bug report sent to Jacob Castillo.')
      setDescription('')
    } catch (error) {
      setMessageType('error')
      setMessage(error instanceof Error ? error.message : 'Could not send bug report.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          setMessage('')
          setMessageType('')
        }}
        className="crm-glass crm-glass-hover inline-flex h-10 w-10 items-center justify-center rounded-[1rem] text-[var(--shell-text-muted)] transition hover:text-[var(--shell-text)] sm:h-12 sm:w-12 sm:rounded-[1.35rem]"
        aria-label="Report a bug"
        title="Report a bug"
      >
        <Bug className="h-4 w-4 text-[#d6b37a]" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[95] grid place-items-center p-4">
          <button
            type="button"
            className="crm-shell-overlay absolute inset-0"
            aria-label="Close bug report dialog"
            onClick={() => {
              if (submitting) return
              setOpen(false)
            }}
          />

          <div className="crm-shell-sidebar relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[1.8rem] border border-[var(--shell-border)] p-5 sm:p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
              Support
            </div>
            <h2 className="mt-2 text-xl font-semibold text-[var(--shell-text)]">
              Report a bug
            </h2>
            <p className="mt-2 text-sm text-[var(--shell-text-soft)]">
              This will send a notification directly to Jacob Castillo.
            </p>

            <div className="mt-4 space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shell-text-faint)]">
                What happened?
              </label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={6}
                maxLength={MAX_DESCRIPTION_LENGTH}
                placeholder="Describe the bug and what page you were on..."
                className="crm-glass-alt w-full resize-y rounded-2xl px-4 py-3 text-sm text-[var(--shell-text)] outline-none transition placeholder:text-[var(--shell-text-faint)] focus:border-[#d6b37a]/35"
              />
              <div className="text-right text-[11px] text-[var(--shell-text-faint)]">
                {description.length}/{MAX_DESCRIPTION_LENGTH}
              </div>
            </div>

            {message ? (
              <div
                className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
                  messageType === 'error'
                    ? 'border-red-400/20 bg-red-500/10 text-red-200'
                    : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
                }`}
              >
                {message}
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="crm-glass crm-glass-hover rounded-xl px-4 py-2 text-sm font-semibold text-[var(--shell-text)] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitBugReport()}
                disabled={submitting}
                className="rounded-xl bg-[#d6b37a] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#e2bf85] disabled:opacity-60"
              >
                {submitting ? 'Sending...' : 'Send Bug Report'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
