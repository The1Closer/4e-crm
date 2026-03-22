'use client'

import { useMemo, useState } from 'react'
import {
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import {
  TASK_KIND_LABEL,
  TASK_STATUS_LABEL,
  toLocalDateTimeInputValue,
  type TaskItem,
  type TaskJobOption,
  type TaskKind,
  type TaskPreset,
  type TaskProfileOption,
} from '@/lib/tasks'

export type TaskEditorValue = {
  presetId: string
  jobId: string
  title: string
  description: string
  kind: TaskKind
  status: 'open' | 'completed'
  scheduledFor: string
  dueAt: string
  appointmentAddress: string
  assigneeIds: string[]
}

function buildInitialValue(params: {
  task: TaskItem | null
  defaultAssignedUserIds: string[]
  viewerId: string
}) {
  if (params.task) {
    return {
      presetId: params.task.preset_id ?? '',
      jobId: params.task.job_id ?? '',
      title: params.task.title,
      description: params.task.description,
      kind: params.task.kind,
      status: params.task.status,
      scheduledFor: toLocalDateTimeInputValue(params.task.scheduled_for),
      dueAt: toLocalDateTimeInputValue(params.task.due_at),
      appointmentAddress: params.task.appointment_address ?? '',
      assigneeIds:
        params.task.assignees.map((assignee) => assignee.id) ||
        params.defaultAssignedUserIds,
    } satisfies TaskEditorValue
  }

  return {
    presetId: '',
    jobId: '',
    title: '',
    description: '',
    kind: 'task',
    status: 'open',
    scheduledFor: '',
    dueAt: '',
    appointmentAddress: '',
    assigneeIds:
      params.defaultAssignedUserIds.length > 0
        ? params.defaultAssignedUserIds
        : [params.viewerId],
  } satisfies TaskEditorValue
}

export default function TaskEditorDialog({
  open,
  task,
  jobId,
  contextLabel,
  presets,
  profiles,
  jobs,
  defaultAssignedUserIds,
  viewerId,
  canManagePresets,
  saving = false,
  onClose,
  onSave,
  onDelete,
  onCreatePreset,
  onDeletePreset,
}: {
  open: boolean
  task: TaskItem | null
  jobId?: string | null
  contextLabel: string
  presets: TaskPreset[]
  profiles: TaskProfileOption[]
  jobs: TaskJobOption[]
  defaultAssignedUserIds: string[]
  viewerId: string
  canManagePresets: boolean
  saving?: boolean
  onClose: () => void
  onSave: (value: TaskEditorValue) => Promise<void> | void
  onDelete?: (() => Promise<void> | void) | null
  onCreatePreset?: ((value: {
    title: string
    description: string
    kind: TaskKind
  }) => Promise<void> | void) | null
  onDeletePreset?: ((presetId: string) => Promise<void> | void) | null
}) {
  const [value, setValue] = useState<TaskEditorValue>(() =>
    buildInitialValue({
      task,
      defaultAssignedUserIds,
      viewerId,
    })
  )
  const [personToAdd, setPersonToAdd] = useState('')
  const [localError, setLocalError] = useState('')

  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === value.presetId) ?? null,
    [presets, value.presetId]
  )
  const selectedJob = useMemo(
    () =>
      jobs.find((jobOption) => jobOption.id === (jobId ?? value.jobId)) ?? null,
    [jobId, jobs, value.jobId]
  )
  const effectiveJobId = jobId ?? value.jobId
  const allowedProfileIds = useMemo(() => {
    if (canManagePresets) {
      return new Set(profiles.map((profile) => profile.id))
    }

    if (effectiveJobId && selectedJob) {
      return new Set([viewerId, ...selectedJob.assigned_profile_ids])
    }

    return new Set([
      viewerId,
      ...value.assigneeIds,
    ])
  }, [
    canManagePresets,
    effectiveJobId,
    profiles,
    selectedJob,
    value.assigneeIds,
    viewerId,
  ])
  const availableProfiles = useMemo(
    () =>
      profiles.filter(
        (profile) =>
          allowedProfileIds.has(profile.id) &&
          !value.assigneeIds.includes(profile.id)
      ),
    [allowedProfileIds, profiles, value.assigneeIds]
  )

  if (!open) {
    return null
  }

  function updateValue(patch: Partial<TaskEditorValue>) {
    setValue((current) => ({ ...current, ...patch }))
  }

  function handlePresetChange(presetId: string) {
    const preset = presets.find((item) => item.id === presetId) ?? null

    setValue((current) => ({
      ...current,
      presetId,
      title: preset?.title ?? current.title,
      description: preset?.description ?? current.description,
      kind: preset?.kind ?? current.kind,
    }))
  }

  function handleJobChange(nextJobId: string) {
    const nextJob = jobs.find((jobOption) => jobOption.id === nextJobId) ?? null

    setValue((current) => ({
      ...current,
      jobId: nextJobId,
      appointmentAddress:
        current.kind === 'appointment' && !nextJob?.address
          ? current.appointmentAddress
          : '',
      assigneeIds:
        nextJob?.assigned_profile_ids.length
          ? nextJob.assigned_profile_ids
          : current.assigneeIds.length > 0
            ? current.assigneeIds
            : [viewerId],
    }))
  }

  function addAssignee() {
    if (!personToAdd || value.assigneeIds.includes(personToAdd)) {
      return
    }

    updateValue({
      assigneeIds: [...value.assigneeIds, personToAdd],
    })
    setPersonToAdd('')
  }

  function removeAssignee(profileId: string) {
    if (value.assigneeIds.length <= 1) {
      return
    }

    updateValue({
      assigneeIds: value.assigneeIds.filter((id) => id !== profileId),
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!value.title.trim()) {
      setLocalError('Task title is required.')
      return
    }

    if (!value.scheduledFor && !value.dueAt) {
      setLocalError('Add a scheduled date or due date.')
      return
    }

    if (value.assigneeIds.length === 0) {
      setLocalError('Assign this to at least one person.')
      return
    }

    setLocalError('')
    await onSave({
      ...value,
      jobId: effectiveJobId,
    })
  }

  async function handleSavePreset() {
    if (!onCreatePreset) return

    if (!value.title.trim()) {
      setLocalError('Add a title before saving a preset.')
      return
    }

    setLocalError('')
    await onCreatePreset({
      title: value.title.trim(),
      description: value.description.trim(),
      kind: value.kind,
    })
  }

  async function handleDeletePreset() {
    if (!selectedPreset || !onDeletePreset) return

    const confirmed = window.confirm(`Delete preset ${selectedPreset.title}?`)

    if (!confirmed) {
      return
    }

    await onDeletePreset(selectedPreset.id)
    setValue((current) => ({ ...current, presetId: '' }))
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/72 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <form
        onSubmit={handleSubmit}
        className="relative z-[1] w-full max-w-3xl rounded-[2rem] border border-white/10 bg-[#090909] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.55)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#d6b37a]">
              {task ? 'Edit Task' : 'New Task'}
            </div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
              {task ? task.title : 'Create a task or appointment'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/58">
              {jobId
                ? `Connected to ${contextLabel}. Assigned job users are preselected, and you can add more if needed.`
                : `Create a general task for ${contextLabel}, or link it to one of your visible jobs.`}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[1.1rem] border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] hover:text-white"
            aria-label="Close task editor"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {localError ? (
          <div className="mt-5 rounded-[1.4rem] border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {localError}
          </div>
        ) : null}

        <div className="mt-6 space-y-5">
          <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
            <label className="block">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                Standard Preset
              </div>
              <select
                value={value.presetId}
                onChange={(event) => handlePresetChange(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
              >
                <option value="">Start from scratch</option>
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.title} ({TASK_KIND_LABEL[preset.kind]})
                  </option>
                ))}
              </select>
            </label>

            {canManagePresets ? (
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    void handleSavePreset()
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
                >
                  <Plus className="h-4 w-4 text-[#d6b37a]" />
                  Save Preset
                </button>
              </div>
            ) : null}

            {canManagePresets && selectedPreset && onDeletePreset ? (
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    void handleDeletePreset()
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/20"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Preset
                </button>
              </div>
            ) : null}
          </div>

          {selectedPreset ? (
            <div className="rounded-[1.4rem] border border-[#d6b37a]/18 bg-[#d6b37a]/8 px-4 py-3 text-sm text-white/74">
              Loaded from <span className="font-semibold text-white">{selectedPreset.title}</span>.
              You can still edit the fields before saving.
            </div>
          ) : null}

          {!jobId ? (
            <label className="block">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                Linked Job
              </div>
              <select
                value={value.jobId}
                onChange={(event) => handleJobChange(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
              >
                <option value="">No linked job</option>
                {jobs.map((jobOption) => (
                  <option key={jobOption.id} value={jobOption.id}>
                    {jobOption.homeowner_name}
                    {jobOption.address ? ` - ${jobOption.address}` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <label className="block">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                Title
              </div>
              <input
                value={value.title}
                onChange={(event) => updateValue({ title: event.target.value })}
                placeholder="Insurance follow-up call"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d6b37a]/35"
              />
            </label>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                Type
              </div>
              <div className="inline-flex rounded-2xl border border-white/10 bg-black/20 p-1">
                {(['task', 'appointment'] as const).map((kind) => {
                  const active = value.kind === kind
                  const Icon = kind === 'appointment' ? CalendarRange : ClipboardList

                  return (
                    <button
                      key={kind}
                      type="button"
                      onClick={() =>
                        updateValue({
                          kind,
                          appointmentAddress:
                            kind === 'appointment' ? value.appointmentAddress : '',
                        })
                      }
                      className={`inline-flex items-center gap-2 rounded-[1rem] px-4 py-2 text-sm font-semibold transition ${
                        active
                          ? 'bg-[#d6b37a] text-black'
                          : 'text-white/65 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {TASK_KIND_LABEL[kind]}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <label className="block">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
              Description
            </div>
            <textarea
              value={value.description}
              onChange={(event) => updateValue({ description: event.target.value })}
              placeholder="Add any extra context, handoff details, or prep notes."
              rows={4}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d6b37a]/35"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                When
              </div>
              <input
                type="datetime-local"
                value={value.scheduledFor}
                onChange={(event) => updateValue({ scheduledFor: event.target.value })}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
              />
            </label>

            <label className="block">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                Due Date
              </div>
              <input
                type="datetime-local"
                value={value.dueAt}
                onChange={(event) => updateValue({ dueAt: event.target.value })}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
              />
            </label>
          </div>

          {value.kind === 'appointment' && !effectiveJobId ? (
            <label className="block">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                <MapPin className="h-3.5 w-3.5 text-[#d6b37a]" />
                Address
              </div>
              <input
                value={value.appointmentAddress}
                onChange={(event) => updateValue({ appointmentAddress: event.target.value })}
                placeholder="Appointment address"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d6b37a]/35"
              />
            </label>
          ) : selectedJob?.address ? (
            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/70">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">
                Address
              </div>
              <div className="mt-2">{selectedJob.address}</div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                Assigned To
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {value.assigneeIds.map((profileId) => {
                  const profile = profiles.find((item) => item.id === profileId)

                  return (
                    <button
                      key={profileId}
                      type="button"
                      onClick={() => removeAssignee(profileId)}
                      disabled={value.assigneeIds.length <= 1}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-sm text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-65"
                    >
                      <span>{profile?.full_name ?? 'Unknown user'}</span>
                      <X className="h-3.5 w-3.5 text-white/55" />
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex min-w-0 flex-col justify-end gap-2">
              <select
                value={personToAdd}
                onChange={(event) => setPersonToAdd(event.target.value)}
                className="min-w-[220px] rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[#d6b37a]/35"
              >
                <option value="">Add another person</option>
                {availableProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={addAssignee}
                disabled={!personToAdd}
                className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1] disabled:opacity-50"
              >
                Add Person
              </button>
            </div>
          </div>

          {task ? (
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
                Status
              </div>
              <div className="mt-3 inline-flex rounded-2xl border border-white/10 bg-black/20 p-1">
                {(['open', 'completed'] as const).map((status) => {
                  const active = value.status === status
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => updateValue({ status })}
                      className={`rounded-[1rem] px-4 py-2 text-sm font-semibold transition ${
                        active
                          ? 'bg-emerald-400/90 text-black'
                          : 'text-white/65 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      {TASK_STATUS_LABEL[status]}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-white/42">
            {effectiveJobId ? 'Linked to a job' : 'General item'} {task ? 'updates in place' : 'will be created'}.
          </div>

          <div className="flex flex-wrap gap-3">
            {task && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  void onDelete()
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/20"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#d6b37a] px-5 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(214,179,122,0.25)] transition hover:bg-[#e2bf85] disabled:opacity-60"
            >
              {value.status === 'completed' ? <CheckCircle2 className="h-4 w-4" /> : null}
              {saving ? 'Saving...' : task ? 'Save Task' : 'Create Task'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
