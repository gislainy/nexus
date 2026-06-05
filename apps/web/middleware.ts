import { NextResponse, type NextRequest } from 'next/server'
import { TOKEN_COOKIE, isTokenExpired } from '@/lib/auth'

const AUTH_PAGES = ['/login', '/register']
const PUBLIC_PREFIXES = ['/login', '/register', '/invites']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(TOKEN_COOKIE)?.value
  const nowSeconds = Math.floor(Date.now() / 1000)
  const authenticated = Boolean(token) && !isTokenExpired(token as string, nowSeconds)

  const isAuthPage = AUTH_PAGES.includes(pathname)

  // Authenticated users should not see login/register — send them to projects.
  if (authenticated && isAuthPage) {
    return NextResponse.redirect(new URL('/projects', request.url))
  }

  // Unauthenticated users may only reach public routes.
  if (!authenticated && !isPublicPath(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  // Run on everything except Next internals, the BFF, and static assets.
  matcher: ['/((?!_next/static|_next/image|api|favicon.ico|.*\\..*).*)'],
}
