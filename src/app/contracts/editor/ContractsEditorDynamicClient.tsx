'use client'

import nextDynamic from 'next/dynamic'

const ContractsEditorClient = nextDynamic(
  () => import('./ContractsEditorClient'),
  {
    ssr: false,
    loading: () => (
      <main className="min-h-screen p-6 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_30%)]" />
            <div className="relative text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d6b37a]">
              Signer
            </div>
            <h1 className="relative mt-3 text-2xl font-bold text-white">
              Loading PDF editor...
            </h1>
            <p className="relative mt-2 text-sm text-white/62">
              Preparing the contract editor.
            </p>
          </div>
        </div>
      </main>
    ),
  }
)

export default function ContractsEditorDynamicClient() {
  return <ContractsEditorClient />
}
