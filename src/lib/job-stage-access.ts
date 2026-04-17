export type PipelineStageRecord = {
  id?: number | null
  name?: string | null
  sort_order?: number | null
}

export type PipelineStageInput =
  | PipelineStageRecord
  | PipelineStageRecord[]
  | null

const CONTRACTED_LABELS = [
  'contracted',
  'contract signed',
  'signed contract',
  'contract executed',
]

const PRE_PRODUCTION_PREP_LABELS = new Set(
  [
    'pre-production prep',
    'pre production prep',
    'contracted/pre-production prep',
    'contracted / pre-production prep',
  ].map((label) =>
    normalizeStageName(label)
  )
)

const INSTALL_SCHEDULED_LABELS = new Set(
  ['install scheduled'].map((label) => normalizeStageName(label))
)

const KNOWN_POST_CONTRACTED_LABELS = new Set([
  'contracted',
  'contracted awaiting deposit',
  'contracted awaiting manager approval',
  'deposit collected awaiting manager approval',
  'pre-production prep',
  'pre production prep',
  'contracted/pre-production prep',
  'contracted / pre-production prep',
  'production',
  'production ready',
  'scheduled',
  'install scheduled',
  'install',
  'installed',
  'final qc',
  'complete',
  'completed',
  'paid',
])

export function normalizeStageName(name: string | null | undefined) {
  return (name ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function isDeadStageName(name: string | null | undefined) {
  return normalizeStageName(name) === 'dead'
}

export function normalizeStage(stage: PipelineStageInput): PipelineStageRecord | null {
  if (!stage) return null
  return Array.isArray(stage) ? stage[0] ?? null : stage
}

function isContractedLabel(name: string | null | undefined) {
  const normalized = normalizeStageName(name)
  return CONTRACTED_LABELS.some(
    (label) => normalized === label || normalized.includes(label)
  )
}

function hasExactStageLabel(
  name: string | null | undefined,
  labels: Set<string>
) {
  return labels.has(normalizeStageName(name))
}

function findStageByLabels(
  stages: PipelineStageRecord[],
  labels: Set<string>
) {
  return stages.find((stage) => hasExactStageLabel(stage.name, labels)) ?? null
}

export function isPreProductionPrepStage(stageInput: PipelineStageInput) {
  const stage = normalizeStage(stageInput)
  return hasExactStageLabel(stage?.name, PRE_PRODUCTION_PREP_LABELS)
}

export function isInstallScheduledStage(stageInput: PipelineStageInput) {
  const stage = normalizeStage(stageInput)
  return hasExactStageLabel(stage?.name, INSTALL_SCHEDULED_LABELS)
}

export function isInstallWorkflowStage(stageInput: PipelineStageInput) {
  return (
    isPreProductionPrepStage(stageInput) || isInstallScheduledStage(stageInput)
  )
}

export function findPreProductionPrepStage(stages: PipelineStageRecord[]) {
  return findStageByLabels(stages, PRE_PRODUCTION_PREP_LABELS)
}

export function findInstallScheduledStage(stages: PipelineStageRecord[]) {
  return findStageByLabels(stages, INSTALL_SCHEDULED_LABELS)
}

export function getManagementStageThreshold(stages: PipelineStageRecord[]) {
  const preProductionStage = findStageByLabels(stages, PRE_PRODUCTION_PREP_LABELS)
  const thresholdStage =
    preProductionStage ?? stages.find((stage) => isContractedLabel(stage.name))

  if (!thresholdStage) return null

  if (
    thresholdStage.sort_order !== null &&
    thresholdStage.sort_order !== undefined
  ) {
    return thresholdStage.sort_order
  }

  return stages.findIndex((stage) => stage.id === thresholdStage.id)
}

export function isManagementLockedStage(
  stageInput: PipelineStageInput,
  stages: PipelineStageRecord[] = []
) {
  const stage = normalizeStage(stageInput)

  if (!stage) return false

  const threshold = getManagementStageThreshold(stages)

  if (threshold !== null) {
    if (stage.sort_order !== null && stage.sort_order !== undefined) {
      return stage.sort_order >= threshold
    }

    const currentIndex = stages.findIndex((candidate) => {
      if (stage.id && candidate.id) return candidate.id === stage.id
      return normalizeStageName(candidate.name) === normalizeStageName(stage.name)
    })

    return currentIndex >= threshold
  }

  const normalized = normalizeStageName(stage.name)
  return (
    isContractedLabel(normalized) || KNOWN_POST_CONTRACTED_LABELS.has(normalized)
  )
}

export function getVisibleStagesForUser(
  stages: PipelineStageRecord[],
  canManageLockedStages: boolean
) {
  if (canManageLockedStages) return stages

  return stages.filter(
    (stage) =>
      !isManagementLockedStage(stage, stages) || isInstallWorkflowStage(stage)
  )
}

export function getStageColor(stageName: string | null | undefined) {
  const normalized = normalizeStageName(stageName)

  if (!normalized) return '#94a3b8'

  const exactColorByStageName: Record<string, string> = {
    lead: '#38bdf8',
    'inspection scheduled': '#f59e0b',
    contingency: '#f97316',
    'adjuster meeting': '#fb7185',
    'partial approval': '#a78bfa',
    approved: '#22c55e',
    'contracted awaiting deposit': '#10b981',
    'contracted awaiting manager approval': '#2dd4bf',
    'deposit collected awaiting manager approval': '#14b8a6',
    'pre-production prep': '#8b5cf6',
    'pre production prep': '#8b5cf6',
    'contracted/pre-production prep': '#7c3aed',
    'contracted / pre-production prep': '#7c3aed',
    'install scheduled': '#3b82f6',
    'install complete': '#06b6d4',
    'coc sent': '#6366f1',
    'pending pay': '#f43f5e',
    'collections (lien)': '#dc2626',
    'paid in full': '#16a34a',
    paid: '#15803d',
    dead: '#64748b',
  }

  const exactColor = exactColorByStageName[normalized]
  if (exactColor) return exactColor

  if (normalized.includes('lost') || normalized.includes('cancel')) {
    return '#b91c1c'
  }

  // Deterministic fallback so unknown stages still get a stable, unique color.
  let hash = 0
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0
  }
  const hue = hash % 360
  return `hsl(${hue} 72% 56%)`
}
