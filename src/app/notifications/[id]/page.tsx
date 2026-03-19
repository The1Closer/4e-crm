'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { fetchNotification, markNotificationRead } from '@/lib/notifications-client'

function OpenNotificationPageContent() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const notificationId = params?.id

  useEffect(() => {
    let isActive = true

    async function openNotification() {
      if (!notificationId) {
        router.replace('/notifications')
        return
      }

      try {
        const notification = await fetchNotification(notificationId)

        if (!isActive) return

        if (!notification) {
          router.replace('/notifications')
          return
        }

        await markNotificationRead(notificationId)

        router.replace(
          notification.link ||
            (notification.job_id ? `/jobs/${notification.job_id}` : '/notifications')
        )
      } catch {
        if (!isActive) return

        router.replace('/notifications')
      }
    }

    const openTimer = window.setTimeout(() => {
      void openNotification()
    }, 0)

    return () => {
      isActive = false
      window.clearTimeout(openTimer)
    }
  }, [notificationId, router])

  return (
    <main className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-sm text-white/60 shadow-[0_25px_80px_rgba(0,0,0,0.25)] backdrop-blur-2xl">
        Opening notification...
      </section>
    </main>
  )
}

export default function OpenNotificationPage() {
  return (
    <ProtectedRoute>
      <OpenNotificationPageContent />
    </ProtectedRoute>
  )
}
