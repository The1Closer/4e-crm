import ProtectedRoute from '../../../components/ProtectedRoute'
import ContractsEditorDynamicClient from './ContractsEditorDynamicClient'

export const dynamic = 'force-dynamic'

export default function ContractsEditorPage() {
  return (
    <ProtectedRoute>
      <ContractsEditorDynamicClient />
    </ProtectedRoute>
  )
}
