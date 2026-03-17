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

const KNOWN_POST_CONTRACTED_LABELS = new Set([
  'contracted',
  'pre-production prep',
  'pre production prep',
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

export function getManagementStageThreshold(stages: PipelineStageRecord[]) {
  const contractedStage = stages.find((stage) => isContractedLabel(stage.name))

  if (!contractedStage) return null

  if (contractedStage.sort_order !== null && contractedStage.sort_order !== undefined) {
    return contractedStage.sort_order
  }

  return stages.findIndex((stage) => stage.id === contractedStage.id)
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

  return stages.filter((stage) => !isManagementLockedStage(stage, stages))
}

export function getStageColor(stageName: string | null | undefined) {
  const normalized = normalizeStageName(stageName)

  if (!normalized) return '#94a3b8'
  if (normalized.includes('new') || normalized.includes('lead')) return '#38bdf8'
  if (normalized.includes('inspection') || normalized.includes('contingency')) {
    return '#f59e0b'
  }
  if (normalized.includes('contract')) return '#22c55e'
  if (
    normalized.includes('pre-production') ||
    normalized.includes('pre production') ||
    normalized.includes('production')
  ) {
    return '#8b5cf6'
  }
  if (normalized.includes('install')) return '#f97316'
  if (normalized.includes('complete') || normalized.includes('paid')) return '#14b8a6'
  if (normalized.includes('lost') || normalized.includes('cancel')) return '#ef4444'

  return '#d6b37a'
}
