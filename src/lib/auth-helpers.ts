import { supabase } from './supabase'

export type CurrentUserProfile = {
  id: string
  email: string | null
  full_name: string | null
  role: string | null
} | null

export async function getCurrentUserProfile(): Promise<CurrentUserProfile> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .single()

  return {
    id: user.id,
    email: user.email ?? null,
    full_name: profile?.full_name ?? null,
    role: profile?.role ?? null,
  }
}

export function isManagerLike(role: string | null | undefined) {
  return role === 'manager' || role === 'admin'
}