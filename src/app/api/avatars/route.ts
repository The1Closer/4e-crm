import { NextRequest, NextResponse } from 'next/server'
import { slugifyFileName } from '@/lib/file-utils'
import { getRouteRequester, isManagerRole } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const formData = await req.formData()
  const fileEntry = formData.get('file')
  const targetProfileId =
    String(formData.get('targetProfileId') ?? '').trim() ||
    authResult.requester.profile.id

  if (!(fileEntry instanceof File)) {
    return NextResponse.json({ error: 'An image file is required.' }, { status: 400 })
  }

  if (!fileEntry.type.startsWith('image/')) {
    return NextResponse.json(
      { error: 'Only image uploads are supported for avatars.' },
      { status: 400 }
    )
  }

  if (
    targetProfileId !== authResult.requester.profile.id &&
    !isManagerRole(authResult.requester.profile.role)
  ) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const filePath = `profiles/${targetProfileId}/${Date.now()}-${slugifyFileName(
    fileEntry.name || 'avatar.jpg'
  )}`

  const uploadRes = await supabaseAdmin.storage
    .from('avatars')
    .upload(filePath, await fileEntry.arrayBuffer(), {
      contentType: fileEntry.type || 'image/jpeg',
      upsert: false,
    })

  if (uploadRes.error) {
    return NextResponse.json({ error: uploadRes.error.message }, { status: 400 })
  }

  const { data } = supabaseAdmin.storage.from('avatars').getPublicUrl(filePath)

  return NextResponse.json({
    avatarUrl: data.publicUrl,
    filePath,
  })
}
