'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../src/lib/supabase'

export default function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const redirectTo = useMemo(
    () => searchParams.get('redirectTo') || '/',
    [searchParams]
  )

  useEffect(() => {
    async function checkExistingSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session?.user) {
        router.replace(redirectTo)
      }
    }

    checkExistingSession()
  }, [router, redirectTo])

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

    setLoading(false)
    router.replace(redirectTo)
    router.refresh()

    setTimeout(() => {
      window.location.href = redirectTo
    }, 120)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_24%),radial-gradient(circle_at_top_right,rgba(214,179,122,0.16),transparent_22%),linear-gradient(180deg,#141414_0%,#080808_48%,#020202_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.02),transparent_32%,rgba(255,255,255,0.012)_62%,transparent)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,179,122,0.82),transparent)]" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6 py-10">
        <div className="w-full max-w-[34rem]">
          <div className="rounded-[2.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03))] px-7 py-8 shadow-[0_40px_120px_rgba(0,0,0,0.52)] backdrop-blur-2xl sm:px-10 sm:py-10">
            <div className="flex flex-col items-center text-center">
              <div className="relative h-[220px] w-[220px] sm:h-[260px] sm:w-[260px]">
                <Image
                  src="/4ELogo.png"
                  alt="4 Elements Renovations"
                  fill
                  className="object-contain"
                  priority
                />
              </div>

              <div className="mt-6 text-[12px] font-semibold uppercase tracking-[0.5em] text-[#d6b37a] sm:text-[22px]">
                4 Elements
              </div>

              <h1 className="font-display mt-4 text-5xl font-semibold leading-none tracking-[0.035em] text-white sm:text-6xl">
                Renovations
              </h1>

              <div className="mt-7 h-px w-20 bg-[linear-gradient(90deg,transparent,rgba(214,179,122,0.85),transparent)]" />

              <h2 className="font-display mt-7 text-4xl font-semibold leading-none tracking-[0.02em] text-white sm:text-5xl">
                Access CRM
              </h2>

              <p className="mt-3 text-sm font-medium uppercase tracking-[0.26em] text-white/42">
                Internal Use Only
              </p>
            </div>

            <form onSubmit={handleSignIn} className="mt-10 space-y-4">
              <Field
                label="Email"
                type="email"
                placeholder="you@4elementsrenovations.com"
                value={email}
                onChange={setEmail}
                autoComplete="email"
              />

              <Field
                label="Password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
              />

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-2xl bg-[#d6b37a] px-5 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-black shadow-[0_16px_40px_rgba(214,179,122,0.26)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85] disabled:opacity-60"
              >
                {loading ? 'Signing In...' : 'Enter Workspace'}
              </button>
            </form>

            {message ? (
              <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
                {message}
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-between rounded-[1.6rem] border border-white/10 bg-black/20 px-4 py-3.5">
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.24em] text-white/34">
                  Secure Access
                </div>
                <div className="mt-1 text-sm font-medium text-white/58">
                  Internal Use Only
                </div>
              </div>

              <div className="h-2.5 w-2.5 rounded-full bg-[#d6b37a] shadow-[0_0_18px_rgba(214,179,122,0.88)]" />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function Field({
  label,
  type,
  placeholder,
  value,
  onChange,
  autoComplete,
}: {
  label: string
  type: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  autoComplete?: string
}) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/38">
        {label}
      </label>
      <input
        type={type}
        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-white outline-none transition placeholder:text-white/26 focus:border-[#d6b37a]/40 focus:bg-black/28"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
      />
    </div>
  )
}