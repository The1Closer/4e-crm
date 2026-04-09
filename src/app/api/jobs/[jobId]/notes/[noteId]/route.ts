import { NextRequest, NextResponse } from 'next/server'
import {
  getRouteRequester,
  requireExistingJob,
  requireManager,
} from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

type RouteContext = {
  params: Promise<{
    jobId: string
    noteId: string
  }>
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const managerResponse = requireManager(authResult.requester)

  if (managerResponse) {
    return managerResponse
  }

  const { jobId, noteId } = await context.params
  const existingJobResult = await requireExistingJob(jobId)

  if ('response' in existingJobResult) {
    return existingJobResult.response
  }

  const { data: note, error: noteError } = await supabaseAdmin
    .from('notes')
    .select('id, job_id')
    .eq('id', noteId)
    .maybeSingle()

  if (noteError) {
    return NextResponse.json({ error: noteError.message }, { status: 400 })
  }

  if (!note || note.job_id !== jobId) {
    return NextResponse.json({ error: 'Note not found.' }, { status: 404 })
  }

  const { error: deleteError } = await supabaseAdmin
    .from('notes')
    .delete()
    .eq('id', noteId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
