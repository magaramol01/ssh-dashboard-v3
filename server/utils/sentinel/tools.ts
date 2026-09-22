import type { H3Event } from 'h3'
import { getAllSentinelTools } from './agents'

export function createSentinelTools(tenant?: string, event?: H3Event) {
  return getAllSentinelTools(tenant, event)
}
