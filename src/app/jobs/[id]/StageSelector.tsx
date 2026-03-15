'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { createNotifications } from '../../../lib/notification-utils'

type Stage = {
  id: number
  name: string
}

export default function StageSelector({
  jobId,
  currentStageId,
  stages,
}: {
  jobId: string
  currentStageId: number | null
  stages: Stage[]
}) {
  const router = useRouter()
  const [value, setValue] = useState(currentStageId ? String(currentStageId) : '')
  const [saving, setSaving] = useState(false)

  async function handleChange(nextValue: string) {
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

      const assignedUserIds = (assignments ?? []).map((a: any) => a.profile_id)

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

      router.refresh()
    }

    setSaving(false)
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm"
      >
        <option value="">No Stage</option>
        {stages.map((stage) => (
          <option key={stage.id} value={stage.id}>
            {stage.name}
          </option>
        ))}
      </select>

      {saving ? <span className="text-xs text-gray-500">Saving...</span> : null}
    </div>
  )
}