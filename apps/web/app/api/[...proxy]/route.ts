import { NextResponse, type NextRequest } from 'next/server'

const TOKEN_COOKIE = 'nexus_token'
const REFRESH_COOKIE = 'nexus_refresh'

// Maps the first path segment after /api to the env var holding the internal
// service base URL. The remaining path (with the segment kept) is forwarded
// unchanged, so /api/auth/login -> <auth>/auth/login and
// /api/projects -> <profile>/projects.
const SERVICE_ENV_BY_SEGMENT: Record<string, string> = {
  auth: 'AUTH_SERVICE_URL',
  projects: 'PROFILE_MANAGER_URL',
  sessions: 'PROFILE_MANAGER_URL',
  questions: 'QUESTION_ENGINE_URL',
}

// Requests that must NOT carry an Authorization header (no token exists yet).
function isPublicAuthPath(targetPath: string): boolean {
  return targetPath === '/auth/login' || targetPath === '/auth/register'
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  }
}

async function handle(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url)
  const targetPath = url.pathname.replace(/^\/api/, '')
  const segment = targetPath.split('/').filter(Boolean)[0] ?? ''

  // Logout is handled locally by the BFF — clears the auth cookies.
  if (targetPath === '/auth/logout') {
    const response = NextResponse.json({ success: true })
    response.cookies.delete(TOKEN_COOKIE)
    response.cookies.delete(REFRESH_COOKIE)
    return response
  }

  const envVar = SERVICE_ENV_BY_SEGMENT[segment]
  if (!envVar) {
    return NextResponse.json(
      { error: `Unknown service for path ${url.pathname}` },
      { status: 404 }
    )
  }

  const base = process.env[envVar]
  if (!base) {
    return NextResponse.json(
      {
        error: `${envVar} is not set — copy .env.local.example to .env.local and fill the service URLs`,
      },
      { status: 502 }
    )
  }

  const targetUrl = `${base}${targetPath}${url.search}`

  const headers = new Headers()
  const contentType = request.headers.get('content-type')
  if (contentType) {
    headers.set('content-type', contentType)
  }

  if (!isPublicAuthPath(targetPath)) {
    const token = request.cookies.get(TOKEN_COOKIE)?.value
    if (token) {
      headers.set('authorization', `Bearer ${token}`)
    }
  }

  const method = request.method
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const body = hasBody ? await request.text() : undefined

  let upstream: Response
  try {
    upstream = await fetch(targetUrl, {
      method,
      headers,
      body,
      cache: 'no-store',
    })
  } catch {
    return NextResponse.json(
      { error: 'Internal service unavailable' },
      { status: 502 }
    )
  }

  const responseText = await upstream.text()
  let payload: unknown = null
  if (responseText) {
    try {
      payload = JSON.parse(responseText)
    } catch {
      payload = { raw: responseText }
    }
  }

  const response = NextResponse.json(payload, { status: upstream.status })

  // On successful login/register, persist tokens as httpOnly cookies.
  if (
    isPublicAuthPath(targetPath) &&
    upstream.ok &&
    payload &&
    typeof payload === 'object'
  ) {
    const tokens = payload as { accessToken?: string; refreshToken?: string }
    if (tokens.accessToken) {
      response.cookies.set(TOKEN_COOKIE, tokens.accessToken, cookieOptions())
    }
    if (tokens.refreshToken) {
      response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, cookieOptions())
    }
  }

  return response
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle
