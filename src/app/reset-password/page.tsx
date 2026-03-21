'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type ResetMode = 'request' | 'reset'

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
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required
      />
    </div>
  )
}

function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_24%),radial-gradient(circle_at_top_right,rgba(214,179,122,0.16),transparent_22%),linear-gradient(180deg,#141414_0%,#080808_48%,#020202_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.02),transparent_32%,rgba(255,255,255,0.012)_62%,transparent)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(214,179,122,0.82),transparent)]" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6 py-10">
        <div className="w-full max-w-[34rem] rounded-[2.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03))] px-7 py-8 shadow-[0_40px_120px_rgba(0,0,0,0.52)] backdrop-blur-2xl sm:px-10 sm:py-10">
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
              {title}
            </h2>

            <p className="mt-3 max-w-md text-sm leading-6 text-white/50">{subtitle}</p>
          </div>

          {children}

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
    </main>
  )
}

export default function ResetPasswordPage() {
  const router = useRouter()

  const [mode, setMode] = useState<ResetMode>('request')
  const [initializing, setInitializing] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'success' | 'error' | ''>('')

  useEffect(() => {
    let isActive = true

    async function syncMode() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!isActive) {
        return
      }

      setMode(session ? 'reset' : 'request')
      setInitializing(false)
    }

    void syncMode()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isActive) {
        return
      }

      if (
        event === 'PASSWORD_RECOVERY' ||
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED'
      ) {
        setMode(session ? 'reset' : 'request')
      }

      if (event === 'SIGNED_OUT') {
        setMode('request')
      }

      setInitializing(false)
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleSendReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setMessageTone('')

    try {
      const redirectTo = `${window.location.origin}/reset-password`
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      })

      if (error) {
        throw error
      }

      setMessage('Password reset link sent. Check your email and open the link on this device.')
      setMessageTone('success')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send reset email.')
      setMessageTone('error')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (password.length < 8) {
      setMessage('Use at least 8 characters for the new password.')
      setMessageTone('error')
      return
    }

    if (password !== confirmPassword) {
      setMessage('The password confirmation does not match.')
      setMessageTone('error')
      return
    }

    setLoading(true)
    setMessage('')
    setMessageTone('')

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      })

      if (error) {
        throw error
      }

      await supabase.auth.signOut()
      setPassword('')
      setConfirmPassword('')
      setMode('request')
      setMessage('Password updated. Sign in with your new password.')
      setMessageTone('success')
      router.replace('/sign-in')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update the password.')
      setMessageTone('error')
    } finally {
      setLoading(false)
    }
  }

  if (initializing) {
    return (
      <AuthShell
        title="Reset Password"
        subtitle="Checking your recovery session so we can show the right step."
      >
        <div className="mt-10 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/62">
          Loading recovery state...
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title={mode === 'reset' ? 'Choose New Password' : 'Reset Password'}
      subtitle={
        mode === 'reset'
          ? 'Set your new password below and we will send you back to sign in.'
          : 'Enter your email and we will send you a secure password reset link.'
      }
    >
      <form
        onSubmit={mode === 'reset' ? handleUpdatePassword : handleSendReset}
        className="mt-10 space-y-4"
      >
        {mode === 'request' ? (
          <Field
            label="Email"
            type="email"
            placeholder="you@4elementsrenovations.com"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />
        ) : (
          <>
            <Field
              label="New Password"
              type="password"
              placeholder="Enter new password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />

            <Field
              label="Confirm Password"
              type="password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
            />
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-2xl bg-[#d6b37a] px-5 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-black shadow-[0_16px_40px_rgba(214,179,122,0.26)] transition hover:-translate-y-0.5 hover:bg-[#e2bf85] disabled:opacity-60"
        >
          {loading
            ? mode === 'reset'
              ? 'Saving Password...'
              : 'Sending Reset Link...'
            : mode === 'reset'
              ? 'Save New Password'
              : 'Send Reset Link'}
        </button>
      </form>

      {message ? (
        <div
          className={`mt-4 rounded-2xl border p-3 text-sm ${
            messageTone === 'success'
              ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
              : 'border-red-400/20 bg-red-500/10 text-red-200'
          }`}
        >
          {message}
        </div>
      ) : null}

      <div className="mt-5 flex justify-between gap-4 text-sm text-white/56">
        <Link href="/sign-in" className="font-medium text-[#f0ce94] transition hover:text-[#f7ddb0]">
          Back to sign in
        </Link>
        {mode === 'reset' ? (
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut()
              setMode('request')
            }}
            className="font-medium text-white/72 transition hover:text-white"
          >
            Start over
          </button>
        ) : null}
      </div>
    </AuthShell>
  )
}
