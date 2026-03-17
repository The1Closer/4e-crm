'use client'

import { type ComponentType, useEffect, useMemo, useState } from 'react'
import {
  BookText,
  FileText,
  Link2,
  MonitorPlay,
  PencilLine,
  Plus,
  Presentation,
  Save,
  Trash2,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { authorizedFetch } from '@/lib/api-client'
import { getCurrentUserProfile, isManagerLike } from '@/lib/auth-helpers'
import {
  cloneTrainingResources,
  DEFAULT_TRAINING_RESOURCES,
  type TrainingResourceCategory,
  type TrainingResourceItem,
  type TrainingResourceManifest,
} from '@/lib/training-defaults'

const CATEGORY_META: Record<
  TrainingResourceCategory,
  {
    title: string
    subtitle: string
    icon: ComponentType<{ className?: string }>
    addLabel: string
  }
> = {
  documents: {
    title: 'Documents',
    subtitle: 'Policies, scripts, checklists, and written process references.',
    icon: FileText,
    addLabel: 'Add Document',
  },
  videos: {
    title: 'Videos',
    subtitle: 'Short training clips for field execution and process walkthroughs.',
    icon: MonitorPlay,
    addLabel: 'Add Video',
  },
  presentations: {
    title: 'PowerPoints',
    subtitle: 'Decks for onboarding, leadership training, and team meetings.',
    icon: Presentation,
    addLabel: 'Add Deck',
  },
}

function buildEmptyResource(category: TrainingResourceCategory) {
  return {
    id: `${category}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: '',
    detail: '',
    url: '',
  }
}

function TrainingPageContent() {
  const [resources, setResources] = useState<TrainingResourceManifest>(
    cloneTrainingResources(DEFAULT_TRAINING_RESOURCES)
  )
  const [savedResources, setSavedResources] = useState<TrainingResourceManifest>(
    cloneTrainingResources(DEFAULT_TRAINING_RESOURCES)
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')
  const [isEditing, setIsEditing] = useState(false)
  const [canManageTraining, setCanManageTraining] = useState(false)

  useEffect(() => {
    let isActive = true

    async function loadPage() {
      setLoading(true)
      setMessage('')
      setMessageType('')

      try {
        const profile = await getCurrentUserProfile()

        if (!isActive) {
          return
        }

        setCanManageTraining(isManagerLike(profile?.role))

        const response = await authorizedFetch('/api/training-resources')
        const result = (await response.json().catch(() => null)) as
          | {
              resources?: TrainingResourceManifest
              error?: string
            }
          | null

        if (!response.ok) {
          throw new Error(result?.error || 'Could not load training resources.')
        }

        const nextResources =
          result?.resources ?? cloneTrainingResources(DEFAULT_TRAINING_RESOURCES)

        setResources(nextResources)
        setSavedResources(cloneTrainingResources(nextResources))
      } catch (error) {
        setMessageType('error')
        setMessage(
          error instanceof Error
            ? error.message
            : 'Could not load training resources.'
        )
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    void loadPage()

    return () => {
      isActive = false
    }
  }, [])

  const totalResourceCount = useMemo(() => {
    return Object.values(resources).reduce((sum, items) => sum + items.length, 0)
  }, [resources])

  function updateResource(
    category: TrainingResourceCategory,
    resourceId: string,
    patch: Partial<TrainingResourceItem>
  ) {
    setResources((current) => ({
      ...current,
      [category]: current[category].map((item) =>
        item.id === resourceId ? { ...item, ...patch } : item
      ),
    }))
  }

  function addResource(category: TrainingResourceCategory) {
    setResources((current) => ({
      ...current,
      [category]: [...current[category], buildEmptyResource(category)],
    }))
  }

  function removeResource(category: TrainingResourceCategory, resourceId: string) {
    setResources((current) => ({
      ...current,
      [category]: current[category].filter((item) => item.id !== resourceId),
    }))
  }

  function handleCancelEdit() {
    setResources(cloneTrainingResources(savedResources))
    setIsEditing(false)
    setMessage('')
    setMessageType('')
  }

  async function handleSaveResources() {
    setSaving(true)
    setMessage('')
    setMessageType('')

    try {
      const response = await authorizedFetch('/api/training-resources', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resources,
        }),
      })

      const result = (await response.json().catch(() => null)) as
        | {
            resources?: TrainingResourceManifest
            error?: string
          }
        | null

      if (!response.ok || !result?.resources) {
        throw new Error(result?.error || 'Could not save training resources.')
      }

      setResources(result.resources)
      setSavedResources(cloneTrainingResources(result.resources))
      setIsEditing(false)
      setMessageType('success')
      setMessage('Training library updated.')
    } catch (error) {
      setMessageType('error')
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not save training resources.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.22),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_26%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,179,122,0.7),transparent)]" />

        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b37a]">
              Training
            </div>

            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
              Rep Resource Library
            </h1>

            <p className="mt-3 max-w-3xl text-base leading-7 text-white/68 md:text-lg">
              A shared library for onboarding, field standards, and leadership materials.
              Reps can browse it cleanly, and managers can update the content without
              leaving the page.
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-black/20 px-5 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.22)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/38">
              Access Mode
            </div>
            <div className="mt-2 text-xl font-semibold text-white">
              {canManageTraining ? (isEditing ? 'Manager Editing' : 'Manager Ready') : 'Read Only'}
            </div>
            <div className="mt-1 text-sm text-white/55">
              {canManageTraining
                ? 'Managers can update library entries and links here.'
                : 'Training materials are view-only for this account.'}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Library Items" value={String(totalResourceCount)} />
        <MetricCard label="Documents" value={String(resources.documents.length)} />
        <MetricCard label="Videos + Decks" value={String(resources.videos.length + resources.presentations.length)} />
      </section>

      {message ? (
        <section
          className={`rounded-[1.6rem] border p-4 text-sm shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl ${
            messageType === 'success'
              ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
              : 'border-red-400/20 bg-red-500/10 text-red-200'
          }`}
        >
          {message}
        </section>
      ) : null}

      {canManageTraining ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
                Manager Controls
              </div>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
                Publish updates directly from the library
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/60">
                Edit titles, descriptions, and external links. Save when you want the
                whole training page updated for everyone.
              </p>
            </div>

            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.1]"
              >
                <PencilLine className="h-4 w-4 text-[#d6b37a]" />
                Edit Library
              </button>
            ) : (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.1]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveResources}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85] disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Library'}
                </button>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {loading ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-sm text-white/60 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          Loading training library...
        </section>
      ) : (
        <section className="grid gap-6 xl:grid-cols-3">
          {(Object.keys(CATEGORY_META) as TrainingResourceCategory[]).map((category) => (
            <ResourcePanel
              key={category}
              category={category}
              title={CATEGORY_META[category].title}
              subtitle={CATEGORY_META[category].subtitle}
              icon={CATEGORY_META[category].icon}
              addLabel={CATEGORY_META[category].addLabel}
              resources={resources[category]}
              editing={canManageTraining && isEditing}
              onAdd={() => addResource(category)}
              onChange={(resourceId, patch) =>
                updateResource(category, resourceId, patch)
              }
              onRemove={(resourceId) => removeResource(category, resourceId)}
            />
          ))}
        </section>
      )}

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
        <div className="flex items-start gap-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-[1.2rem] border border-white/10 bg-black/20">
            <BookText className="h-5 w-5 text-[#d6b37a]" />
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
              Publishing Flow
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
              One page for reps, one edit mode for managers
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
              Reps get a simple library. Managers can maintain the content from the same
              screen without needing a code change every time a playbook, video, or deck
              link changes.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

function MetricCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-white">{value}</div>
    </div>
  )
}

function ResourcePanel({
  category,
  title,
  subtitle,
  icon: Icon,
  addLabel,
  resources,
  editing,
  onAdd,
  onChange,
  onRemove,
}: {
  category: TrainingResourceCategory
  title: string
  subtitle: string
  icon: ComponentType<{ className?: string }>
  addLabel: string
  resources: TrainingResourceItem[]
  editing: boolean
  onAdd: () => void
  onChange: (resourceId: string, patch: Partial<TrainingResourceItem>) => void
  onRemove: (resourceId: string) => void
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
            {title}
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">{subtitle}</p>
        </div>

        <div className="inline-flex h-12 w-12 items-center justify-center rounded-[1.2rem] border border-white/10 bg-black/20">
          <Icon className="h-5 w-5 text-[#d6b37a]" />
        </div>
      </div>

      {editing ? (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
          >
            <Plus className="h-4 w-4 text-[#d6b37a]" />
            {addLabel}
          </button>
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {resources.length === 0 ? (
          <div className="rounded-[1.4rem] border border-dashed border-white/14 p-4 text-sm text-white/55">
            No {category} added yet.
          </div>
        ) : (
          resources.map((resource) => (
            <article
              key={resource.id}
              className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4"
            >
              {!editing ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-white">{resource.title}</div>
                    {resource.url ? (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/75 transition hover:bg-white/[0.1]"
                      >
                        <Link2 className="h-3.5 w-3.5 text-[#d6b37a]" />
                        Open
                      </a>
                    ) : (
                      <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
                        Reference
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/58">{resource.detail}</p>
                  {resource.url ? (
                    <div className="mt-3 truncate text-xs text-[#d6b37a]">{resource.url}</div>
                  ) : null}
                </>
              ) : (
                <div className="space-y-3">
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d6b37a]/35"
                    value={resource.title}
                    onChange={(event) =>
                      onChange(resource.id, { title: event.target.value })
                    }
                    placeholder={`${title} title`}
                  />
                  <textarea
                    className="min-h-[110px] w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d6b37a]/35"
                    value={resource.detail}
                    onChange={(event) =>
                      onChange(resource.id, { detail: event.target.value })
                    }
                    placeholder="Description or coaching note"
                  />
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d6b37a]/35"
                    value={resource.url}
                    onChange={(event) =>
                      onChange(resource.id, { url: event.target.value })
                    }
                    placeholder="Optional external link"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => onRemove(resource.id)}
                      className="inline-flex items-center gap-2 rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-200 transition hover:bg-red-500/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  )
}

export default function TrainingPage() {
  return (
    <ProtectedRoute>
      <TrainingPageContent />
    </ProtectedRoute>
  )
}
