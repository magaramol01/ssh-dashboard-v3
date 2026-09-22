import type { SentinelAction, SentinelActivity, SentinelReference } from '../../../shared/types/sentinel'

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
