import { NextRequest, NextResponse } from 'next/server'
import { ARCHIVE_INACTIVITY_DAYS, getArchiveCutoffDate } from '@/lib/job-lifecycle'
import { getRouteRequester } from '@/lib/server-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

type ArchivedJobRow = {
  id: string
  updated_at: string | null
  homeowners:
    | {
        name: string | null
      }
    | {
        name: string | null
      }[]
    | null
}

type JobAssignmentRow = {
  job_id: string
  profile_id: string
}

type ExistingArchiveNotificationRow = {
  job_id: string | null
  user_id: string
}

function getHomeownerName(homeowner: ArchivedJobRow['homeowners']) {
  if (!homeowner) return null

  const row = Array.isArray(homeowner) ? homeowner[0] ?? null : homeowner
  return row?.name ?? null
}

export async function POST(req: NextRequest) {
  const authResult = await getRouteRequester(req)

  if ('response' in authResult) {
    return authResult.response
  }

  const cutoffIso = getArchiveCutoffDate().toISOString()

  const { data: archivedJobs, error: archivedJobsError } = await supabaseAdmin
    .from('jobs')
    .select(`
      id,
      updated_at,
      homeowners (
        name
      )
    `)
    .lt('updated_at', cutoffIso)

  if (archivedJobsError) {
    return NextResponse.json({ error: archivedJobsError.message }, { status: 400 })
  }

  const jobs = (archivedJobs ?? []) as ArchivedJobRow[]
  const jobIds = jobs.map((job) => job.id)

  if (jobIds.length === 0) {
    return NextResponse.json({ success: true, inserted: 0 })
  }

  const [{ data: assignments, error: assignmentsError }, { data: existingRows, error: existingRowsError }] =
    await Promise.all([
      supabaseAdmin
        .from('job_reps')
        .select('job_id, profile_id')
        .in('job_id', jobIds),
      supabaseAdmin
        .from('notifications')
        .select('job_id, user_id')
        .eq('title', 'Job archived')
        .in('job_id', jobIds),
    ])

  if (assignmentsError) {
    return NextResponse.json({ error: assignmentsError.message }, { status: 400 })
  }

  if (existingRowsError) {
    return NextResponse.json({ error: existingRowsError.message }, { status: 400 })
  }

  const existingKeys = new Set(
    ((existingRows ?? []) as ExistingArchiveNotificationRow[])
      .filter((row) => row.job_id)
      .map((row) => `${row.job_id}:${row.user_id}`)
  )

  const rows = jobs.flatMap((job) => {
    const homeownerName = getHomeownerName(job.homeowners)
    const assignedUserIds = ((assignments ?? []) as JobAssignmentRow[])
      .filter((assignment) => assignment.job_id === job.id)
      .map((assignment) => assignment.profile_id)

    return [...new Set(assignedUserIds)]
      .filter((userId) => !existingKeys.has(`${job.id}:${userId}`))
      .map((userId) => ({
        user_id: userId,
        actor_user_id: null,
        type: 'stage_change',
        title: 'Job archived',
        message: homeownerName
          ? `${homeownerName} was archived after ${ARCHIVE_INACTIVITY_DAYS} days without activity.`
          : `A job was archived after ${ARCHIVE_INACTIVITY_DAYS} days without activity.`,
        link: `/jobs/${job.id}`,
        job_id: job.id,
        note_id: null,
        metadata: {
          event: 'job_archived',
          archived_after_days: ARCHIVE_INACTIVITY_DAYS,
          last_activity_at: job.updated_at,
        },
      }))
  })

  if (rows.length === 0) {
    return NextResponse.json({ success: true, inserted: 0 })
  }

  const { error: insertError } = await supabaseAdmin.from('notifications').insert(rows)

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, inserted: rows.length })
}
