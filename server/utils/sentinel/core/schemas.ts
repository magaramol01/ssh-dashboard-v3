import { z } from 'zod'

export const sentinelMessageSchema = z.discriminatedUnion('role', [
  z.object({
    role: z.literal('user'),
    content: z.string().trim().min(1).max(2_000),
  }),
  z.object({
    role: z.literal('assistant'),
    // Must stay >= the response schema's message.content cap (16_000) —
    // the client replays prior assistant turns as history on every
    // new message, so a lower cap here rejects the client's own past replies.
    content: z.string().trim().min(1).max(16_000),
  }),
])

export const sentinelAgentDomainSchema = z.enum(['fleet-ops', 'emissions', 'voyage-analytics', 'voyage', 'general']).optional()

export const sentinelRequestSchema = z.object({
  agent: sentinelAgentDomainSchema,
  stream: z.boolean().optional(),
  messages: z.array(sentinelMessageSchema).min(1).max(20),
  context: z.object({
    alertId: z.number().int().positive().optional(),
    vesselId: z.number().int().positive().optional(),
    year: z.number().int().positive().optional(),
    vesselName: z.string().trim().max(120).nullable().optional(),
    attainedCii: z.number().nullable().optional(),
    requiredCii: z.number().nullable().optional(),
    rating: z.string().trim().max(10).nullable().optional(),
  }).passthrough().optional(),
}).strict().superRefine((value, ctx) => {
  const total = value.messages.reduce((sum, message) => sum + message.content.length, 0)
  if (total > 40_000) {
    ctx.addIssue({ code: 'custom', path: ['messages'], message: 'Conversation is too large' })
  }
})

const markdownBlockSchema = z.object({
  type: z.literal('markdown'),
  text: z.string().min(1).max(16_000),
}).strict()

const lineChartBlockSchema = z.object({
  type: z.literal('line-chart'),
  title: z.string().min(1).max(120),
  points: z.array(z.object({
    label: z.string().min(1).max(80),
    value: z.number().finite(),
  }).strict()).min(1).max(100),
}).strict()

const barChartBlockSchema = z.object({
  type: z.literal('bar-chart'),
  title: z.string().min(1).max(120),
  points: z.array(z.object({
    label: z.string().min(1).max(80),
    value: z.number().finite(),
  }).strict()).min(1).max(100),
}).strict()

const tableBlockSchema = z.object({
  type: z.literal('table'),
  title: z.string().min(1).max(120),
  columns: z.array(z.object({
    key: z.string().min(1).max(60),
    label: z.string().min(1).max(80),
  }).strict()).min(1).max(12),
  rows: z.array(z.record(z.string().max(60), z.union([z.string().max(300), z.number().finite(), z.null()]))).min(1).max(50),
}).strict()

const kpiBlockSchema = z.object({
  type: z.literal('kpi'),
  label: z.string().min(1).max(80),
  value: z.string().min(1).max(120),
  detail: z.string().max(200).optional(),
  tone: z.enum(['default', 'success', 'warning', 'destructive']).optional(),
}).strict()

export const sentinelBlockSchema = z.discriminatedUnion('type', [
  markdownBlockSchema,
  lineChartBlockSchema,
  barChartBlockSchema,
  tableBlockSchema,
  kpiBlockSchema,
])

export const sentinelResponseSchema = z.object({
  message: z.object({ role: z.literal('agent'), content: z.string().min(1).max(16_000) }).strict(),
  thought: z.string().max(16_000).optional(),
  blocks: z.array(sentinelBlockSchema).min(1).max(16),
  activity: z.array(z.object({
    name: z.string().min(1).max(60),
    args: z.record(z.string(), z.unknown()),
    summary: z.string().min(1).max(300),
  }).strict()).max(10),
  references: z.array(z.object({
    kind: z.enum(['alert', 'vessel', 'telemetry']),
    id: z.string().min(1).max(80),
    label: z.string().min(1).max(200),
  }).strict()).max(20),
  actions: z.array(z.discriminatedUnion('type', [
    z.object({
      type: z.literal('filter-alerts'),
      severity: z.enum(['critical', 'warning', 'all']).optional(),
      search: z.string().trim().max(100).optional(),
      label: z.string().min(1).max(80),
    }).strict(),
    z.object({
      type: z.literal('focus-vessel'),
      vesselId: z.number().int().positive(),
      label: z.string().min(1).max(80),
    }).strict(),
    z.object({
      type: z.literal('apply-speed-scenario'),
      scenarioIndex: z.number().int().min(0).max(10),
      label: z.string().min(1).max(80),
    }).strict(),
  ])).max(5),
}).strict()

export type ValidSentinelRequest = z.infer<typeof sentinelRequestSchema>
