'use client'

import Link from 'next/link'
import {
    Bell,
    Briefcase,
    CalendarDays,
    ClipboardList,
    FileText,
    LayoutDashboard,
    MapPinned,
    PenSquare,
    TrendingUp,
    Wallet,
} from 'lucide-react'

export default function HomePage() {
    return (
        <div className="space-y-8">
            <section className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.11),rgba(255,255,255,0.03))] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:p-10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.22),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_26%)]" />
                <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,179,122,0.7),transparent)]" />

                <div className="relative grid gap-8 xl:grid-cols-[1.3fr_0.92fr]">
                    <div className="space-y-6">
                        <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#d6b37a]">
                            4 Elements Operating System
                        </div>

                        <div className="space-y-4">
                            <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl">
                                Run the branch, drive production, and keep every moving part in one place.
                            </h1>

                            <p className="max-w-2xl text-base leading-7 text-white/68 md:text-lg">
                                Jobs, pipeline visibility, nightly activity, templates, commissions, reporting, and execution — all tied together inside one system built for the company.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <PrimaryAction href="/dashboard" label="Open Dashboard" />
                            <SecondaryAction href="/jobs/new" label="Create Job" />
                            <SecondaryAction href="/stats/submit" label="Submit Numbers" />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3">
                            <CompactMetric
                                icon={TrendingUp}
                                label="Production"
                                value="Live"
                            />
                            <CompactMetric
                                icon={Wallet}
                                label="Revenue"
                                value="Tracked"
                            />
                            <CompactMetric
                                icon={ClipboardList}
                                label="Activity"
                                value="Logged"
                            />
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

            <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="grid gap-6 md:grid-cols-2">
                    <ActionCard
                        title="Submit Nightly Numbers"
                        description="Log today’s knocks, talks, walks, inspections, contingencies, contracts, and revenue."
                        href="/stats/submit"
                        icon={ClipboardList}
                        accent
                    />

                    <ActionCard
                        title="Dashboard"
                        description="View branch, team, and individual performance with charts, projections, and pipeline visibility."
                        href="/dashboard"
                        icon={LayoutDashboard}
                    />

                    <ActionCard
                        title="Jobs"
                        description="Open deals, move homeowners through the pipeline, and keep the branch moving."
                        href="/jobs"
                        icon={Briefcase}
                    />

                    <ActionCard
                        title="Lead Map"
                        description="See live, color-coded pins on Google Maps for every visible lead with an address."
                        href="/map"
                        icon={MapPinned}
                    />

                    <ActionCard
                        title="Templates & Signer"
                        description="Open templates, edit documents, sign files, and save them back into the job."
                        href="/templates"
                        icon={PenSquare}
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
                        <p className="mt-2 text-sm leading-6 text-white/60">
                            Jump straight into the tools that get used every day.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <MiniLink href="/calendar/installs" label="Install Calendar" icon={CalendarDays} />
                        <MiniLink href="/map" label="Lead Map" icon={MapPinned} />
                        <MiniLink href="/commissions" label="Commissions" icon={Wallet} />
                        <MiniLink href="/contracts/editor" label="Signer" icon={PenSquare} />
                        <MiniLink href="/notifications" label="Notifications" icon={Bell} />
                        <MiniLink href="/templates" label="Templates" icon={FileText} />
                    </div>
                </section>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.25)] backdrop-blur-2xl">
                    <div className="mb-5">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d6b37a]">
                            Today at a Glance
                        </div>
                        <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
                            What matters most right now
                        </h2>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <InfoMetric
                            title="Pipeline Movement"
                            text="Keep new homeowners entering and moving forward through each stage."
                        />
                        <InfoMetric
                            title="Numbers Submitted"
                            text="Nightly activity keeps dashboards, projections, and coaching accurate."
                        />
                        <InfoMetric
                            title="Execution Focus"
                            text="Templates, jobs, reporting, and communication all live in one flow."
                        />
                    </div>
                </section>

                <section className="grid gap-6 md:grid-cols-3 lg:grid-cols-1">
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
            </section>
        </div>
    )
}

function PrimaryAction({
    href,
    label,
}: {
    href: string
    label: string
}) {
    return (
        <Link
            href={href}
            className="rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#e2bf85]"
        >
            {label}
        </Link>
    )
}

function SecondaryAction({
    href,
    label,
}: {
    href: string
    label: string
}) {
    return (
        <Link
            href={href}
            className="rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-white/[0.10]"
        >
            {label}
        </Link>
    )
}

function CompactMetric({
    icon: Icon,
    label,
    value,
}: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    value: string
}) {
    return (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 shadow-[0_16px_35px_rgba(0,0,0,0.22)]">
            <div className="flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]">
                    <Icon className="h-4 w-4 text-[#d6b37a]" />
                </div>
                <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">
                        {label}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">{value}</div>
                </div>
            </div>
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
        <div className="rounded-3xl border border-white/10 bg-black/20 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.28)] ring-1 ring-white/5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">
                {label}
            </div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-white">
                {value}
            </div>
            <div className="mt-2 text-sm text-white/55">{sub}</div>
        </div>
    )
}

function ActionCard({
    title,
    description,
    href,
    icon: Icon,
    accent,
}: {
    title: string
    description: string
    href: string
    icon: React.ComponentType<{ className?: string }>
    accent?: boolean
}) {
    return (
        <Link
            href={href}
            className={`group rounded-[2rem] border p-6 shadow-[0_25px_80px_rgba(0,0,0,0.30)] backdrop-blur-2xl transition duration-200 hover:-translate-y-1 ${accent
                    ? 'border-[#d6b37a]/30 bg-[linear-gradient(135deg,rgba(214,179,122,0.18),rgba(255,255,255,0.04))]'
                    : 'border-white/10 bg-white/[0.04]'
                }`}
        >
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
                            <Icon className="h-5 w-5 text-[#d6b37a]" />
                        </div>
                        <h3 className="text-xl font-semibold tracking-tight text-white">
                            {title}
                        </h3>
                    </div>

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
    icon: Icon,
}: {
    href: string
    label: string
    icon: React.ComponentType<{ className?: string }>
}) {
    return (
        <Link
            href={href}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/75 transition hover:border-white/15 hover:bg-white/[0.08] hover:text-white"
        >
            <span className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-[#d6b37a]" />
                {label}
            </span>
            <span className="text-white/30">→</span>
        </Link>
    )
}

function InfoMetric({
    title,
    text,
}: {
    title: string
    text: string
}) {
    return (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <div className="text-sm font-semibold text-white">{title}</div>
            <p className="mt-2 text-sm leading-6 text-white/58">{text}</p>
        </div>
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
            <div className="mt-3 text-xl font-bold tracking-tight text-white">
                {title}
            </div>
            <p className="mt-3 text-sm leading-6 text-white/62">{text}</p>
        </div>
    )
}
