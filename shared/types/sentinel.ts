export type SentinelRole = 'user' | 'assistant'

export type SentinelChatRequest = {
  messages: Array<{ role: SentinelRole; content: string }>
  context?: { alertId?: number; vesselId?: number }
}

export type SentinelActivity = {
  name: string
  args: Record<string, unknown>
  summary: string
}

export type SentinelReference = {
  kind: 'alert' | 'vessel' | 'telemetry'
  id: string
  label: string
}

export type SentinelAction =
  | { type: 'filter-alerts'; severity?: 'critical' | 'warning' | 'all'; search?: string; label: string }
  | { type: 'focus-vessel'; vesselId: number; label: string }

export type SentinelAnswer = {
  summary: string
  severity: 'critical' | 'warning' | 'info'
  confirmedFacts: Array<{ label: string; value: string }>
  possibleCauses: string[]
  recommendedChecks: string[]
  operatorNote: string
}

export type SentinelChatResponse = {
  message: { role: 'agent'; content: string }
  answer: SentinelAnswer
  activity: SentinelActivity[]
  references: SentinelReference[]
  actions: SentinelAction[]
}
