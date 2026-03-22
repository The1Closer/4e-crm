'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  full_name: string | null
  avatar_url?: string | null
  role?: string | null
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
      .map((part) => part[0]?.toUpperCase())
      .join('')
  }

  if (email) {
    return email.slice(0, 2).toUpperCase()
  }

  return 'U'
}

function formatRoleLabel(role: string | null | undefined) {
  return role?.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase()) || 'Team Member'
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
        .select('id, full_name, avatar_url, role')
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

    window.setTimeout(() => {
      window.location.href = '/sign-in'
    }, 100)
  }

  if (loading) {
    return (
      <div className="hidden rounded-[1.35rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/60 shadow-[0_10px_30px_rgba(0,0,0,0.25)] sm:block">
        Loading profile...
      </div>
    )
  }

  if (!user) {
    return (
      <Link
        href="/sign-in"
        className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/78 shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition hover:border-white/15 hover:bg-white/[0.08] hover:text-white"
      >
        Sign In
      </Link>
    )
  }

  const displayName = profile?.full_name || 'User'
  const initials = getInitials(profile?.full_name, user.email)
  const roleLabel = formatRoleLabel(profile?.role)

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/profile"
        className="group flex items-center gap-3 rounded-[1.35rem] border border-white/10 bg-white/[0.04] px-3 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition hover:border-white/15 hover:bg-white/[0.06]"
      >
        {profile?.avatar_url ? (
          <Image
            src={profile.avatar_url}
            alt={displayName}
            width={44}
            height={44}
            unoptimized
            className="h-11 w-11 rounded-[1rem] object-cover"
          />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-white/10 bg-black/25 text-xs font-semibold text-[#d6b37a]">
            {initials}
          </div>
        )}

        <div className="hidden min-w-0 sm:block">
          <div className="truncate text-sm font-semibold text-white">
            {displayName}
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#d6b37a]">
            {roleLabel}
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="inline-flex h-12 w-12 items-center justify-center rounded-[1.35rem] border border-white/10 bg-white/[0.04] text-white/75 shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition hover:border-white/15 hover:bg-white/[0.06] hover:text-white disabled:opacity-60"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  )
}
