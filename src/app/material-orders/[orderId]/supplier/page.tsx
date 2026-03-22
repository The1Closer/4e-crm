import ManagerOnlyRoute from '@/components/ManagerOnlyRoute'
import MaterialOrderDocumentClient from '../MaterialOrderDocumentClient'

type MaterialOrderSupplierPageProps = {
  params: Promise<{
    orderId: string
  }>
}

export default async function MaterialOrderSupplierPage({
  params,
}: MaterialOrderSupplierPageProps) {
  const { orderId } = await params

  return (
    <ManagerOnlyRoute>
      <MaterialOrderDocumentClient orderId={orderId} kind="supplier" />
    </ManagerOnlyRoute>
  )
}

