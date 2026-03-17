'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { isArchivedByInactivity } from '@/lib/job-lifecycle'
import { supabase } from '@/lib/supabase'

type JobRow = {
  id: string
  insurance_carrier: string | null
  type_of_loss: string | null
  install_date: string | null
  contract_signed_date: string | null
  updated_at: string | null
  homeowners:
  | {
    name: string | null
    address: string | null
  }
  | {
    name: string | null
    address: string | null
  }[]
  | null
  pipeline_stages:
  | {
    id: number
    name: string | null
    sort_order: number | null
  }
  | {
    id: number
    name: string | null
    sort_order: number | null
  }[]
  | null
}

type StageRow = {
  id: number
  name: string
  sort_order: number | null
}

type JobRepLookupRow = {
  job_id: string
  profile_id: string
}

function normalizeHomeowner(
  homeowner: JobRow['homeowners']
): { name: string | null; address: string | null } | null {
  if (!homeowner) return null
  return Array.isArray(homeowner) ? homeowner[0] ?? null : homeowner
}

function normalizeStage(
  stage: JobRow['pipeline_stages']
): { id: number; name: string | null; sort_order: number | null } | null {
  if (!stage) return null
  return Array.isArray(stage) ? stage[0] ?? null : stage
}

export default function PipelineKanban({
  title = 'Pipeline',
  repIds,
}: {
  title?: string
  repIds?: string[]
}) {
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [stages, setStages] = useState<StageRow[]>([])
  const [jobs, setJobs] = useState<JobRow[]>([])
  const effectiveRepIds = useMemo(() => repIds ?? [], [repIds])

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setMessage('')

      const { data: stagesData, error: stagesError } = await supabase
        .from('pipeline_stages')
        .select('id, name, sort_order')
        .order('sort_order', { ascending: true })

      if (stagesError) {
        setMessage(stagesError.message)
        setLoading(false)
        return
      }

      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select(`
          id,
          insurance_carrier,
          type_of_loss,
          install_date,
          contract_signed_date,
          updated_at,
          homeowners (
            name,
            address
          ),
          pipeline_stages (
            id,
            name,
            sort_order
          )
        `)

      if (jobsError) {
        setMessage(jobsError.message)
        setLoading(false)
        return
      }

      let nextJobs = (jobsData ?? []) as JobRow[]

      if (effectiveRepIds.length > 0) {
        const { data: jobRepRows, error: jobRepError } = await supabase
          .from('job_reps')
          .select('job_id, profile_id')
          .in('profile_id', effectiveRepIds)

        if (jobRepError) {
          setMessage(jobRepError.message)
          setLoading(false)
          return
        }

        const allowedJobIds = new Set(
          ((jobRepRows ?? []) as JobRepLookupRow[]).map((row) => row.job_id)
        )
        nextJobs = nextJobs.filter((job) => allowedJobIds.has(job.id))
      }

      setStages((stagesData ?? []) as StageRow[])
      setJobs(nextJobs.filter((job) => !isArchivedByInactivity(job.updated_at)))
      setLoading(false)
    }

    void loadData()
  }, [effectiveRepIds])

  const jobsByStage = useMemo(() => {
    const grouped: Record<number, JobRow[]> = {}

    for (const stage of stages) {
      grouped[stage.id] = []
    }

    for (const job of jobs) {
      const stage = normalizeStage(job.pipeline_stages)
      if (!stage?.id) continue

      if (!grouped[stage.id]) {
        grouped[stage.id] = []
      }

      grouped[stage.id].push(job)
    }

    return grouped
  }, [jobs, stages])

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.25)] backdrop-blur-2xl">
        <div className="text-sm text-white/60">Loading pipeline…</div>
      </section>
    )
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.25)] backdrop-blur-2xl">
      <div className="mb-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d6b37a]">
          Pipeline
        </div>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">{title}</h2>
      </div>

      {message ? (
        <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
          {message}
        </div>
      ) : null}

      {stages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-4 text-sm text-white/55">
          No pipeline stages found.
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-4">
            {stages.map((stage) => {
              const stageJobs = jobsByStage[stage.id] ?? []

              return (
                <div
                  key={stage.id}
                  className="w-[320px] shrink-0 rounded-[1.5rem] border border-white/10 bg-black/20"
                >
                  <div className="border-b border-white/10 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">
                        {stage.name}
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-semibold text-white/60">
                        {stageJobs.length}
                      </div>
                    </div>
                  </div>

                  <div className="max-h-[520px] space-y-3 overflow-y-auto p-3">
                    {stageJobs.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-3 text-xs text-white/45">
                        No jobs in this stage.
                      </div>
                    ) : (
                      stageJobs.map((job) => {
                        const homeowner = normalizeHomeowner(job.homeowners)

                        return (
                          <Link
                            key={job.id}
                            href={`/jobs/${job.id}`}
                            className="block rounded-[1.25rem] border border-white/10 bg-white/[0.05] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08]"
                          >
                            <div className="text-sm font-semibold text-white">
                              {homeowner?.name || 'Unnamed Homeowner'}
                            </div>

                            <div className="mt-1 text-xs text-white/50">
                              {homeowner?.address || 'No address'}
                            </div>

                            <div className="mt-3 space-y-1 text-xs text-white/55">
                              <div>Insurance: {job.insurance_carrier || '—'}</div>
                              <div>Loss Type: {job.type_of_loss || '—'}</div>
                              <div>Contract: {job.contract_signed_date || '—'}</div>
                              <div>Install: {job.install_date || '—'}</div>
                            </div>
                          </Link>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
