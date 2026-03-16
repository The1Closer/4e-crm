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
      <main className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="mx-auto max-w-4xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-gray-600">Checking permissions...</div>
        </div>
      </main>
    )
  }

  if (!isManagerLike(profile?.role)) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="mx-auto max-w-4xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">No permission</h1>
          <p className="mt-2 text-sm text-gray-600">
            You do not have access to this page.
          </p>
        </div>
      </main>
    )
  }

  return <>{children}</>
}