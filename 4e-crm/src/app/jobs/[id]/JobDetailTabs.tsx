'use client'

import { useState } from 'react'
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
  const [activeTab, setActiveTab] = useState<JobDetailTabKey>('documents')

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-gray-900 text-white'
                  : 'border border-gray-300 bg-white text-gray-900 hover:bg-gray-100'
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