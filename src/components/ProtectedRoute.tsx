'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
        setAllowed(false)
        setChecking(false)
        router.replace(`/sign-in?redirectTo=${encodeURIComponent(pathname)}`)

        window.setTimeout(() => {
          window.location.replace(`/sign-in?redirectTo=${encodeURIComponent(pathname)}`)
        }, 120)
        return
      }

      setAllowed(true)
      setChecking(false)
    }

    void checkUser()

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
      <main className="space-y-6">
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-sm text-white/60 shadow-[0_25px_80px_rgba(0,0,0,0.25)] backdrop-blur-2xl">
          Checking sign-in...
        </div>
      </main>
    )
  }

  if (!allowed) return null

  return <>{children}</>
}
