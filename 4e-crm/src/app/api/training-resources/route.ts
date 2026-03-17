import { NextRequest, NextResponse } from 'next/server'
import { getRouteRequester, requireManager } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  cloneTrainingResources,
  DEFAULT_TRAINING_RESOURCES,
  sanitizeTrainingResources,
} from '@/lib/training-defaults'

const TRAINING_RESOURCE_BUCKET = 'documents'
const TRAINING_RESOURCE_FILE_PATH = 'training/resources.json'

async function loadTrainingResources() {
  const { data, error } = await supabaseAdmin.storage
    .from(TRAINING_RESOURCE_BUCKET)
    .download(TRAINING_RESOURCE_FILE_PATH)

  if (error || !data) {
    return cloneTrainingResources(DEFAULT_TRAINING_RESOURCES)
  }

  try {
    const rawText = await data.text()
    const parsed = JSON.parse(rawText) as
      | {
          resources?: unknown
        }
      | unknown

    return sanitizeTrainingResources(
      parsed && typeof parsed === 'object' && 'resources' in parsed
        ? parsed.resources
        : parsed
    )
  } catch (error) {
    console.error('Failed to read training resources.', error)
    return cloneTrainingResources(DEFAULT_TRAINING_RESOURCES)
  }
}

export async function GET(req: NextRequest) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const resources = await loadTrainingResources()

  return NextResponse.json({ resources })
}

export async function PUT(req: NextRequest) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const managerError = requireManager(authResult.requester)

  if (managerError) {
    return managerError
  }

  const body = (await req.json().catch(() => null)) as
    | {
        resources?: unknown
      }
    | null

  const resources = sanitizeTrainingResources(body?.resources ?? body)
  const payload = {
    resources,
    updatedAt: new Date().toISOString(),
    updatedBy: authResult.requester.profile.id,
  }

  const uploadRes = await supabaseAdmin.storage
    .from(TRAINING_RESOURCE_BUCKET)
    .upload(
      TRAINING_RESOURCE_FILE_PATH,
      new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      }),
      {
        contentType: 'application/json',
        upsert: true,
      }
    )

  if (uploadRes.error) {
    return NextResponse.json({ error: uploadRes.error.message }, { status: 400 })
  }

  return NextResponse.json({ resources })
}
