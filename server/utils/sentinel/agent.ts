import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'
import { ChatOpenRouter } from '@langchain/openrouter'
import type {
  SentinelAction,
  SentinelActivity,
  SentinelChatResponse,
  SentinelReference,
} from '../../../shared/types/sentinel'
import { getSentinelConfig } from './config'
import { sentinelSystemPrompt } from './prompts'
import { createSentinelTools } from './tools'
import { sentinelAnswerSchema, type ValidSentinelRequest } from './schemas'

const MAX_TOOL_ROUNDS = 3

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
      return `Returned ${alerts} alert summaries from ${String(value.total ?? 0)} matching open alerts.`
    }
    if (name === 'get_fleet_connectivity') {
      return `Returned fleet connectivity: ${String(value.connected ?? 0)} online, ${String(value.offline ?? 0)} offline, ${String(value.unknown ?? 0)} unknown.`
    }
    if (value.not_found) return 'Vessel was not found in the active vessel roster.'
    return 'Returned the vessel context and recent open alerts.'
  } catch {
    return 'The data source returned an unavailable or invalid result.'
  }
}

function referencesFromResult(name: string, raw: string): SentinelReference[] {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>
    const references: SentinelReference[] = []
    const alerts = Array.isArray(value.alerts) ? value.alerts as Array<Record<string, unknown>> : []
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
    return references
  } catch {
    return []
  }
}

function fallbackAnswer(references: SentinelReference[], activity: SentinelActivity[]) {
  return sentinelAnswerSchema.parse({
    summary: references.length ? 'Live operational records were found, but Sentinel could not format a complete assessment.' : 'No evidence-backed operational assessment is available for this request.',
    severity: 'info',
    confirmedFacts: activity.slice(0, 3).map((item) => ({ label: 'Data source', value: item.summary })),
    possibleCauses: [],
    recommendedChecks: ['Review the referenced alert or vessel record before taking action.'],
    operatorNote: 'The response formatter failed. Verify the source record directly before making an operational decision.',
  })
}

function parseAnswer(result: { parsed: unknown; raw: { content: unknown } }, references: SentinelReference[], activity: SentinelActivity[]) {
  const parsed = sentinelAnswerSchema.safeParse(result.parsed)
  if (parsed.success) return parsed.data

  const rawText = textContent(result.raw.content)
  try {
    const raw = JSON.parse(rawText) as Record<string, unknown>
    const strings = (value: unknown) => Array.isArray(value)
      ? value.slice(0, 3).map((item) => String(item).slice(0, 300))
      : []
    const facts = (value: unknown) => Array.isArray(value)
      ? value.slice(0, 3).map((item) => typeof item === 'string'
        ? { label: 'Confirmed data', value: item.slice(0, 300) }
        : item && typeof item === 'object' && 'value' in item
          ? { label: 'label' in item ? String(item.label).slice(0, 80) : 'Confirmed data', value: String(item.value).slice(0, 300) }
          : { label: 'Confirmed data', value: String(item).slice(0, 300) })
      : []
    const normalized = {
      summary: String(raw.summary ?? raw.answer ?? raw.description ?? 'No formatted assessment available.').slice(0, 1_000),
      severity: raw.severity === 'critical' || raw.severity === 'warning' ? raw.severity : 'info',
      confirmedFacts: facts(raw.confirmedFacts ?? raw.confirmed_facts),
      possibleCauses: strings(raw.possibleCauses ?? raw.possible_causes),
      recommendedChecks: strings(raw.recommendedChecks ?? raw.recommended_checks),
      operatorNote: String(raw.operatorNote ?? raw.operator_note ?? 'Verify the source record before taking action.').slice(0, 500),
    }
    const recovered = sentinelAnswerSchema.safeParse(normalized)
    if (recovered.success) return recovered.data
  } catch {
    // Use the safe fallback below when the provider returned incomplete JSON.
  }
  return fallbackAnswer(references, activity)
}

function actionsFor(request: ValidSentinelRequest, references: SentinelReference[]): SentinelAction[] {
  const latest = [...request.messages].reverse().find((message) => message.role === 'user')?.content.toLowerCase() || ''
  const actions: SentinelAction[] = []
  if (latest.includes('critical')) actions.push({ type: 'filter-alerts', severity: 'critical', label: 'Show critical alerts' })
  else if (latest.includes('warning')) actions.push({ type: 'filter-alerts', severity: 'warning', label: 'Show warnings' })
  if (request.context?.vesselId) {
    actions.push({ type: 'focus-vessel', vesselId: request.context.vesselId, label: 'Focus this vessel' })
  }
  const vessel = references.find((reference) => reference.kind === 'vessel')
  if (!request.context?.vesselId && vessel && /vessel|ship|offline|vsat|connectivity/i.test(latest)) {
    actions.push({ type: 'focus-vessel', vesselId: Number(vessel.id), label: `Focus ${vessel.label}` })
  }
  return actions.slice(0, 3)
}

export async function runSentinelConversation(request: ValidSentinelRequest): Promise<SentinelChatResponse> {
  const config = getSentinelConfig()
  const tools = createSentinelTools()
  const toolMap = new Map(tools.map((item) => [item.name, item]))
  const model = new ChatOpenRouter({
    apiKey: config.apiKey,
    model: config.model,
    temperature: 0.1,
    maxTokens: 700,
  }).bindTools(tools)

  const messages = [new SystemMessage(sentinelSystemPrompt), ...request.messages.map((message) => (
    message.role === 'user' ? new HumanMessage(message.content) : new AIMessage(message.content)
  ))]
  if (request.context) {
    messages.push(new HumanMessage(`Use these operator-selected IDs to narrow the investigation: ${JSON.stringify(request.context)}`))
  }

  const activity: SentinelActivity[] = []
  const references: SentinelReference[] = []
  let response = await model.invoke(messages)

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const calls = Array.isArray(response.tool_calls) ? response.tool_calls.slice(0, 4) : []
    if (!calls.length) break
    messages.push(response)

    for (const call of calls) {
      const selected = toolMap.get(call.name)
      if (!selected) {
        messages.push(new ToolMessage({ content: 'Unknown tool. Continue without using it.', tool_call_id: call.id || `${call.name}-${round}` }))
        continue
      }
      try {
        const raw = String(await selected.invoke(call.args || {}))
        activity.push({ name: call.name, args: safeArgs(call.args), summary: summarizeToolResult(call.name, raw) })
        references.push(...referencesFromResult(call.name, raw))
        messages.push(new ToolMessage({ content: raw.slice(0, 20_000), tool_call_id: call.id || `${call.name}-${round}` }))
      } catch {
        activity.push({ name: call.name, args: safeArgs(call.args), summary: 'Data source unavailable.' })
        messages.push(new ToolMessage({ content: 'Data source unavailable. State that limitation clearly.', tool_call_id: call.id || `${call.name}-${round}` }))
      }
    }
    response = await model.invoke(messages)
  }

  messages.push(response)
  const finalModel = new ChatOpenRouter({
    apiKey: config.apiKey,
    model: config.model,
    temperature: 0,
    maxTokens: 1_200,
  }).withStructuredOutput(sentinelAnswerSchema, { method: 'jsonMode', includeRaw: true })
  const finalResult = await finalModel.invoke([
    ...messages,
    new HumanMessage(`Return JSON only using exactly this shape and camelCase keys. Keep it concise: no more than 3 facts, 3 possible causes, and 3 recommended checks. Do not repeat the raw tool output.
{"summary":"short evidence-backed answer","severity":"critical|warning|info","confirmedFacts":[{"label":"field","value":"value"}],"possibleCauses":["hypothesis"],"recommendedChecks":["operator check"],"operatorNote":"verification or limitation"}`),
  ])
  const answer = parseAnswer(finalResult, references, activity)
  const uniqueReferences = [...new Map(references.map((reference) => [`${reference.kind}:${reference.id}`, reference])).values()].slice(0, 20)
  return {
    message: { role: 'agent', content: answer.summary },
    answer,
    activity,
    references: uniqueReferences,
    actions: actionsFor(request, uniqueReferences),
  }
}
