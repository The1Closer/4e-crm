'use client'

import { useEffect, useMemo, useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import { supabase } from '../../lib/supabase'
import { getCurrentUserProfile, isManagerLike } from '../../lib/auth-helpers'

type Profile = {
  id: string
  full_name: string
  role: string | null
  manager_id: string | null
  is_active?: boolean
}

function TeamPageContent() {
  const [currentRole, setCurrentRole] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [selectedRepId, setSelectedRepId] = useState('')
  const [selectedManagerId, setSelectedManagerId] = useState('')

  async function loadProfiles() {
    setLoading(true)
    setMessage('')

    const currentProfile = await getCurrentUserProfile()

    if (!currentProfile) {
      setProfiles([])
      setLoading(false)
      return
    }

    setCurrentRole(currentProfile.role)

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, manager_id, is_active')
      .eq('is_active', true)
      .order('full_name', { ascending: true })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    setProfiles((data ?? []) as Profile[])
    setLoading(false)
  }

  useEffect(() => {
    loadProfiles()
  }, [])

  const managers = useMemo(() => {
    return profiles.filter(
      (profile) => profile.role === 'manager' || profile.role === 'admin'
    )
  }, [profiles])

  const reps = useMemo(() => {
    return profiles.filter((profile) => profile.role === 'rep')
  }, [profiles])

  async function assignRepToManager() {
    if (!selectedRepId) {
      setMessage('Select a rep first.')
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        manager_id: selectedManagerId || null,
      })
      .eq('id', selectedRepId)

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Team assignment updated.')
    setSelectedRepId('')
    setSelectedManagerId('')
    loadProfiles()
  }

  async function clearManager(repId: string) {
    const { error } = await supabase
      .from('profiles')
      .update({
        manager_id: null,
      })
      .eq('id', repId)

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Rep removed from manager.')
    loadProfiles()
  }

  if (loading) {
    return (
      <main className="p-8">
        <div className="mx-auto max-w-6xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-gray-600">Loading team data...</div>
        </div>
      </main>
    )
  }

  if (!isManagerLike(currentRole)) {
    return (
      <main className="p-8">
        <div className="mx-auto max-w-6xl rounded-2xl border border-red-300 bg-red-50 p-6 text-red-700">
          You do not have permission to manage teams.
        </div>
      </main>
    )
  }

  return (
    <main className="p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Assign reps to managers and manage team structure inside the CRM.
          </p>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Assign Rep to Manager</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <select
              className="rounded-xl border px-4 py-3 text-sm"
              value={selectedRepId}
              onChange={(e) => setSelectedRepId(e.target.value)}
            >
              <option value="">Select Rep</option>
              {reps.map((rep) => (
                <option key={rep.id} value={rep.id}>
                  {rep.full_name}
                </option>
              ))}
            </select>

            <select
              className="rounded-xl border px-4 py-3 text-sm"
              value={selectedManagerId}
              onChange={(e) => setSelectedManagerId(e.target.value)}
            >
              <option value="">No Manager</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.full_name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={assignRepToManager}
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
            >
              Save Assignment
            </button>
          </div>

          {message ? (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              {message}
            </div>
          ) : null}
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          {managers.map((manager) => {
            const teamReps = reps.filter((rep) => rep.manager_id === manager.id)

            return (
              <div
                key={manager.id}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <h2 className="text-xl font-semibold text-gray-900">
                  {manager.full_name}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {manager.role}
                </p>

                <div className="mt-4 space-y-3">
                  {teamReps.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600">
                      No reps assigned.
                    </div>
                  ) : (
                    teamReps.map((rep) => (
                      <div
                        key={rep.id}
                        className="flex items-center justify-between rounded-xl border border-gray-200 p-4"
                      >
                        <div className="text-sm font-medium text-gray-900">
                          {rep.full_name}
                        </div>

                        <button
                          type="button"
                          onClick={() => clearManager(rep.id)}
                          className="rounded-lg border border-red-300 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Unassigned Reps</h2>

          <div className="mt-4 space-y-3">
            {reps.filter((rep) => !rep.manager_id).length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600">
                All reps are assigned to a manager.
              </div>
            ) : (
              reps
                .filter((rep) => !rep.manager_id)
                .map((rep) => (
                  <div
                    key={rep.id}
                    className="rounded-xl border border-gray-200 p-4 text-sm font-medium text-gray-900"
                  >
                    {rep.full_name}
                  </div>
                ))
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

export default function TeamPage() {
  return (
    <ProtectedRoute>
      <TeamPageContent />
    </ProtectedRoute>
  )
}