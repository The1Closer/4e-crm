'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useSupabaseAuthUserId() {
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!isActive) {
        return
      }

      setUserId(user?.id ?? null)
    }

    void loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isActive) {
        return
      }

      setUserId(session?.user?.id ?? null)
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
    }
  }, [])

  return userId
}
