'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function NewJobPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    setTimeout(() => {
      router.push('/jobs')
    }, 500)
  }

  return (
    <main className="p-10">
      <h1 className="mb-8 text-4xl font-bold text-white">Create Job</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <button
          type="submit"
          className="px-6 py-3 rounded-xl bg-[#d6b37a] text-black font-semibold"
        >
          {loading ? 'Creating...' : 'Create Job'}
        </button>
      </form>
    </main>
  )
}
