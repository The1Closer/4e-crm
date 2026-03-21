export type NightlyNumbersProfile = {
  role?: string | null
  is_active?: boolean | null
  include_in_nightly_numbers?: boolean | null
}

type NightlyNumbersQueryError = {
  code?: string | null
  message?: string | null
  details?: string | null
  hint?: string | null
} | null | undefined

export const PROFILE_SELECT_FIELDS =
  'id, full_name, role, is_active, manager_id, rep_type_id, avatar_url, phone'

export const PROFILE_SELECT_WITH_NIGHTLY_FIELDS = `${PROFILE_SELECT_FIELDS}, include_in_nightly_numbers`

export const ROSTER_PROFILE_SELECT_FIELDS =
  'id, full_name, role, manager_id, is_active'

export const ROSTER_PROFILE_SELECT_WITH_NIGHTLY_FIELDS = `${ROSTER_PROFILE_SELECT_FIELDS}, include_in_nightly_numbers`

export function getDefaultNightlyNumbersInclusion(role: string | null | undefined) {
  return role === 'rep'
}

export function isMissingNightlyNumbersColumnError(error: NightlyNumbersQueryError) {
  if (!error) {
    return false
  }

  if (error.code === 'PGRST204' || error.code === '42703') {
    return true
  }

  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()

  return (
    text.includes('include_in_nightly_numbers') &&
    (text.includes('column') || text.includes('schema cache'))
  )
}

export function isIncludedInNightlyNumbers(
  profile: NightlyNumbersProfile | null | undefined
) {
  if (!profile || profile.is_active === false) {
    return false
  }

  if (typeof profile.include_in_nightly_numbers === 'boolean') {
    return profile.include_in_nightly_numbers
  }

  return getDefaultNightlyNumbersInclusion(profile.role)
}
