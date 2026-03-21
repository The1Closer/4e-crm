export type AnnouncementContentRow = {
  id: string
  title: string
  body: string
  audience_role: string | null
  audience_manager_id: string | null
  is_active: boolean
  created_at: string
  updated_at?: string
}

export type SpotlightContentType = 'quote' | 'video'

export type SpotlightContentRow = {
  id: string
  title: string
  body: string
  content_type: SpotlightContentType
  media_url: string | null
  quote_author: string | null
  audience_role: string | null
  audience_manager_id: string | null
  is_active: boolean
  display_date: string | null
  created_at: string
  updated_at?: string
}

type MissingTableError = {
  code?: string | null
  message?: string | null
  details?: string | null
  hint?: string | null
} | null | undefined

export function matchesAudience(params: {
  audienceRole?: string | null
  audienceManagerId?: string | null
  userRole?: string | null
  userManagerId?: string | null
  userId?: string | null
}) {
  const roleMatch =
    !params.audienceRole || params.audienceRole === params.userRole
  const managerMatch =
    !params.audienceManagerId ||
    params.audienceManagerId === params.userManagerId ||
    params.audienceManagerId === params.userId

  return roleMatch && managerMatch
}

export function normalizeNullableText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ''
  return trimmed ? trimmed : null
}

export function isMissingHomeSpotlightsTableError(error: MissingTableError) {
  if (!error) {
    return false
  }

  if (error.code === '42P01' || error.code === 'PGRST205') {
    return true
  }

  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()
  return text.includes('home_spotlights')
}

export function getEmbeddableVideoUrl(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  try {
    const url = new URL(trimmed)

    if (url.hostname.includes('youtube.com')) {
      const videoId = url.searchParams.get('v')
      if (videoId) {
        return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`
      }

      const match = url.pathname.match(/\/embed\/([^/?#]+)/)
      if (match?.[1]) {
        return `https://www.youtube-nocookie.com/embed/${match[1]}?rel=0&modestbranding=1`
      }
    }

    if (url.hostname === 'youtu.be') {
      const videoId = url.pathname.replace(/^\/+/, '')
      return videoId
        ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`
        : null
    }

    if (url.hostname.includes('vimeo.com')) {
      const videoId = url.pathname.replace(/^\/+/, '').split('/')[0]
      return videoId ? `https://player.vimeo.com/video/${videoId}` : null
    }

    return null
  } catch {
    return null
  }
}
