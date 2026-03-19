'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import PhotosSection from './PhotosSection'
import JobDocumentsPanel from './JobDocumentsPanel'
import NotesSection from './NotesSection'

export type JobDetailTabKey = 'documents' | 'photos' | 'notes'

const TABS: Array<{
  key: JobDetailTabKey
  label: string
}> = [
  { key: 'documents', label: 'Documents' },
  { key: 'photos', label: 'Photos' },
  { key: 'notes', label: 'Notes' },
]

function isJobDetailTabKey(value: string | null): value is JobDetailTabKey {
  return value === 'documents' || value === 'photos' || value === 'notes'
}

export default function JobDetailTabs({
  jobId,
  initialNotes,
}: {
  jobId: string
  initialNotes: Array<{
    id: string
    body: string
    created_at: string
    updated_at?: string
  }>
}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const activeTab = isJobDetailTabKey(requestedTab) ? requestedTab : 'documents'

  function handleTabChange(nextTab: JobDetailTabKey) {
    const nextParams = new URLSearchParams(searchParams.toString())

    if (nextTab === 'documents') {
      nextParams.delete('tab')
    } else {
      nextParams.set('tab', nextTab)
    }

    router.replace(
      nextParams.size > 0 ? `${pathname}?${nextParams.toString()}` : pathname,
      { scroll: false }
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-[1.6rem] border border-white/10 bg-[#0b0f16]/95 p-3 shadow-[0_18px_45px_rgba(0,0,0,0.2)]">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? 'bg-[#d6b37a] text-black shadow-[0_10px_24px_rgba(214,179,122,0.24)]'
                  : 'border border-white/10 bg-white/[0.04] text-white/72 hover:bg-white/[0.08]'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'documents' ? <JobDocumentsPanel jobId={jobId} /> : null}
      {activeTab === 'photos' ? <PhotosSection jobId={jobId} /> : null}
      {activeTab === 'notes' ? (
        <NotesSection jobId={jobId} initialNotes={initialNotes} />
      ) : null}
    </section>
  )
}
