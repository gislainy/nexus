// Token helpers shared by the middleware (Edge runtime) and the BFF.
// The JWT is read from the httpOnly cookie `nexus_token`; the signature is
// verified by the auth service, so here we only decode the payload to check
// expiration.

export const TOKEN_COOKIE = 'nexus_token'
export const REFRESH_COOKIE = 'nexus_refresh'

interface JwtPayload {
  exp?: number
  sub?: string
}

function decodeBase64Url(segment: string): string {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/')
  const withPadding = padded.padEnd(
    padded.length + ((4 - (padded.length % 4)) % 4),
    '='
  )
  return atob(withPadding)
}

export function decodeJwt(token: string): JwtPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) {
    return null
  }
  try {
    const json = decodeBase64Url(parts[1] ?? '')
    return JSON.parse(json) as JwtPayload
  } catch {
    return null
  }
}

export function isTokenExpired(token: string, nowSeconds: number): boolean {
  const payload = decodeJwt(token)
  if (!payload || typeof payload.exp !== 'number') {
    return true
  }
  return payload.exp <= nowSeconds
}
