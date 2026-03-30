'use client'

import { useMemo } from 'react'
import { UserRound, X } from 'lucide-react'
import AddressAutocompleteInput from '@/components/forms/AddressAutocompleteInput'
import {
  type JobEditorValues,
  type JobRepOption,
  type JobStageOption,
} from '@/components/jobs/job-types'

export default function JobEditorFields({
  values,
  stages,
  reps,
  disabled = false,
  onChange,
}: {
  values: JobEditorValues
  stages: JobStageOption[]
  reps: JobRepOption[]
  disabled?: boolean
  onChange: (patch: Partial<JobEditorValues>) => void
}) {
  const selectedReps = useMemo(
    () => reps.filter((rep) => values.rep_ids.includes(rep.id)),
    [reps, values.rep_ids]
  )

  const availableReps = useMemo(
    () => reps.filter((rep) => !values.rep_ids.includes(rep.id)),
    [reps, values.rep_ids]
  )

  function addRep(repId: string) {
    if (!repId || values.rep_ids.includes(repId)) return

    onChange({
      rep_ids: [...values.rep_ids, repId],
    })
  }

  function removeRep(repId: string) {
    onChange({
      rep_ids: values.rep_ids.filter((value) => value !== repId),
    })
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d6b37a]">
            Homeowner
          </div>
          <div className="mt-2 text-sm text-white/58">
            Core contact details for the job file.
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Homeowner Name"
            value={values.homeowner_name}
            disabled={disabled}
            placeholder="Homeowner name"
            onChange={(value) => onChange({ homeowner_name: value })}
          />
          <Field
            label="Phone"
            value={values.phone}
            disabled={disabled}
            placeholder="Phone number"
            onChange={(value) => onChange({ phone: value })}
          />
          <label className="block">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              Address
            </div>
            <AddressAutocompleteInput
              value={values.address}
              disabled={disabled}
              placeholder="Property address"
              onChange={(value) => onChange({ address: value })}
            />
          </label>
          <Field
            label="Email"
            value={values.email}
            disabled={disabled}
            placeholder="Email address"
            onChange={(value) => onChange({ email: value })}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d6b37a]">
            Job Snapshot
          </div>
          <div className="mt-2 text-sm text-white/58">
            Enough information to create or quickly update the file without leaving the page.
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            label="Stage"
            value={values.stage_id}
            disabled={disabled}
            onChange={(value) => onChange({ stage_id: value })}
            options={[
              { value: '', label: 'No stage selected' },
              ...stages.map((stage) => ({
                value: String(stage.id),
                label: stage.name,
              })),
            ]}
          />
          <Field
            label="Insurance Carrier"
            value={values.insurance_carrier}
            disabled={disabled}
            placeholder="Carrier name"
            onChange={(value) => onChange({ insurance_carrier: value })}
          />
          <Field
            label="Claim Number"
            value={values.claim_number}
            disabled={disabled}
            placeholder="Claim number"
            onChange={(value) => onChange({ claim_number: value })}
          />
          <Field
            label="Install Date"
            value={values.install_date}
            disabled={disabled}
            type="date"
            onChange={(value) => onChange({ install_date: value })}
          />
          <Field
            label="Contract Amount"
            value={values.contract_amount}
            disabled={disabled}
            placeholder="0"
            inputMode="decimal"
            onChange={(value) => onChange({ contract_amount: value })}
          />
          <Field
            label="Supplemented Amount"
            value={values.supplemented_amount}
            disabled={disabled}
            placeholder="0"
            inputMode="decimal"
            onChange={(value) => onChange({ supplemented_amount: value })}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d6b37a]">
            Assigned Team
          </div>
          <div className="mt-2 text-sm text-white/58">
            Add or remove assignees without opening the full detail page.
          </div>
        </div>

        {selectedReps.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {selectedReps.map((rep) => (
              <div
                key={rep.id}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white"
              >
                <UserRound className="h-4 w-4 text-[#d6b37a]" />
                {rep.full_name}
                <button
                  type="button"
                  onClick={() => removeRep(rep.id)}
                  disabled={disabled}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-60"
                  aria-label={`Remove ${rep.full_name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[1.4rem] border border-dashed border-white/14 p-4 text-sm text-white/55">
            No one assigned yet.
          </div>
        )}

        <div className="flex-1">
          <SelectField
            label="Add Assignee"
            value=""
            disabled={disabled || availableReps.length === 0}
            onChange={addRep}
            options={[
              {
                value: '',
                label:
                  availableReps.length === 0
                    ? 'No more assignees available'
                    : 'Select an assignee',
              },
              ...availableReps.map((rep) => ({
                value: rep.id,
                label: rep.full_name,
              })),
            ]}
          />
        </div>
      </section>
    </div>
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

function SelectField({
  label,
  value,
  disabled = false,
  options,
  onChange,
}: {
  label: string
  value: string
  disabled?: boolean
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
        {label}
      </div>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#d6b37a]/35 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
