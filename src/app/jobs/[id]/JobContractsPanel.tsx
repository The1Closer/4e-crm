'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Trash2, X } from 'lucide-react'
import { authorizedFetch } from '@/lib/api-client'
import { CONTRACT_TRADE_OPTIONS } from '@/lib/job-contracts'

type JobContractRow = {
  id: string
  job_id: string
  trades_included: string[]
  trade_other_detail: string | null
  contract_amount: number
  date_signed: string
  created_at: string
  created_by: string | null
  supplement_total: number
}

type ContractsResponse = {
  contracts: JobContractRow[]
  error?: string
}

type ContractFormState = {
  tradesIncluded: string[]
  tradeOtherDetail: string
  contractAmount: string
  dateSigned: string
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

function getTodayDateInputValue() {
  const now = new Date()
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 10)
}

export default function JobContractsPanel({
  jobId,
}: {
  jobId: string
}) {
  const [contracts, setContracts] = useState<JobContractRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingContractId, setDeletingContractId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'success' | 'error' | ''>('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<ContractFormState>({
    tradesIncluded: [],
    tradeOtherDetail: '',
    contractAmount: '',
    dateSigned: getTodayDateInputValue(),
  })

  const loadContracts = useCallback(async (options?: { preserveMessage?: boolean }) => {
    setLoading(true)

    try {
      const response = await authorizedFetch(`/api/jobs/${jobId}/contracts`)
      const result = (await response.json().catch(() => null)) as ContractsResponse | null

      if (!response.ok || !result) {
        throw new Error(result?.error || 'Could not load contracts.')
      }

      setContracts(result.contracts ?? [])

      if (!options?.preserveMessage) {
        setMessage('')
        setMessageTone('')
      }
    } catch (error) {
      setContracts([])
      setMessageTone('error')
      setMessage(error instanceof Error ? error.message : 'Could not load contracts.')
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    void loadContracts()
  }, [loadContracts])

  const contractSubtotal = useMemo(
    () => contracts.reduce((sum, contract) => sum + Number(contract.contract_amount ?? 0), 0),
    [contracts]
  )

  function toggleTrade(trade: string) {
    setForm((current) => {
      const hasTrade = current.tradesIncluded.includes(trade)
      const nextTrades = hasTrade
        ? current.tradesIncluded.filter((item) => item !== trade)
        : [...current.tradesIncluded, trade]

      return {
        ...current,
        tradesIncluded: nextTrades,
        tradeOtherDetail:
          trade === 'Misc/other' && hasTrade ? '' : current.tradeOtherDetail,
      }
    })
  }

  function resetForm() {
    setForm({
      tradesIncluded: [],
      tradeOtherDetail: '',
      contractAmount: '',
      dateSigned: getTodayDateInputValue(),
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (saving) return

    setSaving(true)
    setMessage('')
    setMessageTone('')

    try {
      const response = await authorizedFetch(`/api/jobs/${jobId}/contracts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trades_included: form.tradesIncluded,
          trade_other_detail: form.tradeOtherDetail,
          contract_amount: form.contractAmount,
          date_signed: form.dateSigned,
        }),
      })
      const result = (await response.json().catch(() => null)) as
        | {
            error?: string
          }
        | null

      if (!response.ok) {
        throw new Error(result?.error || 'Could not save contract.')
      }

      await loadContracts({ preserveMessage: true })
      resetForm()
      setShowModal(false)
      setMessageTone('success')
      setMessage('Contract saved. Job totals updated.')
      window.dispatchEvent(new CustomEvent('job-detail:refresh', { detail: { jobId } }))
    } catch (error) {
      setMessageTone('error')
      setMessage(error instanceof Error ? error.message : 'Could not save contract.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(contract: JobContractRow) {
    if (deletingContractId) return

    const confirmed = window.confirm(
      'Delete this contract? Contracts with supplements or payments cannot be deleted.'
    )

    if (!confirmed) return

    setDeletingContractId(contract.id)
    setMessage('')
    setMessageTone('')

    try {
      const response = await authorizedFetch(
        `/api/jobs/${jobId}/contracts/${contract.id}`,
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
        throw new Error(result?.error || 'Could not delete contract.')
      }

      await loadContracts({ preserveMessage: true })
      setMessageTone('success')
      setMessage('Contract deleted. Job totals updated.')
      window.dispatchEvent(new CustomEvent('job-detail:refresh', { detail: { jobId } }))
    } catch (error) {
      setMessageTone('error')
      setMessage(error instanceof Error ? error.message : 'Could not delete contract.')
    } finally {
      setDeletingContractId(null)
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
            <h2 className="text-xl font-semibold text-white">Contracts</h2>
            <p className="mt-1 text-sm text-white/60">
              Add each contract signed for this job. Totals roll up into job finance and commissions.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85]"
          >
            <Plus className="h-4 w-4" />
            Enter Contract
          </button>
        </div>

        <div className="mt-6 rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
            Contract Subtotal
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-white">
            {formatCurrency(contractSubtotal)}
          </div>
        </div>

        {loading ? (
          <div className="mt-4 text-sm text-white/60">Loading contracts...</div>
        ) : contracts.length === 0 ? (
          <div className="mt-4 rounded-[1.4rem] border border-dashed border-white/15 p-4 text-sm text-white/60">
            No contracts logged yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {contracts.map((contract) => (
              <div
                key={contract.id}
                className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4 shadow-[0_16px_36px_rgba(0,0,0,0.18)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d6b37a]">
                      Signed {formatDate(contract.date_signed)}
                    </div>
                    <div className="mt-2 text-2xl font-bold tracking-tight text-white">
                      {formatCurrency(contract.contract_amount)}
                    </div>
                    <div className="mt-2 text-sm text-white/65">
                      Trades: {contract.trades_included.join(', ')}
                      {contract.trade_other_detail ? ` (${contract.trade_other_detail})` : ''}
                    </div>
                    <div className="mt-2 text-sm text-white/55">
                      Supplements on this contract: {formatCurrency(contract.supplement_total)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      void handleDelete(contract)
                    }}
                    disabled={deletingContractId === contract.id}
                    className="inline-flex items-center gap-2 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingContractId === contract.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    {deletingContractId === contract.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-[1.75rem] border border-white/10 bg-[#0b0f16] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white">Enter Contract</h3>
                <p className="mt-1 text-sm text-white/60">
                  Trades Included, Contract Amount, and Date Signed are required.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false)
                }}
                className="rounded-full border border-white/10 bg-white/[0.06] p-2 text-white/70 transition hover:bg-white/[0.12] hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                  Trades Included
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CONTRACT_TRADE_OPTIONS.map((trade) => {
                    const checked = form.tradesIncluded.includes(trade)

                    return (
                      <label
                        key={trade}
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTrade(trade)}
                          className="h-4 w-4 rounded border-white/20 bg-black/30 text-[#d6b37a] focus:ring-[#d6b37a]"
                        />
                        <span>{trade}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {form.tradesIncluded.includes('Misc/other') ? (
                <label className="block">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                    Specify Misc/other
                  </div>
                  <input
                    value={form.tradeOtherDetail}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        tradeOtherDetail: event.target.value,
                      }))
                    }
                    placeholder="Describe the trade"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d6b37a]/35"
                  />
                </label>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                    Contract Amount
                  </div>
                  <input
                    value={form.contractAmount}
                    inputMode="decimal"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        contractAmount: event.target.value,
                      }))
                    }
                    placeholder="0.00"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d6b37a]/35"
                  />
                </label>

                <label className="block">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                    Date Signed
                  </div>
                  <input
                    type="date"
                    value={form.dateSigned}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        dateSigned: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
                  />
                </label>
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {saving ? 'Saving Contract...' : 'Save Contract'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  )
}
