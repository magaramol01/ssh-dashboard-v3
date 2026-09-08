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

export type SentinelBlock =
  | { type: 'markdown'; text: string }
  | { type: 'line-chart'; title: string; points: Array<{ label: string; value: number }> }
  | { type: 'bar-chart'; title: string; points: Array<{ label: string; value: number }> }
  | { type: 'table'; title: string; columns: Array<{ key: string; label: string }>; rows: Array<Record<string, string | number | null>> }
  | { type: 'kpi'; label: string; value: string; detail?: string; tone?: 'default' | 'success' | 'warning' | 'destructive' }

export type SentinelChatResponse = {
  message: { role: 'agent'; content: string }
  blocks: SentinelBlock[]
  activity: SentinelActivity[]
  references: SentinelReference[]
  actions: SentinelAction[]
}
