'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { createNotifications } from '../../../lib/notification-utils'

type Stage = {
  id: number
  name: string
}

type Rep = {
  id: string
  full_name: string
  role?: string
  is_active?: boolean
}

type FormData = {
  homeowner_name: string
  phone: string
  address: string
  email: string
  stage_id: string
  insurance_carrier: string
  deductible: string
  claim_number: string
  adjuster_name: string
  adjuster_phone: string
  adjuster_email: string
  date_of_loss: string
  type_of_loss: string
  install_date: string
  contract_signed_date: string
  contract_amount: string
  deposit_collected: string
  remaining_balance: string
  supplemented_amount: string
  shingle_name: string
}

export default function EditJobForm({
  jobId,
  homeownerId,
  stages,
  reps,
  initialSelectedRepIds,
  initialData,
}: {
  jobId: string
  homeownerId: string
  stages: Stage[]
  reps: Rep[]
  initialSelectedRepIds: string[]
  initialData: FormData
}) {
  const router = useRouter()

  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<FormData>(initialData)
  const [selectedRepIds, setSelectedRepIds] = useState<string[]>(initialSelectedRepIds)
  const [repToAdd, setRepToAdd] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  function updateField(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const selectedReps = useMemo(() => {
    return reps.filter((rep) => selectedRepIds.includes(rep.id))
  }, [reps, selectedRepIds])

  const availableReps = useMemo(() => {
    return reps.filter((rep) => !selectedRepIds.includes(rep.id))
  }, [reps, selectedRepIds])

  function removeRep(repId: string) {
    setSelectedRepIds((prev) => prev.filter((id) => id !== repId))
  }

  function addRep() {
    if (!repToAdd) return
    if (selectedRepIds.includes(repToAdd)) return

    setSelectedRepIds((prev) => [...prev, repToAdd])
    setRepToAdd('')
  }

  function handleCancel() {
    setForm(initialData)
    setSelectedRepIds(initialSelectedRepIds)
    setRepToAdd('')
    setMessage('')
    setIsEditing(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error: homeownerError } = await supabase
      .from('homeowners')
      .update({
        name: form.homeowner_name || null,
        phone: form.phone || null,
        address: form.address || null,
        email: form.email || null,
      })
      .eq('id', homeownerId)

    if (homeownerError) {
      setMessage(homeownerError.message)
      setSaving(false)
      return
    }

    const { error: jobError } = await supabase
      .from('jobs')
      .update({
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
      })
      .eq('id', jobId)

    if (jobError) {
      setMessage(jobError.message)
      setSaving(false)
      return
    }

    const { error: deleteRepError } = await supabase
      .from('job_reps')
      .delete()
      .eq('job_id', jobId)

    if (deleteRepError) {
      setMessage(deleteRepError.message)
      setSaving(false)
      return
    }

    if (selectedRepIds.length > 0) {
      const assignments = selectedRepIds.map((profileId) => ({
        job_id: jobId,
        profile_id: profileId,
      }))

      const { error: insertRepError } = await supabase
        .from('job_reps')
        .insert(assignments)

      if (insertRepError) {
        setMessage(insertRepError.message)
        setSaving(false)
        return
      }
    }

    const newlyAddedRepIds = selectedRepIds.filter(
      (id) => !initialSelectedRepIds.includes(id)
    )

    if (newlyAddedRepIds.length > 0) {
      await createNotifications({
        userIds: newlyAddedRepIds,
        actorUserId: user?.id ?? null,
        type: 'assignment',
        title: 'You were assigned to a job',
        message: 'You were assigned to a job in the CRM.',
        link: `/jobs/${jobId}`,
        jobId,
      })
    }

    setSaving(false)
    setIsEditing(false)
    setMessage('Saved')
    router.refresh()
  }

  if (!isEditing) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Edit Job</h2>
            <p className="mt-1 text-sm text-gray-600">
              Update homeowner, claim, adjuster, financial info, and assigned reps.
            </p>

            <div className="mt-3 text-sm text-gray-700">
              <span className="font-medium">Assigned reps:</span>{' '}
              {selectedReps.length > 0
                ? selectedReps.map((rep) => rep.full_name).join(', ')
                : 'No reps assigned'}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            Edit
          </button>
        </div>

        {message ? (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            {message}
          </div>
        ) : null}
      </section>
    )
  }

  return (
    <form
      onSubmit={handleSave}
      className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Editing Job</h2>
          <p className="mt-1 text-sm text-gray-600">
            Make changes, then save or cancel.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {message ? (
        <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          {message}
        </div>
      ) : null}

      <div className="space-y-8">
        <section>
          <h3 className="mb-4 text-lg font-semibold">Homeowner Info</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <input
              className="rounded-lg border px-4 py-3"
              placeholder="Homeowner name"
              value={form.homeowner_name}
              onChange={(e) => updateField('homeowner_name', e.target.value)}
            />
            <input
              className="rounded-lg border px-4 py-3"
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
            />
            <input
              className="rounded-lg border px-4 py-3"
              placeholder="Address"
              value={form.address}
              onChange={(e) => updateField('address', e.target.value)}
            />
            <input
              className="rounded-lg border px-4 py-3"
              placeholder="Email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
            />
          </div>
        </section>

        <section>
          <h3 className="mb-4 text-lg font-semibold">Assigned Reps</h3>

          <div className="space-y-3">
            {selectedReps.length > 0 ? (
              selectedReps.map((rep) => (
                <div
                  key={rep.id}
                  className="flex items-center justify-between rounded-xl border border-gray-200 p-4"
                >
                  <div className="text-sm font-medium text-gray-900">
                    {rep.full_name}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeRep(rep.id)}
                    className="rounded-lg border border-red-300 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600">
                No reps assigned.
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <select
              className="rounded-lg border px-4 py-3 md:min-w-[280px]"
              value={repToAdd}
              onChange={(e) => setRepToAdd(e.target.value)}
            >
              <option value="">Select rep to add</option>
              {availableReps.map((rep) => (
                <option key={rep.id} value={rep.id}>
                  {rep.full_name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={addRep}
              disabled={!repToAdd}
              className="rounded-lg border bg-white px-4 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-100 disabled:opacity-50"
            >
              Add Rep
            </button>
          </div>
        </section>

        <section>
          <h3 className="mb-4 text-lg font-semibold">Claim / Job Info</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <select
              className="rounded-lg border px-4 py-3"
              value={form.stage_id}
              onChange={(e) => updateField('stage_id', e.target.value)}
            >
              <option value="">Select stage</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>

            <input
              className="rounded-lg border px-4 py-3"
              placeholder="Insurance carrier"
              value={form.insurance_carrier}
              onChange={(e) => updateField('insurance_carrier', e.target.value)}
            />
            <input
              className="rounded-lg border px-4 py-3"
              placeholder="Deductible"
              value={form.deductible}
              onChange={(e) => updateField('deductible', e.target.value)}
            />
            <input
              className="rounded-lg border px-4 py-3"
              placeholder="Claim number"
              value={form.claim_number}
              onChange={(e) => updateField('claim_number', e.target.value)}
            />
            <input
              className="rounded-lg border px-4 py-3"
              placeholder="Type of loss"
              value={form.type_of_loss}
              onChange={(e) => updateField('type_of_loss', e.target.value)}
            />
            <input
              className="rounded-lg border px-4 py-3"
              placeholder="Adjuster name"
              value={form.adjuster_name}
              onChange={(e) => updateField('adjuster_name', e.target.value)}
            />
            <input
              className="rounded-lg border px-4 py-3"
              placeholder="Adjuster phone"
              value={form.adjuster_phone}
              onChange={(e) => updateField('adjuster_phone', e.target.value)}
            />
            <input
              className="rounded-lg border px-4 py-3"
              placeholder="Adjuster email"
              value={form.adjuster_email}
              onChange={(e) => updateField('adjuster_email', e.target.value)}
            />
            <input
              type="date"
              className="rounded-lg border px-4 py-3"
              value={form.date_of_loss}
              onChange={(e) => updateField('date_of_loss', e.target.value)}
            />
            <input
              type="date"
              className="rounded-lg border px-4 py-3"
              value={form.install_date}
              onChange={(e) => updateField('install_date', e.target.value)}
            />
            <input
              type="date"
              className="rounded-lg border px-4 py-3"
              value={form.contract_signed_date}
              onChange={(e) => updateField('contract_signed_date', e.target.value)}
            />
            <input
              className="rounded-lg border px-4 py-3"
              placeholder="Contract amount"
              value={form.contract_amount}
              onChange={(e) => updateField('contract_amount', e.target.value)}
            />
            <input
              className="rounded-lg border px-4 py-3"
              placeholder="Deposit collected"
              value={form.deposit_collected}
              onChange={(e) => updateField('deposit_collected', e.target.value)}
            />
            <input
              className="rounded-lg border px-4 py-3"
              placeholder="Remaining balance"
              value={form.remaining_balance}
              onChange={(e) => updateField('remaining_balance', e.target.value)}
            />
            <input
              className="rounded-lg border px-4 py-3"
              placeholder="Supplemented amount"
              value={form.supplemented_amount}
              onChange={(e) => updateField('supplemented_amount', e.target.value)}
            />
            <input
              className="rounded-lg border px-4 py-3 md:col-span-2"
              placeholder="Shingle name"
              value={form.shingle_name}
              onChange={(e) => updateField('shingle_name', e.target.value)}
            />
          </div>
        </section>
      </div>
    </form>
  )
}