import { NextRequest, NextResponse } from 'next/server'
import {
  getRouteRequester,
  requireExistingJob,
  requireJobAccess,
} from '@/lib/server-auth'
import { extractMentionNames, profileMatchesMention } from '@/lib/mention-utils'
import { supabaseAdmin } from '@/lib/supabase-admin'

type RouteContext = {
  params: Promise<{
    jobId: string
  }>
}

type CreateNoteBody = {
  body?: string
}

type InsertedNoteRow = {
  id: string
  body: string
  created_at: string
  updated_at?: string | null
  created_by?: string | null
}

export async function POST(req: NextRequest, context: RouteContext) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const { jobId } = await context.params
  const existingJobResult = await requireExistingJob(jobId)

  if ('response' in existingJobResult) {
    return existingJobResult.response
  }

  const accessError = await requireJobAccess(authResult.requester, jobId)

  if (accessError) {
    return accessError
  }

  const body = (await req.json()) as CreateNoteBody
  const noteBody = String(body.body ?? '').trim()

  if (!noteBody) {
    return NextResponse.json({ error: 'Note text is required.' }, { status: 400 })
  }

  const insertWithCreator = async () =>
    supabaseAdmin
      .from('notes')
      .insert({
        job_id: jobId,
        body: noteBody,
        created_by: authResult.requester.profile.id,
      })
      .select('*')
      .single()

  const insertWithoutCreator = async () =>
    supabaseAdmin
      .from('notes')
      .insert({
        job_id: jobId,
        body: noteBody,
      })
      .select('*')
      .single()

  let noteInsertResult = await insertWithCreator()

  if (
    noteInsertResult.error?.message
      ?.toLowerCase()
      .includes('column "created_by" of relation "notes" does not exist')
  ) {
    noteInsertResult = await insertWithoutCreator()
  }

  const note = noteInsertResult.data as InsertedNoteRow | null
  const noteError = noteInsertResult.error

  if (noteError || !note) {
    return NextResponse.json(
      { error: noteError?.message || 'Could not create the note.' },
      { status: 400 }
    )
  }

  const mentionTokens = extractMentionNames(noteBody)

  if (mentionTokens.length > 0) {
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .eq('is_active', true)
      .order('full_name', { ascending: true })

    if (!profilesError) {
      const mentionedUserIds = (profiles ?? [])
        .filter((profile) => {
          if (!profile.full_name) {
            return false
          }

          return mentionTokens.some((token) =>
            profileMatchesMention(profile.full_name ?? '', token)
          )
        })
        .map((profile) => profile.id)
        .filter((userId) => userId !== authResult.requester.profile.id)

      if (mentionedUserIds.length > 0) {
        await supabaseAdmin.from('notifications').insert(
          [...new Set(mentionedUserIds)].map((userId) => ({
            user_id: userId,
            actor_user_id: authResult.requester.profile.id,
            type: 'note_mention',
            title: 'You were mentioned in a note',
            message: `${
              authResult.requester.profile.full_name || 'A teammate'
            } tagged you in a job note.`,
            link: `/jobs/${jobId}?tab=notes`,
            job_id: jobId,
            note_id: note.id,
            metadata: {
              mention_tokens: mentionTokens,
            },
          }))
        )
      }
    }
  }

  return NextResponse.json({
    note: {
      id: note.id,
      body: note.body,
      created_at: note.created_at,
      updated_at: note.updated_at ?? null,
      author_name: authResult.requester.profile.full_name ?? null,
    },
  })
}
