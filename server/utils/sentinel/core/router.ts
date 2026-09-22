import type { H3Event } from 'h3'
import type { SentinelAgentDomain } from '../../../../shared/types/sentinel'
import type { ValidSentinelRequest } from './schemas'
import { getAllSentinelTools } from '../agents'
import { getFleetOpsTools } from '../agents/fleet-ops/tools'
import { getEmissionsTools } from '../agents/emissions/tools'
import { getVoyageTools } from '../agents/voyage/tools'
import { fleetOpsPrompt } from '../agents/fleet-ops/prompt'
import { emissionsPrompt } from '../agents/emissions/prompt'
import { voyagePrompt } from '../agents/voyage/prompt'
import { sentinelSystemPrompt } from '../prompts'

export interface ResolvedAgent {
  domain: SentinelAgentDomain
  prompt: string
  tools: any[]
}

export function resolveAgentDomain(request: ValidSentinelRequest): SentinelAgentDomain {
  // 1. Direct explicit agent routing from frontend request
  if (request.agent && ['fleet-ops', 'emissions', 'voyage', 'general'].includes(request.agent)) {
    return request.agent
  }

  // 2. Intelligent context fallback if frontend did not specify agent
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

  return 'general'
}

export function resolveAgentConfig(
  request: ValidSentinelRequest,
  tenant?: string,
  event?: H3Event
): ResolvedAgent {
  const domain = resolveAgentDomain(request)

  switch (domain) {
    case 'fleet-ops':
      return {
        domain,
        prompt: fleetOpsPrompt,
        tools: getFleetOpsTools(tenant),
      }
    case 'emissions':
      return {
        domain,
        prompt: emissionsPrompt,
        tools: getEmissionsTools(tenant),
      }
    case 'voyage':
      return {
        domain,
        prompt: voyagePrompt,
        tools: getVoyageTools(tenant, event),
      }
    case 'general':
    default:
      return {
        domain: 'general',
        prompt: sentinelSystemPrompt,
        tools: getAllSentinelTools(tenant, event),
      }
  }
}
