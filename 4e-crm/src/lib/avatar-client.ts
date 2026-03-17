'use client'

import { authorizedFetch } from '@/lib/api-client'

function slugifyAvatarLabel(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function cropImageToSquareBlob(
  file: File,
  size = 512
): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const sx = Math.floor((bitmap.width - side) / 2)
  const sy = Math.floor((bitmap.height - side) / 2)

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Could not prepare avatar canvas.')
  }

  context.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Could not create cropped avatar image.'))
        return
      }

      resolve(blob)
    }, 'image/jpeg', 0.92)
  })
}

export async function uploadAvatarViaApi(params: {
  file: File
  label: string
  targetProfileId?: string
}) {
  const blob = await cropImageToSquareBlob(params.file, 512)
  const uploadFile = new File(
    [blob],
    `${slugifyAvatarLabel(params.label || 'avatar') || 'avatar'}.jpg`,
    {
      type: 'image/jpeg',
    }
  )

  const formData = new FormData()
  formData.set('file', uploadFile)

  if (params.targetProfileId) {
    formData.set('targetProfileId', params.targetProfileId)
  }

  const response = await authorizedFetch('/api/avatars', {
    method: 'POST',
    body: formData,
  })

  const result = (await response.json().catch(() => null)) as
    | {
        avatarUrl?: string
        error?: string
      }
    | null

  if (!response.ok || !result?.avatarUrl) {
    throw new Error(result?.error || 'Could not upload avatar.')
  }

  return result.avatarUrl
}
