'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import JobEditorFields from '@/components/jobs/JobEditorFields'
import {
  buildJobEditorValues,
  type JobEditorValues,
  type JobRepOption,
  type JobStageOption,
} from '@/components/jobs/job-types'
import { getCurrentUserProfile, isManagerLike } from '@/lib/auth-helpers'
import { supabase } from '@/lib/supabase'
import { authorizedFetch } from '@/lib/api-client'
import { isManagementLockedStage } from '@/lib/job-stage-access'

function NewJobPageContent() {
  const router = useRouter()

  const [values, setValues] = useState<JobEditorValues>(buildJobEditorValues())
  const [stages, setStages] = useState<JobStageOption[]>([])
  const [reps, setReps] = useState<JobRepOption[]>([])
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')

  useEffect(() => {
    let isActive = true

    async function loadFormOptions() {
      setLoading(true)
      setMessage('')
      setMessageType('')

      const currentProfile = await getCurrentUserProfile()

      if (!isActive) return

      setRole(currentProfile?.role ?? null)

      const [stagesRes, profilesRes] = await Promise.all([
        supabase
          .from('pipeline_stages')
          .select('id, name, sort_order')
          .order('sort_order', { ascending: true }),
        supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('is_active', true)
          .order('full_name', { ascending: true }),
      ])

      if (!isActive) return

      if (stagesRes.error || profilesRes.error) {
        setStages([])
        setReps([])
        setMessageType('error')
        setMessage(
          stagesRes.error?.message ??
            profilesRes.error?.message ??
            'Could not load job form options.'
        )
        setLoading(false)
        return
      }

      const nextStages = (stagesRes.data ?? []) as JobStageOption[]
      const nextReps = (profilesRes.data ?? []) as JobRepOption[]

      setStages(nextStages)
      setReps(nextReps)
      setValues((current) => {
        if (current.rep_ids.length > 0 || !currentProfile?.id) {
          return current
        }

        const creatorIsAssignable = nextReps.some((rep) => rep.id === currentProfile.id)

        if (!creatorIsAssignable) {
          return current
        }

        return {
          ...current,
          rep_ids: [currentProfile.id],
        }
      })
      setLoading(false)
    }

    void loadFormOptions()

    return () => {
      isActive = false
    }
  }, [])

  const visibleStages = useMemo(
    () =>
      isManagerLike(role)
        ? stages
        : stages.filter((stage) => !isManagementLockedStage(stage, stages)),
    [role, stages]
  )

  async function handleCreateJob(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!values.homeowner_name.trim()) {
      setMessageType('error')
      setMessage('Homeowner name is required.')
      return
    }

    setSaving(true)
    setMessage('')
    setMessageType('')

    try {
      const response = await authorizedFetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      })

      const result = (await response.json().catch(() => null)) as
        | { error?: string; jobId?: string }
        | null

      if (!response.ok || !result?.jobId) {
        throw new Error(result?.error || 'Could not create the job.')
      }

      setMessageType('success')
      setMessage('Job created. Opening the file now...')
      router.push(`/jobs/${result.jobId}`)
      router.refresh()
    } catch (error) {
      setMessageType('error')
      setMessage(error instanceof Error ? error.message : 'Could not create the job.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.22),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_26%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,179,122,0.7),transparent)]" />

        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b37a]">
              New Job
            </div>

            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
              Create a Real Job File
            </h1>

            <p className="mt-3 max-w-3xl text-base leading-7 text-white/68 md:text-lg">
              This replaces the old placeholder screen so you can enter the core information once and move straight into the live job.
            </p>
          </div>

          <Link
            href="/jobs"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.1]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Jobs
          </Link>
        </div>
      </section>

      <form
        onSubmit={handleCreateJob}
        className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
              Intake
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
              Start the file with the essentials
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Deeper claim, adjuster, and production details can still be added later from the job detail page.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85] disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Creating...' : 'Create Job'}
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

        {loading ? (
          <div className="mt-6 rounded-[1.4rem] border border-white/10 bg-black/20 p-4 text-sm text-white/60">
            Loading form options...
          </div>
        ) : (
          <div className="mt-6">
            <JobEditorFields
              values={values}
              stages={visibleStages}
              reps={reps}
              disabled={saving}
              onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
            />
          </div>
        )}
      </form>
    </main>
  )
}

export default function NewJobPage() {
  return (
    <ProtectedRoute>
      <NewJobPageContent />
    </ProtectedRoute>
  )
}
