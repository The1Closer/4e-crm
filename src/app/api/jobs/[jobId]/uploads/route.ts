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

type DocumentFileType = 'photo' | 'document'

function inferFileType(params: {
  mimeType?: string | null
  fileName?: string | null
}): DocumentFileType {
  const mimeType = (params.mimeType ?? '').trim().toLowerCase()
  const fileName = (params.fileName ?? '').trim().toLowerCase()

  if (mimeType.startsWith('image/')) {
    return 'photo'
  }

  if (
    fileName.endsWith('.png') ||
    fileName.endsWith('.jpg') ||
    fileName.endsWith('.jpeg') ||
    fileName.endsWith('.webp') ||
    fileName.endsWith('.gif') ||
    fileName.endsWith('.bmp') ||
    fileName.endsWith('.heic') ||
    fileName.endsWith('.heif')
  ) {
    return 'photo'
  }

  return 'document'
}

function buildFilePath(jobId: string, fileName: string) {
  return `${jobId}/${Date.now()}-${slugifyFileName(fileName || 'upload')}`
}

function isValidJobScopedPath(jobId: string, filePath: string) {
  return filePath.startsWith(`${jobId}/`) && !filePath.includes('..')
}

async function insertDocumentRow(params: {
  jobId: string
  fileName: string
  filePath: string
  fileType: DocumentFileType
}) {
  const { data, error } = await supabaseAdmin
    .from('documents')
    .insert({
      job_id: params.jobId,
      file_name: params.fileName,
      file_path: params.filePath,
      file_type: params.fileType,
    })
    .select('id, file_name, file_path, file_type, created_at')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
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

  const requestContentType = req.headers.get('content-type') ?? ''

  if (requestContentType.includes('application/json')) {
    const body = (await req.json().catch(() => null)) as
      | {
          action?: string
          fileName?: string
          mimeType?: string
          filePath?: string
          fileType?: string
        }
      | null

    if (!body?.action) {
      return NextResponse.json({ error: 'Missing upload action.' }, { status: 400 })
    }

    if (body.action === 'create_signed_upload') {
      const fileName = (body.fileName ?? '').trim()

      if (!fileName) {
        return NextResponse.json(
          { error: 'A file name is required.' },
          { status: 400 }
        )
      }

      const filePath = buildFilePath(jobId, fileName)
      const fileType = inferFileType({
        mimeType: body.mimeType ?? '',
        fileName,
      })

      const signedUploadRes = await supabaseAdmin.storage
        .from('job-files')
        .createSignedUploadUrl(filePath)

      if (signedUploadRes.error || !signedUploadRes.data) {
        return NextResponse.json(
          { error: signedUploadRes.error?.message || 'Could not prepare upload.' },
          { status: 400 }
        )
      }

      return NextResponse.json({
        upload: {
          filePath,
          token: signedUploadRes.data.token,
          fileType,
          fileName,
        },
      })
    }

    if (body.action === 'finalize_signed_upload') {
      const fileName = (body.fileName ?? '').trim()
      const filePath = (body.filePath ?? '').trim()

      if (!fileName || !filePath) {
        return NextResponse.json(
          { error: 'fileName and filePath are required.' },
          { status: 400 }
        )
      }

      if (!isValidJobScopedPath(jobId, filePath)) {
        return NextResponse.json({ error: 'Invalid file path.' }, { status: 400 })
      }

      const fileType = inferFileType({
        fileName,
        mimeType: body.fileType ?? '',
      })

      try {
        const data = await insertDocumentRow({
          jobId,
          fileName,
          filePath,
          fileType,
        })

        return NextResponse.json({ document: data })
      } catch (error) {
        await supabaseAdmin.storage.from('job-files').remove([filePath])

        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : 'Could not finalize uploaded file.',
          },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({ error: 'Unsupported upload action.' }, { status: 400 })
  }

  const formData = await req.formData()
  const fileEntry = formData.get('file')

  if (!(fileEntry instanceof File)) {
    return NextResponse.json({ error: 'A file is required.' }, { status: 400 })
  }

  const filePath = buildFilePath(jobId, fileEntry.name || 'upload')
  const fileType = inferFileType({
    mimeType: fileEntry.type,
    fileName: fileEntry.name,
  })

  const uploadRes = await supabaseAdmin.storage
    .from('job-files')
    .upload(filePath, await fileEntry.arrayBuffer(), {
      contentType: fileEntry.type || undefined,
      upsert: false,
    })

  if (uploadRes.error) {
    return NextResponse.json({ error: uploadRes.error.message }, { status: 400 })
  }

  try {
    const data = await insertDocumentRow({
      jobId,
      fileName: fileEntry.name,
      filePath,
      fileType,
    })

    return NextResponse.json({ document: data })
  } catch (error) {
    await supabaseAdmin.storage.from('job-files').remove([filePath])

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Could not save uploaded file.',
      },
      { status: 400 }
    )
  }
}
