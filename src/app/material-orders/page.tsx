'use client'

import ManagerOnlyRoute from '@/components/ManagerOnlyRoute'
import MaterialOrdersScreen from './MaterialOrdersScreen'

export default function MaterialOrdersPage() {
  return (
    <ManagerOnlyRoute>
      <MaterialOrdersScreen />
    </ManagerOnlyRoute>
  )
}

