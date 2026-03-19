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

async function proxyPdfFromPublicUrl(
  fileUrl: string,
  failureMessage: string
) {
  try {
    const response = await fetch(fileUrl, { cache: 'no-store' })

    if (!response.ok) {
      return NextResponse.json({ error: failureMessage }, { status: 400 })
    }

    return new NextResponse(await response.arrayBuffer(), {
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/pdf',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : failureMessage,
      },
      { status: 400 }
    )
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const { documentId } = await context.params

  const { data: doc, error: docError } = await supabaseAdmin
    .from('job_documents')
    .select('id, job_id, file_path, file_url, file_name')
    .eq('id', documentId)
    .maybeSingle()

  if (docError || !doc) {
    return NextResponse.json({ error: 'Job document not found.' }, { status: 404 })
  }

  const accessError = await requireJobAccess(authResult.requester, doc.job_id)

  if (accessError) {
    return accessError
  }

  if (!doc.file_path) {
    if (doc.file_url) {
      return proxyPdfFromPublicUrl(doc.file_url, 'Could not load the job document.')
    }

    return NextResponse.json(
      { error: 'Job document file is missing.' },
      { status: 404 }
    )
  }

  const downloadRes = await supabaseAdmin.storage.from('documents').download(doc.file_path)

  if (downloadRes.error || !downloadRes.data) {
    if (doc.file_url) {
      return proxyPdfFromPublicUrl(
        doc.file_url,
        downloadRes.error?.message || 'Could not load the job document.'
      )
    }

    return NextResponse.json(
      { error: downloadRes.error?.message || 'Could not load the job document.' },
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
