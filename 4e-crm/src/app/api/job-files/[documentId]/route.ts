import { NextRequest, NextResponse } from 'next/server'
import {
  getRouteRequester,
  requireJobAccess,
  requireManager,
} from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

type RouteContext = {
  params: Promise<{
    documentId: string
  }>
}

export async function GET(req: NextRequest, context: RouteContext) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const { documentId } = await context.params

  const { data: doc, error: docError } = await supabaseAdmin
    .from('documents')
    .select('id, job_id, file_path, file_name')
    .eq('id', documentId)
    .maybeSingle()

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 })
  }

  const accessError = await requireJobAccess(authResult.requester, doc.job_id)

  if (accessError) {
    return accessError
  }

  const downloadRes = await supabaseAdmin.storage
    .from('job-files')
    .download(doc.file_path)

  if (downloadRes.error || !downloadRes.data) {
    return NextResponse.json(
      { error: downloadRes.error?.message || 'Could not load the document file.' },
      { status: 400 }
    )
  }

  return new NextResponse(await downloadRes.data.arrayBuffer(), {
    headers: {
      'Content-Type': 'application/pdf',
      'Cache-Control': 'no-store',
    },
  })
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
    .from('documents')
    .select('id, file_path')
    .eq('id', documentId)
    .maybeSingle()

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 })
  }

  if (doc.file_path) {
    await supabaseAdmin.storage.from('job-files').remove([doc.file_path])
  }

  const { error } = await supabaseAdmin.from('documents').delete().eq('id', documentId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
