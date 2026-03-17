'use client'

import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { authorizedFetch } from '@/lib/api-client'
import JobEditorFields from '@/components/jobs/JobEditorFields'
import {
  buildJobEditorValues,
  type JobEditorValues,
  type JobListRow,
  type JobRepOption,
  type JobStageOption,
} from '@/components/jobs/job-types'

export default function JobsQuickEditDialog({
  job,
  stages,
  reps,
  open,
  onClose,
  onSaved,
}: {
  job: JobListRow | null
  stages: JobStageOption[]
  reps: JobRepOption[]
  open: boolean
  onClose: () => void
  onSaved: () => Promise<void> | void
}) {
  const [values, setValues] = useState<JobEditorValues>(buildJobEditorValues())
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')

  useEffect(() => {
    if (!job) {
      setValues(buildJobEditorValues())
      return
    }

    setValues(buildJobEditorValues(job))
    setMessage('')
    setMessageType('')
  }, [job])

  if (!open || !job) return null
  const activeJob = job

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setMessageType('')

    try {
      const response = await authorizedFetch(`/api/jobs/${activeJob.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      })

      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null

      if (!response.ok) {
        throw new Error(result?.error || 'Could not update the job.')
      }

      await onSaved()
      setMessageType('success')
      setMessage('Job updated.')
      onClose()
    } catch (error) {
      setMessageType('error')
      setMessage(error instanceof Error ? error.message : 'Could not update the job.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] border border-white/10 bg-[#090909] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
              Quick Edit
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
              {activeJob.homeownerName}
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Make core job changes here, or open the full job detail page when you need the deeper form.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[1.2rem] border border-white/10 bg-white/[0.04] text-white/70 transition hover:border-white/15 hover:bg-white/[0.08] hover:text-white"
            aria-label="Close quick edit"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {message ? (
          <div
            className={`mt-5 rounded-[1.4rem] border p-4 text-sm ${
              messageType === 'success'
                ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
                : 'border-red-400/20 bg-red-500/10 text-red-200'
            }`}
          >
            {message}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <JobEditorFields
            values={values}
            stages={stages}
            reps={reps}
            disabled={saving}
            onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
          />

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.1]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85] disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
