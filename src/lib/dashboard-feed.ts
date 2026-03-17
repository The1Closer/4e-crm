import { supabase } from '@/lib/supabase'

export type AnnouncementRow = {
    id: string
    title: string
    body: string
    audience_role: string | null
    audience_manager_id: string | null
    is_active: boolean
    created_at: string
}

export type ActivityFeedRow = {
    id: string
    job_id: string
    event_type: string
    event_label: string
    metadata: Record<string, any>
    created_at: string
    jobs:
    | {
        id: string
        homeowners:
        | {
            name: string | null
            address: string | null
        }
        | {
            name: string | null
            address: string | null
        }[]
        | null
    }
    | {
        id: string
        homeowners:
        | {
            name: string | null
            address: string | null
        }
        | {
            name: string | null
            address: string | null
        }[]
        | null
    }[]
    | null
}

function normalizeHomeowner(
    homeowner:
        | {
            name: string | null
            address: string | null
        }
        | {
            name: string | null
            address: string | null
        }[]
        | null
) {
    if (!homeowner) return null
    return Array.isArray(homeowner) ? homeowner[0] ?? null : homeowner
}

export async function loadAnnouncements(params: {
    role?: string | null
    managerId?: string | null
}) {
    const { role, managerId } = params

    const { data, error } = await supabase
        .from('announcements')
        .select('id, title, body, audience_role, audience_manager_id, is_active, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(6)

    if (error) {
        console.error(error)
        return []
    }

    const rows = (data ?? []) as AnnouncementRow[]

    return rows.filter((row) => {
        const roleMatch = !row.audience_role || row.audience_role === role
        const managerMatch = !row.audience_manager_id || row.audience_manager_id === managerId
        return roleMatch && managerMatch
    })
}

export async function loadActivityFeed(params: {
    repIds?: string[]
    limit?: number
}) {
    const { repIds = [], limit = 8 } = params

    const { data: activityRows, error } = await supabase
        .from('job_activity_log')
        .select(`
      id,
      job_id,
      event_type,
      event_label,
      metadata,
      created_at,
      jobs (
        id,
        homeowners (
          name,
          address
        )
      )
    `)
        .order('created_at', { ascending: false })
        .limit(limit * 3)

    if (error) {
        console.error(error)
        return []
    }

    let rows = (activityRows ?? []) as ActivityFeedRow[]

    if (repIds.length > 0) {
        const { data: jobRepRows, error: jobRepError } = await supabase
            .from('job_reps')
            .select('job_id, profile_id')
            .in('profile_id', repIds)

        if (jobRepError) {
            console.error(jobRepError)
            return []
        }

        const allowedJobIds = new Set((jobRepRows ?? []).map((row: any) => row.job_id))
        rows = rows.filter((row) => allowedJobIds.has(row.job_id))
    }

    return rows.slice(0, limit).map((row) => {
        const job = Array.isArray(row.jobs) ? row.jobs[0] ?? null : row.jobs
        const homeowner = normalizeHomeowner(job?.homeowners ?? null)

        return {
            id: row.id,
            jobId: row.job_id,
            eventType: row.event_type,
            eventLabel: row.event_label,
            createdAt: row.created_at,
            homeownerName: homeowner?.name || 'Unnamed Homeowner',
            address: homeowner?.address || 'No address',
        }
    })
}