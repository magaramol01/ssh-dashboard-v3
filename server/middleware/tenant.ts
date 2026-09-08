import { defineEventHandler, getHeader, setHeader } from 'h3'
import { isReservedTenant } from '../../shared/constants/tenants'
import { tenantStorage } from '../utils/tenant-context'

/**
 * Server middleware for multi-tenancy and request tracing.
 *
 * 1. Reads or extracts `x-tenant-id` from request header, path, or referer.
 * 2. Reads or generates a unique `x-request-id` (UUID v4).
 * 3. Populates `event.context.tenant` and `event.context.requestId`.
 * 4. Injects headers into `event.node.req.headers` for SSR forwarding.
 * 5. Emits `x-request-id` and `x-tenant-id` on response headers.
 */
export default defineEventHandler((event) => {
  let tenantId = getHeader(event, 'x-tenant-id') || ''
  let requestId = getHeader(event, 'x-request-id') || ''

  // 1. Ensure requestId is present
  if (!requestId) {
    requestId = crypto.randomUUID()
  }

  // 2. If tenantId not in header, try extracting from URL path
  if (!tenantId) {
    const rawPath = event.path || ''
    const cleanPath = rawPath.split('?')[0]
    const segments = cleanPath.split('/').filter(Boolean)
    if (segments.length > 0 && !isReservedTenant(segments[0])) {
      tenantId = segments[0]
    }
  }

  // 3. If still not found and request is an API request, check Referer header
  if (!tenantId && event.path?.startsWith('/api/')) {
    const referer = getHeader(event, 'referer') || ''
    if (referer) {
      try {
        const url = new URL(referer)
        const refSegments = url.pathname.split('/').filter(Boolean)
        if (refSegments.length > 0 && !isReservedTenant(refSegments[0])) {
          tenantId = refSegments[0]
        }
      } catch {
        // Invalid referer URL, ignore
      }
    }
  }

  // 4. Attach to event context for server handlers (e.g. event.context.tenant)
  event.context.tenant = tenantId
  event.context.requestId = requestId

  // 5. Inject into node request headers so internal SSR useRequestFetch forwards them
  if (event.node?.req?.headers) {
    if (tenantId) {
      event.node.req.headers['x-tenant-id'] = tenantId
    }
    event.node.req.headers['x-request-id'] = requestId
  }

  // 6. Set response headers for tracing
  setHeader(event, 'x-request-id', requestId)
  if (tenantId) {
    setHeader(event, 'x-tenant-id', tenantId)
    tenantStorage.enterWith(tenantId)
  }
})
