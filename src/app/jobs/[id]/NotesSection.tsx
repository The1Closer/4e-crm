'use client'

import { useState } from 'react'
import { supabase } from '../../../lib/supabase'

type NoteItem = {
  id: string
  body: string
  created_at: string
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-US')
}

export default function NotesSection({
  jobId,
  initialNotes,
}: {
  jobId: string
  initialNotes: NoteItem[]
}) {
  const [notes, setNotes] = useState<NoteItem[]>(initialNotes)
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function handleAddNote() {
    if (!body.trim()) return

    setSaving(true)
    setMessage('')

    const { data, error } = await supabase
      .from('notes')
      .insert({
        job_id: jobId,
        body: body.trim(),
      })
      .select('id, body, created_at')
      .single()

    if (error) {
      setMessage(error.message)
      setSaving(false)
      return
    }

    setNotes((prev) => [data as NoteItem, ...prev])
    setBody('')
    setSaving(false)
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Notes</h2>

      <div className="mt-4 space-y-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note..."
          className="min-h-[120px] w-full rounded-xl border px-4 py-3 text-sm"
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleAddNote}
            disabled={saving}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Add Note'}
          </button>

          {message ? (
            <div className="text-sm text-red-600">{message}</div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {notes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600">
            No notes yet.
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="rounded-xl border border-gray-200 bg-gray-50 p-4"
            >
              <div className="whitespace-pre-wrap text-sm text-gray-800">
                {note.body}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {formatDateTime(note.created_at)}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}