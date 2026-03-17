'use client'

import { supabase } from '@/lib/supabase'

export async function authorizedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
) {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('You are not signed in.')
  }

  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${session.access_token}`)

  return fetch(input, {
    ...init,
    headers,
  })
}
