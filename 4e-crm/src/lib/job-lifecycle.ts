export const ARCHIVE_INACTIVITY_DAYS = 120

const DAY_IN_MS = 24 * 60 * 60 * 1000

export function getArchiveCutoffDate(now = new Date()) {
  return new Date(now.getTime() - ARCHIVE_INACTIVITY_DAYS * DAY_IN_MS)
}

export function isArchivedByInactivity(updatedAt?: string | null, now = new Date()) {
  if (!updatedAt) return false

  const updatedTime = new Date(updatedAt).getTime()

  if (!Number.isFinite(updatedTime)) {
    return false
  }

  return updatedTime < getArchiveCutoffDate(now).getTime()
}

export function isPaidInFull(remainingBalance?: number | null) {
  return Number(remainingBalance ?? 0) <= 0
}
