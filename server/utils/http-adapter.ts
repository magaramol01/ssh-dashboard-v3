import crypto from 'node:crypto'
import type { H3Event } from 'h3'
import { getCookie, getHeader } from 'h3'
import { getCurrentTenant } from './tenant-context'

export interface BackendRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: unknown
  headers?: Record<string, string>
  tenant?: string
  requestId?: string
  event?: H3Event
}

export interface BackendResponse<T = unknown> {
  success: boolean
  status: number
  data: T
  rawHeaders: Headers
}

export const BACKEND_API_BASE = process.env.BACKEND_API_URL || 'https://smartshipweb.com/prod/api/v2'

/**
 * MD5 hash helper.
 * If input is already a 32-character hexadecimal string, returns it as-is.
 * Otherwise hashes input to MD5 hex format.
 */
export function hashMd5(input: string): string {
  const trimmed = input.trim()
  if (/^[a-f0-9]{32}$/i.test(trimmed)) {
    return trimmed
  }
  return crypto.createHash('md5').update(input).digest('hex')
}

/**
 * Generic HTTP adapter to communicate with the external backend server.
 * Injects required x-tenant-id, x-request-id, Referer, and token headers.
 */
export async function backendFetch<T = any>(
  endpoint: string,
  options: BackendRequestOptions = {}
): Promise<BackendResponse<T>> {
  const { event } = options

  // Resolve tenant: explicit > event context > AsyncLocalStorage > request header > fallback
  const tenant = (
    options.tenant ||
    event?.context?.tenant ||
    getCurrentTenant() ||
    (event ? getHeader(event, 'x-tenant-id') : '') ||
    'asiaticlloyd'
  ).trim().toLowerCase()

  // Resolve request ID: explicit > event context > request header > generated UUID
  const requestId =
    options.requestId ||
    event?.context?.requestId ||
    (event ? getHeader(event, 'x-request-id') : '') ||
    crypto.randomUUID()

  // Resolve auth tokens if available from cookies
  const authToken = event ? (getCookie(event, 'auth_token') || getHeader(event, 'x-auth-id') || '') : ''
  const refreshToken = event ? (getCookie(event, 'refresh_token') || getHeader(event, 'x-refresh-id') || '') : ''

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${BACKEND_API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`

  const headers: Record<string, string> = {
    'accept': 'application/json, text/plain, */*',
    'content-type': 'application/json;charset=UTF-8',
    'x-tenant-id': tenant,
    'x-request-id': requestId,
    'x-auth-id': authToken,
    'x-refresh-id': refreshToken,
    'Referer': 'https://www.smartshipweb.com/',
    ...options.headers,
  }

  const fetchOptions: RequestInit = {
    method: options.method || 'GET',
    headers,
  }

  if (options.body && options.method !== 'GET') {
    fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
  }

  try {
    const res = await fetch(url, fetchOptions)
    const rawText = await res.text()
    let data: any
    try {
      data = JSON.parse(rawText)
    } catch {
      data = rawText
    }

    return {
      success: res.ok,
      status: res.status,
      data,
      rawHeaders: res.headers,
    }
  } catch (err: any) {
    return {
      success: false,
      status: 502,
      data: { msg: err?.message || 'Backend server connection error' } as any,
      rawHeaders: new Headers(),
    }
  }
}

export interface ValidateUserPayload {
  email: string
  password: string // Plaintext or MD5
  tenant?: string
  requestId?: string
  event?: H3Event
}

export interface ValidateUserResult {
  msg: string
  Email?: string
  FirstName?: string
  LastName?: string
  UserName?: string
  Role?: string
  CompanyName?: string
  authToken?: string
  refreshToken?: string
  expiresIn?: number
  [key: string]: any
}

/**
 * Validate user with external backend.
 * MD5-hashes password and passes tenant and request-id headers.
 */
export async function validateUser(payload: ValidateUserPayload): Promise<BackendResponse<ValidateUserResult>> {
  const hashedPassword = hashMd5(payload.password)

  return backendFetch<ValidateUserResult>('/validateUser', {
    method: 'POST',
    tenant: payload.tenant,
    requestId: payload.requestId,
    event: payload.event,
    body: {
      Email: payload.email.trim(),
      Password: hashedPassword,
    },
  })
}
