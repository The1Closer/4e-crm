import { NextRequest, NextResponse } from 'next/server'
import { getRouteRequester, requireManager } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

type RouteContext = {
  params: Promise<{
    templateId: string
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
