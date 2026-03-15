'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getCurrentUserProfile, isManagerLike } from '../lib/auth-helpers'

export default function ManagerOnlyRoute({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    async function checkAccess() {
      const currentProfile = await getCurrentUserProfile()

      if (!currentProfile) {
        router.replace(`/sign-in?redirectTo=${encodeURIComponent(pathname)}`)
        return
      }

      if (!isManagerLike(currentProfile.role)) {
        router.replace('/')
        return
      }

      setAllowed(true)
      setChecking(false)
    }

    checkAccess()
  }, [pathname, router])

  if (checking) {
    return (
      <main className="p-8">
        <div className="mx-auto max-w-4xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-gray-600">Checking access...</div>
        </div>
      </main>
    )
  }

  if (!allowed) return null

  return <>{children}</>
}