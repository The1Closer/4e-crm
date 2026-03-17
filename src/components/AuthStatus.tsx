'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

type Profile = {
  id: string
  full_name: string | null
  avatar_url?: string | null
}

type UserState = {
  id: string
  email?: string
} | null

function getInitials(name: string | null | undefined, email?: string) {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/)
    return parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('')
  }

  if (email) {
    return email.slice(0, 2).toUpperCase()
  }

  return 'U'
}

export default function AuthStatus() {
  const router = useRouter()

  const [user, setUser] = useState<UserState>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    let isActive = true

    async function loadUserAndProfile() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()

      if (!isActive) return

      if (error || !user) {
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      setUser({
        id: user.id,
        email: user.email,
      })

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle()

      if (!isActive) return

      setProfile((profileData as Profile) ?? null)
      setLoading(false)
    }

    void loadUserAndProfile()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadUserAndProfile()
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleSignOut() {
    setSigningOut(true)

    await supabase.auth.signOut()

    setUser(null)
    setProfile(null)

    router.replace('/sign-in')
    router.refresh()

    setTimeout(() => {
      window.location.href = '/sign-in'
    }, 100)
  }

  if (loading) {
    return <div className="text-sm text-white/60">Loading...</div>
  }

  if (!user) {
    return (
      <Link
        href="/sign-in"
        className="text-sm font-semibold text-white/78 transition hover:text-white"
      >
        Sign In
      </Link>
    )
  }

  const displayName = profile?.full_name || 'Signed In User'
  const initials = getInitials(profile?.full_name, user.email)

  return (
    <div className="flex items-center gap-3">
      {profile?.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={displayName}
          className="h-10 w-10 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
          {initials}
        </div>
      )}

      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-white">
          {displayName}
        </div>
        <div className="truncate text-xs text-white/42">
          {user.email ?? ''}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/[0.1] disabled:opacity-60"
      >
        {signingOut ? 'Signing Out...' : 'Sign Out'}
      </button>
    </div>
  )
}
