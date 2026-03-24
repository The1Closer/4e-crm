'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Loader2, Trash2, Upload } from 'lucide-react'
import { authorizedFetch } from '@/lib/api-client'
import {
  getTodayDateInputValue,
  type JobPaymentRecord,
  type JobPaymentSummary,
} from '@/lib/job-payments'
import { supabase } from '@/lib/supabase'

type PaymentsResponse = {
  payments: JobPaymentRecord[]
  summary: JobPaymentSummary
  error?: string
}

type PaymentFormState = {
  amount: string
  paymentType: string
  paymentDate: string
  checkNumber: string
  note: string
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return '-'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US')
}

function buildProofUrl(filePath: string) {
  const { data } = supabase.storage.from('job-files').getPublicUrl(filePath)
  return data.publicUrl
}

function SummaryTile({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[1.3rem] border border-white/10 bg-black/20 p-4 shadow-[0_14px_32px_rgba(0,0,0,0.18)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
        {label}
      </div>
      <div className="mt-2 text-xl font-bold tracking-tight text-white">{value}</div>
    </div>
  )
}

export default function JobPaymentsPanel({
  jobId,
}: {
  jobId: string
}) {
  const [payments, setPayments] = useState<JobPaymentRecord[]>([])
  const [summary, setSummary] = useState<JobPaymentSummary | null>(null)
  const [form, setForm] = useState<PaymentFormState>({
    amount: '',
    paymentType: '',
    paymentDate: getTodayDateInputValue(),
    checkNumber: '',
    note: '',
  })
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'success' | 'error' | ''>('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const loadPayments = useCallback(async (options?: { preserveMessage?: boolean }) => {
    setLoading(true)

    try {
      const response = await authorizedFetch(`/api/jobs/${jobId}/payments`)
      const result = (await response.json().catch(() => null)) as PaymentsResponse | null

      if (!response.ok || !result) {
        throw new Error(result?.error || 'Could not load job payments.')
      }

      setPayments(result.payments ?? [])
      setSummary(result.summary)

      if (!options?.preserveMessage) {
        setMessage('')
        setMessageTone('')
      }
    } catch (error) {
      setPayments([])
      setSummary(null)
      setMessageTone('error')
      setMessage(error instanceof Error ? error.message : 'Could not load job payments.')
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    void loadPayments()
  }, [loadPayments])

  const totalJobValue = useMemo(
    () => formatCurrency(summary?.totalDue ?? null),
    [summary]
  )
  const totalPaid = useMemo(
    () => formatCurrency(summary?.totalPaid ?? null),
    [summary]
  )
  const remainingBalance = useMemo(
    () => formatCurrency(summary?.remainingBalance ?? null),
    [summary]
  )

  function updateForm(field: keyof PaymentFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function resetForm() {
    setForm({
      amount: '',
      paymentType: '',
      paymentDate: getTodayDateInputValue(),
      checkNumber: '',
      note: '',
    })
    setFile(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (saving) return

    setSaving(true)
    setMessage('')
    setMessageTone('')

    try {
      const payload = new FormData()
      payload.set('amount', form.amount)
      payload.set('paymentType', form.paymentType)
      payload.set('paymentDate', form.paymentDate)
      payload.set('checkNumber', form.checkNumber)
      payload.set('note', form.note)

      if (file) {
        payload.set('file', file)
      }

      const response = await authorizedFetch(`/api/jobs/${jobId}/payments`, {
        method: 'POST',
        body: payload,
      })

      const result = (await response.json().catch(() => null)) as
        | {
            error?: string
          }
        | null

      if (!response.ok) {
        throw new Error(result?.error || 'Could not save the payment.')
      }

      resetForm()
      await loadPayments({ preserveMessage: true })
      setMessageTone('success')
      setMessage('Payment saved. Totals updated.')
      window.dispatchEvent(
        new CustomEvent('job-detail:refresh', {
          detail: { jobId },
        })
      )
    } catch (error) {
      setMessageTone('error')
      setMessage(error instanceof Error ? error.message : 'Could not save the payment.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(payment: JobPaymentRecord) {
    if (deletingPaymentId) return

    const confirmed = window.confirm('Delete this payment entry?')

    if (!confirmed) return

    setDeletingPaymentId(payment.id)
    setMessage('')
    setMessageTone('')

    try {
      const response = await authorizedFetch(
        `/api/jobs/${jobId}/payments/${payment.id}`,
        {
          method: 'DELETE',
        }
      )

      const result = (await response.json().catch(() => null)) as
        | {
            error?: string
          }
        | null

      if (!response.ok) {
        throw new Error(result?.error || 'Could not delete the payment.')
      }

      await loadPayments({ preserveMessage: true })
      setMessageTone('success')
      setMessage('Payment deleted. Totals updated.')
      window.dispatchEvent(
        new CustomEvent('job-detail:refresh', {
          detail: { jobId },
        })
      )
    } catch (error) {
      setMessageTone('error')
      setMessage(error instanceof Error ? error.message : 'Could not delete the payment.')
    } finally {
      setDeletingPaymentId(null)
    }
  }

  return (
    <section className="space-y-6">
      {message ? (
        <div
          className={`rounded-[1.4rem] border p-4 text-sm shadow-[0_18px_45px_rgba(0,0,0,0.18)] ${
            messageTone === 'success'
              ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
              : 'border-red-400/20 bg-red-500/10 text-red-100'
          }`}
        >
          {message}
        </div>
      ) : null}

      <section className="rounded-[2rem] border border-white/10 bg-[#0b0f16]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Payments</h2>
            <p className="mt-1 text-sm text-white/60">
              Log every payment here with proof and let the CRM keep total paid and
              remaining balance in sync automatically.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <SummaryTile label="Total Job Value" value={totalJobValue} />
          <SummaryTile label="Total Paid" value={totalPaid} />
          <SummaryTile label="Remaining Balance" value={remainingBalance} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5"
        >
          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Amount"
                value={form.amount}
                placeholder="0.00"
                inputMode="decimal"
                disabled={saving}
                onChange={(value) => updateForm('amount', value)}
              />
              <Field
                label="Payment Type"
                value={form.paymentType}
                placeholder="Insurance check, homeowner deposit, ACH..."
                disabled={saving}
                onChange={(value) => updateForm('paymentType', value)}
              />
              <Field
                label="Payment Date"
                type="date"
                value={form.paymentDate}
                disabled={saving}
                onChange={(value) => updateForm('paymentDate', value)}
              />
              <Field
                label="Check Number"
                value={form.checkNumber}
                placeholder="Optional"
                disabled={saving}
                onChange={(value) => updateForm('checkNumber', value)}
              />
              <label className="block md:col-span-2">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                  Notes
                </div>
                <textarea
                  rows={4}
                  value={form.note}
                  disabled={saving}
                  placeholder="Optional payment notes"
                  onChange={(event) => updateForm('note', event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d6b37a]/35 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b37a]">
                Proof Upload
              </div>
              <p className="mt-2 text-sm leading-6 text-white/55">
                Attach a check image, receipt, remittance, or any other payment proof.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                disabled={saving}
                accept="image/*,.pdf,.heic,.heif"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="mt-4 block w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white file:mr-4 file:rounded-full file:border-0 file:bg-[#d6b37a] file:px-4 file:py-2 file:text-xs file:font-semibold file:text-black hover:file:bg-[#e2bf85]"
              />

              {file ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80">
                  Selected proof: <span className="font-semibold text-white">{file.name}</span>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-white/12 px-4 py-3 text-sm text-white/45">
                  Proof is optional, but helpful for reconciliation.
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-45"
            >
              Clear
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {saving ? 'Saving Payment...' : 'Save Payment'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[#0b0f16]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">Payment Ledger</h2>
            <p className="mt-1 text-sm text-white/60">
              Every recorded payment for this job lives here.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 text-sm text-white/60">Loading payments...</div>
        ) : payments.length === 0 ? (
          <div className="mt-4 rounded-[1.4rem] border border-dashed border-white/15 p-4 text-sm text-white/60">
            No payments logged yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {payments.map((payment) => {
              const proofUrl = payment.proof_file_path
                ? buildProofUrl(payment.proof_file_path)
                : null

              return (
                <div
                  key={payment.id}
                  className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4 shadow-[0_16px_36px_rgba(0,0,0,0.18)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d6b37a]">
                        {payment.payment_type}
                      </div>
                      <div className="mt-3 text-2xl font-bold tracking-tight text-white">
                        {formatCurrency(payment.amount)}
                      </div>
                      <div className="mt-1 text-sm text-white/55">
                        Received {formatDate(payment.payment_date)}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {proofUrl ? (
                        <a
                          href={proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
                        >
                          <ExternalLink className="h-4 w-4 text-[#d6b37a]" />
                          Open Proof
                        </a>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => {
                          void handleDelete(payment)
                        }}
                        disabled={deletingPaymentId === payment.id}
                        className="inline-flex items-center gap-2 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingPaymentId === payment.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        {deletingPaymentId === payment.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <DetailItem
                      label="Check Number"
                      value={payment.check_number ?? 'Not provided'}
                    />
                    <DetailItem
                      label="Proof File"
                      value={payment.proof_file_name ?? 'No file attached'}
                    />
                    <DetailItem
                      label="Recorded"
                      value={new Date(payment.created_at).toLocaleString('en-US')}
                    />
                    <DetailItem
                      label="Payment ID"
                      value={payment.id}
                    />
                  </div>

                  {payment.note ? (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white/75">
                      {payment.note}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </section>
  )
}

function Field({
  label,
  value,
  placeholder,
  disabled = false,
  type = 'text',
  inputMode,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  disabled?: boolean
  type?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
        {label}
      </div>
      <input
        type={type}
        value={value}
        disabled={disabled}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d6b37a]/35 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  )
}

function DetailItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.04] p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
        {label}
      </div>
      <div className="mt-2 text-sm leading-6 text-white/80">{value}</div>
    </div>
  )
}
