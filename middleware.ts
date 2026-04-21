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

const DEFAULT_CORS_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
const DEFAULT_CORS_HEADERS = 'Authorization,Content-Type,Accept'

function isProtectedPath(pathname: string) {
  return PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

function getAllowedOrigins(request: NextRequest) {
  const configured = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  return new Set<string>([request.nextUrl.origin, ...configured])
}

function corsHeaders(request: NextRequest, origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': DEFAULT_CORS_METHODS,
    'Access-Control-Allow-Headers':
      request.headers.get('access-control-request-headers') ??
      DEFAULT_CORS_HEADERS,
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function handleApiCors(request: NextRequest) {
  const origin = request.headers.get('origin')

  if (!origin) {
    return null
  }

  const allowedOrigins = getAllowedOrigins(request)
  if (!allowedOrigins.has(origin)) {
    return new NextResponse(
      JSON.stringify({ error: 'CORS origin is not allowed.' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  const headers = corsHeaders(request, origin)

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers })
  }

  const response = NextResponse.next()
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api/')) {
    const apiResponse = handleApiCors(request)
    if (apiResponse) {
      return apiResponse
    }
  }

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
    '/api/:path*',
  ],
}
