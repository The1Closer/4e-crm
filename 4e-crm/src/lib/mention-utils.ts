export function normalizeMentionHandle(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\.+/g, '.')
}

export function buildMentionHandle(fullName: string | null | undefined) {
  return normalizeMentionHandle(fullName) || 'user'
}

export function extractMentionNames(text: string): string[] {
  const matches = text.match(/@([a-zA-Z0-9._-]+)/g) || []

  return [
    ...new Set(
      matches
        .map((match) => normalizeMentionHandle(match.slice(1)))
        .filter(Boolean)
    ),
  ]
}

export function profileMatchesMention(fullName: string, mention: string) {
  const normalizedMention = normalizeMentionHandle(mention)

  if (!normalizedMention) {
    return false
  }

  const normalizedFullName = normalizeMentionHandle(fullName)
  const nameParts = fullName
    .split(/\s+/)
    .map((part) => normalizeMentionHandle(part))
    .filter(Boolean)

  return (
    normalizedFullName === normalizedMention ||
    nameParts.some((part) => part === normalizedMention)
  )
}
