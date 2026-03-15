import { redirect } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type NotificationRow = {
  id: string
  job_id: string | null
}

export default async function OpenNotificationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { data, error } = await supabase
    .from('notifications')
    .select('id, job_id')
    .eq('id', id)
    .single()

  if (error || !data) {
    redirect('/notifications')
  }

  const notification = data as NotificationRow

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)

  if (notification.job_id) {
    redirect(`/jobs/${notification.job_id}`)
  }

  redirect('/notifications')
}