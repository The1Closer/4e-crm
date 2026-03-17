import { NextRequest, NextResponse } from 'next/server'
import { getRouteRequester, requireManager } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

type RouteContext = {
  params: Promise<{
    documentId: string
  }>
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const managerError = requireManager(authResult.requester)

  if (managerError) {
    return managerError
  }

  const { documentId } = await context.params

  const { data: doc, error: docError } = await supabaseAdmin
    .from('job_documents')
    .select('id, file_path')
    .eq('id', documentId)
    .maybeSingle()

  if (docError || !doc) {
    return NextResponse.json({ error: 'Job document not found.' }, { status: 404 })
  }

  if (doc.file_path) {
    await supabaseAdmin.storage.from('documents').remove([doc.file_path])
  }

  const { error } = await supabaseAdmin
    .from('job_documents')
    .delete()
    .eq('id', documentId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
