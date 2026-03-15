import ProtectedRoute from '../../components/ProtectedRoute'
import NotificationsClient from './NotificationsClient'

export default function NotificationsPage() {
  return (
    <ProtectedRoute>
      <NotificationsClient />
    </ProtectedRoute>
  )
}