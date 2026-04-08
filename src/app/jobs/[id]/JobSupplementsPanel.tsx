'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { authorizedFetch } from '@/lib/api-client'

type ContractOption = {
  id: string
  contract_amount: number
  date_signed: string
  trades_included: string[]
}

type SupplementRow = {
  id: string
  job_id: string
  job_contract_id: string
  amount: number
  supplement_for: string
  created_at: string
  created_by: string | null
  job_contracts: ContractOption
}

type ContractsResponse = {
  contracts: ContractOption[]
  error?: string
}

type SupplementsResponse = {
  supplements: SupplementRow[]
  error?: string
}

type FormState = {
  jobContractId: string
  amount: string
  supplementFor: string
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

function contractLabel(contract: ContractOption) {
  return `${formatDate(contract.date_signed)} • ${formatCurrency(contract.contract_amount)}`
}

export default function JobSupplementsPanel({
  jobId,
}: {
  jobId: string
}) {
  const [contracts, setContracts] = useState<ContractOption[]>([])
  const [supplements, setSupplements] = useState<SupplementRow[]>([])
  const [form, setForm] = useState<FormState>({
    jobContractId: '',
    amount: '',
    supplementFor: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'success' | 'error' | ''>('')

  const loadData = useCallback(async (options?: { preserveMessage?: boolean }) => {
    setLoading(true)

    try {
      const [contractsRes, supplementsRes] = await Promise.all([
        authorizedFetch(`/api/jobs/${jobId}/contracts`),
        authorizedFetch(`/api/jobs/${jobId}/supplements`),
      ])
      const contractsResult = (await contractsRes.json().catch(() => null)) as
        | ContractsResponse
        | null
      const supplementsResult = (await supplementsRes.json().catch(() => null)) as
        | SupplementsResponse
        | null

      if (!contractsRes.ok || !contractsResult) {
        throw new Error(contractsResult?.error || 'Could not load contracts.')
      }

      if (!supplementsRes.ok || !supplementsResult) {
        throw new Error(supplementsResult?.error || 'Could not load supplements.')
      }

      const nextContracts = contractsResult.contracts ?? []
      setContracts(nextContracts)
      setSupplements(supplementsResult.supplements ?? [])
      setForm((current) => ({
        ...current,
        jobContractId:
          current.jobContractId || nextContracts.length === 0
            ? current.jobContractId
            : nextContracts[0].id,
      }))

      if (!options?.preserveMessage) {
        setMessage('')
        setMessageTone('')
      }
    } catch (error) {
      setContracts([])
      setSupplements([])
      setMessageTone('error')
      setMessage(error instanceof Error ? error.message : 'Could not load supplements.')
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const supplementTotal = useMemo(
    () => supplements.reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
    [supplements]
  )

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (saving) return

    setSaving(true)
    setMessage('')
    setMessageTone('')

    try {
      const response = await authorizedFetch(`/api/jobs/${jobId}/supplements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      })
      const result = (await response.json().catch(() => null)) as
        | {
            error?: string
          }
        | null

      if (!response.ok) {
        throw new Error(result?.error || 'Could not add supplement.')
      }

      setForm((current) => ({
        ...current,
        amount: '',
        supplementFor: '',
      }))
      await loadData({ preserveMessage: true })
      setMessageTone('success')
      setMessage('Supplement added and totals updated.')
      window.dispatchEvent(new CustomEvent('job-detail:refresh', { detail: { jobId } }))
    } catch (error) {
      setMessageTone('error')
      setMessage(error instanceof Error ? error.message : 'Could not add supplement.')
    } finally {
      setSaving(false)
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
        <div>
          <h2 className="text-xl font-semibold text-white">Supplements</h2>
          <p className="mt-1 text-sm text-white/60">
            Add supplements to a specific contract and keep an audit log.
          </p>
        </div>

        <div className="mt-6 rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
            Supplement Total
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-white">
            {formatCurrency(supplementTotal)}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                Contract
              </div>
              <select
                value={form.jobContractId}
                disabled={saving || contracts.length === 0}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    jobContractId: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#d6b37a]/35 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">
                  {contracts.length === 0 ? 'Add a contract first' : 'Select contract'}
                </option>
                {contracts.map((contract) => (
                  <option key={contract.id} value={contract.id}>
                    {contractLabel(contract)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                Amount
              </div>
              <input
                value={form.amount}
                inputMode="decimal"
                disabled={saving || contracts.length === 0}
                placeholder="0.00"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d6b37a]/35 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>

            <label className="block md:col-span-2">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                Supplement For
              </div>
              <input
                value={form.supplementFor}
                disabled={saving || contracts.length === 0}
                placeholder="Describe what this supplement is for"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    supplementFor: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d6b37a]/35 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="submit"
              disabled={saving || contracts.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Saving Supplement...' : 'Add Supplement'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[#0b0f16]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
        <div>
          <h2 className="text-xl font-semibold text-white">Supplement Log</h2>
          <p className="mt-1 text-sm text-white/60">Every supplement entry for this job.</p>
        </div>

        {loading ? (
          <div className="mt-4 text-sm text-white/60">Loading supplements...</div>
        ) : supplements.length === 0 ? (
          <div className="mt-4 rounded-[1.4rem] border border-dashed border-white/15 p-4 text-sm text-white/60">
            No supplements logged yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {supplements.map((supplement) => (
              <div
                key={supplement.id}
                className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4 shadow-[0_16px_36px_rgba(0,0,0,0.18)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d6b37a]">
                      Added {new Date(supplement.created_at).toLocaleString('en-US')}
                    </div>
                    <div className="mt-2 text-2xl font-bold tracking-tight text-white">
                      {formatCurrency(supplement.amount)}
                    </div>
                    <div className="mt-2 text-sm text-white/70">{supplement.supplement_for}</div>
                    <div className="mt-2 text-sm text-white/55">
                      Contract: {contractLabel(supplement.job_contracts)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}
