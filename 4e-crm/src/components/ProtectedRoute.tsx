'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    let mounted = true

    async function checkUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted) return

      if (!session?.user) {
        router.replace(`/sign-in?redirectTo=${encodeURIComponent(pathname)}`)
        return
      }

      setAllowed(true)
      setChecking(false)
    }

    checkUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return

      if (!session?.user) {
        setAllowed(false)
        setChecking(false)
        router.replace(`/sign-in?redirectTo=${encodeURIComponent(pathname)}`)
        return
      }

      setAllowed(true)
      setChecking(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [pathname, router])

  if (checking) {
    return (
      <main className="p-8">
        <div className="mx-auto max-w-4xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-gray-600">Checking sign-in...</div>
        </div>
      </main>
    )
  }

  if (!allowed) return null

  return <>{children}</>
}