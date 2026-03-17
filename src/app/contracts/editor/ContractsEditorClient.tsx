'use client'

import nextDynamic from 'next/dynamic'

const ContractsEditorCoreLazy = nextDynamic(
  () => import('./ContractsEditorCore').then(m => m.default),
  {
    ssr: false,
    loading: () => (
      <main className="space-y-6">
        <div className="rounded-[2.25rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <h1 className="text-2xl font-bold text-white">
              Loading PDF engine...
          </h1>
          <p className="mt-2 text-sm text-white/60">
              Initializing the contract editor.
          </p>
        </div>
      </main>
    ),
  }
)

export default function ContractsEditorClient() {
  return <ContractsEditorCoreLazy />
}
