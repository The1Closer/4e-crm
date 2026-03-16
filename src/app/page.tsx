'use client'

import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-8 shadow-[0_25px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_26%)]" />

        <div className="relative grid gap-8 xl:grid-cols-[1.35fr_0.9fr]">
          <div className="space-y-5">
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b37a]">
              Business Operations
            </div>

            <div className="space-y-3">
              <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-white md:text-5xl">
                Run the branch, track performance, and move deals from one system.
              </h1>

              <p className="max-w-2xl text-base leading-7 text-white/68 md:text-lg">
                Jobs, pipeline visibility, nightly activity, reporting, templates, commissions, and performance tracking — all in one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85]"
              >
                Open Dashboard
              </Link>

              <Link
                href="/jobs/new"
                className="rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.10]"
              >
                Create Job
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <StatTile label="Month to Date" value="$0" sub="Tracked revenue" />
            <StatTile label="Projected Finish" value="$0" sub="Mon–Sat pace" />
            <StatTile label="Contingencies" value="0" sub="This month" />
            <StatTile label="Contracts" value="0" sub="This month" />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-6 md:grid-cols-2">
          <ActionCard
            title="Submit Nightly Numbers"
            description="Log today’s knocks, talks, walks, inspections, contingencies, contracts, and revenue."
            href="/stats/submit"
            accent
          />

          <ActionCard
            title="Dashboard"
            description="Branch, team, and individual performance with charts, projections, and pipeline visibility."
            href="/dashboard"
          />

          <ActionCard
            title="Jobs"
            description="Open deals, move homeowners through the pipeline, and manage the work in progress."
            href="/jobs"
          />

          <ActionCard
            title="Templates & Signer"
            description="Open templates, edit documents, sign files, and save them back into the job."
            href="/templates"
          />
        </div>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_90px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
          <div className="mb-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b37a]">
              Quick Access
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
              Daily Workflow
            </h2>
          </div>

          <div className="space-y-3">
            <MiniLink href="/calendar/installs" label="Install Calendar" />
            <MiniLink href="/commissions" label="Commissions" />
            <MiniLink href="/contracts/editor" label="Signer" />
            <MiniLink href="/notifications" label="Notifications" />
            <MiniLink href="/stats/manager" label="Manager Entry" />
          </div>
        </section>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <InfoCard
          eyebrow="Pipeline"
          title="Keep deals moving."
          text="Track every homeowner from first contact through signed contract and production."
        />
        <InfoCard
          eyebrow="Performance"
          title="Measure what matters."
          text="Use nightly numbers, projections, and dashboards to keep reps accountable and improving."
        />
        <InfoCard
          eyebrow="Execution"
          title="Run everything faster."
          text="Templates, documents, reporting, and jobs all live inside one operating system."
        />
      </section>
    </div>
  )
}

function StatTile({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub: string
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.28)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">
        {label}
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight text-white">{value}</div>
      <div className="mt-2 text-sm text-white/55">{sub}</div>
    </div>
  )
}

function ActionCard({
  title,
  description,
  href,
  accent,
}: {
  title: string
  description: string
  href: string
  accent?: boolean
}) {
  return (
    <Link
      href={href}
      className={`group rounded-[2rem] border p-6 shadow-[0_25px_80px_rgba(0,0,0,0.30)] backdrop-blur-2xl transition duration-200 hover:-translate-y-1 ${accent
          ? 'border-[#d6b37a]/30 bg-[linear-gradient(135deg,rgba(214,179,122,0.16),rgba(255,255,255,0.04))]'
          : 'border-white/10 bg-white/[0.04]'
        }`}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-xl font-semibold tracking-tight text-white">{title}</h3>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45 transition group-hover:text-white/70">
            Open
          </span>
        </div>

        <p className="text-sm leading-6 text-white/65">{description}</p>
      </div>
    </Link>
  )
}

function MiniLink({
  href,
  label,
}: {
  href: string
  label: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/75 transition hover:border-white/15 hover:bg-white/[0.08] hover:text-white"
    >
      <span>{label}</span>
      <span className="text-white/30">→</span>
    </Link>
  )
}

function InfoCard({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string
  title: string
  text: string
}) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.25)] backdrop-blur-2xl">
      <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d6b37a]">
        {eyebrow}
      </div>
      <div className="mt-3 text-xl font-bold tracking-tight text-white">{title}</div>
      <p className="mt-3 text-sm leading-6 text-white/62">{text}</p>
    </div>
  )
}