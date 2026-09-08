import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import { ChatOpenRouter } from '@langchain/openrouter'
import { createReactAgent } from '@langchain/langgraph/prebuilt'
import type { SentinelAction, SentinelActivity, SentinelReference } from '../../../shared/types/sentinel'
import { getSentinelConfig } from './config'
import { sentinelSystemPrompt } from './prompts'
import { createSentinelTools } from './tools'
import type { ValidSentinelRequest } from './schemas'
import { getCurrentTenant } from '../tenant-context'

export type SentinelToolResult = {
  name: string
  args: Record<string, unknown>
  raw: string
}

export type SentinelRawResponse = {
  text: string
  toolResults: SentinelToolResult[]
  activity: SentinelActivity[]
  references: SentinelReference[]
  actions: SentinelAction[]
}

function textContent(content: unknown) {
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''
  return content.map((part) => typeof part === 'string' ? part : (part && typeof part === 'object' && 'text' in part ? String(part.text) : '')).join('').trim()
}

function safeArgs(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return {}
  return Object.fromEntries(Object.entries(args).slice(0, 8).map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 100) : value]))
}

function summarizeToolResult(name: string, raw: string) {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>
    if (name === 'search_operational_alerts') {
      const alerts = Array.isArray(value.alerts) ? value.alerts.length : 0
      return `Loaded ${alerts} alert summaries from ${String(value.total ?? 0)} matching open alerts.`
    }
    if (name === 'get_fleet_connectivity') {
      return `Loaded fleet connectivity: ${String(value.connected ?? 0)} online, ${String(value.offline ?? 0)} offline, ${String(value.unknown ?? 0)} unknown.`
    }
    if (name === 'analyze_operational_alert') {
      const analysis = value.analysis as Record<string, unknown> | undefined
      return `Analyzed the alert threshold and ${String(analysis?.relatedAlertCount ?? 0)} related vessel alerts.`
    }
    if (name === 'get_fleet_alarm_trends') {
      return `Loaded fleet alarm trends (${String(value.total_alarms ?? 0)} alarms recorded across 24 hours).`
    }
    if (name === 'get_fleet_voyages') {
      return `Loaded ${String(value.count ?? 0)} active fleet voyages and passage forecasts.`
    }
    if (value.not_found) return 'Vessel was not found in the active vessel roster.'
    return 'Loaded vessel context and recent open alerts.'
  } catch {
    return 'The data source returned an unavailable or invalid result.'
  }
}

function referencesFromResult(name: string, raw: string): SentinelReference[] {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>
    const references: SentinelReference[] = []
    const alerts = Array.isArray(value.alerts) ? value.alerts as Array<Record<string, unknown>> : []
    if (value.alert && typeof value.alert === 'object') alerts.unshift(value.alert as Record<string, unknown>)
    for (const alert of alerts.slice(0, 10)) {
      if (alert.id !== undefined) references.push({ kind: 'alert', id: String(alert.id), label: `${alert.vessel_name || 'Unknown vessel'} · ${alert.message || 'Operational alert'}`.slice(0, 200) })
    }
    if (name === 'get_vessel_operational_context' && value.vessel && typeof value.vessel === 'object') {
      const vessel = value.vessel as Record<string, unknown>
      if (vessel.id !== undefined) references.unshift({ kind: 'vessel', id: String(vessel.id), label: String(vessel.name || `Vessel ${vessel.id}`) })
    }
    if (name === 'get_fleet_connectivity' && Array.isArray(value.networkVessels)) {
      for (const vessel of (value.networkVessels as Array<Record<string, unknown>>).filter((item) => item.connected !== true).slice(0, 10)) {
        if (vessel.vessel_id !== undefined) references.push({ kind: 'vessel', id: String(vessel.vessel_id), label: String(vessel.vessel_name || `Vessel ${vessel.vessel_id}`) })
      }
    }
    if (name === 'get_vessel_cii_telemetry' && value.vesselId !== undefined) {
      references.unshift({ kind: 'vessel', id: String(value.vesselId), label: String(value.vesselName || `Vessel ${value.vesselId}`) })
      references.push({ kind: 'telemetry', id: `cii-${value.vesselId}`, label: `CII ${value.rating || ''} (${value.attainedCii || ''} gCO₂/tnm)`.trim() })
    }
    if (name === 'simulate_vessel_speed_reduction' && value.vesselId !== undefined) {
      references.unshift({ kind: 'vessel', id: String(value.vesselId), label: String(value.vesselName || `Vessel ${value.vesselId}`) })
    }
    return references
  } catch {
    return []
  }
}

function actionsFor(request: ValidSentinelRequest, references: SentinelReference[], toolResults: SentinelToolResult[] = []): SentinelAction[] {
  const latest = [...request.messages].reverse().find((message) => message.role === 'user')?.content.toLowerCase() || ''
  const actions: SentinelAction[] = []
  for (const tr of toolResults) {
    if (tr.name === 'simulate_vessel_speed_reduction') {
      try {
        const val = JSON.parse(tr.raw)
        if (val.recommendedScenario && Array.isArray(val.scenarios)) {
          const idx = val.scenarios.findIndex((s: any) => s.reductionPercent === val.recommendedScenario.reductionPercent)
          if (idx >= 0) {
            actions.push({
              type: 'apply-speed-scenario',
              scenarioIndex: idx,
              label: `Apply -${val.recommendedScenario.reductionPercent}% Speed Cut (${val.recommendedScenario.speedKnots} kts)`,
            })
          }
        }
      } catch {}
    }
  }
  if (latest.includes('critical')) actions.push({ type: 'filter-alerts', severity: 'critical', label: 'Show critical alerts' })
  else if (latest.includes('warning')) actions.push({ type: 'filter-alerts', severity: 'warning', label: 'Show warnings' })
  if (request.context?.vesselId) actions.push({ type: 'focus-vessel', vesselId: request.context.vesselId, label: 'Focus this vessel' })
  const vessel = references.find((reference) => reference.kind === 'vessel')
  if (!request.context?.vesselId && vessel && /vessel|ship|offline|vsat|connectivity/i.test(latest)) {
    actions.push({ type: 'focus-vessel', vesselId: Number(vessel.id), label: `Focus ${vessel.label}` })
  }
  return actions.slice(0, 3)
}

export async function runSentinelConversation(request: ValidSentinelRequest, tenant?: string): Promise<SentinelRawResponse> {
  const activeTenant = tenant || getCurrentTenant()
  const config = getSentinelConfig()
  const tools = createSentinelTools(activeTenant)
  const model = new ChatOpenRouter({
    apiKey: config.apiKey,
    model: config.model,
    temperature: 0.1,
    maxTokens: 700,
    siteName: 'ShipTrack Sentinel',
  })
  const graph = createReactAgent({
    llm: model,
    tools,
    prompt: new SystemMessage(sentinelSystemPrompt),
    version: 'v2',
  })

  const messages = request.messages.map((message) => message.role === 'user'
    ? new HumanMessage(message.content)
    : new AIMessage(message.content))
  if (request.context) messages.push(new HumanMessage(`Use these operator-selected IDs to narrow the investigation: ${JSON.stringify(request.context)}`))

  const result = await graph.invoke({ messages }, { recursionLimit: 8 })
  const rawMessages = Array.isArray(result.messages) ? result.messages as Array<Record<string, any>> : []
  const calls = new Map<string, { name: string; args: Record<string, unknown> }>()
  const toolResults: SentinelToolResult[] = []
  const activity: SentinelActivity[] = []
  const references: SentinelReference[] = []

  for (const message of rawMessages) {
    for (const call of Array.isArray(message.tool_calls) ? message.tool_calls : []) {
      calls.set(String(call.id || `${call.name}-${calls.size}`), { name: String(call.name), args: safeArgs(call.args) })
    }
    if (message.tool_call_id) {
      const call = calls.get(String(message.tool_call_id))
      if (call) {
        const raw = textContent(message.content)
        toolResults.push({ name: call.name, args: call.args, raw })
        activity.push({ name: call.name, args: call.args, summary: summarizeToolResult(call.name, raw) })
        references.push(...referencesFromResult(call.name, raw))
      }
    }
  }

  const finalMessage = [...rawMessages].reverse().find((message) => message.type === 'ai' && !message.tool_calls?.length)
  const text = textContent(finalMessage?.content) || 'I could not produce an evidence-backed answer from the available marine data.'
  const uniqueReferences = [...new Map(references.map((reference) => [`${reference.kind}:${reference.id}`, reference])).values()].slice(0, 20)
  return { text, toolResults, activity, references: uniqueReferences, actions: actionsFor(request, uniqueReferences, toolResults) }
}
