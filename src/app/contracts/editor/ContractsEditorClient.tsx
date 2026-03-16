'use client'

import nextDynamic from 'next/dynamic'

const ContractsEditorCoreLazy = nextDynamic(
  () => import('./ContractsEditorCore').then(m => m.default),
  {
    ssr: false,
    loading: () => (
      <main className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-gray-900">
              Loading PDF engine...
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Initializing the contract editor.
            </p>
          </div>
        </div>
      </main>
    ),
  }
)

export default function ContractsEditorClient() {
  return <ContractsEditorCoreLazy />
}