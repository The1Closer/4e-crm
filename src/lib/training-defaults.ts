export const TRAINING_RESOURCE_CATEGORIES = [
  'documents',
  'videos',
  'presentations',
] as const

export type TrainingResourceCategory =
  (typeof TRAINING_RESOURCE_CATEGORIES)[number]

export type TrainingResourceItem = {
  id: string
  title: string
  detail: string
  url: string
}

export type TrainingResourceManifest = Record<
  TrainingResourceCategory,
  TrainingResourceItem[]
>

export const DEFAULT_TRAINING_RESOURCES: TrainingResourceManifest = {
  documents: [
    {
      id: 'sales-playbook',
      title: 'Sales Playbook',
      detail:
        'Scripts, objection handling, and field expectations for new and current reps.',
      url: '',
    },
    {
      id: 'inspection-checklist',
      title: 'Inspection Checklist',
      detail:
        'Standard roof inspection process and homeowner conversation flow.',
      url: '',
    },
    {
      id: 'contract-process-guide',
      title: 'Contract Process Guide',
      detail:
        'How to move from contingency through signature without missing handoff steps.',
      url: '',
    },
  ],
  videos: [
    {
      id: 'door-approach-walkthrough',
      title: 'Door Approach Walkthrough',
      detail:
        'Talk track structure, first impression cues, and pacing for live reps.',
      url: '',
    },
    {
      id: 'insurance-conversation-basics',
      title: 'Insurance Conversation Basics',
      detail:
        'How to explain the process clearly without creating confusion for the homeowner.',
      url: '',
    },
    {
      id: 'job-handoff-overview',
      title: 'Job Handoff Overview',
      detail:
        'What needs to be clean in CRM before a file leaves the sales side.',
      url: '',
    },
  ],
  presentations: [
    {
      id: 'new-rep-ramp-deck',
      title: 'New Rep Ramp Deck',
      detail:
        'Core expectations, daily standards, systems, and coaching checkpoints.',
      url: '',
    },
    {
      id: 'leadership-training-deck',
      title: 'Leadership Training Deck',
      detail:
        'Manager cadence, team standards, accountability, and rep development.',
      url: '',
    },
    {
      id: 'production-handoff-deck',
      title: 'Production Handoff Deck',
      detail:
        'Visual walkthrough of the transition from sold to scheduled to installed.',
      url: '',
    },
  ],
}

function cloneTrainingItems(items: TrainingResourceItem[]) {
  return items.map((item) => ({ ...item }))
}

export function cloneTrainingResources(
  resources: TrainingResourceManifest = DEFAULT_TRAINING_RESOURCES
): TrainingResourceManifest {
  return {
    documents: cloneTrainingItems(resources.documents),
    videos: cloneTrainingItems(resources.videos),
    presentations: cloneTrainingItems(resources.presentations),
  }
}

function sanitizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function sanitizeCategory(
  value: unknown,
  category: TrainingResourceCategory
): TrainingResourceItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item, index) => {
      const nextItem =
        item && typeof item === 'object'
          ? (item as Partial<TrainingResourceItem>)
          : {}

      const title = sanitizeText(nextItem.title)
      const detail = sanitizeText(nextItem.detail)
      const url = sanitizeText(nextItem.url)

      if (!title && !detail && !url) {
        return null
      }

      return {
        id:
          sanitizeText(nextItem.id) ||
          `${category}-${Date.now()}-${String(index + 1)}`,
        title,
        detail,
        url,
      }
    })
    .filter((item): item is TrainingResourceItem => Boolean(item))
}

export function sanitizeTrainingResources(
  value: unknown
): TrainingResourceManifest {
  const source =
    value && typeof value === 'object'
      ? (value as Partial<Record<TrainingResourceCategory, unknown>>)
      : {}

  return {
    documents: sanitizeCategory(source.documents, 'documents'),
    videos: sanitizeCategory(source.videos, 'videos'),
    presentations: sanitizeCategory(source.presentations, 'presentations'),
  }
}
