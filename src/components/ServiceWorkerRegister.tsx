'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    async function registerServiceWorker() {
      try {
        await navigator.serviceWorker.register('/sw.js')
      } catch (error) {
        console.error('Failed to register service worker.', error)
      }
    }

    void registerServiceWorker()
  }, [])

  return null
}
