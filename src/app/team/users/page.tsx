'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import ManagerOnlyRoute from '@/components/ManagerOnlyRoute'
import { authorizedFetch } from '@/lib/api-client'
import { uploadAvatarViaApi } from '@/lib/avatar-client'
import {
  getDefaultNightlyNumbersInclusion,
  isIncludedInNightlyNumbers,
  isMissingNightlyNumbersColumnError,
  PROFILE_SELECT_FIELDS,
  PROFILE_SELECT_WITH_NIGHTLY_FIELDS,
} from '@/lib/nightly-numbers'
import { supabase } from '@/lib/supabase'

type ProfileRow = {
  id: string
  full_name: string
  role: string
  is_active: boolean
  manager_id: string | null
  rep_type_id: number | null
  avatar_url: string | null
  phone: string | null
  include_in_nightly_numbers: boolean | null
}

type RepTypeRow = {
  id: number
  name: string
  code: string
}

type ManagerRow = {
  id: string
  full_name: string
  role: string
}

type DraftRow = {
  email: string
  full_name: string
  role: string
  phone: string
  manager_id: string
  rep_type_id: string
  is_active: boolean
  avatar_url: string
  include_in_nightly_numbers: boolean
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

function getTempPasswordFromPhone(phone: string) {
  const digits = digitsOnly(phone)
  return digits.length >= 8 ? digits.slice(0, 8) : ''
}

function formatRoleLabel(value: string | null | undefined) {
  return value?.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase()) || 'Unknown Role'
}

function getInitials(value: string | null | undefined) {
  if (!value?.trim()) return '?'

  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

const PANEL_CLASS_NAME =
  'rounded-[2rem] border border-white/10 bg-[#0b0f16]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]'

const SUBPANEL_CLASS_NAME =
  'rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-4'

const INPUT_CLASS_NAME =
  'w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d6b37a]/35'

const READONLY_INPUT_CLASS_NAME =
  'w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white/60 outline-none'

const LABEL_CLASS_NAME =
  'text-xs font-semibold uppercase tracking-[0.18em] text-white/45'

const PRIMARY_BUTTON_CLASS_NAME =
  'rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85] disabled:cursor-not-allowed disabled:opacity-45'

const SECONDARY_BUTTON_CLASS_NAME =
  'rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-45'

const DANGER_BUTTON_CLASS_NAME =
  'rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/18 disabled:cursor-not-allowed disabled:opacity-45'

export default function TeamUsersPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('rep')
  const [managerId, setManagerId] = useState('')
  const [repTypeId, setRepTypeId] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [includeInNightlyNumbers, setIncludeInNightlyNumbers] = useState(
    getDefaultNightlyNumbersInclusion('rep')
  )
  const [createNightlyToggleTouched, setCreateNightlyToggleTouched] = useState(false)

  const [avatarPreview, setAvatarPreview] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [managers, setManagers] = useState<ManagerRow[]>([])
  const [repTypes, setRepTypes] = useState<RepTypeRow[]>([])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({})
  const [draftAvatarFiles, setDraftAvatarFiles] = useState<Record<string, File | null>>({})
  const [draftAvatarPreviews, setDraftAvatarPreviews] = useState<Record<string, string>>({})
  const [savingEditId, setSavingEditId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [roleFilter, setRoleFilter] = useState<
    | 'all'
    | 'rep'
    | 'manager'
    | 'sales_manager'
    | 'production_manager'
    | 'social_media_coordinator'
    | 'admin'
  >('all')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')

  const generatedPassword = getTempPasswordFromPhone(phone)

  async function loadData() {
    setLoading(true)
    setMessage('')

    let { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT_WITH_NIGHTLY_FIELDS)
      .order('full_name', { ascending: true })

    if (profilesError && isMissingNightlyNumbersColumnError(profilesError)) {
      const fallbackResult = await supabase
        .from('profiles')
        .select(PROFILE_SELECT_FIELDS)
        .order('full_name', { ascending: true })

      profilesData = fallbackResult.data as typeof profilesData
      profilesError = fallbackResult.error
    }

    const [managersRes, repTypesRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', [
          'manager',
          'sales_manager',
          'production_manager',
          'social_media_coordinator',
          'admin',
        ])
        .eq('is_active', true)
        .order('full_name', { ascending: true }),

      supabase
        .from('rep_types')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name', { ascending: true }),
    ])

    if (profilesError) {
      setMessageType('error')
      setMessage(profilesError.message)
      setLoading(false)
      return
    }

    if (managersRes.error) {
      setMessageType('error')
      setMessage(managersRes.error.message)
      setLoading(false)
      return
    }

    if (repTypesRes.error) {
      setMessageType('error')
      setMessage(repTypesRes.error.message)
      setLoading(false)
      return
    }

    const nextProfiles = (profilesData ?? []) as ProfileRow[]
    const nextManagers = (managersRes.data ?? []) as ManagerRow[]
    const nextRepTypes = (repTypesRes.data ?? []) as RepTypeRow[]

    setProfiles(nextProfiles)
    setManagers(nextManagers)
    setRepTypes(nextRepTypes)

    const nextDrafts: Record<string, DraftRow> = {}
    for (const profile of nextProfiles) {
      nextDrafts[profile.id] = {
        email: '',
        full_name: profile.full_name ?? '',
        role: profile.role ?? 'rep',
        phone: profile.phone ?? '',
        manager_id: profile.manager_id ?? '',
        rep_type_id: profile.rep_type_id !== null ? String(profile.rep_type_id) : '',
        is_active: profile.is_active,
        avatar_url: profile.avatar_url ?? '',
        include_in_nightly_numbers: isIncludedInNightlyNumbers(profile),
      }
    }

    setDrafts(nextDrafts)
    setDraftAvatarFiles({})
    setDraftAvatarPreviews({})
    setLoading(false)
  }

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => {
      window.clearTimeout(loadTimer)
    }
  }, [])

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    setMessageType('')

    if (!generatedPassword) {
      setMessageType('error')
      setMessage('Phone number must contain at least 8 digits so the temporary password can be generated.')
      setSaving(false)
      return
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setMessageType('error')
      setMessage('You are not signed in.')
      setSaving(false)
      return
    }

    let avatarUrl: string | null = null

    try {
      if (avatarFile) {
        avatarUrl = await uploadAvatarViaApi({
          file: avatarFile,
          label: fullName || email || 'avatar',
        })
      }

      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone: phone || null,
          password: generatedPassword,
          role,
          manager_id: managerId || null,
          rep_type_id: repTypeId ? Number(repTypeId) : null,
          is_active: isActive,
          avatar_url: avatarUrl,
          include_in_nightly_numbers: includeInNightlyNumbers,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setMessageType('error')
        setMessage(result.error || 'Failed to create user.')
        setSaving(false)
        return
      }

      setMessageType('success')
      setMessage('User created successfully.')
      setFullName('')
      setEmail('')
      setPhone('')
      setRole('rep')
      setManagerId('')
      setRepTypeId('')
      setIsActive(true)
      setIncludeInNightlyNumbers(getDefaultNightlyNumbersInclusion('rep'))
      setCreateNightlyToggleTouched(false)
      setAvatarPreview('')
      setAvatarFile(null)
      setSaving(false)

      await loadData()
    } catch (error) {
      setMessageType('error')
      setMessage(error instanceof Error ? error.message : 'Failed to create user.')
      setSaving(false)
    }
  }

  function updateDraft(id: string, patch: Partial<DraftRow>) {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...patch,
      },
    }))
  }

  async function handleSaveExistingUser(id: string) {
    const draft = drafts[id]
    if (!draft) return

    setSavingEditId(id)
    setMessage('')
    setMessageType('')

    try {
      let avatarUrl = draft.avatar_url || null

      if (draftAvatarFiles[id]) {
        avatarUrl = await uploadAvatarViaApi({
          file: draftAvatarFiles[id] as File,
          label: draft.full_name || 'avatar',
          targetProfileId: id,
        })
      }

      const response = await authorizedFetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: draft.email || null,
          full_name: draft.full_name,
          role: draft.role,
          phone: draft.phone,
          manager_id: draft.manager_id,
          rep_type_id: draft.rep_type_id ? Number(draft.rep_type_id) : null,
          is_active: draft.is_active,
          avatar_url: avatarUrl,
          include_in_nightly_numbers: draft.include_in_nightly_numbers,
        }),
      })

      const result = (await response.json().catch(() => null)) as
        | {
            error?: string
          }
        | null

      if (!response.ok) {
        setMessageType('error')
        setMessage(result?.error || 'Failed to update user.')
        setSavingEditId(null)
        return
      }

      setMessageType('success')
      setMessage('User updated.')
      setEditingId(null)
      setSavingEditId(null)
      setDraftAvatarFiles((prev) => ({
        ...prev,
        [id]: null,
      }))
      setDraftAvatarPreviews((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      await loadData()
    } catch (error) {
      setMessageType('error')
      setMessage(error instanceof Error ? error.message : 'Failed to update user.')
      setSavingEditId(null)
    }
  }

  async function handleToggleActive(profile: ProfileRow) {
    setMessage('')
    setMessageType('')

    const response = await authorizedFetch(`/api/admin/users/${profile.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: null,
        full_name: profile.full_name,
        role: profile.role,
        phone: profile.phone,
        manager_id: profile.manager_id,
        rep_type_id: profile.rep_type_id,
        is_active: !profile.is_active,
        avatar_url: profile.avatar_url,
        include_in_nightly_numbers: isIncludedInNightlyNumbers(profile),
      }),
    })

    const result = (await response.json().catch(() => null)) as
      | {
          error?: string
        }
      | null

    if (!response.ok) {
      setMessageType('error')
      setMessage(result?.error || 'Could not update the user.')
      return
    }

    setMessageType('success')
    setMessage(`${profile.full_name} is now ${profile.is_active ? 'inactive' : 'active'}.`)
    await loadData()
  }

  async function handleDeleteUser(profile: ProfileRow) {
    const confirmed = window.confirm(`Delete ${profile.full_name}? This should remove both the auth user and profile.`)
    if (!confirmed) return

    setDeletingId(profile.id)
    setMessage('')
    setMessageType('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setMessageType('error')
        setMessage('You are not signed in.')
        setDeletingId(null)
        return
      }

      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          user_id: profile.id,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setMessageType('error')
        setMessage(result.error || 'Failed to delete user.')
        setDeletingId(null)
        return
      }

      setMessageType('success')
      setMessage('User deleted.')
      setDeletingId(null)
      await loadData()
    } catch (error) {
      setMessageType('error')
      setMessage(error instanceof Error ? error.message : 'Failed to delete user.')
      setDeletingId(null)
    }
  }

  const managerNameById = useMemo(() => {
    return new Map(managers.map((manager) => [manager.id, manager.full_name]))
  }, [managers])

  const repTypeNameById = useMemo(() => {
    return new Map(repTypes.map((repType) => [repType.id, repType.name]))
  }, [repTypes])

  const filteredProfiles = useMemo(() => {
    return [...profiles]
      .filter((profile) => {
        const searchBlob = [
          profile.full_name,
          profile.role,
          profile.phone,
          profile.manager_id ? managerNameById.get(profile.manager_id) : '',
          profile.rep_type_id !== null ? repTypeNameById.get(profile.rep_type_id) : '',
        ]
          .join(' ')
          .toLowerCase()

        if (search.trim() && !searchBlob.includes(search.trim().toLowerCase())) {
          return false
        }

        if (statusFilter === 'active' && !profile.is_active) return false
        if (statusFilter === 'inactive' && profile.is_active) return false
        if (roleFilter !== 'all' && profile.role !== roleFilter) return false

        return true
      })
      .sort((a, b) => {
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
        return a.full_name.localeCompare(b.full_name)
      })
  }, [profiles, search, statusFilter, roleFilter, managerNameById, repTypeNameById])

  const activeCount = useMemo(
    () => profiles.filter((profile) => profile.is_active).length,
    [profiles]
  )
  const inactiveCount = profiles.length - activeCount

  return (
    <ManagerOnlyRoute>
      <main className="min-h-screen p-6 md:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(135deg,#0f172a,#111827)] p-8 shadow-[0_24px_70px_rgba(15,23,42,0.26)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.25),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_26%)]" />
            <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,179,122,0.7),transparent)]" />

            <div className="relative flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-4xl">
                <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b37a]">
                  Team Management
                </div>
                <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
                  Users
                </h1>
                <p className="mt-3 max-w-3xl text-base leading-7 text-white/68 md:text-lg">
                  Create CRM users, assign managers, control commission tiers, and
                  keep profile photos and roster access current from one place.
                </p>
              </div>

              <div className="crm-grid-safe grid w-full gap-3 sm:grid-cols-3 xl:w-auto xl:min-w-0">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-4 backdrop-blur-xl">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                    Total Users
                  </div>
                  <div className="mt-2 text-3xl font-bold tracking-tight text-white">
                    {profiles.length}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-4 backdrop-blur-xl">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                    Active
                  </div>
                  <div className="mt-2 text-3xl font-bold tracking-tight text-white">
                    {activeCount}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-4 backdrop-blur-xl">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                    Showing
                  </div>
                  <div className="mt-2 text-3xl font-bold tracking-tight text-white">
                    {filteredProfiles.length}
                  </div>
                </div>
              </div>
            </div>

            {message ? (
              <div
                className={`relative mt-6 rounded-[1.4rem] border p-4 text-sm ${
                  messageType === 'error'
                    ? 'border-red-400/20 bg-red-500/10 text-red-100'
                    : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
                }`}
              >
                {message}
              </div>
            ) : null}
          </section>

          <section className={PANEL_CLASS_NAME}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
                  Create User
                </div>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
                  Add a new teammate to the CRM
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
                  Temporary passwords are generated automatically from the first 8
                  digits of the phone number, so new accounts can be created quickly
                  without leaving this page.
                </p>
              </div>

              <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/68">
                Active roster: <span className="font-semibold text-white">{activeCount}</span>
                {' '}of <span className="font-semibold text-white">{profiles.length}</span>
              </div>
            </div>

            <form
              onSubmit={handleCreateUser}
              className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className={LABEL_CLASS_NAME}>Full Name</label>
                  <input
                    className={INPUT_CLASS_NAME}
                    placeholder="Full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className={LABEL_CLASS_NAME}>Email</label>
                  <input
                    className={INPUT_CLASS_NAME}
                    placeholder="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className={LABEL_CLASS_NAME}>Phone Number</label>
                  <input
                    className={INPUT_CLASS_NAME}
                    placeholder="Phone number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className={LABEL_CLASS_NAME}>Temporary Password</label>
                  <input
                    className={READONLY_INPUT_CLASS_NAME}
                    value={generatedPassword}
                    readOnly
                    placeholder="Generated from phone"
                  />
                </div>

                <div className="space-y-2">
                  <label className={LABEL_CLASS_NAME}>Role</label>
                  <select
                    className={INPUT_CLASS_NAME}
                    value={role}
                    onChange={(e) => {
                      const nextRole = e.target.value
                      setRole(nextRole)

                      if (!createNightlyToggleTouched) {
                        setIncludeInNightlyNumbers(
                          getDefaultNightlyNumbersInclusion(nextRole)
                        )
                      }
                    }}
                  >
                    <option value="rep">Rep</option>
                    <option value="manager">Manager</option>
                    <option value="sales_manager">Sales Manager</option>
                    <option value="production_manager">Production Manager</option>
                    <option value="social_media_coordinator">Social Media Coordinator</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className={LABEL_CLASS_NAME}>Manager</label>
                  <select
                    className={INPUT_CLASS_NAME}
                    value={managerId}
                    onChange={(e) => setManagerId(e.target.value)}
                  >
                    <option value="">No manager</option>
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className={LABEL_CLASS_NAME}>Rep Type / Commission Tier</label>
                  <select
                    className={INPUT_CLASS_NAME}
                    value={repTypeId}
                    onChange={(e) => setRepTypeId(e.target.value)}
                  >
                    <option value="">No rep type</option>
                    {repTypes.map((repType) => (
                      <option key={repType.id} value={repType.id}>
                        {repType.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className={LABEL_CLASS_NAME}>Avatar</label>
                  <input
                    type="file"
                    accept="image/*"
                    className={INPUT_CLASS_NAME}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null
                      setAvatarFile(file)
                      setAvatarPreview(file ? URL.createObjectURL(file) : '')
                    }}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/78">
                    <input
                      type="checkbox"
                      checked={includeInNightlyNumbers}
                      onChange={(e) => {
                        setIncludeInNightlyNumbers(e.target.checked)
                        setCreateNightlyToggleTouched(true)
                      }}
                      className="accent-[#d6b37a]"
                    />
                    Include on nightly numbers roster
                  </label>
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/78">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="accent-[#d6b37a]"
                    />
                    Active user
                  </label>
                </div>

                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className={PRIMARY_BUTTON_CLASS_NAME}
                  >
                    {saving ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className={SUBPANEL_CLASS_NAME}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
                    Preview
                  </div>
                  <div className="mt-4 flex items-center gap-4">
                    {avatarPreview ? (
                      <Image
                        src={avatarPreview}
                        alt="Avatar preview"
                        width={80}
                        height={80}
                        unoptimized
                        className="h-20 w-20 rounded-full object-cover ring-2 ring-white/10"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-black/20 text-xl font-semibold text-white/72">
                        {getInitials(fullName || email)}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="text-lg font-semibold text-white">
                        {fullName || 'New team member'}
                      </div>
                      <div className="mt-1 text-sm text-white/55">
                        {email || 'No email entered yet'}
                      </div>
                      <div className="mt-3 inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
                        {formatRoleLabel(role)}
                      </div>
                      <div className="mt-2 text-xs font-medium text-white/55">
                        {includeInNightlyNumbers
                          ? 'Included on nightly numbers'
                          : 'Excluded from nightly numbers'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 text-sm leading-6 text-white/55">
                    Avatar uploads are center-cropped into square profile photos before
                    they are saved.
                  </div>
                </div>

                <div className={SUBPANEL_CLASS_NAME}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
                    Access Setup
                  </div>
                  <div className="mt-3 text-sm leading-6 text-white/60">
                    New users start with a temporary password based on the first 8
                    digits in their phone number. Managers and admins can edit profile
                    photos, roles, active state, and commission tiers after creation.
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                        Temp Password
                      </div>
                      <div className="mt-2 text-xl font-bold tracking-tight text-white">
                        {generatedPassword || 'Awaiting phone'}
                      </div>
                    </div>

                    <div className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                        Account State
                      </div>
                      <div className="mt-2 text-xl font-bold tracking-tight text-white">
                        {isActive ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </section>

          <section className={PANEL_CLASS_NAME}>
            <div className="crm-grid-safe mb-6 grid gap-4 md:grid-cols-3">
              <div className="min-w-0 md:col-span-3 lg:col-span-1">
                <label className={`mb-2 block ${LABEL_CLASS_NAME}`}>Search Users</label>
                <input
                  className={`${INPUT_CLASS_NAME} crm-clamp-input`}
                  placeholder="Search by name, phone, role, manager, or rep type"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="min-w-0">
                <label className={`mb-2 block ${LABEL_CLASS_NAME}`}>Status</label>
                <select
                  className={`${INPUT_CLASS_NAME} crm-clamp-input`}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                >
                  <option value="all">All</option>
                  <option value="active">Active only</option>
                  <option value="inactive">Inactive only</option>
                </select>
              </div>

              <div className="min-w-0">
                <label className={`mb-2 block ${LABEL_CLASS_NAME}`}>Role</label>
                <select
                  className={`${INPUT_CLASS_NAME} crm-clamp-input`}
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
                >
                  <option value="all">All roles</option>
                  <option value="rep">Rep</option>
                  <option value="manager">Manager</option>
                  <option value="sales_manager">Sales Manager</option>
                  <option value="production_manager">Production Manager</option>
                  <option value="social_media_coordinator">Social Media Coordinator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
                  Roster
                </div>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
                  Existing Users
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Search, edit, activate, deactivate, and delete CRM users without
                  leaving the roster view.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/65">
                  {filteredProfiles.length} showing
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/65">
                  {inactiveCount} inactive
                </div>
              </div>
            </div>

            {loading ? (
              <div className="mt-4 text-sm text-white/60">Loading users...</div>
            ) : filteredProfiles.length === 0 ? (
              <div className="mt-4 rounded-[1.4rem] border border-dashed border-white/15 p-4 text-sm text-white/60">
                No users matched your filters.
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredProfiles.map((profile) => {
                  const managerName = profile.manager_id
                    ? managerNameById.get(profile.manager_id) ?? 'Unknown manager'
                    : '—'

                  const repTypeName =
                    profile.rep_type_id !== null
                      ? repTypeNameById.get(profile.rep_type_id) ?? 'Unknown rep type'
                      : '—'

                  const draft = drafts[profile.id]
                  const activeDraftAvatarPreview =
                    draftAvatarPreviews[profile.id] || draft?.avatar_url || ''
                  const isEditing = editingId === profile.id

                  return (
                    <div
                      key={profile.id}
                      className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]"
                    >
                      {!isEditing || !draft ? (
                        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0 flex items-start gap-4">
                            <div className="shrink-0">
                              {profile.avatar_url ? (
                                <Image
                                  src={profile.avatar_url}
                                  alt={profile.full_name}
                                  width={56}
                                  height={56}
                                  unoptimized
                                  className="h-14 w-14 rounded-full object-cover ring-2 ring-white/10"
                                />
                              ) : (
                                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-black/20 text-sm font-semibold text-white/72">
                                  {getInitials(profile.full_name)}
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-lg font-semibold text-white">
                                  {profile.full_name}
                                </div>
                                <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/72">
                                  {formatRoleLabel(profile.role)}
                                </div>
                                <div
                                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                                    profile.is_active
                                      ? 'border-emerald-400/20 bg-emerald-500/12 text-emerald-100'
                                      : 'border-white/10 bg-white/[0.04] text-white/55'
                                  }`}
                                >
                                  {profile.is_active ? 'Active' : 'Inactive'}
                                </div>
                                <div
                                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                                    isIncludedInNightlyNumbers(profile)
                                      ? 'border-[#d6b37a]/25 bg-[#d6b37a]/12 text-[#f5deb3]'
                                      : 'border-white/10 bg-white/[0.04] text-white/55'
                                  }`}
                                >
                                  {isIncludedInNightlyNumbers(profile)
                                    ? 'Nightly Included'
                                    : 'Nightly Excluded'}
                                </div>
                              </div>

                              <div className="mt-4 grid gap-3 text-sm text-white/62 md:grid-cols-3">
                                <div className="rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-3">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                                    Phone
                                  </div>
                                  <div className="mt-2 text-sm text-white/78">
                                    {profile.phone || '—'}
                                  </div>
                                </div>

                                <div className="rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-3">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                                    Manager
                                  </div>
                                  <div className="mt-2 text-sm text-white/78">
                                    {managerName}
                                  </div>
                                </div>

                                <div className="rounded-[1.2rem] border border-white/10 bg-black/20 px-4 py-3">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                                    Rep Type
                                  </div>
                                  <div className="mt-2 text-sm text-white/78">
                                    {repTypeName}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleActive(profile)}
                              className={SECONDARY_BUTTON_CLASS_NAME}
                            >
                              {profile.is_active ? 'Make Inactive' : 'Make Active'}
                            </button>

                            <button
                              type="button"
                              onClick={() => setEditingId(profile.id)}
                              className={SECONDARY_BUTTON_CLASS_NAME}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteUser(profile)}
                              disabled={deletingId === profile.id}
                              className={DANGER_BUTTON_CLASS_NAME}
                            >
                              {deletingId === profile.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-5">
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
                              Editing User
                            </div>
                            <h3 className="mt-2 text-xl font-bold tracking-tight text-white">
                              {profile.full_name}
                            </h3>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <label className={LABEL_CLASS_NAME}>Rep Email</label>
                              <input
                                className={INPUT_CLASS_NAME}
                                type="email"
                                value={draft.email}
                                onChange={(e) =>
                                  updateDraft(profile.id, { email: e.target.value })
                                }
                                placeholder="new-rep-email@example.com"
                              />
                              <p className="text-xs text-white/45">
                                Managers can update rep emails and their own email.
                              </p>
                            </div>

                            <div className="space-y-2">
                              <label className={LABEL_CLASS_NAME}>Full Name</label>
                              <input
                                className={INPUT_CLASS_NAME}
                                value={draft.full_name}
                                onChange={(e) =>
                                  updateDraft(profile.id, { full_name: e.target.value })
                                }
                                placeholder="Full name"
                              />
                            </div>

                            <div className="space-y-2">
                              <label className={LABEL_CLASS_NAME}>Phone</label>
                              <input
                                className={INPUT_CLASS_NAME}
                                value={draft.phone}
                                onChange={(e) =>
                                  updateDraft(profile.id, { phone: e.target.value })
                                }
                                placeholder="Phone"
                              />
                            </div>

                            <div className="space-y-2">
                              <label className={LABEL_CLASS_NAME}>Role</label>
                              <select
                                className={INPUT_CLASS_NAME}
                                value={draft.role}
                                onChange={(e) =>
                                  updateDraft(profile.id, { role: e.target.value })
                                }
                              >
                                <option value="rep">Rep</option>
                                <option value="manager">Manager</option>
                                <option value="sales_manager">Sales Manager</option>
                                <option value="production_manager">Production Manager</option>
                                <option value="social_media_coordinator">Social Media Coordinator</option>
                                <option value="admin">Admin</option>
                              </select>
                            </div>

                            <div className="space-y-2">
                              <label className={LABEL_CLASS_NAME}>Manager</label>
                              <select
                                className={INPUT_CLASS_NAME}
                                value={draft.manager_id}
                                onChange={(e) =>
                                  updateDraft(profile.id, { manager_id: e.target.value })
                                }
                              >
                                <option value="">No manager</option>
                                {managers.map((manager) => (
                                  <option key={manager.id} value={manager.id}>
                                    {manager.full_name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-2">
                              <label className={LABEL_CLASS_NAME}>Rep Type</label>
                              <select
                                className={INPUT_CLASS_NAME}
                                value={draft.rep_type_id}
                                onChange={(e) =>
                                  updateDraft(profile.id, { rep_type_id: e.target.value })
                                }
                              >
                                <option value="">No rep type</option>
                                {repTypes.map((repType) => (
                                  <option key={repType.id} value={repType.id}>
                                    {repType.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="md:col-span-2">
                              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/78">
                                <input
                                  type="checkbox"
                                  checked={draft.include_in_nightly_numbers}
                                  onChange={(e) =>
                                    updateDraft(profile.id, {
                                      include_in_nightly_numbers: e.target.checked,
                                    })
                                  }
                                  className="accent-[#d6b37a]"
                                />
                                Include on nightly numbers roster
                              </label>
                            </div>

                            <div className="md:col-span-2 rounded-[1.6rem] border border-white/10 bg-black/20 p-4">
                              <div className="flex flex-wrap items-center gap-4">
                                {activeDraftAvatarPreview ? (
                                  <Image
                                    src={activeDraftAvatarPreview}
                                    alt={draft.full_name || profile.full_name}
                                    width={64}
                                    height={64}
                                    unoptimized
                                    className="h-16 w-16 rounded-full object-cover ring-2 ring-white/10"
                                  />
                                ) : (
                                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-sm font-semibold text-white/72">
                                    {getInitials(draft.full_name || profile.full_name || '?')}
                                  </div>
                                )}

                                <div className="flex flex-wrap gap-3">
                                  <label className={`${SECONDARY_BUTTON_CLASS_NAME} cursor-pointer`}>
                                    Upload Avatar
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0] ?? null
                                        setDraftAvatarFiles((prev) => ({
                                          ...prev,
                                          [profile.id]: file,
                                        }))
                                        setDraftAvatarPreviews((prev) => ({
                                          ...prev,
                                          [profile.id]: file
                                            ? URL.createObjectURL(file)
                                            : '',
                                        }))
                                      }}
                                    />
                                  </label>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateDraft(profile.id, { avatar_url: '' })
                                      setDraftAvatarFiles((prev) => ({
                                        ...prev,
                                        [profile.id]: null,
                                      }))
                                      setDraftAvatarPreviews((prev) => {
                                        const next = { ...prev }
                                        delete next[profile.id]
                                        return next
                                      })
                                    }}
                                    className={SECONDARY_BUTTON_CLASS_NAME}
                                  >
                                    Clear Avatar
                                  </button>
                                </div>
                              </div>

                              <div className="mt-3 text-xs text-white/50">
                                Avatar uploads are center-cropped and saved through the
                                server so managers can update user photos without storage
                                permission issues.
                              </div>
                            </div>
                          </div>

                          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/78">
                            <input
                              type="checkbox"
                              checked={draft.is_active}
                              onChange={(e) =>
                                updateDraft(profile.id, { is_active: e.target.checked })
                              }
                              className="accent-[#d6b37a]"
                            />
                            Active user
                          </label>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveExistingUser(profile.id)}
                              disabled={savingEditId === profile.id}
                              className={PRIMARY_BUTTON_CLASS_NAME}
                            >
                              {savingEditId === profile.id ? 'Saving...' : 'Save'}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null)
                                setDrafts((prev) => ({
                                  ...prev,
                                  [profile.id]: {
                                    email: '',
                                    full_name: profile.full_name ?? '',
                                    role: profile.role ?? 'rep',
                                    phone: profile.phone ?? '',
                                    manager_id: profile.manager_id ?? '',
                                    rep_type_id:
                                      profile.rep_type_id !== null
                                        ? String(profile.rep_type_id)
                                        : '',
                                    is_active: profile.is_active,
                                    avatar_url: profile.avatar_url ?? '',
                                    include_in_nightly_numbers:
                                      isIncludedInNightlyNumbers(profile),
                                  },
                                }))
                                setDraftAvatarFiles((prev) => ({
                                  ...prev,
                                  [profile.id]: null,
                                }))
                                setDraftAvatarPreviews((prev) => {
                                  const next = { ...prev }
                                  delete next[profile.id]
                                  return next
                                })
                              }}
                              className={SECONDARY_BUTTON_CLASS_NAME}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </ManagerOnlyRoute>
  )
}
