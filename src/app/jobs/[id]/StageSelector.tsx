'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authorizedFetch } from '@/lib/api-client'
import { getCurrentUserProfile, getPermissions } from '@/lib/auth-helpers'
import {
  getVisibleStagesForUser,
  isInstallScheduledStage,
  isInstallWorkflowStage,
  isManagementLockedStage,
  isPreProductionPrepStage,
} from '@/lib/job-stage-access'

type Stage = {
  id: number
  name: string
  sort_order?: number | null
}

export default function StageSelector({
  jobId,
  currentStageId,
  installDate,
  stages,
}: {
  jobId: string
  currentStageId: number | null
  installDate?: string | null
  stages: Stage[]
}) {
  const router = useRouter()
  const [value, setValue] = useState(currentStageId ? String(currentStageId) : '')
  const [saving, setSaving] = useState(false)
  const [canManageLockedStages, setCanManageLockedStages] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function loadPermissions() {
      const profile = await getCurrentUserProfile()
      const permissions = getPermissions(profile?.role)
      setCanManageLockedStages(permissions.canManageLockedStages)
    }

    void loadPermissions()
  }, [])

  const currentStage = useMemo(
    () => stages.find((stage) => String(stage.id) === String(currentStageId)) ?? null,
    [currentStageId, stages]
  )

  const selectedValue = saving ? value : currentStageId ? String(currentStageId) : ''

  const visibleStages = useMemo(() => {
    const unlockedStages = getVisibleStagesForUser(stages, canManageLockedStages)

    if (!currentStage || unlockedStages.some((stage) => stage.id === currentStage.id)) {
      return unlockedStages
    }

    return [currentStage, ...unlockedStages]
  }, [canManageLockedStages, currentStage, stages])

  const stageLockedForUser = useMemo(() => {
    return (
      Boolean(currentStage) &&
      isManagementLockedStage(currentStage, stages) &&
      !isInstallWorkflowStage(currentStage) &&
      !canManageLockedStages
    )
  }, [canManageLockedStages, currentStage, stages])

  function normalizePromptInstallDate(rawValue: string): string | null | 'invalid' {
    const trimmed = rawValue.trim()
    if (!trimmed) return null
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return 'invalid'

    const parsed = new Date(`${trimmed}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) return 'invalid'

    return trimmed
  }

  async function handleChange(nextValue: string) {
    const nextStage = stages.find((stage) => String(stage.id) === nextValue) ?? null
    let nextInstallDate = nextStage && isPreProductionPrepStage(nextStage) ? null : installDate

    if (nextStage && isInstallScheduledStage(nextStage) && !nextInstallDate) {
      const promptedValue = window.prompt(
        'This job does not have an install date yet. Enter one now (YYYY-MM-DD), or leave blank and click OK to skip for now.',
        ''
      )

      if (promptedValue === null) {
        setMessage('Move canceled.')
        return
      }

      const normalizedPromptDate = normalizePromptInstallDate(promptedValue)

      if (normalizedPromptDate === 'invalid') {
        setMessage('Please use a valid install date in YYYY-MM-DD format.')
        return
      }

      nextInstallDate = normalizedPromptDate ?? null
    }

    if (
      nextStage &&
      isManagementLockedStage(nextStage, stages) &&
      !isInstallWorkflowStage(nextStage) &&
      !canManageLockedStages
    ) {
      setMessage(
        'Only management can move jobs into Pre-Production Prep and later stages.'
      )
      return
    }

    setMessage('')
    setValue(nextValue)
    setSaving(true)

    const response = await authorizedFetch(`/api/jobs/${jobId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        stage_id: nextValue ? Number(nextValue) : null,
        install_date: nextInstallDate,
      })
    })

    const result = (await response.json().catch(() => null)) as
      | { error?: string }
      | null

    if (!response.ok) {
      setMessage(result?.error || 'Could not update the stage.')
      setSaving(false)
      return
    }

    window.dispatchEvent(
      new CustomEvent('job-detail:refresh', {
        detail: { jobId },
      })
    )
    router.refresh()

    setSaving(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={selectedValue}
          onChange={(e) => handleChange(e.target.value)}
          disabled={saving || stageLockedForUser}
          className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white shadow-sm outline-none transition focus:border-[#d6b37a]/40"
        >
          <option value="">No Stage</option>
          {visibleStages.map((stage) => (
            <option
              key={stage.id}
              value={String(stage.id ?? '')}
              className="bg-[#111111] text-white"
            >
              {stage.name}
            </option>
          ))}
        </select>

        {saving ? <span className="text-xs text-white/45">Saving...</span> : null}
      </div>

      {stageLockedForUser ? (
        <div className="text-xs text-[#f8c38a]">
          Only management can change the stage once a job reaches Pre-Production Prep or later.
        </div>
      ) : null}

      {message ? <div className="text-xs text-[#f8c38a]">{message}</div> : null}
    </div>
  )
}
