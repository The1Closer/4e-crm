'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { authorizedFetch } from '@/lib/api-client'
import {
  buildMentionHandle,
  getActiveProfiles,
} from '@/lib/notification-utils'

type NoteItem = {
  id: string
  body: string
  created_at: string
  updated_at?: string
  author_name?: string | null
}

type MentionableProfile = {
  id: string
  full_name: string | null
  role?: string | null
  is_active?: boolean | null
}

type MentionContext = {
  start: number
  end: number
  query: string
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-US')
}

function getMentionContext(value: string, caretIndex: number): MentionContext | null {
  const beforeCaret = value.slice(0, caretIndex)
  const match = beforeCaret.match(/(?:^|\s)@([a-zA-Z0-9._-]*)$/)

  if (!match) {
    return null
  }

  return {
    start: caretIndex - match[1].length - 1,
    end: caretIndex,
    query: match[1].toLowerCase(),
  }
}

function HighlightedNoteBody({ body }: { body: string }) {
  return body.split(/(@[A-Za-z0-9._-]+)/g).map((part, index) => {
    if (part.startsWith('@')) {
      return (
        <span
          key={`${part}-${index}`}
          className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900"
        >
          {part}
        </span>
      )
    }

    return <span key={`${part}-${index}`}>{part}</span>
  })
}

export default function NotesSection({
  jobId,
  initialNotes,
  canDeleteNotes,
}: {
  jobId: string
  initialNotes: NoteItem[]
  canDeleteNotes: boolean
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const [notes, setNotes] = useState<NoteItem[]>(initialNotes)
  const [profiles, setProfiles] = useState<MentionableProfile[]>([])
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [mentionContext, setMentionContext] = useState<MentionContext | null>(null)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0)

  useEffect(() => {
    let isActive = true

    async function loadProfiles() {
      const nextProfiles = (await getActiveProfiles()) as MentionableProfile[]

      if (!isActive) {
        return
      }

      setProfiles(nextProfiles)
    }

    void loadProfiles()

    return () => {
      isActive = false
    }
  }, [])

  const mentionSuggestions = useMemo(() => {
    if (!mentionContext) {
      return []
    }

    const loweredQuery = mentionContext.query.trim().toLowerCase()

    return profiles
      .filter((profile) => {
        const fullName = (profile.full_name ?? '').toLowerCase()
        const handle = buildMentionHandle(profile.full_name)

        if (!loweredQuery) {
          return true
        }

        return (
          fullName.includes(loweredQuery) ||
          handle.includes(loweredQuery) ||
          handle.startsWith(loweredQuery)
        )
      })
      .slice(0, 6)
  }, [mentionContext, profiles])

  useEffect(() => {
    if (activeSuggestionIndex < mentionSuggestions.length) {
      return
    }

    setActiveSuggestionIndex(0)
  }, [activeSuggestionIndex, mentionSuggestions.length])

  function syncMentionContext(nextValue: string, caretIndex: number) {
    const nextContext = getMentionContext(nextValue, caretIndex)
    setMentionContext(nextContext)

    if (!nextContext) {
      setActiveSuggestionIndex(0)
    }
  }

  function applyMention(profile: MentionableProfile) {
    if (!mentionContext) {
      return
    }

    const handle = buildMentionHandle(profile.full_name)
    const nextValue = `${body.slice(0, mentionContext.start)}@${handle} ${body.slice(
      mentionContext.end
    )}`
    const nextCaretIndex = mentionContext.start + handle.length + 2

    setBody(nextValue)
    setMentionContext(null)
    setActiveSuggestionIndex(0)

    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(nextCaretIndex, nextCaretIndex)
    })
  }

  async function handleAddNote() {
    if (!body.trim()) return

    setSaving(true)
    setMessage('')

    try {
      const response = await authorizedFetch(`/api/jobs/${jobId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body,
        }),
      })

      const result = (await response.json().catch(() => null)) as
        | {
            note?: NoteItem
            error?: string
          }
        | null

      if (!response.ok || !result?.note) {
        throw new Error(result?.error || 'Could not add the note.')
      }

      setNotes((prev) => [result.note as NoteItem, ...prev])
      setBody('')
      setMentionContext(null)
      setActiveSuggestionIndex(0)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add the note.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!canDeleteNotes || deletingNoteId) {
      return
    }

    const confirmed = window.confirm('Delete this note?')

    if (!confirmed) {
      return
    }

    setDeletingNoteId(noteId)
    setMessage('')

    try {
      const response = await authorizedFetch(`/api/jobs/${jobId}/notes/${noteId}`, {
        method: 'DELETE',
      })

      const result = (await response.json().catch(() => null)) as
        | {
            error?: string
          }
        | null

      if (!response.ok) {
        throw new Error(result?.error || 'Could not delete the note.')
      }

      setNotes((prev) => prev.filter((note) => note.id !== noteId))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not delete the note.')
    } finally {
      setDeletingNoteId(null)
    }
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-[#0b0f16]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Notes</h2>
          <p className="mt-1 text-sm text-white/60">
            Add job context, tag teammates with `@name`, and keep handoffs visible.
          </p>
        </div>

        <div className="rounded-full border border-[#d6b37a]/25 bg-[#d6b37a]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#f6dfb2]">
          {notes.length} note{notes.length === 1 ? '' : 's'}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(event) => {
              const nextValue = event.target.value
              setBody(nextValue)
              syncMentionContext(nextValue, event.target.selectionStart)
            }}
            onClick={(event) =>
              syncMentionContext(body, event.currentTarget.selectionStart)
            }
            onKeyUp={(event) =>
              syncMentionContext(body, event.currentTarget.selectionStart)
            }
            onKeyDown={(event) => {
              if (!mentionContext || mentionSuggestions.length === 0) {
                return
              }

              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActiveSuggestionIndex(
                  (current) => (current + 1) % mentionSuggestions.length
                )
                return
              }

              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveSuggestionIndex((current) =>
                  current === 0 ? mentionSuggestions.length - 1 : current - 1
                )
                return
              }

              if (event.key === 'Enter' || event.key === 'Tab') {
                event.preventDefault()
                applyMention(mentionSuggestions[activeSuggestionIndex])
                return
              }

              if (event.key === 'Escape') {
                setMentionContext(null)
                setActiveSuggestionIndex(0)
              }
            }}
            placeholder="Add a note, then type @ to tag someone..."
            className="min-h-[140px] w-full rounded-[1.4rem] border border-white/10 bg-black/20 px-4 py-3 pr-4 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d6b37a]/35"
          />

          {mentionContext && mentionSuggestions.length > 0 ? (
            <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-[1.6rem] border border-white/10 bg-[#0b0f16] p-2 shadow-[0_28px_60px_rgba(0,0,0,0.35)]">
              <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                Mention Someone
              </div>

              <div className="space-y-1">
                {mentionSuggestions.map((profile, index) => {
                  const handle = buildMentionHandle(profile.full_name)
                  const isActive = index === activeSuggestionIndex

                  return (
                    <button
                      key={profile.id}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault()
                        applyMention(profile)
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${
                        isActive
                          ? 'bg-[#d6b37a] text-black'
                          : 'bg-white/[0.04] text-white hover:bg-white/[0.08]'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-medium">
                          {profile.full_name || 'Unnamed user'}
                        </div>
                        <div
                          className={`text-xs ${
                            isActive ? 'text-black/65' : 'text-white/48'
                          }`}
                        >
                          @{handle}
                        </div>
                      </div>

                      <div
                        className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${
                          isActive ? 'text-black/55' : 'text-white/35'
                        }`}
                      >
                        {profile.role || 'user'}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleAddNote}
            disabled={saving}
            className="rounded-2xl bg-[#d6b37a] px-4 py-2 text-sm font-semibold text-black shadow-[0_12px_24px_rgba(214,179,122,0.24)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {saving ? 'Saving...' : 'Add Note'}
          </button>

          <div className="text-xs text-white/48">
            Tip: `@john.smith` style mentions are inserted automatically when you
            choose a teammate.
          </div>
        </div>

        {message ? <div className="text-sm text-red-200">{message}</div> : null}
      </div>

      <div className="mt-6 space-y-3">
        {notes.length === 0 ? (
          <div className="rounded-[1.4rem] border border-dashed border-white/15 p-4 text-sm text-white/60">
            No notes yet.
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4"
            >
              {canDeleteNotes ? (
                <div className="mb-2 flex justify-end">
                  <button
                    type="button"
                    disabled={deletingNoteId === note.id}
                    onClick={() => {
                      void handleDeleteNote(note.id)
                    }}
                    className="rounded-lg border border-red-300/25 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingNoteId === note.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              ) : null}
              <div className="whitespace-pre-wrap text-sm leading-7 text-white/82">
                <HighlightedNoteBody body={note.body} />
              </div>
              <div className="mt-2 text-xs text-white/42">
                {note.author_name ? `${note.author_name} • ` : ''}
                {formatDateTime(note.created_at)}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
