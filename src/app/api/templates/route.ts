import { NextRequest, NextResponse } from 'next/server'
import { slugifyFileName } from '@/lib/file-utils'
import { getRouteRequester, requireManager } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const managerError = requireManager(authResult.requester)

  if (managerError) {
    return managerError
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

  const fileName = `${Date.now()}-${slugifyFileName(fileEntry.name || `${name}.pdf`)}`
  const filePath = `templates/${fileName}`

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
