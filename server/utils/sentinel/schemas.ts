import { z } from 'zod'

export const sentinelRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(2_000),
  })).min(1).max(20),
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
  if (total > 12_000) {
    ctx.addIssue({ code: 'custom', path: ['messages'], message: 'Conversation is too large' })
  }
})

const markdownBlockSchema = z.object({
  type: z.literal('markdown'),
  text: z.string().min(1).max(8_000),
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
    key: z.string().regex(/^[a-z][a-zA-Z0-9_]*$/),
    label: z.string().min(1).max(80),
  }).strict()).min(1).max(12),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))).max(100),
}).strict()

const kpiBlockSchema = z.object({
  type: z.literal('kpi'),
  label: z.string().min(1).max(80),
  value: z.string().min(1).max(100),
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
  message: z.object({ role: z.literal('agent'), content: z.string().min(1).max(8_000) }).strict(),
  blocks: z.array(sentinelBlockSchema).min(1).max(16),
  activity: z.array(z.object({
    name: z.string().min(1).max(80),
    args: z.record(z.string(), z.unknown()),
    summary: z.string().min(1).max(500),
  }).strict()).max(12),
  references: z.array(z.object({
    kind: z.enum(['alert', 'vessel', 'telemetry']),
    id: z.string().min(1).max(100),
    label: z.string().min(1).max(200),
  }).strict()).max(20),
  actions: z.array(z.discriminatedUnion('type', [
    z.object({
      type: z.literal('filter-alerts'),
      severity: z.enum(['critical', 'warning', 'all']).optional(),
      search: z.string().max(100).optional(),
      label: z.string().min(1).max(100),
    }).strict(),
    z.object({
      type: z.literal('focus-vessel'),
      vesselId: z.number().int().positive(),
      label: z.string().min(1).max(100),
    }).strict(),
    z.object({
      type: z.literal('apply-speed-scenario'),
      scenarioIndex: z.number().int().min(0).max(10),
      label: z.string().min(1).max(100),
    }).strict(),
  ])).max(5),
}).strict()

export type ValidSentinelRequest = z.infer<typeof sentinelRequestSchema>
