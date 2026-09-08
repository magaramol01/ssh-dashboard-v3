import { defineEventHandler, getHeader } from 'h3'

export default defineEventHandler((event) => {
  return {
    tenant: event.context.tenant || '',
    requestId: event.context.requestId || '',
    receivedHeaders: {
      'x-tenant-id': getHeader(event, 'x-tenant-id') || null,
      'x-request-id': getHeader(event, 'x-request-id') || null,
    },
    timestamp: new Date().toISOString(),
  }
})
