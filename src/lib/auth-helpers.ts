import { supabase } from '@/lib/supabase'
import {
  isMissingNightlyNumbersColumnError,
  PROFILE_SELECT_FIELDS,
  PROFILE_SELECT_WITH_NIGHTLY_FIELDS,
} from '@/lib/nightly-numbers'

export type AppRole = 'admin' | 'manager' | 'sales_manager' | 'rep' | string

export type UserProfile = {
  id: string
  full_name: string | null
  role: AppRole | null
  is_active: boolean | null
  manager_id?: string | null
  rep_type_id?: number | null
  avatar_url?: string | null
  phone?: string | null
  include_in_nightly_numbers?: boolean | null
}

export type AppPermissions = {
  canViewHome: boolean
  canViewJobs: boolean
  canCreateJob: boolean
  canViewDashboard: boolean
  canViewLeadMap: boolean
  canViewArchive: boolean

  canViewTeamManagement: boolean
  canManageUsers: boolean
  canViewManagerEntry: boolean

  canViewInstallCalendar: boolean

  canViewCommissions: boolean
  canViewAllCommissions: boolean

  canViewTemplates: boolean
  canManageTemplates: boolean

  canUseSigner: boolean
  canViewNotifications: boolean
  canManageLockedStages: boolean
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  let { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT_WITH_NIGHTLY_FIELDS)
    .eq('id', user.id)
    .single()

  if (error && isMissingNightlyNumbersColumnError(error)) {
    const fallbackResult = await supabase
      .from('profiles')
      .select(PROFILE_SELECT_FIELDS)
      .eq('id', user.id)
      .single()

    data = fallbackResult.data as typeof data
    error = fallbackResult.error
  }

  if (error || !data) return null

  return data as UserProfile
}

export function isManagerLike(role: AppRole | null | undefined) {
  return role === 'admin' || role === 'manager' || role === 'sales_manager'
}

export function getPermissions(role: AppRole | null | undefined): AppPermissions {
  const managerLike = isManagerLike(role)

  return {
    canViewHome: true,
    canViewJobs: true,
    canCreateJob: true,
    canViewDashboard: true,
    canViewLeadMap: true,
    canViewArchive: true,

    canViewTeamManagement: managerLike,
    canManageUsers: managerLike,
    canViewManagerEntry: managerLike,

    canViewInstallCalendar: true,

    canViewCommissions: true,
    canViewAllCommissions: managerLike,

    canViewTemplates: true,
    canManageTemplates: managerLike,

    canUseSigner: true,
    canViewNotifications: true,
    canManageLockedStages: managerLike,
  }
}
