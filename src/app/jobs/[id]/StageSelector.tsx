'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { createNotifications } from '../../../lib/notification-utils'
import { getCurrentUserProfile, getPermissions } from '@/lib/auth-helpers'
import {
  getVisibleStagesForUser,
  isInstallScheduledStage,
  isManagementLockedStage,
} from '@/lib/job-stage-access'

type Stage = {
  id: number
  name: string
  sort_order?: number | null
}

type JobAssignment = {
  profile_id: string
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
    const unlockedStages = getVisibleStagesForUser(stages, canManageLockedStages).filter(
      (stage) => !isInstallScheduledStage(stage)
    )

    if (!currentStage || unlockedStages.some((stage) => stage.id === currentStage.id)) {
      return unlockedStages
    }

    return [currentStage, ...unlockedStages]
  }, [canManageLockedStages, currentStage, stages])

  const stageLockedForUser = useMemo(() => {
    return (
      Boolean(currentStage) &&
      isManagementLockedStage(currentStage, stages) &&
      !canManageLockedStages
    )
  }, [canManageLockedStages, currentStage, stages])

  const stageManagedByCalendar = useMemo(
    () => Boolean(installDate && currentStage && isInstallScheduledStage(currentStage)),
    [currentStage, installDate]
  )

  async function handleChange(nextValue: string) {
    const nextStage = stages.find((stage) => String(stage.id) === nextValue) ?? null

    if (nextStage && isInstallScheduledStage(nextStage)) {
      setMessage('Install Scheduled is managed from the install calendar.')
      return
    }

    if (nextStage && isManagementLockedStage(nextStage, stages) && !canManageLockedStages) {
      setMessage('Only management can move jobs into Contracted and later stages.')
      return
    }

    setMessage('')
    setValue(nextValue)
    setSaving(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('jobs')
      .update({
        stage_id: nextValue ? Number(nextValue) : null,
      })
      .eq('id', jobId)

    if (!error) {
      const selectedStage = stages.find((stage) => String(stage.id) === nextValue)

      const { data: assignments } = await supabase
        .from('job_reps')
        .select('profile_id')
        .eq('job_id', jobId)

      const assignedUserIds = ((assignments ?? []) as JobAssignment[]).map(
        (assignment) => assignment.profile_id
      )

      if (assignedUserIds.length > 0 && selectedStage) {
        await createNotifications({
          userIds: assignedUserIds,
          actorUserId: user?.id ?? null,
          type: 'stage_change',
          title: 'Job stage changed',
          message: `A job was moved to ${selectedStage.name}.`,
          link: `/jobs/${jobId}`,
          jobId,
          metadata: {
            stage_id: selectedStage.id,
            stage_name: selectedStage.name,
          },
        })
      }

      window.dispatchEvent(
        new CustomEvent('job-detail:refresh', {
          detail: { jobId },
        })
      )
      router.refresh()
    }

    setSaving(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={selectedValue}
          onChange={(e) => handleChange(e.target.value)}
          disabled={saving || stageLockedForUser || stageManagedByCalendar}
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
          Only management can change the stage once a job reaches Contracted or later.
        </div>
      ) : null}

      {stageManagedByCalendar ? (
        <div className="text-xs text-[#f8c38a]">
          Install Scheduled is controlled from the install calendar while an install date
          is set.
        </div>
      ) : null}

      {message ? <div className="text-xs text-[#f8c38a]">{message}</div> : null}
    </div>
  )
}
