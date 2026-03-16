'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentUserProfile, isManagerLike } from '@/lib/auth-helpers'
import ProtectedRoute from '@/components/ProtectedRoute'

type FormState = {
  knocks: string
  talks: string
  walks: string
  inspections: string
  contingencies: string
  contracts_with_deposit: string
  revenue_signed: string
}

const EMPTY_FORM: FormState = {
  knocks: '',
  talks: '',
  walks: '',
  inspections: '',
  contingencies: '',
  contracts_with_deposit: '',
  revenue_signed: '',
}

function getTodayLocalDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return 0
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : 0
}

function MetricInput({
  label,
  value,
  onChange,
  inputMode = 'numeric',
  placeholder = '0',
}: {
  label: string
  value: string
  onChange: (next: string) => void
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  placeholder?: string
}) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
        {label}
      </div>
      <input
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4 text-lg font-semibold text-white outline-none transition placeholder:text-white/20 focus:border-[#d6b37a]/50 focus:bg-white/[0.08]"
      />
    </label>
  )
}

function SubmitNumbersPageContent() {
  const [profile, setProfile] = useState<any>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [loadingEntry, setLoadingEntry] = useState(true)
  const [saving, setSaving] = useState(false)

  const [reportDate, setReportDate] = useState(getTodayLocalDate())
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')

  useEffect(() => {
    async function loadProfile() {
      const currentProfile = await getCurrentUserProfile()
      setProfile(currentProfile)
      setLoadingProfile(false)
    }

    loadProfile()
  }, [])

  const isManager = useMemo(
    () => isManagerLike(profile?.role ?? null),
    [profile?.role]
  )

  useEffect(() => {
    async function loadExistingEntry() {
      if (!profile?.id) {
        setLoadingEntry(false)
        return
      }

      setLoadingEntry(true)
      setMessage('')
      setMessageType('')

      const { data, error } = await supabase
        .from('rep_daily_stats')
        .select(`
          knocks,
          talks,
          walks,
          inspections,
          contingencies,
          contracts_with_deposit,
          revenue_signed
        `)
        .eq('rep_id', profile.id)
        .eq('report_date', reportDate)
        .maybeSingle()

      if (error) {
        setMessage(error.message)
        setMessageType('error')
        setForm(EMPTY_FORM)
        setLoadingEntry(false)
        return
      }

      if (!data) {
        setForm(EMPTY_FORM)
        setLoadingEntry(false)
        return
      }

      setForm({
        knocks: String(data.knocks ?? ''),
        talks: String(data.talks ?? ''),
        walks: String(data.walks ?? ''),
        inspections: String(data.inspections ?? ''),
        contingencies: String(data.contingencies ?? ''),
        contracts_with_deposit: String(data.contracts_with_deposit ?? ''),
        revenue_signed: String(data.revenue_signed ?? ''),
      })

      setLoadingEntry(false)
    }

    if (!loadingProfile) {
      loadExistingEntry()
    }
  }, [profile?.id, reportDate, loadingProfile])

  function updateField(field: keyof FormState, value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!profile?.id) {
      setMessage('Could not find your user profile.')
      setMessageType('error')
      return
    }

    setSaving(true)
    setMessage('')
    setMessageType('')

    const payload = {
      rep_id: profile.id,
      report_date: reportDate,
      knocks: toNumber(form.knocks),
      talks: toNumber(form.talks),
      walks: toNumber(form.walks),
      inspections: toNumber(form.inspections),
      contingencies: toNumber(form.contingencies),
      contracts_with_deposit: toNumber(form.contracts_with_deposit),
      revenue_signed: toNumber(form.revenue_signed),
    }

    const { error } = await supabase
      .from('rep_daily_stats')
      .upsert(payload, {
        onConflict: 'rep_id,report_date',
      })

    if (error) {
      setMessage(error.message)
      setMessageType('error')
      setSaving(false)
      return
    }

    setMessage('Nightly numbers saved.')
    setMessageType('success')
    setSaving(false)
  }

  if (loadingProfile) {
    return (
      <main className="space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.30)] backdrop-blur-2xl">
          <div className="text-sm text-white/60">Loading profile…</div>
        </section>
      </main>
    )
  }

  return (
    <main className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_25px_90px_rgba(0,0,0,0.35)] backdrop-blur-2xl md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,179,122,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.06),transparent_24%)]" />

        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d6b37a]">
              Daily Activity
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
              Nightly Numbers
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/62">
              Log your activity for the day so dashboards, reports, projections, and coaching stay current.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">
              User
            </div>
            <div className="mt-1 text-sm font-semibold text-white">
              {profile?.full_name || 'Unknown User'}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.30)] backdrop-blur-2xl">
        <div className="grid gap-4 md:grid-cols-[280px_1fr] md:items-end">
          <label className="block">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
              Report Date
            </div>
            <input
              type="date"
              value={reportDate}
              max={isManager ? undefined : getTodayLocalDate()}
              onChange={(e) => setReportDate(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white outline-none transition focus:border-[#d6b37a]/50 focus:bg-white/[0.08]"
            />
          </label>

          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/60">
            {isManager
              ? 'Manager mode: you can open different dates and edit your own entries.'
              : 'Rep mode: submit today’s numbers here.'}
          </div>
        </div>
      </section>

      {message ? (
        <section
          className={`rounded-2xl border p-4 text-sm shadow-[0_15px_40px_rgba(0,0,0,0.18)] ${messageType === 'error'
              ? 'border-red-400/20 bg-red-500/10 text-red-200'
              : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
            }`}
        >
          {message}
        </section>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricInput
            label="Knocks"
            value={form.knocks}
            onChange={(next) => updateField('knocks', next)}
          />
          <MetricInput
            label="Talks"
            value={form.talks}
            onChange={(next) => updateField('talks', next)}
          />
          <MetricInput
            label="Walks"
            value={form.walks}
            onChange={(next) => updateField('walks', next)}
          />
          <MetricInput
            label="Inspections"
            value={form.inspections}
            onChange={(next) => updateField('inspections', next)}
          />
          <MetricInput
            label="Contingencies"
            value={form.contingencies}
            onChange={(next) => updateField('contingencies', next)}
          />
          <MetricInput
            label="Contracts"
            value={form.contracts_with_deposit}
            onChange={(next) => updateField('contracts_with_deposit', next)}
          />
          <MetricInput
            label="Revenue"
            value={form.revenue_signed}
            onChange={(next) => updateField('revenue_signed', next)}
            inputMode="decimal"
            placeholder="0.00"
          />
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.30)] backdrop-blur-2xl">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">
                Activity Total
              </div>
              <div className="mt-2 text-3xl font-bold text-white">
                {(
                  toNumber(form.knocks) +
                  toNumber(form.talks) +
                  toNumber(form.walks) +
                  toNumber(form.inspections)
                ).toLocaleString()}
              </div>
              <div className="mt-2 text-sm text-white/55">
                Knocks + talks + walks + inspections
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">
                Closing Actions
              </div>
              <div className="mt-2 text-3xl font-bold text-white">
                {(toNumber(form.contingencies) + toNumber(form.contracts_with_deposit)).toLocaleString()}
              </div>
              <div className="mt-2 text-sm text-white/55">
                Contingencies + contracts
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">
                Revenue Entered
              </div>
              <div className="mt-2 text-3xl font-bold text-white">
                ${toNumber(form.revenue_signed).toLocaleString()}
              </div>
              <div className="mt-2 text-sm text-white/55">
                Signed revenue for this date
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving || loadingEntry}
              className="rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Numbers'}
            </button>

            <button
              type="button"
              onClick={() => setForm(EMPTY_FORM)}
              className="rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.10]"
            >
              Clear Form
            </button>
          </div>
        </section>
      </form>
    </main>
  )
}

export default function SubmitNumbersPage() {
  return (
    <ProtectedRoute>
      <SubmitNumbersPageContent />
    </ProtectedRoute>
  )
}