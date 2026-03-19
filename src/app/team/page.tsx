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
    <main className="flex min-h-[60vh] items-center justify-center">
      <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_30%)]" />
        <div className="relative">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d6b37a]">
            Team
          </div>
          <h1 className="mt-3 text-2xl font-bold text-white">Redirecting…</h1>
          <p className="mt-2 text-sm text-white/62">
            Team Management has been simplified. Sending you to Users.
          </p>
        </div>
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
