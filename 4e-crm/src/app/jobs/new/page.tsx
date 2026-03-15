'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type Stage = {
  id: number
  name: string
}

type RepProfile = {
  id: string
  full_name: string
  role: string
  is_active: boolean
}

export default function NewJobPage() {
  const router = useRouter()

  const [stages, setStages] = useState<Stage[]>([])
  const [reps, setReps] = useState<RepProfile[]>([])
  const [selectedRepIds, setSelectedRepIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const [form, setForm] = useState({
    homeowner_name: '',
    phone: '',
    address: '',
    email: '',
    stage_id: '',
    insurance_carrier: '',
    deductible: '',
    claim_number: '',
    adjuster_name: '',
    adjuster_phone: '',
    adjuster_email: '',
    date_of_loss: '',
    type_of_loss: '',
    install_date: '',
    contract_signed_date: '',
    contract_amount: '',
    deposit_collected: '',
    remaining_balance: '',
    supplemented_amount: '',
    shingle_name: '',
  })

  useEffect(() => {
    async function loadData() {
      const [{ data: stageData }, { data: repData }] = await Promise.all([
        supabase
          .from('pipeline_stages')
          .select('id, name')
          .order('sort_order', { ascending: true }),
        supabase
          .from('profiles')
          .select('id, full_name, role, is_active')
          .eq('is_active', true)
          .order('full_name', { ascending: true }),
      ])

      if (stageData) setStages(stageData)
      if (repData) setReps(repData)
    }

    loadData()
  }, [])

  function updateField(field: keyof typeof form, value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  function toggleRep(repId: string) {
    setSelectedRepIds((prev) =>
      prev.includes(repId)
        ? prev.filter((id) => id !== repId)
        : [...prev, repId]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrorMessage('')

    try {
      const { data: homeownerData, error: homeownerError } = await supabase
        .from('homeowners')
        .insert([
          {
            name: form.homeowner_name,
            phone: form.phone || null,
            address: form.address || null,
            email: form.email || null,
          },
        ])
        .select()
        .single()

      if (homeownerError || !homeownerData) {
        throw new Error(homeownerError?.message || 'Failed to create homeowner')
      }

      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .insert([
          {
            homeowner_id: homeownerData.id,
            stage_id: form.stage_id ? Number(form.stage_id) : null,
            insurance_carrier: form.insurance_carrier || null,
            deductible: form.deductible ? Number(form.deductible) : null,
            claim_number: form.claim_number || null,
            adjuster_name: form.adjuster_name || null,
            adjuster_phone: form.adjuster_phone || null,
            adjuster_email: form.adjuster_email || null,
            date_of_loss: form.date_of_loss || null,
            type_of_loss: form.type_of_loss || null,
            install_date: form.install_date || null,
            contract_signed_date: form.contract_signed_date || null,
            contract_amount: form.contract_amount ? Number(form.contract_amount) : null,
            deposit_collected: form.deposit_collected ? Number(form.deposit_collected) : 0,
            remaining_balance: form.remaining_balance ? Number(form.remaining_balance) : 0,
            supplemented_amount: form.supplemented_amount ? Number(form.supplemented_amount) : 0,
            shingle_name: form.shingle_name || null,
          },
        ])
        .select()
        .single()

      if (jobError || !jobData) {
        throw new Error(jobError?.message || 'Failed to create job')
      }

      if (selectedRepIds.length > 0) {
        const assignments = selectedRepIds.map((profileId) => ({
          job_id: jobData.id,
          profile_id: profileId,
        }))

        const { error: repError } = await supabase
          .from('job_reps')
          .insert(assignments)

        if (repError) {
          throw new Error(repError.message || 'Failed to assign reps')
        }
      }

      router.push(`/jobs/${jobData.id}`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong'
      setErrorMessage(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Create New Job</h1>
          <p className="mt-2 text-sm text-gray-600">
            Add a new homeowner and full roofing claim record.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          {errorMessage ? (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <section>
            <h2 className="mb-4 text-xl font-semibold">Homeowner Info</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <input className="rounded-lg border px-4 py-3" placeholder="Homeowner name" value={form.homeowner_name} onChange={(e) => updateField('homeowner_name', e.target.value)} required />
              <input className="rounded-lg border px-4 py-3" placeholder="Phone" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
              <input className="rounded-lg border px-4 py-3" placeholder="Address" value={form.address} onChange={(e) => updateField('address', e.target.value)} />
              <input className="rounded-lg border px-4 py-3" placeholder="Email" value={form.email} onChange={(e) => updateField('email', e.target.value)} />
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold">Assigned Reps</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {reps.map((rep) => (
                <label
                  key={rep.id}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 p-4"
                >
                  <input
                    type="checkbox"
                    checked={selectedRepIds.includes(rep.id)}
                    onChange={() => toggleRep(rep.id)}
                  />
                  <span className="text-sm font-medium text-gray-900">
                    {rep.full_name}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold">Claim / Job Info</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <select className="rounded-lg border px-4 py-3" value={form.stage_id} onChange={(e) => updateField('stage_id', e.target.value)} required>
                <option value="">Select stage</option>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>

              <input className="rounded-lg border px-4 py-3" placeholder="Insurance carrier" value={form.insurance_carrier} onChange={(e) => updateField('insurance_carrier', e.target.value)} />
              <input className="rounded-lg border px-4 py-3" placeholder="Deductible" value={form.deductible} onChange={(e) => updateField('deductible', e.target.value)} />
              <input className="rounded-lg border px-4 py-3" placeholder="Claim number" value={form.claim_number} onChange={(e) => updateField('claim_number', e.target.value)} />
              <input className="rounded-lg border px-4 py-3" placeholder="Type of loss" value={form.type_of_loss} onChange={(e) => updateField('type_of_loss', e.target.value)} />
              <input className="rounded-lg border px-4 py-3" placeholder="Adjuster name" value={form.adjuster_name} onChange={(e) => updateField('adjuster_name', e.target.value)} />
              <input className="rounded-lg border px-4 py-3" placeholder="Adjuster phone" value={form.adjuster_phone} onChange={(e) => updateField('adjuster_phone', e.target.value)} />
              <input className="rounded-lg border px-4 py-3" placeholder="Adjuster email" value={form.adjuster_email} onChange={(e) => updateField('adjuster_email', e.target.value)} />
              <input type="date" className="rounded-lg border px-4 py-3" value={form.date_of_loss} onChange={(e) => updateField('date_of_loss', e.target.value)} />
              <input type="date" className="rounded-lg border px-4 py-3" value={form.install_date} onChange={(e) => updateField('install_date', e.target.value)} />
              <input type="date" className="rounded-lg border px-4 py-3" value={form.contract_signed_date} onChange={(e) => updateField('contract_signed_date', e.target.value)} />
              <input className="rounded-lg border px-4 py-3" placeholder="Contract amount" value={form.contract_amount} onChange={(e) => updateField('contract_amount', e.target.value)} />
              <input className="rounded-lg border px-4 py-3" placeholder="Deposit collected" value={form.deposit_collected} onChange={(e) => updateField('deposit_collected', e.target.value)} />
              <input className="rounded-lg border px-4 py-3" placeholder="Remaining balance" value={form.remaining_balance} onChange={(e) => updateField('remaining_balance', e.target.value)} />
              <input className="rounded-lg border px-4 py-3" placeholder="Supplemented amount" value={form.supplemented_amount} onChange={(e) => updateField('supplemented_amount', e.target.value)} />
              <input className="rounded-lg border px-4 py-3 md:col-span-2" placeholder="Shingle name" value={form.shingle_name} onChange={(e) => updateField('shingle_name', e.target.value)} />
            </div>
          </section>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-60"
            >
              {loading ? 'Creating...' : 'Create Job'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}