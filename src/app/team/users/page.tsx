'use client'

import { useEffect, useMemo, useState } from 'react'
import ManagerOnlyRoute from '@/components/ManagerOnlyRoute'
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
  full_name: string
  role: string
  phone: string
  manager_id: string
  rep_type_id: string
  is_active: boolean
  avatar_url: string
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

function getTempPasswordFromPhone(phone: string) {
  const digits = digitsOnly(phone)
  return digits.length >= 8 ? digits.slice(0, 8) : ''
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function cropImageToSquareBlob(file: File, size = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const sx = Math.floor((bitmap.width - side) / 2)
  const sy = Math.floor((bitmap.height - side) / 2)

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not prepare avatar canvas.')
  }

  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Could not create cropped avatar image.'))
        return
      }
      resolve(blob)
    }, 'image/jpeg', 0.92)
  })
}

async function uploadAvatarFile(file: File, label: string) {
  const blob = await cropImageToSquareBlob(file, 512)
  const filePath = `profiles/${Date.now()}-${slugify(label || 'avatar')}.jpg`

  const uploadRes = await supabase.storage
    .from('avatars')
    .upload(filePath, blob, {
      contentType: 'image/jpeg',
      upsert: false,
    })

  if (uploadRes.error) {
    throw new Error(uploadRes.error.message)
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
  return data.publicUrl
}

export default function TeamUsersPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('rep')
  const [managerId, setManagerId] = useState('')
  const [repTypeId, setRepTypeId] = useState('')
  const [isActive, setIsActive] = useState(true)

  const [avatarPreview, setAvatarPreview] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [managers, setManagers] = useState<ManagerRow[]>([])
  const [repTypes, setRepTypes] = useState<RepTypeRow[]>([])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({})
  const [savingEditId, setSavingEditId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [roleFilter, setRoleFilter] = useState<'all' | 'rep' | 'manager' | 'sales_manager' | 'admin'>('all')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')

  const generatedPassword = getTempPasswordFromPhone(phone)

  async function loadData() {
    setLoading(true)
    setMessage('')

    const [profilesRes, managersRes, repTypesRes] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          'id, full_name, role, is_active, manager_id, rep_type_id, avatar_url, phone'
        )
        .order('full_name', { ascending: true }),

      supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['manager', 'sales_manager', 'admin'])
        .eq('is_active', true)
        .order('full_name', { ascending: true }),

      supabase
        .from('rep_types')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name', { ascending: true }),
    ])

    if (profilesRes.error) {
      setMessageType('error')
      setMessage(profilesRes.error.message)
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

    const nextProfiles = (profilesRes.data ?? []) as ProfileRow[]
    const nextManagers = (managersRes.data ?? []) as ManagerRow[]
    const nextRepTypes = (repTypesRes.data ?? []) as RepTypeRow[]

    setProfiles(nextProfiles)
    setManagers(nextManagers)
    setRepTypes(nextRepTypes)

    const nextDrafts: Record<string, DraftRow> = {}
    for (const profile of nextProfiles) {
      nextDrafts[profile.id] = {
        full_name: profile.full_name ?? '',
        role: profile.role ?? 'rep',
        phone: profile.phone ?? '',
        manager_id: profile.manager_id ?? '',
        rep_type_id: profile.rep_type_id !== null ? String(profile.rep_type_id) : '',
        is_active: profile.is_active,
        avatar_url: profile.avatar_url ?? '',
      }
    }

    setDrafts(nextDrafts)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
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
        avatarUrl = await uploadAvatarFile(avatarFile, fullName || email || 'avatar')
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
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: draft.full_name || null,
          role: draft.role || null,
          phone: draft.phone || null,
          manager_id: draft.manager_id || null,
          rep_type_id: draft.rep_type_id ? Number(draft.rep_type_id) : null,
          is_active: draft.is_active,
          avatar_url: draft.avatar_url || null,
        })
        .eq('id', id)

      if (error) {
        setMessageType('error')
        setMessage(error.message)
        setSavingEditId(null)
        return
      }

      setMessageType('success')
      setMessage('User updated.')
      setEditingId(null)
      setSavingEditId(null)
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

    const { error } = await supabase
      .from('profiles')
      .update({
        is_active: !profile.is_active,
      })
      .eq('id', profile.id)

    if (error) {
      setMessageType('error')
      setMessage(error.message)
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

  return (
    <ManagerOnlyRoute>
      <main className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Users
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Create CRM users, assign managers, assign rep commission tiers, upload avatars, and manage the entire roster.
            </p>

            {message ? (
              <div
                className={`mt-4 rounded-xl p-3 text-sm ${
                  messageType === 'error'
                    ? 'border border-red-200 bg-red-50 text-red-700'
                    : 'border border-green-200 bg-green-50 text-green-700'
                }`}
              >
                {message}
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Create User</h2>
              <p className="mt-1 text-sm text-gray-600">
                Temporary password is always generated automatically from the first 8 digits of the phone number.
              </p>
            </div>

            <form onSubmit={handleCreateUser} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Full name</label>
                <input
                  className="w-full rounded-xl border px-4 py-3 text-sm"
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Email</label>
                <input
                  className="w-full rounded-xl border px-4 py-3 text-sm"
                  placeholder="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Phone number</label>
                <input
                  className="w-full rounded-xl border px-4 py-3 text-sm"
                  placeholder="Phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Temporary password</label>
                <input
                  className="w-full rounded-xl border bg-gray-50 px-4 py-3 text-sm text-gray-700"
                  value={generatedPassword}
                  readOnly
                  placeholder="Generated from phone"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Role</label>
                <select
                  className="w-full rounded-xl border px-4 py-3 text-sm"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="rep">Rep</option>
                  <option value="manager">Manager</option>
                  <option value="sales_manager">Sales Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Manager</label>
                <select
                  className="w-full rounded-xl border px-4 py-3 text-sm"
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
                <label className="text-sm font-medium text-gray-700">Rep type / commission tier</label>
                <select
                  className="w-full rounded-xl border px-4 py-3 text-sm"
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
                <label className="text-sm font-medium text-gray-700">Avatar</label>
                <input
                  type="file"
                  accept="image/*"
                  className="w-full rounded-xl border px-4 py-3 text-sm"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null
                    setAvatarFile(file)
                    setAvatarPreview(file ? URL.createObjectURL(file) : '')
                  }}
                />
              </div>

              {avatarPreview ? (
                <div className="md:col-span-2">
                  <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <img
                      src={avatarPreview}
                      alt="Avatar preview"
                      className="h-20 w-20 rounded-full object-cover"
                    />
                    <div className="text-sm text-gray-600">
                      Avatar will be center-cropped into a square profile image when uploaded.
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="md:col-span-2">
                <label className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  Active user
                </label>
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-60"
                >
                  {saving ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-wrap items-end gap-4">
              <div className="min-w-[220px] flex-1">
                <label className="mb-2 block text-sm font-medium text-gray-700">Search users</label>
                <input
                  className="w-full rounded-xl border px-4 py-3 text-sm"
                  placeholder="Search by name, phone, role, manager, or rep type"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="min-w-[180px]">
                <label className="mb-2 block text-sm font-medium text-gray-700">Status</label>
                <select
                  className="w-full rounded-xl border px-4 py-3 text-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                >
                  <option value="all">All</option>
                  <option value="active">Active only</option>
                  <option value="inactive">Inactive only</option>
                </select>
              </div>

              <div className="min-w-[180px]">
                <label className="mb-2 block text-sm font-medium text-gray-700">Role</label>
                <select
                  className="w-full rounded-xl border px-4 py-3 text-sm"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
                >
                  <option value="all">All roles</option>
                  <option value="rep">Rep</option>
                  <option value="manager">Manager</option>
                  <option value="sales_manager">Sales Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Existing Users</h2>
              <p className="mt-1 text-sm text-gray-600">
                Search, edit, activate, deactivate, and delete CRM users.
              </p>
            </div>

            {loading ? (
              <div className="mt-4 text-sm text-gray-600">Loading users...</div>
            ) : filteredProfiles.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600">
                No users matched your filters.
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredProfiles.map((profile) => {
                  const managerName = profile.manager_id
                    ? managerNameById.get(profile.manager_id) ?? 'Unknown manager'
                    : '—'

                  const repTypeName =
                    profile.rep_type_id !== null
                      ? repTypeNameById.get(profile.rep_type_id) ?? 'Unknown rep type'
                      : '—'

                  const draft = drafts[profile.id]
                  const isEditing = editingId === profile.id

                  return (
                    <div
                      key={profile.id}
                      className="rounded-xl border border-gray-200 p-4"
                    >
                      {!isEditing || !draft ? (
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-3">
                              {profile.avatar_url ? (
                                <img
                                  src={profile.avatar_url}
                                  alt={profile.full_name}
                                  className="h-12 w-12 rounded-full object-cover"
                                />
                              ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-600">
                                  {profile.full_name?.slice(0, 1) || '?'}
                                </div>
                              )}

                              <div>
                                <div className="text-sm font-semibold text-gray-900">
                                  {profile.full_name}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                                  <span>Role: {profile.role}</span>
                                  <span>•</span>
                                  <span>Active: {profile.is_active ? 'Yes' : 'No'}</span>
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 text-xs text-gray-500">
                              Phone: {profile.phone || '—'}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              Manager: {managerName}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              Rep Type: {repTypeName}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleActive(profile)}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 transition hover:bg-gray-100"
                            >
                              {profile.is_active ? 'Make Inactive' : 'Make Active'}
                            </button>

                            <button
                              type="button"
                              onClick={() => setEditingId(profile.id)}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 transition hover:bg-gray-100"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteUser(profile)}
                              disabled={deletingId === profile.id}
                              className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                            >
                              {deletingId === profile.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <input
                              className="rounded-xl border px-4 py-3 text-sm"
                              value={draft.full_name}
                              onChange={(e) =>
                                updateDraft(profile.id, { full_name: e.target.value })
                              }
                              placeholder="Full name"
                            />

                            <input
                              className="rounded-xl border px-4 py-3 text-sm"
                              value={draft.phone}
                              onChange={(e) =>
                                updateDraft(profile.id, { phone: e.target.value })
                              }
                              placeholder="Phone"
                            />

                            <select
                              className="rounded-xl border px-4 py-3 text-sm"
                              value={draft.role}
                              onChange={(e) =>
                                updateDraft(profile.id, { role: e.target.value })
                              }
                            >
                              <option value="rep">Rep</option>
                              <option value="manager">Manager</option>
                              <option value="sales_manager">Sales Manager</option>
                              <option value="admin">Admin</option>
                            </select>

                            <select
                              className="rounded-xl border px-4 py-3 text-sm"
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

                            <select
                              className="rounded-xl border px-4 py-3 text-sm"
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

                            <input
                              className="rounded-xl border px-4 py-3 text-sm"
                              value={draft.avatar_url}
                              onChange={(e) =>
                                updateDraft(profile.id, { avatar_url: e.target.value })
                              }
                              placeholder="Avatar URL"
                            />
                          </div>

                          <label className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={draft.is_active}
                              onChange={(e) =>
                                updateDraft(profile.id, { is_active: e.target.checked })
                              }
                            />
                            Active user
                          </label>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveExistingUser(profile.id)}
                              disabled={savingEditId === profile.id}
                              className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-gray-800 disabled:opacity-60"
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
                                  },
                                }))
                              }}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-900 transition hover:bg-gray-100"
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