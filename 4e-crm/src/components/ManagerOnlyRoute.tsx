'use client'

import { useEffect, useState } from 'react'
import {
  getCurrentUserProfile,
  isManagerLike,
  type UserProfile,
} from '@/lib/auth-helpers'

export default function ManagerOnlyRoute({
  children,
}: {
  children: React.ReactNode
}) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [permissionsLoading, setPermissionsLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      const nextProfile = await getCurrentUserProfile()
      setProfile(nextProfile)
      setPermissionsLoading(false)
    }

    loadProfile()
  }, [])

  if (permissionsLoading) {
    return (
      <main className="space-y-6">
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-sm text-white/60 shadow-[0_25px_80px_rgba(0,0,0,0.25)] backdrop-blur-2xl">
          Checking permissions...
        </div>
      </main>
    )
  }

  if (!isManagerLike(profile?.role)) {
    return (
      <main className="space-y-6">
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-red-400/20 bg-red-500/10 p-6 text-red-100 shadow-[0_25px_80px_rgba(0,0,0,0.25)] backdrop-blur-2xl">
          <h1 className="text-2xl font-bold text-white">No permission</h1>
          <p className="mt-2 text-sm text-red-100/80">
            You do not have access to this page.
          </p>
        </div>
      </main>
    )
  }

  return <>{children}</>
}
