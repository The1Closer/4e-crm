import { NextRequest, NextResponse } from 'next/server'
import { getRouteRequester, requireManager } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

type RouteContext = {
  params: Promise<{
    templateId: string
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

  const { templateId } = await context.params

  const { data: template, error: templateError } = await supabaseAdmin
    .from('document_templates')
    .select('id, name, file_path, file_url')
    .eq('id', templateId)
    .maybeSingle()

  if (templateError || !template) {
    return NextResponse.json({ error: 'Template not found.' }, { status: 404 })
  }

  if (!template.file_path) {
    if (template.file_url) {
      return proxyPdfFromPublicUrl(
        template.file_url,
        'Could not load the template PDF.'
      )
    }

    return NextResponse.json(
      { error: 'Template file is missing.' },
      { status: 404 }
    )
  }

  const downloadRes = await supabaseAdmin.storage
    .from('documents')
    .download(template.file_path)

  if (downloadRes.error || !downloadRes.data) {
    if (template.file_url) {
      return proxyPdfFromPublicUrl(
        template.file_url,
        downloadRes.error?.message || 'Could not load the template PDF.'
      )
    }

    return NextResponse.json(
      { error: downloadRes.error?.message || 'Could not load the template PDF.' },
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

  const { templateId } = await context.params

  const { data: template, error: templateError } = await supabaseAdmin
    .from('document_templates')
    .select('id, file_path')
    .eq('id', templateId)
    .maybeSingle()

  if (templateError || !template) {
    return NextResponse.json({ error: 'Template not found.' }, { status: 404 })
  }

  if (template.file_path) {
    await supabaseAdmin.storage.from('documents').remove([template.file_path])
  }

  const { error } = await supabaseAdmin
    .from('document_templates')
    .delete()
    .eq('id', templateId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
