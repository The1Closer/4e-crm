import { NextRequest, NextResponse } from 'next/server'
import {
  getRouteRequester,
  requireExistingJob,
  requireJobAccess,
} from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

type RouteContext = {
  params: Promise<{
    jobId: string
  }>
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
    supabaseAdmin
      .from('job_reps')
      .select('profile_id')
      .eq('job_id', jobId),
    supabaseAdmin
      .from('notes')
      .select('id, body, created_at, updated_at')
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

  return NextResponse.json({
    job: jobRes.data,
    stages: stagesRes.data ?? [],
    reps: repsRes.data ?? [],
    initialSelectedRepIds: (jobRepsRes.data ?? []).map(
      (row: { profile_id: string }) => row.profile_id
    ),
    initialNotes: notesRes.data ?? [],
  })
}
