import type { H3Event } from 'h3'
import type { ValidSentinelRequest } from './schemas'
import { getAllSentinelTools, getFleetOpsTools, getEmissionsTools, getVoyageTools } from '../agents'

export type AgentDomain = 'fleet-ops' | 'emissions' | 'voyage' | 'all'

export function resolveAgentDomain(request: ValidSentinelRequest): AgentDomain {
  const latestPrompt = [...request.messages].reverse().find((m) => m.role === 'user')?.content.toLowerCase() || ''
  const ctx = request.context || {}

  if (ctx.attainedCii !== undefined || /cii|emission|carbon|decarbon|ets|imo rating/i.test(latestPrompt)) {
    return 'emissions'
  }

  if (ctx.year !== undefined && /speed|reduction|noon|position|gps|passage|voyage/i.test(latestPrompt)) {
    return 'voyage'
  }

  if (ctx.alertId !== undefined || /alert|alarm|connectivity|vsat|online|offline/i.test(latestPrompt)) {
    return 'fleet-ops'
  }

  return 'all'
}

export function resolveToolsForDomain(domain: AgentDomain, tenant?: string, event?: H3Event) {
  switch (domain) {
    case 'fleet-ops':
      return getFleetOpsTools(tenant)
    case 'emissions':
      return getEmissionsTools(tenant)
    case 'voyage':
      return getVoyageTools(tenant, event)
    case 'all':
    default:
      return getAllSentinelTools(tenant, event)
  }
}
