import { NextRequest, NextResponse } from 'next/server'
import { slugifyFileName } from '@/lib/file-utils'
import {
  getRouteRequester,
  requireExistingJob,
  requireJobAccess,
} from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

type RouteContext = {
  params: Promise<{
    jobId: string
  }>
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

  const formData = await req.formData()
  const fileEntry = formData.get('file')
  const templateId = String(formData.get('templateId') ?? '').trim() || null
  const documentName = String(formData.get('documentName') ?? '').trim()
  const documentType =
    String(formData.get('documentType') ?? '').trim() || 'Signed Document'

  if (!(fileEntry instanceof File)) {
    return NextResponse.json({ error: 'A PDF file is required.' }, { status: 400 })
  }

  const safeBase = slugifyFileName(documentName || fileEntry.name || 'signed-document')
  const filePath = `jobs/${jobId}/${Date.now()}-${safeBase}.pdf`

  const uploadRes = await supabaseAdmin.storage
    .from('documents')
    .upload(filePath, await fileEntry.arrayBuffer(), {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (uploadRes.error) {
    return NextResponse.json({ error: uploadRes.error.message }, { status: 400 })
  }

  const publicUrlRes = supabaseAdmin.storage.from('documents').getPublicUrl(filePath)

  const { data, error } = await supabaseAdmin
    .from('job_documents')
    .insert({
      job_id: jobId,
      template_id: templateId,
      file_name: `${documentName || 'signed-document'}.pdf`,
      file_url: publicUrlRes.data.publicUrl,
      file_path: filePath,
      document_type: documentType,
      is_signed: true,
      created_by: authResult.requester.profile.id,
    })
    .select(
      'id, template_id, file_name, file_url, file_path, document_type, is_signed, created_at'
    )
    .single()

  if (error) {
    await supabaseAdmin.storage.from('documents').remove([filePath])

    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ document: data })
}
