import ManagerOnlyRoute from '@/components/ManagerOnlyRoute'
import MaterialOrderDocumentClient from '../MaterialOrderDocumentClient'

type MaterialOrderInternalPageProps = {
  params: Promise<{
    orderId: string
  }>
}

export default async function MaterialOrderInternalPage({
  params,
}: MaterialOrderInternalPageProps) {
  const { orderId } = await params

  return (
    <ManagerOnlyRoute>
      <MaterialOrderDocumentClient orderId={orderId} kind="internal" />
    </ManagerOnlyRoute>
  )
}

