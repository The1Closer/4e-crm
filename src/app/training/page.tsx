'use client'

import { BookText, FileText, MonitorPlay, Presentation } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'

const documentResources = [
  {
    title: 'Sales Playbook',
    detail: 'Scripts, objection handling, and field expectations for new and current reps.',
  },
  {
    title: 'Inspection Checklist',
    detail: 'Standard roof inspection process and homeowner conversation flow.',
  },
  {
    title: 'Contract Process Guide',
    detail: 'How to move from contingency through signature without missing handoff steps.',
  },
]

const videoResources = [
  {
    title: 'Door Approach Walkthrough',
    detail: 'Talk track structure, first impression cues, and pacing for live reps.',
  },
  {
    title: 'Insurance Conversation Basics',
    detail: 'How to explain the process clearly without creating confusion for the homeowner.',
  },
  {
    title: 'Job Handoff Overview',
    detail: 'What needs to be clean in CRM before a file leaves the sales side.',
  },
]

const presentationResources = [
  {
    title: 'New Rep Ramp Deck',
    detail: 'Core expectations, daily standards, systems, and coaching checkpoints.',
  },
  {
    title: 'Leadership Training Deck',
    detail: 'Manager cadence, team standards, accountability, and rep development.',
  },
  {
    title: 'Production Handoff Deck',
    detail: 'Visual walkthrough of the transition from sold to scheduled to installed.',
  },
]

function TrainingPageContent() {
  return (
    <main className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.22),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_26%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,179,122,0.7),transparent)]" />

        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b37a]">
              Training
            </div>

            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
              Rep Resource Library
            </h1>

            <p className="mt-3 max-w-3xl text-base leading-7 text-white/68 md:text-lg">
              A clean read-only spot for onboarding materials, reference documents, videos, and decks. Reps can view what they need here without editing anything.
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-black/20 px-5 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.22)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/38">
              Access Mode
            </div>
            <div className="mt-2 text-xl font-semibold text-white">Read Only</div>
            <div className="mt-1 text-sm text-white/55">
              Resource publishing can be expanded later.
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <ResourcePanel
          title="Documents"
          subtitle="Policies, scripts, checklists, and written process references."
          icon={FileText}
          resources={documentResources}
        />
        <ResourcePanel
          title="Videos"
          subtitle="Short training clips for field execution and process walkthroughs."
          icon={MonitorPlay}
          resources={videoResources}
        />
        <ResourcePanel
          title="PowerPoints"
          subtitle="Decks for onboarding, leadership training, and team meetings."
          icon={Presentation}
          resources={presentationResources}
        />
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
        <div className="flex items-start gap-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-[1.2rem] border border-white/10 bg-black/20">
            <BookText className="h-5 w-5 text-[#d6b37a]" />
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
              Next Additions
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
              Ready for real assets when you are
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
              This page is set up so we can plug in real PDFs, hosted videos, and deck files next without changing the overall layout again.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

function ResourcePanel({
  title,
  subtitle,
  icon: Icon,
  resources,
}: {
  title: string
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
  resources: Array<{ title: string; detail: string }>
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
            {title}
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">{subtitle}</p>
        </div>

        <div className="inline-flex h-12 w-12 items-center justify-center rounded-[1.2rem] border border-white/10 bg-black/20">
          <Icon className="h-5 w-5 text-[#d6b37a]" />
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {resources.map((resource) => (
          <article
            key={resource.title}
            className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-white">{resource.title}</div>
              <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
                Read Only
              </div>
            </div>
            <p className="mt-2 text-sm leading-6 text-white/58">{resource.detail}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export default function TrainingPage() {
  return (
    <ProtectedRoute>
      <TrainingPageContent />
    </ProtectedRoute>
  )
}
