import type { H3Event } from 'h3'
import { getFleetOpsTools } from './fleet-ops/tools'
import { getEmissionsTools } from './emissions/tools'
import { getVoyageTools } from './voyage/tools'

export function getAllSentinelTools(tenant?: string, event?: H3Event) {
  return [
    ...getFleetOpsTools(tenant),
    ...getEmissionsTools(tenant),
    ...getVoyageTools(tenant, event),
  ]
}
