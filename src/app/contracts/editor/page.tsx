import ProtectedRoute from '../../../components/ProtectedRoute'
import ContractsEditorClient from './ContractsEditorClient'

export const dynamic = 'force-dynamic'

export default function ContractsEditorPage() {
  return (
    <ProtectedRoute>
      <ContractsEditorClient />
    </ProtectedRoute>
  )
}