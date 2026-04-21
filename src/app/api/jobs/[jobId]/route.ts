import { NextRequest, NextResponse } from 'next/server'
import { slugifyFileName } from '@/lib/file-utils'
import {
  isMissingJobPaymentsTableError,
} from '@/lib/job-payments-server'
import {
  findInstallScheduledStage,
  isInstallScheduledStage,
  isInstallWorkflowStage,
  isManagementLockedStage,
  isPreProductionPrepStage,
} from '@/lib/job-stage-access'
import {
  getRouteRequester,
  isManagerRole,
  requireExistingJob,
  requireJobAccess,
  requireManager,
} from '@/lib/server-auth'
import { loadMaterialOrders } from '@/lib/material-orders-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type RouteContext = {
  params: Promise<{
    jobId: string
  }>
}

type JobMutationBody = {
  homeowner_name?: string
  phone?: string
  address?: string
  email?: string
  stage_id?: string | number | null
  insurance_carrier?: string
  deductible?: string | number | null
  claim_number?: string
  adjuster_name?: string
  adjuster_phone?: string
  adjuster_email?: string
  date_of_loss?: string | null
  type_of_loss?: string
  install_date?: string | null
  deposit_collected?: string | number | null
  remaining_balance?: string | number | null
  shingle_name?: string
  rep_ids?: string[]
}

type StageRow = {
  id: number
  name: string
  sort_order: number | null
}

type JobFileRow = {
  file_path: string | null
}

type PaymentProofRow = {
  proof_file_path: string | null
}

type ExistingDocumentNameRow = {
  file_name: string | null
}

type NoteRow = {
  id: string
  body: string
  created_at: string
  updated_at?: string | null
  created_by?: string | null
  profile_id?: string | null
  user_id?: string | null
}

const COLTAN_POWELL_FULL_NAME = 'Coltan Powell'

function formatNotificationDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return value
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeDate(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeStageId(value: unknown) {
  if (value === null || value === undefined || value === '') return null

  const parsed = Number(value)
  if (!Number.isInteger(parsed)) {
    throw new Error('Stage selection is invalid.')
  }

  return parsed
}

function normalizeNumber(value: unknown, fallbackToZero = false) {
  if (value === null || value === undefined || value === '') {
    return fallbackToZero ? 0 : null
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error('One of the numeric values is invalid.')
  }

  return parsed
}

function normalizeRepIds(value: unknown) {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value
        .filter(
          (item): item is string =>
            typeof item === 'string' && item.trim().length > 0
        )
        .map((item) => item.trim())
    ),
  ]
}

function getNoteCreatorId(note: NoteRow) {
  if (typeof note.created_by === 'string' && note.created_by.trim()) {
    return note.created_by
  }

  if (typeof note.profile_id === 'string' && note.profile_id.trim()) {
    return note.profile_id
  }

  if (typeof note.user_id === 'string' && note.user_id.trim()) {
    return note.user_id
  }

  return null
}

async function loadStageRows() {
  const { data, error } = await supabaseAdmin
    .from('pipeline_stages')
    .select('id, name, sort_order')
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as StageRow[]
}

async function notifyAssignedReps(params: {
  jobId: string
  actorUserId: string
  repIds: string[]
  homeownerName?: string | null
}) {
  if (params.repIds.length === 0) return

  const homeownerName = params.homeownerName?.trim()
  const rows = params.repIds
    .filter((repId) => repId !== params.actorUserId)
    .map((repId) => ({
      user_id: repId,
      actor_user_id: params.actorUserId,
      type: 'assignment',
      title: 'You were assigned to a job',
      message: homeownerName
        ? `You were assigned to ${homeownerName}'s job in the CRM.`
        : 'You were assigned to a job in the CRM.',
      link: `/jobs/${params.jobId}`,
      job_id: params.jobId,
      note_id: null,
      metadata: {},
    }))

  if (rows.length === 0) return

  await supabaseAdmin.from('notifications').insert(rows)
}

async function notifyStageChange(params: {
  jobId: string
  actorUserId: string
  repIds: string[]
  stage: StageRow
  homeownerName?: string | null
}) {
  const homeownerName = params.homeownerName?.trim()
  const rows = params.repIds
    .filter((repId) => repId !== params.actorUserId)
    .map((repId) => ({
      user_id: repId,
      actor_user_id: params.actorUserId,
      type: 'stage_change',
      title: 'Job stage changed',
      message: homeownerName
        ? `${homeownerName}'s job was moved to ${params.stage.name}.`
        : `A job was moved to ${params.stage.name}.`,
      link: `/jobs/${params.jobId}`,
      job_id: params.jobId,
      note_id: null,
      metadata: {
        stage_id: params.stage.id,
        stage_name: params.stage.name,
      },
    }))

  if (rows.length === 0) return

  await supabaseAdmin.from('notifications').insert(rows)
}

async function notifyInstallScheduled(params: {
  jobId: string
  actorUserId: string
  repIds: string[]
  installDate: string
  homeownerName?: string | null
}) {
  if (params.repIds.length === 0) return

  const formattedDate = formatNotificationDate(params.installDate)
  const homeownerName = params.homeownerName?.trim()
  const rows = params.repIds
    .filter((repId) => repId !== params.actorUserId)
    .map((repId) => ({
      user_id: repId,
      actor_user_id: params.actorUserId,
      type: 'stage_change',
      title: 'Install scheduled',
      message: homeownerName
        ? `${homeownerName}'s install is scheduled for ${formattedDate}.`
        : `Install scheduled for ${formattedDate}.`,
      link: `/jobs/${params.jobId}`,
      job_id: params.jobId,
      note_id: null,
      metadata: {
        event: 'install_scheduled',
        install_date: params.installDate,
      },
    }))

  if (rows.length === 0) return

  await supabaseAdmin.from('notifications').insert(rows)
}

function normalizeStageName(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function isApprovedStageName(value: string | null | undefined) {
  return normalizeStageName(value) === 'approved'
}

function isInstallCompleteStageName(value: string | null | undefined) {
  const normalized = normalizeStageName(value)
  return normalized === 'install complete' || normalized.includes('install complete')
}

function isInstallScheduledStageName(value: string | null | undefined) {
  const normalized = normalizeStageName(value)
  return normalized === 'install scheduled' || normalized.includes('install scheduled')
}

async function findProfileIdByFullName(fullName: string) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .ilike('full_name', `%${fullName}%`)
    .limit(1)

  if (error) {
    throw new Error(error.message)
  }

  const row = Array.isArray(data) ? data[0] : null
  return row?.id ?? null
}

async function notifyColtanStageWorkflow(params: {
  jobId: string
  actorUserId: string
  stage: StageRow
  homeownerName?: string | null
}) {
  const coltanId = await findProfileIdByFullName(COLTAN_POWELL_FULL_NAME)

  if (!coltanId) {
    return
  }

  let title = ''
  let message = ''
  const homeownerName = params.homeownerName?.trim()

  if (isApprovedStageName(params.stage.name)) {
    title = 'Review for Supplements'
    message = homeownerName
      ? `${homeownerName}'s job moved to Approved. Start supplementing.`
      : 'A job moved to Approved. Start supplementing.'
  } else if (isInstallScheduledStageName(params.stage.name)) {
    title = 'Install Scheduled'
    message = homeownerName
      ? `${homeownerName}'s install is scheduled.`
      : 'Install Scheduled'
  } else if (isInstallCompleteStageName(params.stage.name)) {
    title = 'Send COC'
    message = homeownerName
      ? `${homeownerName}'s job moved to Install Complete. Send COC.`
      : 'A job moved to Install Complete. Send COC.'
  } else {
    return
  }

  const { error } = await supabaseAdmin.from('notifications').insert({
    user_id: coltanId,
    actor_user_id: params.actorUserId,
    type: 'stage_change',
    title,
    message,
    link: `/jobs/${params.jobId}`,
    job_id: params.jobId,
    note_id: null,
    metadata: {
      stage_id: params.stage.id,
      stage_name: params.stage.name,
      workflow_alert: true,
      target_user_name: COLTAN_POWELL_FULL_NAME,
    },
  })

  if (error) {
    throw new Error(error.message)
  }
}

async function removeStoragePaths(
  bucketName: 'documents' | 'job-files',
  filePaths: (string | null | undefined)[]
) {
  const uniquePaths = [
    ...new Set(
      filePaths.filter(
        (path): path is string => typeof path === 'string' && path.trim().length > 0
      )
    ),
  ]

  if (uniquePaths.length === 0) {
    return
  }

  const { error } = await supabaseAdmin.storage.from(bucketName).remove(uniquePaths)

  if (error) {
    console.error(`Could not remove ${bucketName} files for deleted job.`, error)
  }
}

function isPaidInFullStage(name: string | null | undefined) {
  const normalized = (name ?? '').trim().toLowerCase()
  return normalized === 'paid' || normalized.includes('paid in full')
}

function formatMaterialOrderValue(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : '-'
}

function formatMaterialOrderArchiveText(order: Awaited<ReturnType<typeof loadMaterialOrders>>[number]) {
  const lines: string[] = []

  lines.push(`Material Order Archive`)
  lines.push(`Order Number: ${order.order_number}`)
  lines.push(`Status: ${order.status}`)
  lines.push(`Archived At (UTC): ${new Date().toISOString()}`)
  lines.push('')
  lines.push('Vendor')
  lines.push(`Name: ${formatMaterialOrderValue(order.vendor_name)}`)
  lines.push(`Contact: ${formatMaterialOrderValue(order.vendor_contact_name)}`)
  lines.push(`Phone: ${formatMaterialOrderValue(order.vendor_phone)}`)
  lines.push(`Email: ${formatMaterialOrderValue(order.vendor_email)}`)
  lines.push('')
  lines.push('Shipping')
  lines.push(`Ship To Name: ${formatMaterialOrderValue(order.ship_to_name)}`)
  lines.push(`Ship To Address: ${formatMaterialOrderValue(order.ship_to_address)}`)
  lines.push(`Needed By: ${formatMaterialOrderValue(order.needed_by)}`)
  lines.push(`Ordered At: ${formatMaterialOrderValue(order.ordered_at)}`)
  lines.push('')
  lines.push('Notes')
  lines.push(`Internal Notes: ${formatMaterialOrderValue(order.internal_notes)}`)
  lines.push(`Supplier Notes: ${formatMaterialOrderValue(order.supplier_notes)}`)
  lines.push('')
  lines.push('Items')

  if (order.items.length === 0) {
    lines.push('- No line items were captured.')
  } else {
    order.items.forEach((item, index) => {
      lines.push(
        `${index + 1}. ${item.item_name} | Qty: ${item.quantity} | Unit: ${formatMaterialOrderValue(item.unit)}`
      )

      const selectedOptions = item.options
        .filter((option) => option.is_selected)
        .map((option) => `${option.option_group}: ${option.option_value}`)

      lines.push(
        `   Selected Options: ${
          selectedOptions.length > 0 ? selectedOptions.join(', ') : '-'
        }`
      )
      lines.push(`   Notes: ${formatMaterialOrderValue(item.notes)}`)
    })
  }

  return `${lines.join('\n')}\n`
}

async function archiveAndClearMaterialOrdersForPaidJob(jobId: string) {
  const materialOrders = await loadMaterialOrders({ jobId })

  if (materialOrders.length === 0) {
    return
  }

  const archiveFileNames = materialOrders.map(
    (order) =>
      `material-order-${slugifyFileName(order.order_number || order.id)}-archive.txt`
  )

  const { data: existingDocuments, error: existingDocumentsError } = await supabaseAdmin
    .from('documents')
    .select('file_name')
    .eq('job_id', jobId)
    .in('file_name', archiveFileNames)

  if (existingDocumentsError) {
    throw new Error(existingDocumentsError.message)
  }

  const existingNames = new Set(
    ((existingDocuments ?? []) as ExistingDocumentNameRow[])
      .map((row) => row.file_name)
      .filter((name): name is string => typeof name === 'string' && name.length > 0)
  )

  for (const order of materialOrders) {
    const archiveFileName = `material-order-${slugifyFileName(
      order.order_number || order.id
    )}-archive.txt`

    if (existingNames.has(archiveFileName)) {
      continue
    }

    const filePath = `${jobId}/${Date.now()}-${slugifyFileName(archiveFileName)}`
    const archiveText = formatMaterialOrderArchiveText(order)

    const uploadRes = await supabaseAdmin.storage
      .from('job-files')
      .upload(filePath, archiveText, {
        contentType: 'text/plain; charset=utf-8',
        upsert: false,
      })

    if (uploadRes.error) {
      throw new Error(uploadRes.error.message)
    }

    const { error: documentInsertError } = await supabaseAdmin
      .from('documents')
      .insert({
        job_id: jobId,
        file_name: archiveFileName,
        file_path: filePath,
        file_type: 'document',
      })

    if (documentInsertError) {
      await supabaseAdmin.storage.from('job-files').remove([filePath])
      throw new Error(documentInsertError.message)
    }

    existingNames.add(archiveFileName)
  }

  const { error: deleteOrdersError } = await supabaseAdmin
    .from('material_orders')
    .delete()
    .eq('job_id', jobId)

  if (deleteOrdersError) {
    throw new Error(deleteOrdersError.message)
  }
}

function getHomeownerRow(
  homeowners:
    | {
        name: string | null
        phone: string | null
        address: string | null
        email: string | null
      }[]
    | {
        name: string | null
        phone: string | null
        address: string | null
        email: string | null
      }
    | null
) {
  if (!homeowners) return null
  return Array.isArray(homeowners) ? homeowners[0] ?? null : homeowners
}

export async function GET(req: NextRequest, context: RouteContext) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const { jobId } = await context.params
  const existingJobResult = await requireExistingJob(jobId)

  if ('response' in existingJobResult) {
    return existingJobResult.response
  }

  const accessError = await requireJobAccess(authResult.requester, jobId)

  if (accessError) {
    return accessError
  }

  const [jobRes, stagesRes, repsRes, jobRepsRes, notesRes] = await Promise.all([
    supabaseAdmin
      .from('jobs')
      .select(`
        id,
        homeowner_id,
        stage_id,
        insurance_carrier,
        deductible,
        claim_number,
        adjuster_name,
        adjuster_phone,
        adjuster_email,
        date_of_loss,
        type_of_loss,
        install_date,
        contract_signed_date,
        contract_amount,
        deposit_collected,
        remaining_balance,
        supplemented_amount,
        shingle_name,
        stage_entered_at,
        created_at,
        updated_at,
        homeowners (
          id,
          name,
          phone,
          address,
          email,
          created_at,
          updated_at
        ),
        pipeline_stages (
          id,
          name,
          sort_order,
          created_at
        ),
        job_reps (
          id,
          job_id,
          profile_id,
          created_at,
          profiles (
            id,
            full_name
          )
        )
      `)
      .eq('id', jobId)
      .single(),
    supabaseAdmin
      .from('pipeline_stages')
      .select('id, name, sort_order')
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, is_active')
      .eq('is_active', true)
      .order('full_name', { ascending: true }),
    supabaseAdmin.from('job_reps').select('profile_id').eq('job_id', jobId),
    supabaseAdmin
      .from('notes')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false }),
  ])

  if (jobRes.error || !jobRes.data) {
    return NextResponse.json(
      {
        error: jobRes.error?.message ?? 'Job not found.',
      },
      { status: 404 }
    )
  }

  const noteRows = (notesRes.data ?? []) as NoteRow[]
  const creatorIds = [...new Set(noteRows.map(getNoteCreatorId).filter(Boolean))] as string[]
  const creatorNameById = new Map<string, string | null>()

  if (creatorIds.length > 0) {
    const { data: noteCreators } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .in('id', creatorIds)

    for (const creator of noteCreators ?? []) {
      creatorNameById.set(creator.id, creator.full_name ?? null)
    }
  }

  const initialNotes = noteRows.map((note) => {
    const creatorId = getNoteCreatorId(note)

    return {
      id: note.id,
      body: note.body,
      created_at: note.created_at,
      updated_at: note.updated_at ?? null,
      author_name: creatorId ? creatorNameById.get(creatorId) ?? null : null,
    }
  })

  return NextResponse.json({
    job: jobRes.data,
    stages: stagesRes.data ?? [],
    reps: repsRes.data ?? [],
    initialSelectedRepIds: (jobRepsRes.data ?? []).map(
      (row: { profile_id: string }) => row.profile_id
    ),
    initialNotes,
  })
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const { jobId } = await context.params
  const existingJobResult = await requireExistingJob(jobId)

  if ('response' in existingJobResult) {
    return existingJobResult.response
  }

  const accessError = await requireJobAccess(authResult.requester, jobId)

  if (accessError) {
    return accessError
  }

  try {
    const body = (await req.json()) as JobMutationBody
    const { data: existingJob, error: existingJobError } = await supabaseAdmin
      .from('jobs')
      .select(`
        id,
        homeowner_id,
        stage_id,
        insurance_carrier,
        deductible,
        claim_number,
        adjuster_name,
        adjuster_phone,
        adjuster_email,
        date_of_loss,
        type_of_loss,
        install_date,
        contract_signed_date,
        contract_amount,
        supplemented_amount,
        shingle_name,
        homeowners (
          name,
          phone,
          address,
          email
        )
      `)
      .eq('id', jobId)
      .single()

    if (existingJobError || !existingJob) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
    }

    const stages = await loadStageRows()
    const bodyIncludesStageId = Object.prototype.hasOwnProperty.call(body, 'stage_id')
    const bodyIncludesInstallDate = Object.prototype.hasOwnProperty.call(body, 'install_date')
    const requestedStageId = bodyIncludesStageId
      ? normalizeStageId(body.stage_id)
      : existingJob.stage_id
    const installDate = bodyIncludesInstallDate
      ? normalizeDate(body.install_date)
      : existingJob.install_date

    const requestedStage =
      requestedStageId === null
        ? null
        : stages.find((stage) => stage.id === requestedStageId) ?? null
    const autoScheduledStage = installDate ? findInstallScheduledStage(stages) : null
    const stageId =
      installDate && (!requestedStage || isPreProductionPrepStage(requestedStage))
        ? autoScheduledStage?.id ?? requestedStageId
        : requestedStageId
    const targetStage = stageId === null ? null : stages.find((stage) => stage.id === stageId)

    if (requestedStageId !== null && !requestedStage) {
      return NextResponse.json({ error: 'Stage not found.' }, { status: 400 })
    }

    if (stageId !== null && !targetStage) {
      return NextResponse.json({ error: 'Stage not found.' }, { status: 400 })
    }

    if (targetStage && isInstallScheduledStage(targetStage) && !installDate) {
      return NextResponse.json(
        { error: 'Install Scheduled requires an install date.' },
        { status: 400 }
      )
    }

    if (
      targetStage &&
      isManagementLockedStage(targetStage, stages) &&
      !isInstallWorkflowStage(targetStage) &&
      !isManagerRole(authResult.requester.profile.role)
    ) {
      return NextResponse.json(
        { error: 'Only management can move jobs into this stage.' },
        { status: 403 }
      )
    }

    const { data: currentAssignments, error: assignmentError } = await supabaseAdmin
      .from('job_reps')
      .select('profile_id')
      .eq('job_id', jobId)

    if (assignmentError) {
      throw new Error(assignmentError.message)
    }

    const currentRepIds = (currentAssignments ?? []).map(
      (row: { profile_id: string }) => row.profile_id
    )
    const bodyIncludesRepIds = Object.prototype.hasOwnProperty.call(body, 'rep_ids')
    const repIds = bodyIncludesRepIds ? normalizeRepIds(body.rep_ids) : currentRepIds
    const existingHomeowner = getHomeownerRow(existingJob.homeowners)
    const homeownerName = Object.prototype.hasOwnProperty.call(body, 'homeowner_name')
      ? normalizeText(body.homeowner_name)
      : existingHomeowner?.name ?? null
    const { error: homeownerError } = await supabaseAdmin
      .from('homeowners')
      .update({
        name: Object.prototype.hasOwnProperty.call(body, 'homeowner_name')
          ? homeownerName
          : existingHomeowner?.name ?? null,
        phone: Object.prototype.hasOwnProperty.call(body, 'phone')
          ? normalizeText(body.phone)
          : existingHomeowner?.phone ?? null,
        address: Object.prototype.hasOwnProperty.call(body, 'address')
          ? normalizeText(body.address)
          : existingHomeowner?.address ?? null,
        email: Object.prototype.hasOwnProperty.call(body, 'email')
          ? normalizeText(body.email)
          : existingHomeowner?.email ?? null,
      })
      .eq('id', existingJob.homeowner_id)

    if (homeownerError) {
      throw new Error(homeownerError.message)
    }

    const { error: jobError } = await supabaseAdmin
      .from('jobs')
      .update({
        stage_id: stageId,
        insurance_carrier: Object.prototype.hasOwnProperty.call(body, 'insurance_carrier')
          ? normalizeText(body.insurance_carrier)
          : existingJob.insurance_carrier,
        deductible: Object.prototype.hasOwnProperty.call(body, 'deductible')
          ? normalizeNumber(body.deductible)
          : existingJob.deductible,
        claim_number: Object.prototype.hasOwnProperty.call(body, 'claim_number')
          ? normalizeText(body.claim_number)
          : existingJob.claim_number,
        adjuster_name: Object.prototype.hasOwnProperty.call(body, 'adjuster_name')
          ? normalizeText(body.adjuster_name)
          : existingJob.adjuster_name,
        adjuster_phone: Object.prototype.hasOwnProperty.call(body, 'adjuster_phone')
          ? normalizeText(body.adjuster_phone)
          : existingJob.adjuster_phone,
        adjuster_email: Object.prototype.hasOwnProperty.call(body, 'adjuster_email')
          ? normalizeText(body.adjuster_email)
          : existingJob.adjuster_email,
        date_of_loss: Object.prototype.hasOwnProperty.call(body, 'date_of_loss')
          ? normalizeDate(body.date_of_loss)
          : existingJob.date_of_loss,
        type_of_loss: Object.prototype.hasOwnProperty.call(body, 'type_of_loss')
          ? normalizeText(body.type_of_loss)
          : existingJob.type_of_loss,
        install_date: installDate,
        shingle_name: Object.prototype.hasOwnProperty.call(body, 'shingle_name')
          ? normalizeText(body.shingle_name)
          : existingJob.shingle_name,
      })
      .eq('id', jobId)

    if (jobError) {
      throw new Error(jobError.message)
    }

    const { error: deleteAssignmentError } = await supabaseAdmin
      .from('job_reps')
      .delete()
      .eq('job_id', jobId)

    if (deleteAssignmentError) {
      throw new Error(deleteAssignmentError.message)
    }

    if (repIds.length > 0) {
      const { error: insertAssignmentError } = await supabaseAdmin
        .from('job_reps')
        .insert(repIds.map((repId) => ({ job_id: jobId, profile_id: repId })))

      if (insertAssignmentError) {
        throw new Error(insertAssignmentError.message)
      }
    }

    const movedIntoPaidInFull =
      Boolean(targetStage) &&
      isPaidInFullStage(targetStage?.name) &&
      existingJob.stage_id !== stageId

    if (movedIntoPaidInFull) {
      await archiveAndClearMaterialOrdersForPaidJob(jobId)
    }

    const newlyAddedRepIds = repIds.filter((repId) => !currentRepIds.includes(repId))
    try {
      await notifyAssignedReps({
        jobId,
        actorUserId: authResult.requester.profile.id,
        repIds: newlyAddedRepIds,
        homeownerName,
      })
    } catch (notificationError) {
      console.error('Could not notify newly assigned reps.', notificationError)
    }

    const shouldNotifyInstallScheduled =
      Boolean(targetStage) &&
      Boolean(installDate) &&
      isInstallScheduledStage(targetStage as StageRow) &&
      (existingJob.stage_id !== stageId || existingJob.install_date !== installDate)

    if (shouldNotifyInstallScheduled && installDate) {
      try {
        await notifyInstallScheduled({
          jobId,
          actorUserId: authResult.requester.profile.id,
          repIds,
          installDate,
          homeownerName,
        })
      } catch (notificationError) {
        console.error('Could not notify reps about the install schedule.', notificationError)
      }

      if (targetStage) {
        try {
          await notifyColtanStageWorkflow({
            jobId,
            actorUserId: authResult.requester.profile.id,
            stage: targetStage,
            homeownerName,
          })
        } catch (notificationError) {
          console.error('Could not notify Coltan Powell about the stage workflow.', notificationError)
        }
      }
    } else if (targetStage && existingJob.stage_id !== stageId) {
      try {
        await notifyStageChange({
          jobId,
          actorUserId: authResult.requester.profile.id,
          repIds,
          stage: targetStage,
          homeownerName,
        })
      } catch (notificationError) {
        console.error('Could not notify reps about the stage change.', notificationError)
      }

      try {
        await notifyColtanStageWorkflow({
          jobId,
          actorUserId: authResult.requester.profile.id,
          stage: targetStage,
          homeownerName,
        })
      } catch (notificationError) {
        console.error('Could not notify Coltan Powell about the stage workflow.', notificationError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Could not update the job.',
      },
      { status: 400 }
    )
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const managerError = requireManager(authResult.requester)

  if (managerError) {
    return managerError
  }

  const { jobId } = await context.params
  const existingJobResult = await requireExistingJob(jobId)

  if ('response' in existingJobResult) {
    return existingJobResult.response
  }

  try {
    const [jobRes, signedDocsRes, uploadedDocsRes, paymentProofsRes] = await Promise.all([
      supabaseAdmin
        .from('jobs')
        .select('id, homeowner_id')
        .eq('id', jobId)
        .single(),
      supabaseAdmin
        .from('job_documents')
        .select('file_path')
        .eq('job_id', jobId),
      supabaseAdmin
        .from('documents')
        .select('file_path')
        .eq('job_id', jobId),
      supabaseAdmin
        .from('job_payments')
        .select('proof_file_path')
        .eq('job_id', jobId),
    ])

    if (jobRes.error || !jobRes.data) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 })
    }

    if (signedDocsRes.error) {
      throw new Error(signedDocsRes.error.message)
    }

    if (uploadedDocsRes.error) {
      throw new Error(uploadedDocsRes.error.message)
    }

    if (
      paymentProofsRes.error &&
      !isMissingJobPaymentsTableError(paymentProofsRes.error)
    ) {
      throw new Error(paymentProofsRes.error.message)
    }

    const signedFilePaths = (signedDocsRes.data ?? []) as JobFileRow[]
    const uploadedFilePaths = (uploadedDocsRes.data ?? []) as JobFileRow[]
    const paymentProofFilePaths = (paymentProofsRes.data ?? []) as PaymentProofRow[]

    const { error: notificationsError } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('job_id', jobId)

    if (notificationsError) {
      throw new Error(notificationsError.message)
    }

    const { error: notesError } = await supabaseAdmin
      .from('notes')
      .delete()
      .eq('job_id', jobId)

    if (notesError) {
      throw new Error(notesError.message)
    }

    const { error: repsError } = await supabaseAdmin
      .from('job_reps')
      .delete()
      .eq('job_id', jobId)

    if (repsError) {
      throw new Error(repsError.message)
    }

    if (!isMissingJobPaymentsTableError(paymentProofsRes.error)) {
      const { error: paymentsError } = await supabaseAdmin
        .from('job_payments')
        .delete()
        .eq('job_id', jobId)

      if (paymentsError) {
        throw new Error(paymentsError.message)
      }
    }

    const { error: commissionsError } = await supabaseAdmin
      .from('job_commissions')
      .delete()
      .eq('job_id', jobId)

    if (
      commissionsError &&
      !/relation .* does not exist/i.test(commissionsError.message)
    ) {
      throw new Error(commissionsError.message)
    }

    const { error: signedDocsDeleteError } = await supabaseAdmin
      .from('job_documents')
      .delete()
      .eq('job_id', jobId)

    if (signedDocsDeleteError) {
      throw new Error(signedDocsDeleteError.message)
    }

    const { error: uploadsDeleteError } = await supabaseAdmin
      .from('documents')
      .delete()
      .eq('job_id', jobId)

    if (uploadsDeleteError) {
      throw new Error(uploadsDeleteError.message)
    }

    const { error: jobDeleteError } = await supabaseAdmin
      .from('jobs')
      .delete()
      .eq('id', jobId)

    if (jobDeleteError) {
      throw new Error(jobDeleteError.message)
    }

    if (jobRes.data.homeowner_id) {
      const { data: remainingJobs, error: remainingJobsError } = await supabaseAdmin
        .from('jobs')
        .select('id')
        .eq('homeowner_id', jobRes.data.homeowner_id)
        .limit(1)

      if (remainingJobsError) {
        console.error('Could not confirm remaining jobs for deleted homeowner.', remainingJobsError)
      } else if ((remainingJobs ?? []).length === 0) {
        const { error: homeownerDeleteError } = await supabaseAdmin
          .from('homeowners')
          .delete()
          .eq('id', jobRes.data.homeowner_id)

        if (homeownerDeleteError) {
          console.error('Could not remove orphaned homeowner after job delete.', homeownerDeleteError)
        }
      }
    }

    await Promise.allSettled([
      removeStoragePaths(
        'documents',
        signedFilePaths.map((file) => file.file_path)
      ),
      removeStoragePaths(
        'job-files',
        [
          ...uploadedFilePaths.map((file) => file.file_path),
          ...paymentProofFilePaths.map((file) => file.proof_file_path),
        ]
      ),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Could not delete the job.',
      },
      { status: 400 }
    )
  }
}
