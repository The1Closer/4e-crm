'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ManagerOnlyRoute from '@/components/ManagerOnlyRoute'

function TeamRedirectContent() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/team/users')
  }, [router])

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-4xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Redirecting…</h1>
        <p className="mt-2 text-sm text-gray-600">
          Team Management has been simplified. Sending you to Users.
        </p>
      </div>
    </main>
  )
}

export default function TeamPage() {
  return (
    <ManagerOnlyRoute>
      <TeamRedirectContent />
    </ManagerOnlyRoute>
  )
}