'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import {
  Camera,
  PencilLine,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { authorizedFetch } from '@/lib/api-client'
import { uploadAvatarViaApi } from '@/lib/avatar-client'
import { getCurrentUserProfile, type UserProfile } from '@/lib/auth-helpers'
import { supabase } from '@/lib/supabase'

type ProfileForm = {
  full_name: string
  phone: string
  avatar_url: string
}

function formatRoleLabel(role: string | null | undefined) {
  return role?.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase()) || 'Team Member'
}

function getInitials(name: string | null | undefined) {
  if (!name?.trim()) return '4E'

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function ProfilePageContent() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [email, setEmail] = useState('')
  const [form, setForm] = useState<ProfileForm>({
    full_name: '',
    phone: '',
    avatar_url: '',
  })
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')

  useEffect(() => {
    let isActive = true

    async function loadProfile() {
      setLoading(true)
      setMessage('')
      setMessageType('')

      const [{ data: authData }, nextProfile] = await Promise.all([
        supabase.auth.getUser(),
        getCurrentUserProfile(),
      ])

      if (!isActive) return

      setProfile(nextProfile)
      setEmail(authData.user?.email ?? '')
      setForm({
        full_name: nextProfile?.full_name ?? '',
        phone: nextProfile?.phone ?? '',
        avatar_url: nextProfile?.avatar_url ?? '',
      })
      setLoading(false)
    }

    void loadProfile()

    return () => {
      isActive = false
    }
  }, [])

  const roleLabel = useMemo(() => formatRoleLabel(profile?.role), [profile?.role])
  const activeAvatar = avatarPreview || form.avatar_url || ''

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!profile?.id) {
      setMessageType('error')
      setMessage('Could not find your profile.')
      return
    }

    setSaving(true)
    setMessage('')
    setMessageType('')

    try {
      let avatarUrl = form.avatar_url || null

      if (avatarFile) {
        avatarUrl = await uploadAvatarViaApi({
          file: avatarFile,
          label: form.full_name || email || profile.id || 'avatar',
        })
      }

      const response = await authorizedFetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: form.full_name,
          phone: form.phone,
          avatar_url: avatarUrl,
        }),
      })

      const result = (await response.json().catch(() => null)) as
        | {
            error?: string
            profile?: UserProfile
          }
        | null

      if (!response.ok) {
        throw new Error(result?.error || 'Could not update profile.')
      }

      const nextProfile = result?.profile ?? (await getCurrentUserProfile())
      setProfile(nextProfile)
      setForm({
        full_name: nextProfile?.full_name ?? form.full_name,
        phone: nextProfile?.phone ?? form.phone,
        avatar_url: nextProfile?.avatar_url ?? avatarUrl ?? '',
      })
      setAvatarFile(null)
      setAvatarPreview('')
      setMessageType('success')
      setMessage('Profile updated.')
      window.dispatchEvent(new CustomEvent('profile:updated'))
    } catch (error) {
      setMessageType('error')
      setMessage(error instanceof Error ? error.message : 'Could not update profile.')
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setForm({
      full_name: profile?.full_name ?? '',
      phone: profile?.phone ?? '',
      avatar_url: profile?.avatar_url ?? '',
    })
    setAvatarFile(null)
    setAvatarPreview('')
    setMessage('')
    setMessageType('')
  }

  function clearAvatar() {
    setAvatarFile(null)
    setAvatarPreview('')
    setForm((current) => ({
      ...current,
      avatar_url: '',
    }))
  }

  if (loading) {
    return (
      <main className="space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-sm text-white/60 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          Loading your profile...
        </section>
      </main>
    )
  }

  return (
    <main className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.22),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_26%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,179,122,0.7),transparent)]" />

        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b37a]">
              Profile
            </div>

            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
              Edit Your Account
            </h1>

            <p className="mt-3 max-w-3xl text-base leading-7 text-white/68 md:text-lg">
              Update the name, phone number, and photo the rest of the team sees in the CRM.
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-black/20 px-5 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.22)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/38">
              Current Position
            </div>
            <div className="mt-2 text-xl font-semibold text-white">{roleLabel}</div>
            <div className="mt-1 text-sm text-white/55">{email || 'No email found'}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <aside className="space-y-6">
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
            <div className="flex items-center gap-4">
              {activeAvatar ? (
                <Image
                  src={activeAvatar}
                  alt={form.full_name || 'Profile avatar'}
                  width={96}
                  height={96}
                  unoptimized
                  className="h-24 w-24 rounded-[1.8rem] object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-[1.8rem] border border-white/10 bg-black/25 text-xl font-semibold text-[#d6b37a]">
                  {getInitials(form.full_name || profile?.full_name)}
                </div>
              )}

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
                  Visible Identity
                </div>
                <div className="mt-2 text-2xl font-bold text-white">
                  {form.full_name || 'Your name'}
                </div>
                <div className="mt-1 text-sm text-white/58">{roleLabel}</div>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              <ProfileSummary icon={UserRound} label="Email" value={email || 'Not available'} />
              <ProfileSummary icon={Phone} label="Phone" value={form.phone || 'No phone added'} />
              <ProfileSummary
                icon={ShieldCheck}
                label="Access"
                value="Only your own profile details can be edited here."
              />
            </div>
          </section>
        </aside>

        <form
          onSubmit={handleSave}
          className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
                Edit Details
              </div>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
                Keep your CRM profile current
              </h2>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.1]"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85] disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>

          {message ? (
            <div
              className={`mt-5 rounded-[1.4rem] border p-4 text-sm ${
                messageType === 'success'
                  ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
                  : 'border-red-400/20 bg-red-500/10 text-red-200'
              }`}
            >
              {message}
            </div>
          ) : null}

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="block">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                Full Name
              </div>
              <input
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d6b37a]/35"
                value={form.full_name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    full_name: event.target.value,
                  }))
                }
                placeholder="Your full name"
              />
            </label>

            <label className="block">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                Phone Number
              </div>
              <input
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d6b37a]/35"
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                placeholder="Best contact number"
              />
            </label>

            <label className="block md:col-span-2">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                Profile Photo
              </div>
              <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1]">
                    <Camera className="h-4 w-4 text-[#d6b37a]" />
                    Upload New Photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const nextFile = event.target.files?.[0] ?? null
                        setAvatarFile(nextFile)
                        setAvatarPreview(nextFile ? URL.createObjectURL(nextFile) : '')
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={clearAvatar}
                    className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
                  >
                    Remove Photo
                  </button>
                </div>

                <div className="mt-3 text-sm text-white/55">
                  Photos are center-cropped into a square so they stay clean in the header and sidebar.
                </div>
              </div>
            </label>

            <label className="block md:col-span-2">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                Position
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white">
                <PencilLine className="h-4 w-4 text-[#d6b37a]" />
                {roleLabel}
              </div>
            </label>
          </div>
        </form>
      </section>
    </main>
  )
}

function ProfileSummary({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
      <div className="flex items-start gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.04]">
          <Icon className="h-4 w-4 text-[#d6b37a]" />
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/38">
            {label}
          </div>
          <div className="mt-1 text-sm font-medium text-white">{value}</div>
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfilePageContent />
    </ProtectedRoute>
  )
}
