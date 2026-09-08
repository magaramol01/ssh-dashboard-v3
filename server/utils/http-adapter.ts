import crypto from 'node:crypto'
import type { H3Event } from 'h3'
import { getCookie, getHeader, getQuery } from 'h3'
import { getCurrentTenant } from './tenant-context'

export interface BackendRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: unknown
  headers?: Record<string, string>
  tenant?: string
  requestId?: string
  authToken?: string
  refreshToken?: string
  event?: H3Event
}

export interface BackendResponse<T = unknown> {
  success: boolean
  status: number
  data: T
  rawHeaders: Headers
}

export const BACKEND_SERVER_ORIGIN = process.env.BACKEND_SERVER_URL || 'https://smartshipweb.com'
export const BACKEND_API_BASE = process.env.BACKEND_API_URL || `${BACKEND_SERVER_ORIGIN}/prod/api/v2`

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
 * Injects required x-tenant-id, x-request-id, Referer, and token headers dynamically.
 */
export async function backendFetch<T = any>(
  endpoint: string,
  options: BackendRequestOptions = {}
): Promise<BackendResponse<T>> {
  const { event } = options

  // Resolve tenant dynamically: explicit > event context > AsyncLocalStorage > header > query > cookie
  const tenant = (
    options.tenant ||
    event?.context?.tenant ||
    getCurrentTenant() ||
    (event ? getHeader(event, 'x-tenant-id') : '') ||
    (event ? (getQuery(event).tenant as string) : '') ||
    (event ? getCookie(event, 'ssh_tenant') : '') ||
    ''
  ).trim().toLowerCase()

  // Resolve request ID dynamically: explicit > event context > header > generated UUID
  const requestId =
    options.requestId ||
    event?.context?.requestId ||
    (event ? getHeader(event, 'x-request-id') : '') ||
    crypto.randomUUID()

  // Resolve auth tokens dynamically: explicit > cookie > header > bearer
  const authToken =
    options.authToken ||
    (event ? (getCookie(event, 'auth_token') || getHeader(event, 'x-auth-id') || getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '')) : '') ||
    ''
  const refreshToken =
    options.refreshToken ||
    (event ? (getCookie(event, 'refresh_token') || getHeader(event, 'x-refresh-id')) : '') ||
    ''

  let url = endpoint
  if (!url.startsWith('http')) {
    if (url.startsWith('/prod/api/') || url.startsWith('/api/')) {
      const cleanPath = url.startsWith('/prod/') ? url : `/prod${url}`
      url = `${BACKEND_SERVER_ORIGIN}${cleanPath}`
    } else {
      url = `${BACKEND_API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
    }
  }

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

export interface VesselsGeoJsonResponse {
  sourceDestinationPortToPortArray: Array<{
    vesselId: number
    portToPortGeoJson: Array<{
      type: 'Feature'
      geometry: {
        type: 'LineString' | 'Point'
        coordinates: [number, number] | [number, number][]
      }
      properties?: {
        isSource?: boolean
        isDestination?: boolean
        [key: string]: any
      }
    }>
  }>
  allshipDataGEoJson: Array<{
    type: 'Feature'
    geometry: {
      type: 'Point'
      coordinates: [number, number] // [lng, lat]
    }
    properties: {
      lat: string
      long: string
      packetTs: string
      waveDirection: string
      swellDirection: string
      currentSpeed: string
      currentDirection: string
      latDirection: string
      longDirection: string
      sog: number // speed over ground (knots)
      vessleName: string
      vesselId: number
      windSpeedBF: number
      [key: string]: any
    }
  }>
  mapTooltipConfiguration?: any[]
  spireLayerConfigurations?: Record<string, any>
}

export interface GetVesselsOptions {
  tenant?: string
  authToken?: string
  refreshToken?: string
  requestId?: string
  event?: H3Event
}

/**
 * Fetch all vessels GeoJSON data from external backend with dynamic tenant and auth.
 */
export async function getAllVesselsGeoJsonData(
  options: GetVesselsOptions = {}
): Promise<BackendResponse<VesselsGeoJsonResponse>> {
  return backendFetch<VesselsGeoJsonResponse>('/prod/api/v1/getAllVesselsGeoJsonData', {
    method: 'GET',
    tenant: options.tenant,
    authToken: options.authToken,
    refreshToken: options.refreshToken,
    requestId: options.requestId,
    event: options.event,
  })
}
