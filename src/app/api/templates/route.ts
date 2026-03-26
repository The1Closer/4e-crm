import { NextRequest, NextResponse } from 'next/server'
import { slugifyFileName } from '@/lib/file-utils'
import { getRouteRequester, requireManager } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

function buildTemplateFilePath(fileName: string) {
  return `templates/${Date.now()}-${slugifyFileName(fileName || 'template.pdf')}`
}

export async function POST(req: NextRequest) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const managerError = requireManager(authResult.requester)

  if (managerError) {
    return managerError
  }

  const requestContentType = req.headers.get('content-type') ?? ''

  if (requestContentType.includes('application/json')) {
    const body = (await req.json().catch(() => null)) as
      | {
          action?: string
          name?: string
          category?: string
          fileName?: string
          filePath?: string
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

      const filePath = buildTemplateFilePath(fileName)

      const signedUploadRes = await supabaseAdmin.storage
        .from('documents')
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
        },
      })
    }

    if (body.action === 'finalize_signed_upload') {
      const name = String(body.name ?? '').trim()
      const category = String(body.category ?? '').trim()
      const filePath = String(body.filePath ?? '').trim()

      if (!name) {
        return NextResponse.json({ error: 'Template name is required.' }, { status: 400 })
      }

      if (!filePath.startsWith('templates/') || filePath.includes('..')) {
        return NextResponse.json({ error: 'Invalid template file path.' }, { status: 400 })
      }

      const publicUrlRes = supabaseAdmin.storage.from('documents').getPublicUrl(filePath)

      const { data, error } = await supabaseAdmin
        .from('document_templates')
        .insert({
          name,
          category: category || null,
          file_url: publicUrlRes.data.publicUrl,
          file_path: filePath,
          created_by: authResult.requester.profile.id,
        })
        .select('id, name, category, file_url, file_path, is_active, created_at')
        .single()

      if (error) {
        await supabaseAdmin.storage.from('documents').remove([filePath])

        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({ template: data })
    }

    return NextResponse.json({ error: 'Unsupported upload action.' }, { status: 400 })
  }

  const formData = await req.formData()
  const name = String(formData.get('name') ?? '').trim()
  const category = String(formData.get('category') ?? '').trim()
  const fileEntry = formData.get('file')

  if (!name) {
    return NextResponse.json({ error: 'Template name is required.' }, { status: 400 })
  }

  if (!(fileEntry instanceof File)) {
    return NextResponse.json({ error: 'A PDF file is required.' }, { status: 400 })
  }

  if (fileEntry.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF uploads are supported.' }, { status: 400 })
  }

  const filePath = buildTemplateFilePath(fileEntry.name || `${name}.pdf`)

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
    .from('document_templates')
    .insert({
      name,
      category: category || null,
      file_url: publicUrlRes.data.publicUrl,
      file_path: filePath,
      created_by: authResult.requester.profile.id,
    })
    .select('id, name, category, file_url, file_path, is_active, created_at')
    .single()

  if (error) {
    await supabaseAdmin.storage.from('documents').remove([filePath])

    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ template: data })
}
