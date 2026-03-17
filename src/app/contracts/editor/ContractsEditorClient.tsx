'use client'

import { type ComponentType, useEffect, useState } from 'react'

function ContractsEditorLoadingState({
  title = 'Loading PDF engine...',
  body = 'Initializing the contract editor.',
}: {
  title?: string
  body?: string
}) {
  return (
    <main className="space-y-6">
      <div className="rounded-[2.25rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="mt-2 text-sm text-white/60">{body}</p>
      </div>
    </main>
  )
}

export default function ContractsEditorClient() {
  const [EditorComponent, setEditorComponent] = useState<ComponentType | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadEditor() {
      try {
        const editorModule = await import('./ContractsEditorCore')

        if (!isActive) return

        setEditorComponent(() => editorModule.default)
      } catch (error) {
        console.error('Failed to load contracts editor.', error)

        if (!isActive) return

        setLoadError('The contract editor could not be loaded.')
      }
    }

    void loadEditor()

    return () => {
      isActive = false
    }
  }, [])

  if (loadError) {
    return (
      <ContractsEditorLoadingState
        title="Contract editor unavailable"
        body={loadError}
      />
    )
  }

  if (!EditorComponent) {
    return <ContractsEditorLoadingState />
  }

  return <EditorComponent />
}
