'use client'

import { useEffect, useState } from 'react'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { supabase } from '../../../lib/supabase'
import { getCurrentUserProfile } from '../../../lib/auth-helpers'

type RepStats = {
  id: string
  name: string
  jobCount: number
  contractTotal: number
  installsScheduled: number
}

function TeamDashboardContent() {
  const [stats, setStats] = useState<RepStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      setLoading(true)

      const manager = await getCurrentUserProfile()
      if (!manager) return

      const { data: reps } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('manager_id', manager.id)

      if (!reps || reps.length === 0) {
        setStats([])
        setLoading(false)
        return
      }

      const repIds = reps.map((r) => r.id)

      const { data: assignments } = await supabase
        .from('job_reps')
        .select(`
          profile_id,
          jobs (
            contract_amount,
            install_date
          )
        `)
        .in('profile_id', repIds)

      const statsMap: Record<string, RepStats> = {}

      reps.forEach((rep) => {
        statsMap[rep.id] = {
          id: rep.id,
          name: rep.full_name,
          jobCount: 0,
          contractTotal: 0,
          installsScheduled: 0,
        }
      })

      assignments?.forEach((row: any) => {
        const rep = statsMap[row.profile_id]
        if (!rep) return

        const job = row.jobs

        rep.jobCount += 1
        rep.contractTotal += job?.contract_amount ?? 0

        if (job?.install_date) {
          rep.installsScheduled += 1
        }
      })

      setStats(Object.values(statsMap))
      setLoading(false)
    }

    loadStats()
  }, [])

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-gray-600">Loading team stats...</div>
      </div>
    )
  }

  return (
    <main className="p-8">
      <div className="mx-auto max-w-6xl space-y-6">

        <h1 className="text-3xl font-bold">Team Performance</h1>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

          {stats.map((rep) => (
            <div
              key={rep.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="text-lg font-semibold text-gray-900">
                {rep.name}
              </div>

              <div className="mt-4 space-y-2 text-sm">

                <div>
                  Jobs: <strong>{rep.jobCount}</strong>
                </div>

                <div>
                  Revenue: <strong>
                    ${rep.contractTotal.toLocaleString()}
                  </strong>
                </div>

                <div>
                  Installs Scheduled: <strong>
                    {rep.installsScheduled}
                  </strong>
                </div>

              </div>
            </div>
          ))}

        </div>

      </div>
    </main>
  )
}

export default function TeamDashboardPage() {
  return (
    <ProtectedRoute>
      <TeamDashboardContent />
    </ProtectedRoute>
  )
}