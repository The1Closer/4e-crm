'use client'

import { useEffect, useMemo, useState } from 'react'
import { authorizedFetch } from '@/lib/api-client'
import { getActiveProfiles } from '@/lib/notification-utils'
import type { UserProfile } from '@/lib/auth-helpers'

type OpponentRow = {
  id: string
  full_name: string | null
  role: string | null
  is_active: boolean | null
}

const TIME_CONTROLS = ['3+2 Blitz', '10+0 Rapid', '15+10 Classical'] as const
const COLOR_OPTIONS = ['No Preference', 'White', 'Black'] as const

export default function ChessChallengePanel({
  profile,
}: {
  profile: UserProfile
}) {
  const [opponents, setOpponents] = useState<OpponentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [opponentId, setOpponentId] = useState('')
  const [timeControl, setTimeControl] =
    useState<(typeof TIME_CONTROLS)[number]>('10+0 Rapid')
  const [colorPreference, setColorPreference] =
    useState<(typeof COLOR_OPTIONS)[number]>('No Preference')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')

  useEffect(() => {
    let isActive = true

    async function loadOpponents() {
      const rows = (await getActiveProfiles()) as OpponentRow[]

      if (!isActive) return

      const availableOpponents = rows
        .filter((row) => row.id !== profile.id)
        .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''))

      setOpponents(availableOpponents)
      setOpponentId((current) => current || availableOpponents[0]?.id || '')
      setLoading(false)
    }

    void loadOpponents()

    return () => {
      isActive = false
    }
  }, [profile.id])

  const selectedOpponent = useMemo(
    () => opponents.find((opponent) => opponent.id === opponentId) ?? null,
    [opponentId, opponents]
  )

  async function sendChallenge() {
    if (!selectedOpponent?.id) {
      setMessageType('error')
      setMessage('Choose a teammate to challenge.')
      return
    }

    setSending(true)
    setMessage('')
    setMessageType('')

    try {
      const colorFragment =
        colorPreference === 'No Preference'
          ? 'No color preference.'
          : `Preferred color: ${colorPreference}.`

      const noteFragment = note.trim() ? ` Note: ${note.trim()}` : ''

      const response = await authorizedFetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userIds: [selectedOpponent.id],
          type: 'chess_invite',
          title: 'Chess match request',
          message: `${profile.full_name ?? 'A teammate'} invited you to a ${timeControl} chess match. ${colorFragment}${noteFragment}`,
          link: '/dashboard',
          metadata: {
            challenger_id: profile.id,
            challenger_name: profile.full_name,
            time_control: timeControl,
            color_preference: colorPreference,
            note: note.trim() || null,
          },
        }),
      })

      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null

      if (!response.ok) {
        throw new Error(result?.error || 'Could not send the chess challenge.')
      }

      setMessageType('success')
      setMessage(`Challenge sent to ${selectedOpponent.full_name ?? 'your teammate'}.`)
      setNote('')
    } catch (error) {
      setMessageType('error')
      setMessage(
        error instanceof Error ? error.message : 'Could not send the chess challenge.'
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]">
            Chess Lounge
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-white">
            Send a match request
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
            Challenge another teammate straight from your dashboard. Requests arrive as CRM notifications so you can keep it internal.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/62">
          Bot status: not wired yet
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="block">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
            Opponent
          </div>
          <select
            value={opponentId}
            onChange={(event) => setOpponentId(event.target.value)}
            disabled={loading || opponents.length === 0}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
          >
            {opponents.length === 0 ? (
              <option value="">No teammates available</option>
            ) : null}
            {opponents.map((opponent) => (
              <option key={opponent.id} value={opponent.id}>
                {opponent.full_name ?? 'Unnamed Teammate'}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
            Time Control
          </div>
          <select
            value={timeControl}
            onChange={(event) =>
              setTimeControl(event.target.value as (typeof TIME_CONTROLS)[number])
            }
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
          >
            {TIME_CONTROLS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
            Color Preference
          </div>
          <select
            value={colorPreference}
            onChange={(event) =>
              setColorPreference(event.target.value as (typeof COLOR_OPTIONS)[number])
            }
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
          >
            {COLOR_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
            Selected Teammate
          </div>
          <div className="mt-2 text-lg font-semibold text-white">
            {selectedOpponent?.full_name ?? 'No teammate selected'}
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.16em] text-[#d6b37a]">
            {selectedOpponent?.role?.replaceAll('_', ' ') || 'Internal player'}
          </div>
        </div>
      </div>

      <label className="mt-4 block">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
          Note
        </div>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional: opening line, time preference, trash talk kept professional..."
          className="min-h-28 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/24 focus:border-[#d6b37a]/35"
        />
      </label>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void sendChallenge()}
          disabled={sending || loading || opponents.length === 0}
          className="rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#e2bf85] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending ? 'Sending...' : 'Send Match Request'}
        </button>

        <div className="text-sm text-white/52">
          Real-time chess bot play is not installed in this deploy build yet.
        </div>
      </div>

      {message ? (
        <div
          className={`mt-4 rounded-2xl border p-3 text-sm ${
            messageType === 'success'
              ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
              : 'border-red-400/25 bg-red-500/10 text-red-200'
          }`}
        >
          {message}
        </div>
      ) : null}
    </section>
  )
}
