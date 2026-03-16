'use client'

import Link from 'next/link'

export default function HomePage() {
 return (
  <div className="space-y-8">
   <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.04))] p-8 shadow-[0_25px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl md:p-10">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(148,163,184,0.12),transparent_30%)]" />

    <div className="relative grid gap-8 xl:grid-cols-[1.4fr_1fr]">
     <div className="space-y-5">
      <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
       Business Operations
      </div>

      <div className="space-y-3">
       <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-white md:text-5xl">
        The operating hub for your branch, your pipeline, and your people.
       </h1>

       <p className="max-w-2xl text-base leading-7 text-white/70 md:text-lg">
        Track deals, monitor performance, submit nightly numbers, and move the entire company from one place.
       </p>
      </div>

      <div className="flex flex-wrap gap-3">
       <Link
        href="/dashboard"
        className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_10px_30px_rgba(255,255,255,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(255,255,255,0.22)]"
       >
        Open Dashboard
       </Link>

       <Link
        href="/jobs/new"
        className="rounded-2xl border border-white/15 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.10]"
       >
        Create Job
       </Link>
      </div>
     </div>

     <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
      <MetricTile label="Month to Date" value="$0" sub="Revenue tracked" />
      <MetricTile label="Projected Finish" value="$0" sub="Mon–Sat pace" />
      <MetricTile label="Contingencies" value="0" sub="This month" />
      <MetricTile label="Contracts" value="0" sub="This month" />
     </div>
    </div>
   </section>

   <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
    <div className="grid gap-6 md:grid-cols-2">
     <ActionCard
      title="Submit Nightly Numbers"
      description="Log your daily activity fast so dashboards, leaderboards, and reports stay current."
      href="/stats/submit"
      accent="bright"
     />

     <ActionCard
      title="Dashboard"
      description="Branch, team, and individual performance with charts, pipeline, and projections."
      href="/dashboard"
     />

     <ActionCard
      title="Jobs"
      description="View active deals, move jobs through the pipeline, and manage homeowners."
      href="/jobs"
     />

     <ActionCard
      title="Templates & Signer"
      description="Open templates, edit documents, and generate signed files quickly."
      href="/templates"
     />
    </div>

    <section className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.25)] backdrop-blur-xl">
     <div className="mb-5">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
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
     </div>
    </section>
   </section>
  </div>
 )
}

function MetricTile({
 label,
 value,
 sub,
}: {
 label: string
 value: string
 sub: string
}) {
 return (
  <div className="rounded-3xl border border-white/10 bg-black/20 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.25)]">
   <div className="text-[11px] font-semibold uppercase tracking-[0.20em] text-white/45">
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
 accent?: 'bright'
}) {
 return (
  <Link
   href={href}
   className={`group rounded-[2rem] border p-6 shadow-[0_25px_80px_rgba(0,0,0,0.25)] backdrop-blur-xl transition duration-200 hover:-translate-y-1 ${accent === 'bright'
     ? 'border-white/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.14),rgba(255,255,255,0.05))]'
     : 'border-white/10 bg-white/[0.05]'
    }`}
  >
   <div className="space-y-3">
    <div className="flex items-center justify-between gap-4">
     <h3 className="text-xl font-semibold tracking-tight text-white">{title}</h3>
     <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/45 transition group-hover:text-white/70">
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
   className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/75 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
  >
   <span>{label}</span>
   <span className="text-white/35">→</span>
  </Link>
 )
}