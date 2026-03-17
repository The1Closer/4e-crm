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

function inferFileType(file: File) {
  return file.type.startsWith('image/') ? 'photo' : 'document'
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

  if (!(fileEntry instanceof File)) {
    return NextResponse.json({ error: 'A file is required.' }, { status: 400 })
  }

  const filePath = `${jobId}/${Date.now()}-${slugifyFileName(fileEntry.name || 'upload')}`
  const fileType = inferFileType(fileEntry)

  const uploadRes = await supabaseAdmin.storage
    .from('job-files')
    .upload(filePath, await fileEntry.arrayBuffer(), {
      contentType: fileEntry.type || undefined,
      upsert: false,
    })

  if (uploadRes.error) {
    return NextResponse.json({ error: uploadRes.error.message }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('documents')
    .insert({
      job_id: jobId,
      file_name: fileEntry.name,
      file_path: filePath,
      file_type: fileType,
    })
    .select('id, file_name, file_path, file_type, created_at')
    .single()

  if (error) {
    await supabaseAdmin.storage.from('job-files').remove([filePath])

    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ document: data })
}
