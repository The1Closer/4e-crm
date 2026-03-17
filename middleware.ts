import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PATHS = [
  '/',
  '/dashboard',
  '/jobs',
  '/map',
  '/archive',
  '/calendar',
  '/commissions',
  '/templates',
  '/contracts',
  '/notifications',
  '/team',
  '/stats',
  '/profile',
  '/training',
]

function isProtectedPath(pathname: string) {
  return PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!isProtectedPath(pathname)) {
    return NextResponse.next()
  }

  const hasSupabaseAuthCookie = request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')
    )

  if (!hasSupabaseAuthCookie) {
    const signInUrl = new URL('/sign-in', request.url)
    signInUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/jobs/:path*',
    '/map/:path*',
    '/archive/:path*',
    '/calendar/:path*',
    '/commissions/:path*',
    '/templates/:path*',
    '/contracts/:path*',
    '/notifications/:path*',
    '/team/:path*',
    '/stats/:path*',
    '/profile/:path*',
    '/training/:path*',
  ],
}
