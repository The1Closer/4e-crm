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
      <div className="crm-glass crm-text-soft hidden rounded-[1.35rem] px-4 py-3 text-sm sm:block">
        Loading profile...
      </div>
    )
  }

  if (!user) {
    return (
      <Link
        href="/sign-in"
        className="crm-glass crm-glass-hover rounded-[1rem] px-3 py-2 text-sm font-semibold text-[var(--shell-text-muted)] hover:text-[var(--shell-text)] sm:rounded-[1.35rem] sm:px-4 sm:py-3"
      >
        Sign In
      </Link>
    )
  }

  const displayName = profile?.full_name || 'User'
  const initials = getInitials(profile?.full_name, user.email)
  const roleLabel = formatRoleLabel(profile?.role)

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <Link
        href="/profile"
        className="crm-glass crm-glass-hover group flex items-center gap-2 rounded-[1rem] px-2 py-2 sm:gap-3 sm:rounded-[1.35rem] sm:px-3 sm:py-2.5"
      >
        {profile?.avatar_url ? (
          <Image
            src={profile.avatar_url}
            alt={displayName}
            width={44}
            height={44}
            unoptimized
            className="h-9 w-9 rounded-[0.75rem] object-cover sm:h-11 sm:w-11 sm:rounded-[1rem]"
          />
        ) : (
          <div className="crm-glass-alt flex h-9 w-9 items-center justify-center rounded-[0.75rem] text-xs font-semibold text-[#d6b37a] sm:h-11 sm:w-11 sm:rounded-[1rem]">
            {initials}
          </div>
        )}

        <div className="hidden min-w-0 sm:block">
          <div className="truncate text-sm font-semibold text-[var(--shell-text)]">
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
        className="crm-glass crm-glass-hover inline-flex h-10 w-10 items-center justify-center rounded-[1rem] text-[var(--shell-text-muted)] hover:text-[var(--shell-text)] disabled:opacity-60 sm:h-12 sm:w-12 sm:rounded-[1.35rem]"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  )
}
