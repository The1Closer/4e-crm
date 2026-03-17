'use client'

import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, PencilLine, X } from 'lucide-react'
import { authorizedFetch } from '@/lib/api-client'
import { getCurrentUserProfile, getPermissions } from '@/lib/auth-helpers'
import {
  getVisibleStagesForUser,
  isManagementLockedStage,
} from '@/lib/job-stage-access'

type Stage = {
  id: number
  name: string
  sort_order?: number | null
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

function SurfacePanel({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
        {eyebrow}
      </div>
      <h3 className="mt-2 text-xl font-bold tracking-tight text-white">{title}</h3>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function FormField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
        {label}
      </div>
      {children}
    </label>
  )
}

const INPUT_CLASS_NAME =
  'w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d6b37a]/35'

export default function EditJobForm({
  jobId,
  stages,
  reps,
  initialSelectedRepIds,
  initialData,
  buttonLabel = 'Edit Job',
  buttonClassName,
}: {
  jobId: string
  stages: Stage[]
  reps: Rep[]
  initialSelectedRepIds: string[]
  initialData: FormData
  buttonLabel?: string
  buttonClassName?: string
}) {
  const router = useRouter()

  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<FormData>(initialData)
  const [selectedRepIds, setSelectedRepIds] = useState<string[]>(initialSelectedRepIds)
  const [repToAdd, setRepToAdd] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'success' | 'error' | ''>('')
  const [canManageLockedStages, setCanManageLockedStages] = useState(false)

  useEffect(() => {
    async function loadPermissions() {
      const profile = await getCurrentUserProfile()
      const permissions = getPermissions(profile?.role)
      setCanManageLockedStages(permissions.canManageLockedStages)
    }

    void loadPermissions()
  }, [])

  useEffect(() => {
    setForm(initialData)
  }, [initialData])

  useEffect(() => {
    setSelectedRepIds(initialSelectedRepIds)
  }, [initialSelectedRepIds])

  function updateField(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const selectedReps = useMemo(() => {
    return reps.filter((rep) => selectedRepIds.includes(rep.id))
  }, [reps, selectedRepIds])

  const availableReps = useMemo(() => {
    return reps.filter((rep) => !selectedRepIds.includes(rep.id))
  }, [reps, selectedRepIds])

  const visibleStages = useMemo(
    () => getVisibleStagesForUser(stages, canManageLockedStages),
    [canManageLockedStages, stages]
  )

  const currentStage = useMemo(
    () => stages.find((stage) => String(stage.id) === initialData.stage_id) ?? null,
    [initialData.stage_id, stages]
  )

  const stageLockedForUser = useMemo(
    () =>
      Boolean(currentStage) &&
      isManagementLockedStage(currentStage, stages) &&
      !canManageLockedStages,
    [canManageLockedStages, currentStage, stages]
  )

  function removeRep(repId: string) {
    setSelectedRepIds((prev) => prev.filter((id) => id !== repId))
  }

  function addRep() {
    if (!repToAdd) return
    if (selectedRepIds.includes(repToAdd)) return

    setSelectedRepIds((prev) => [...prev, repToAdd])
    setRepToAdd('')
  }

  function handleOpenEdit() {
    setMessage('')
    setMessageTone('')
    setIsEditing(true)
  }

  function handleCancel() {
    setForm(initialData)
    setSelectedRepIds(initialSelectedRepIds)
    setRepToAdd('')
    setMessage('')
    setMessageTone('')
    setIsEditing(false)
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextStage = stages.find((stage) => String(stage.id) === form.stage_id) ?? null

    if (nextStage && isManagementLockedStage(nextStage, stages) && !canManageLockedStages) {
      setMessageTone('error')
      setMessage('Only management can move jobs into Contracted and later stages.')
      return
    }

    setSaving(true)
    setMessage('')
    setMessageTone('')

    try {
      const response = await authorizedFetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          rep_ids: selectedRepIds,
        }),
      })

      const result = (await response.json().catch(() => null)) as
        | {
            error?: string
          }
        | null

      if (!response.ok) {
        throw new Error(result?.error || 'Could not update the job.')
      }

      setIsEditing(false)
      setRepToAdd('')
      window.dispatchEvent(
        new CustomEvent('job-detail:refresh', {
          detail: { jobId },
        })
      )
      router.refresh()
    } catch (error) {
      setMessageTone('error')
      setMessage(error instanceof Error ? error.message : 'Could not update the job.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpenEdit}
        disabled={stageLockedForUser}
        title={
          stageLockedForUser
            ? 'Only management can edit jobs in this stage.'
            : undefined
        }
        className={
          buttonClassName ||
          'rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-45'
        }
      >
        <span className="inline-flex items-center gap-2">
          <PencilLine className="h-4 w-4 text-[#d6b37a]" />
          {buttonLabel}
        </span>
      </button>

      {isEditing ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/72 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSave}
            className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[2rem] border border-white/10 bg-[#0a0a0a] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.55)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b37a]">
                  Edit Job
                </div>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">
                  {form.homeowner_name || 'Unnamed homeowner'}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
                  Make the updates you need here, save them back to the CRM, and keep
                  the job detail page in sync without leaving the file.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex h-11 w-11 items-center justify-center rounded-[1.2rem] border border-white/10 bg-white/[0.04] text-white/70 transition hover:border-white/15 hover:bg-white/[0.08] hover:text-white"
                aria-label="Close job editor"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {message ? (
              <div
                className={`mt-5 rounded-[1.4rem] border p-4 text-sm ${
                  messageTone === 'success'
                    ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
                    : 'border-red-400/20 bg-red-500/10 text-red-200'
                }`}
              >
                {message}
              </div>
            ) : null}

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-6">
                <SurfacePanel eyebrow="Homeowner" title="Primary Contact">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="Homeowner Name">
                      <input
                        className={INPUT_CLASS_NAME}
                        placeholder="Homeowner name"
                        value={form.homeowner_name}
                        onChange={(event) =>
                          updateField('homeowner_name', event.target.value)
                        }
                      />
                    </FormField>

                    <FormField label="Phone">
                      <input
                        className={INPUT_CLASS_NAME}
                        placeholder="Phone number"
                        value={form.phone}
                        onChange={(event) => updateField('phone', event.target.value)}
                      />
                    </FormField>

                    <FormField label="Address">
                      <input
                        className={INPUT_CLASS_NAME}
                        placeholder="Street address"
                        value={form.address}
                        onChange={(event) => updateField('address', event.target.value)}
                      />
                    </FormField>

                    <FormField label="Email">
                      <input
                        className={INPUT_CLASS_NAME}
                        placeholder="Email address"
                        value={form.email}
                        onChange={(event) => updateField('email', event.target.value)}
                      />
                    </FormField>
                  </div>
                </SurfacePanel>

                <SurfacePanel eyebrow="Claim" title="Insurance + Adjuster">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="Insurance Carrier">
                      <input
                        className={INPUT_CLASS_NAME}
                        placeholder="Insurance carrier"
                        value={form.insurance_carrier}
                        onChange={(event) =>
                          updateField('insurance_carrier', event.target.value)
                        }
                      />
                    </FormField>

                    <FormField label="Claim Number">
                      <input
                        className={INPUT_CLASS_NAME}
                        placeholder="Claim number"
                        value={form.claim_number}
                        onChange={(event) =>
                          updateField('claim_number', event.target.value)
                        }
                      />
                    </FormField>

                    <FormField label="Deductible">
                      <input
                        className={INPUT_CLASS_NAME}
                        placeholder="Deductible"
                        value={form.deductible}
                        onChange={(event) =>
                          updateField('deductible', event.target.value)
                        }
                      />
                    </FormField>

                    <FormField label="Type of Loss">
                      <input
                        className={INPUT_CLASS_NAME}
                        placeholder="Type of loss"
                        value={form.type_of_loss}
                        onChange={(event) =>
                          updateField('type_of_loss', event.target.value)
                        }
                      />
                    </FormField>

                    <FormField label="Adjuster Name">
                      <input
                        className={INPUT_CLASS_NAME}
                        placeholder="Adjuster name"
                        value={form.adjuster_name}
                        onChange={(event) =>
                          updateField('adjuster_name', event.target.value)
                        }
                      />
                    </FormField>

                    <FormField label="Adjuster Phone">
                      <input
                        className={INPUT_CLASS_NAME}
                        placeholder="Adjuster phone"
                        value={form.adjuster_phone}
                        onChange={(event) =>
                          updateField('adjuster_phone', event.target.value)
                        }
                      />
                    </FormField>

                    <FormField label="Adjuster Email">
                      <input
                        className={INPUT_CLASS_NAME}
                        placeholder="Adjuster email"
                        value={form.adjuster_email}
                        onChange={(event) =>
                          updateField('adjuster_email', event.target.value)
                        }
                      />
                    </FormField>

                    <FormField label="Date of Loss">
                      <input
                        type="date"
                        className={INPUT_CLASS_NAME}
                        value={form.date_of_loss}
                        onChange={(event) =>
                          updateField('date_of_loss', event.target.value)
                        }
                      />
                    </FormField>
                  </div>
                </SurfacePanel>

                <SurfacePanel eyebrow="Production" title="Schedule + Financials">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label="Install Date">
                      <input
                        type="date"
                        className={INPUT_CLASS_NAME}
                        value={form.install_date}
                        onChange={(event) =>
                          updateField('install_date', event.target.value)
                        }
                      />
                    </FormField>

                    <FormField label="Contract Signed Date">
                      <input
                        type="date"
                        className={INPUT_CLASS_NAME}
                        value={form.contract_signed_date}
                        onChange={(event) =>
                          updateField('contract_signed_date', event.target.value)
                        }
                      />
                    </FormField>

                    <FormField label="Contract Amount">
                      <input
                        className={INPUT_CLASS_NAME}
                        placeholder="Contract amount"
                        value={form.contract_amount}
                        onChange={(event) =>
                          updateField('contract_amount', event.target.value)
                        }
                      />
                    </FormField>

                    <FormField label="Deposit Collected">
                      <input
                        className={INPUT_CLASS_NAME}
                        placeholder="Deposit collected"
                        value={form.deposit_collected}
                        onChange={(event) =>
                          updateField('deposit_collected', event.target.value)
                        }
                      />
                    </FormField>

                    <FormField label="Remaining Balance">
                      <input
                        className={INPUT_CLASS_NAME}
                        placeholder="Remaining balance"
                        value={form.remaining_balance}
                        onChange={(event) =>
                          updateField('remaining_balance', event.target.value)
                        }
                      />
                    </FormField>

                    <FormField label="Supplemented Amount">
                      <input
                        className={INPUT_CLASS_NAME}
                        placeholder="Supplemented amount"
                        value={form.supplemented_amount}
                        onChange={(event) =>
                          updateField('supplemented_amount', event.target.value)
                        }
                      />
                    </FormField>

                    <FormField label="Shingle Name">
                      <input
                        className={INPUT_CLASS_NAME}
                        placeholder="Shingle name"
                        value={form.shingle_name}
                        onChange={(event) =>
                          updateField('shingle_name', event.target.value)
                        }
                      />
                    </FormField>
                  </div>
                </SurfacePanel>
              </div>

              <div className="space-y-6">
                <SurfacePanel eyebrow="Pipeline" title="Stage + Ownership">
                  <div className="space-y-4">
                    <FormField label="Current Stage">
                      <select
                        className={INPUT_CLASS_NAME}
                        value={form.stage_id}
                        onChange={(event) => updateField('stage_id', event.target.value)}
                      >
                        <option value="">Select stage</option>
                        {visibleStages.map((stage) => (
                          <option key={stage.id} value={String(stage.id ?? '')}>
                            {stage.name}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/38">
                        Assigned Reps
                      </div>

                      <div className="mt-3 space-y-3">
                        {selectedReps.length > 0 ? (
                          selectedReps.map((rep) => (
                            <div
                              key={rep.id}
                              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
                            >
                              <div className="text-sm font-medium text-white">
                                {rep.full_name}
                              </div>

                              <button
                                type="button"
                                onClick={() => removeRep(rep.id)}
                                className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-red-200 transition hover:bg-red-500/20"
                              >
                                Remove
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-dashed border-white/14 p-4 text-sm text-white/55">
                            No reps assigned yet.
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex flex-col gap-3">
                        <select
                          className={INPUT_CLASS_NAME}
                          value={repToAdd}
                          onChange={(event) => setRepToAdd(event.target.value)}
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
                          className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1] disabled:opacity-50"
                        >
                          Add Rep
                        </button>
                      </div>
                    </div>
                  </div>
                </SurfacePanel>

                <SurfacePanel eyebrow="Review" title="Before You Save">
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/68">
                    <p>
                      Stage changes, homeowner updates, and rep assignments all save in one
                      pass.
                    </p>
                    <p>
                      New rep assignments trigger notifications automatically through the job
                      update route.
                    </p>
                  </div>
                </SurfacePanel>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85] disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving ? 'Saving...' : 'Save Job Changes'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  )
}
