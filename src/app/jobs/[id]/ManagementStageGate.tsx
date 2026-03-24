'use client'

import { useEffect, useState } from 'react'
import { getCurrentUserProfile, isManagerLike } from '@/lib/auth-helpers'
import {
  isManagementLockedStage,
  type PipelineStageRecord,
} from '@/lib/job-stage-access'

export default function ManagementStageGate({
  currentStage,
  stages,
  children,
}: {
  currentStage: PipelineStageRecord | null
  stages: PipelineStageRecord[]
  children: React.ReactNode
}) {
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    let isActive = true

    async function checkAccess() {
      const profile = await getCurrentUserProfile()

      if (!isActive) return

      setAllowed(
        !isManagementLockedStage(currentStage, stages) || isManagerLike(profile?.role)
      )
      setLoading(false)
    }

    void checkAccess()

    return () => {
      isActive = false
    }
  }, [currentStage, stages])

  if (loading) {
    return (
      <main className="space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-white/60 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          Checking stage access...
        </section>
      </main>
    )
  }

  if (!allowed) {
    return (
      <main className="space-y-6">
        <section className="rounded-[2rem] border border-red-400/20 bg-red-500/10 p-6 text-red-100 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          This job is in Pre-Production Prep or a later stage. Management access is required.
        </section>
      </main>
    )
  }

  return <>{children}</>
}
