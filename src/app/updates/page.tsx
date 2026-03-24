'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import ManagerOnlyRoute from '@/components/ManagerOnlyRoute'
import { authorizedFetch } from '@/lib/api-client'
import type {
  AnnouncementContentRow,
  SpotlightContentRow,
  SpotlightContentType,
} from '@/lib/home-content'

type ManagerRow = {
  id: string
  full_name: string | null
  role: string | null
}

type ManageResponse = {
  announcements?: AnnouncementContentRow[]
  spotlights?: SpotlightContentRow[]
  managers?: ManagerRow[]
  spotlightsConfigured?: boolean
  error?: string
}

type SaveResponse = {
  error?: string
}

type AnnouncementDraft = {
  id: string | null
  title: string
  body: string
  is_active: boolean
  audience_role: string
  audience_manager_id: string
}

type SpotlightDraft = {
  id: string | null
  title: string
  body: string
  content_type: SpotlightContentType
  media_url: string
  quote_author: string
  is_active: boolean
  display_date: string
  audience_role: string
  audience_manager_id: string
}

const PANEL_CLASS_NAME =
  'rounded-[2rem] border border-white/10 bg-[#0b0f16]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]'

const FIELD_CLASS_NAME =
  'w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d6b37a]/35'

const PRIMARY_BUTTON_CLASS_NAME =
  'rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85] disabled:cursor-not-allowed disabled:opacity-45'

const SECONDARY_BUTTON_CLASS_NAME =
  'rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-45'

const DANGER_BUTTON_CLASS_NAME =
  'rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/18 disabled:cursor-not-allowed disabled:opacity-45'

const EMPTY_ANNOUNCEMENT: AnnouncementDraft = {
  id: null,
  title: '',
  body: '',
  is_active: true,
  audience_role: '',
  audience_manager_id: '',
}

const EMPTY_SPOTLIGHT: SpotlightDraft = {
  id: null,
  title: '',
  body: '',
  content_type: 'quote',
  media_url: '',
  quote_author: '',
  is_active: true,
  display_date: '',
  audience_role: '',
  audience_manager_id: '',
}

function formatRoleLabel(value: string | null | undefined) {
  return value?.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase()) || 'All Roles'
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return 'No date'
  }

  const parsed = new Date(`${value}T12:00:00`)
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
}

function LabeledField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
        {label}
      </div>
      {children}
    </label>
  )
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-white/20 bg-black/30 text-[#d6b37a] focus:ring-[#d6b37a]/40"
      />
      <span>{label}</span>
    </label>
  )
}

function UpdatesPageContent() {
  const [announcements, setAnnouncements] = useState<AnnouncementContentRow[]>([])
  const [spotlights, setSpotlights] = useState<SpotlightContentRow[]>([])
  const [managers, setManagers] = useState<ManagerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingAnnouncement, setSavingAnnouncement] = useState(false)
  const [savingSpotlight, setSavingSpotlight] = useState(false)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')
  const [spotlightsConfigured, setSpotlightsConfigured] = useState(true)
  const [announcementDraft, setAnnouncementDraft] =
    useState<AnnouncementDraft>(EMPTY_ANNOUNCEMENT)
  const [spotlightDraft, setSpotlightDraft] =
    useState<SpotlightDraft>(EMPTY_SPOTLIGHT)

  const managerOptions = useMemo(
    () =>
      managers.map((manager) => ({
        value: manager.id,
        label: `${manager.full_name || 'Unnamed Manager'} (${formatRoleLabel(manager.role)})`,
      })),
    [managers]
  )

  async function loadContent() {
    setLoading(true)
    setMessage('')

    const response = await authorizedFetch('/api/home-content?view=manage', {
      cache: 'no-store',
    })
    const result = (await response.json().catch(() => null)) as
      | ManageResponse
      | null

    if (!response.ok) {
      setMessageType('error')
      setMessage(result?.error || 'Failed to load home-page content.')
      setLoading(false)
      return
    }

    setAnnouncements(result?.announcements ?? [])
    setSpotlights(result?.spotlights ?? [])
    setManagers(result?.managers ?? [])
    setSpotlightsConfigured(result?.spotlightsConfigured ?? true)
    setLoading(false)
  }

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadContent()
    }, 0)

    return () => {
      window.clearTimeout(loadTimer)
    }
  }, [])

  async function saveAnnouncement() {
    setSavingAnnouncement(true)
    setMessage('')

    const response = await authorizedFetch('/api/home-content', {
      method: announcementDraft.id ? 'PATCH' : 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kind: 'announcement',
        ...announcementDraft,
      }),
    })

    const result = (await response.json().catch(() => null)) as
      | SaveResponse
      | null

    if (!response.ok) {
      setMessageType('error')
      setMessage(result?.error || 'Could not save the announcement.')
      setSavingAnnouncement(false)
      return
    }

    setAnnouncementDraft(EMPTY_ANNOUNCEMENT)
    setMessageType('success')
    setMessage(
      announcementDraft.id ? 'Announcement updated.' : 'Announcement created.'
    )
    setSavingAnnouncement(false)
    await loadContent()
  }

  async function saveSpotlight() {
    setSavingSpotlight(true)
    setMessage('')

    const response = await authorizedFetch('/api/home-content', {
      method: spotlightDraft.id ? 'PATCH' : 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kind: 'spotlight',
        ...spotlightDraft,
      }),
    })

    const result = (await response.json().catch(() => null)) as
      | SaveResponse
      | null

    if (!response.ok) {
      setMessageType('error')
      setMessage(result?.error || 'Could not save the spotlight.')
      setSavingSpotlight(false)
      return
    }

    setSpotlightDraft(EMPTY_SPOTLIGHT)
    setMessageType('success')
    setMessage(spotlightDraft.id ? 'Spotlight updated.' : 'Spotlight created.')
    setSavingSpotlight(false)
    await loadContent()
  }

  async function deleteItem(kind: 'announcement' | 'spotlight', id: string) {
    const label = kind === 'announcement' ? 'announcement' : 'spotlight'
    const confirmed = window.confirm(`Delete this ${label}?`)

    if (!confirmed) {
      return
    }

    setDeletingKey(`${kind}:${id}`)
    setMessage('')

    const response = await authorizedFetch('/api/home-content', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kind,
        id,
      }),
    })

    const result = (await response.json().catch(() => null)) as
      | SaveResponse
      | null

    if (!response.ok) {
      setMessageType('error')
      setMessage(result?.error || `Could not delete the ${label}.`)
      setDeletingKey(null)
      return
    }

    setMessageType('success')
    setMessage(`${label[0]?.toUpperCase()}${label.slice(1)} deleted.`)
    setDeletingKey(null)
    await loadContent()
  }

  return (
    <main className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_25px_90px_rgba(0,0,0,0.35)] backdrop-blur-2xl md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.06),transparent_24%)]" />
        <div className="relative space-y-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d6b37a]">
            Manager Tools
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                Updates & Announcements
              </h1>
              <p className="mt-3 text-sm leading-7 text-white/68 md:text-base">
                Control the home-page announcements, the optional daily quote or video spotlight,
                and the exact content your team sees when they land in the CRM.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
            >
              Preview Home Page
            </Link>
          </div>
        </div>
      </section>

      {message ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            messageType === 'error'
              ? 'border-red-400/25 bg-red-500/10 text-red-100'
              : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
          }`}
        >
          {message}
        </div>
      ) : null}

      {!spotlightsConfigured ? (
        <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
          The spotlight table is not in Supabase yet. Announcements still work, but quote/video
          spotlight editing will need the SQL migration first.
        </div>
      ) : null}

      {loading ? (
        <section className={PANEL_CLASS_NAME}>
          <div className="text-sm text-white/60">Loading home-page content…</div>
        </section>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className={PANEL_CLASS_NAME}>
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d6b37a]">
                Announcements
              </div>
              <h2 className="text-2xl font-semibold text-white">
                Home-page updates
              </h2>
              <p className="text-sm text-white/60">
                Add general updates, audience-specific notes, or team-specific announcements.
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <LabeledField label="Title">
                <input
                  value={announcementDraft.title}
                  onChange={(event) =>
                    setAnnouncementDraft((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  className={FIELD_CLASS_NAME}
                  placeholder="Storm prep update"
                />
              </LabeledField>

              <LabeledField label="Body">
                <textarea
                  value={announcementDraft.body}
                  onChange={(event) =>
                    setAnnouncementDraft((current) => ({
                      ...current,
                      body: event.target.value,
                    }))
                  }
                  className={`${FIELD_CLASS_NAME} min-h-32`}
                  placeholder="Share the update that should appear on the home page."
                />
              </LabeledField>

              <div className="grid gap-4 md:grid-cols-2">
                <LabeledField label="Audience Role">
                  <select
                    value={announcementDraft.audience_role}
                    onChange={(event) =>
                      setAnnouncementDraft((current) => ({
                        ...current,
                        audience_role: event.target.value,
                      }))
                    }
                    className={FIELD_CLASS_NAME}
                  >
                    <option value="">All Roles</option>
                    <option value="rep">Rep</option>
                    <option value="manager">Manager</option>
                    <option value="sales_manager">Sales Manager</option>
                    <option value="production_manager">Production Manager</option>
                    <option value="social_media_coordinator">Social Media Coordinator</option>
                    <option value="admin">Admin</option>
                  </select>
                </LabeledField>

                <LabeledField label="Manager Team Filter">
                  <select
                    value={announcementDraft.audience_manager_id}
                    onChange={(event) =>
                      setAnnouncementDraft((current) => ({
                        ...current,
                        audience_manager_id: event.target.value,
                      }))
                    }
                    className={FIELD_CLASS_NAME}
                  >
                    <option value="">All Teams</option>
                    {managerOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </LabeledField>
              </div>

              <ToggleField
                label="Show this announcement on the home page"
                checked={announcementDraft.is_active}
                onChange={(next) =>
                  setAnnouncementDraft((current) => ({
                    ...current,
                    is_active: next,
                  }))
                }
              />

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void saveAnnouncement()}
                  disabled={savingAnnouncement}
                  className={PRIMARY_BUTTON_CLASS_NAME}
                >
                  {savingAnnouncement
                    ? 'Saving...'
                    : announcementDraft.id
                      ? 'Update Announcement'
                      : 'Create Announcement'}
                </button>
                <button
                  type="button"
                  onClick={() => setAnnouncementDraft(EMPTY_ANNOUNCEMENT)}
                  className={SECONDARY_BUTTON_CLASS_NAME}
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              {announcements.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] px-4 py-5 text-sm text-white/50">
                  No announcements yet.
                </div>
              ) : (
                announcements.map((announcement) => (
                  <article
                    key={announcement.id}
                    className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]">
                          <span>{announcement.is_active ? 'Active' : 'Hidden'}</span>
                          <span>{formatRoleLabel(announcement.audience_role)}</span>
                          <span>{formatDate(announcement.created_at.slice(0, 10))}</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white">
                          {announcement.title}
                        </h3>
                        <p className="max-w-2xl whitespace-pre-wrap text-sm leading-6 text-white/68">
                          {announcement.body}
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setAnnouncementDraft({
                              id: announcement.id,
                              title: announcement.title,
                              body: announcement.body,
                              is_active: announcement.is_active,
                              audience_role: announcement.audience_role ?? '',
                              audience_manager_id:
                                announcement.audience_manager_id ?? '',
                            })
                          }
                          className={SECONDARY_BUTTON_CLASS_NAME}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void deleteItem('announcement', announcement.id)
                          }
                          disabled={deletingKey === `announcement:${announcement.id}`}
                          className={DANGER_BUTTON_CLASS_NAME}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className={PANEL_CLASS_NAME}>
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d6b37a]">
                Spotlight
              </div>
              <h2 className="text-2xl font-semibold text-white">
                Daily quote or video
              </h2>
              <p className="text-sm text-white/60">
                Optionally feature one quote or video on the home page alongside announcements.
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <LabeledField label="Title">
                  <input
                    value={spotlightDraft.title}
                    onChange={(event) =>
                      setSpotlightDraft((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    className={FIELD_CLASS_NAME}
                    placeholder="Today’s reset"
                  />
                </LabeledField>

                <LabeledField label="Type">
                  <select
                    value={spotlightDraft.content_type}
                    onChange={(event) =>
                      setSpotlightDraft((current) => ({
                        ...current,
                        content_type: event.target.value === 'video' ? 'video' : 'quote',
                      }))
                    }
                    className={FIELD_CLASS_NAME}
                  >
                    <option value="quote">Quote</option>
                    <option value="video">Video</option>
                  </select>
                </LabeledField>
              </div>

              <LabeledField
                label={spotlightDraft.content_type === 'video' ? 'Description' : 'Quote'}
              >
                <textarea
                  value={spotlightDraft.body}
                  onChange={(event) =>
                    setSpotlightDraft((current) => ({
                      ...current,
                      body: event.target.value,
                    }))
                  }
                  className={`${FIELD_CLASS_NAME} min-h-32`}
                  placeholder={
                    spotlightDraft.content_type === 'video'
                      ? 'Tell the team why this video matters.'
                      : 'Put the quote text here.'
                  }
                />
              </LabeledField>

              <div className="grid gap-4 md:grid-cols-2">
                {spotlightDraft.content_type === 'video' ? (
                  <LabeledField label="Video URL">
                    <input
                      value={spotlightDraft.media_url}
                      onChange={(event) =>
                        setSpotlightDraft((current) => ({
                          ...current,
                          media_url: event.target.value,
                        }))
                      }
                      className={FIELD_CLASS_NAME}
                      placeholder="https://www.youtube.com/watch?v=..."
                    />
                  </LabeledField>
                ) : (
                  <LabeledField label="Quote Author">
                    <input
                      value={spotlightDraft.quote_author}
                      onChange={(event) =>
                        setSpotlightDraft((current) => ({
                          ...current,
                          quote_author: event.target.value,
                        }))
                      }
                      className={FIELD_CLASS_NAME}
                      placeholder="Coach or team member"
                    />
                  </LabeledField>
                )}

                <LabeledField label="Display Date">
                  <input
                    type="date"
                    value={spotlightDraft.display_date}
                    onChange={(event) =>
                      setSpotlightDraft((current) => ({
                        ...current,
                        display_date: event.target.value,
                      }))
                    }
                    className={FIELD_CLASS_NAME}
                  />
                </LabeledField>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <LabeledField label="Audience Role">
                  <select
                    value={spotlightDraft.audience_role}
                    onChange={(event) =>
                      setSpotlightDraft((current) => ({
                        ...current,
                        audience_role: event.target.value,
                      }))
                    }
                    className={FIELD_CLASS_NAME}
                  >
                    <option value="">All Roles</option>
                    <option value="rep">Rep</option>
                    <option value="manager">Manager</option>
                    <option value="sales_manager">Sales Manager</option>
                    <option value="production_manager">Production Manager</option>
                    <option value="social_media_coordinator">Social Media Coordinator</option>
                    <option value="admin">Admin</option>
                  </select>
                </LabeledField>

                <LabeledField label="Manager Team Filter">
                  <select
                    value={spotlightDraft.audience_manager_id}
                    onChange={(event) =>
                      setSpotlightDraft((current) => ({
                        ...current,
                        audience_manager_id: event.target.value,
                      }))
                    }
                    className={FIELD_CLASS_NAME}
                  >
                    <option value="">All Teams</option>
                    {managerOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </LabeledField>
              </div>

              <ToggleField
                label="Show this spotlight on the home page"
                checked={spotlightDraft.is_active}
                onChange={(next) =>
                  setSpotlightDraft((current) => ({
                    ...current,
                    is_active: next,
                  }))
                }
              />

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void saveSpotlight()}
                  disabled={savingSpotlight}
                  className={PRIMARY_BUTTON_CLASS_NAME}
                >
                  {savingSpotlight
                    ? 'Saving...'
                    : spotlightDraft.id
                      ? 'Update Spotlight'
                      : 'Create Spotlight'}
                </button>
                <button
                  type="button"
                  onClick={() => setSpotlightDraft(EMPTY_SPOTLIGHT)}
                  className={SECONDARY_BUTTON_CLASS_NAME}
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              {spotlights.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] px-4 py-5 text-sm text-white/50">
                  No quote or video spotlights yet.
                </div>
              ) : (
                spotlights.map((spotlight) => (
                  <article
                    key={spotlight.id}
                    className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]">
                          <span>{spotlight.is_active ? 'Active' : 'Hidden'}</span>
                          <span>{spotlight.content_type}</span>
                          <span>{formatDate(spotlight.display_date)}</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white">
                          {spotlight.title}
                        </h3>
                        <p className="max-w-2xl whitespace-pre-wrap text-sm leading-6 text-white/68">
                          {spotlight.body}
                        </p>
                        {spotlight.quote_author ? (
                          <div className="text-sm text-white/45">
                            {spotlight.quote_author}
                          </div>
                        ) : null}
                        {spotlight.media_url ? (
                          <a
                            href={spotlight.media_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex text-sm font-semibold text-[#d6b37a] transition hover:text-[#e2bf85]"
                          >
                            Open video link
                          </a>
                        ) : null}
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setSpotlightDraft({
                              id: spotlight.id,
                              title: spotlight.title,
                              body: spotlight.body,
                              content_type: spotlight.content_type,
                              media_url: spotlight.media_url ?? '',
                              quote_author: spotlight.quote_author ?? '',
                              is_active: spotlight.is_active,
                              display_date: spotlight.display_date ?? '',
                              audience_role: spotlight.audience_role ?? '',
                              audience_manager_id:
                                spotlight.audience_manager_id ?? '',
                            })
                          }
                          className={SECONDARY_BUTTON_CLASS_NAME}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void deleteItem('spotlight', spotlight.id)
                          }
                          disabled={deletingKey === `spotlight:${spotlight.id}`}
                          className={DANGER_BUTTON_CLASS_NAME}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

export default function UpdatesPage() {
  return (
    <ManagerOnlyRoute>
      <UpdatesPageContent />
    </ManagerOnlyRoute>
  )
}
