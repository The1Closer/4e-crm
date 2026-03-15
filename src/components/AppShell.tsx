'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import AuthStatus from './AuthStatus'
import NotificationBell from './NotificationBell'

export default function AppShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const isAuthPage = pathname === '/sign-in'

  if (isAuthPage) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="text-lg font-bold tracking-tight text-gray-900"
            >
              4 Elements CRM
            </Link>

            <nav className="flex flex-wrap gap-2">
              <Link
                href="/"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
              >
                Home
              </Link>

              <Link
                href="/jobs"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
              >
                Jobs
              </Link>

              <Link
                href="/jobs/new"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
              >
                New Job
              </Link>

              <Link
                href="/team"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
              >
                Team Management
              </Link>

              <Link
                href="/stats/manager"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
              >
                Manager Entry
              </Link>

              <Link
                href="/dashboard/team"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
              >
                Team Dashboard
              </Link>

              <Link
                href="/dashboard/branch"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
              >
                Branch Dashboard
              </Link>

              <Link
                href="/calendar/installs"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
              >
                Install Calendar
              </Link>

              <Link
                href="/commissions"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
              >
                Commissions
              </Link>

              <Link
                href="/templates"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
              >
                Templates
              </Link>

              <Link
                href="/contracts/editor"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
              >
                Signer
              </Link>

              <Link
                href="/notifications"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100"
              >
                Notifications
              </Link>
            </nav>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <NotificationBell />
            <AuthStatus />
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  )
}