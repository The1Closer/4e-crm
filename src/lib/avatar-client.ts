'use client'

import { authorizedFetch } from '@/lib/api-client'

function slugifyAvatarLabel(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

type DrawableImageSource = CanvasImageSource & {
  width: number
  height: number
}

function drawSquareSource(params: {
  context: CanvasRenderingContext2D
  source: DrawableImageSource
  size: number
}) {
  const { context, source, size } = params
  const side = Math.min(source.width, source.height)
  const sx = Math.floor((source.width - side) / 2)
  const sy = Math.floor((source.height - side) / 2)

  context.drawImage(source, sx, sy, side, side, 0, 0, size, size)
}

async function loadImageElement(file: File) {
  const objectUrl = URL.createObjectURL(file)

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()

      image.onload = () => resolve(image)
      image.onerror = () =>
        reject(new Error('Could not decode that image file. Try a JPG or PNG.'))
      image.src = objectUrl
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function cropImageToSquareBlob(
  file: File,
  size = 512
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Could not prepare avatar canvas.')
  }

  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file)

      try {
        drawSquareSource({
          context,
          source: bitmap as DrawableImageSource,
          size,
        })
      } finally {
        bitmap.close()
      }
    } else {
      const image = await loadImageElement(file)
      drawSquareSource({
        context,
        source: image as DrawableImageSource,
        size,
      })
    }
  } catch (error) {
    const image = await loadImageElement(file).catch(() => {
      throw error instanceof Error
        ? error
        : new Error('Could not prepare that image for avatar upload.')
    })

    drawSquareSource({
      context,
      source: image as DrawableImageSource,
      size,
    })
  }

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
