export type JobListRow = {
  id: string
  homeownerName: string
  phone: string
  email: string
  address: string
  stageId: number | null
  stageName: string
  repNames: string[]
  repIds: string[]
  insuranceCarrier: string
  claimNumber: string
  installDate: string | null
  stageEnteredAt: string | null
  daysInStatus: number
  contractAmount: number | null
  depositCollected: number | null
  remainingBalance: number | null
  supplementedAmount: number | null
}

export type JobStageOption = {
  id: number
  name: string
  sort_order?: number | null
}

export type JobRepOption = {
  id: string
  full_name: string
}

export type JobEditorValues = {
  homeowner_name: string
  phone: string
  address: string
  email: string
  stage_id: string
  insurance_carrier: string
  claim_number: string
  install_date: string
  rep_ids: string[]
}

export function buildJobEditorValues(job?: JobListRow | null): JobEditorValues {
  return {
    homeowner_name: job?.homeownerName ?? '',
    phone: job?.phone === '-' ? '' : job?.phone ?? '',
    address: job?.address === '-' ? '' : job?.address ?? '',
    email: job?.email === '-' ? '' : job?.email ?? '',
    stage_id: job?.stageId ? String(job.stageId) : '',
    insurance_carrier: job?.insuranceCarrier === '-' ? '' : job?.insuranceCarrier ?? '',
    claim_number: job?.claimNumber === '-' ? '' : job?.claimNumber ?? '',
    install_date: job?.installDate ?? '',
    rep_ids: job?.repIds ?? [],
  }
}
