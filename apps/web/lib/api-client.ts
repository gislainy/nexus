import type {
  AuthTokens,
  AuthUser,
  LoginInput,
  RegisterInput,
} from '@/lib/types'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// All calls go through the BFF at /api/* — never directly to internal services.
async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed with status ${response.status}`
    throw new ApiError(response.status, message)
  }

  return data as T
}

function get<T>(path: string): Promise<T> {
  return request<T>('GET', path)
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body)
}

const authClient = {
  register: (input: RegisterInput) =>
    post<AuthTokens>('/api/auth/register', input),
  login: (input: LoginInput) => post<AuthTokens>('/api/auth/login', input),
  logout: () => post<{ success: boolean }>('/api/auth/logout'),
  me: () => get<AuthUser>('/api/auth/me'),
}

export const apiClient = {
  auth: authClient,
}
