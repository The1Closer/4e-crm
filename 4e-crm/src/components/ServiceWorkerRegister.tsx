'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    async function syncServiceWorker() {
      if (process.env.NODE_ENV !== 'production') {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map((registration) => registration.unregister()))
        return
      }

      try {
        await navigator.serviceWorker.register('/sw.js')
      } catch (error) {
        console.error('Failed to register service worker.', error)
      }
    }

    void syncServiceWorker()
  }, [])

  return null
}
