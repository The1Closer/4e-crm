'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../src/lib/supabase'

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInShell />}>
      <SignInPageContent />
    </Suspense>
  )
}

function SignInPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function checkExistingSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session?.user) {
        const redirectTo = searchParams.get('redirectTo') || '/'
        router.replace(redirectTo)
      }
    }

    checkExistingSession()
  }, [router, searchParams])

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    const redirectTo = searchParams.get('redirectTo') || '/'
    setLoading(false)
    router.replace(redirectTo)
    router.refresh()

    setTimeout(() => {
      window.location.href = redirectTo
    }, 100)
  }

  return (
    <SignInShell>
      <form onSubmit={handleSignIn} className="mt-6 space-y-4">
        <input
          type="email"
          className="w-full rounded-xl border px-4 py-3"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          className="w-full rounded-xl border px-4 py-3"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-60"
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>

      {message ? (
        <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {message}
        </div>
      ) : null}
    </SignInShell>
  )
}

function SignInShell({ children }: { children?: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
            4 Elements Renovations
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
            Sign In
          </h1>

          <p className="mt-2 text-sm text-gray-600">
            Sign in to access the CRM.
          </p>

          {children}
        </div>
      </div>
    </main>
  )
}
