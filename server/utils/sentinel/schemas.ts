import { z } from 'zod'

export const sentinelRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(2_000),
  })).min(1).max(20),
  context: z.object({
    alertId: z.number().int().positive().optional(),
    vesselId: z.number().int().positive().optional(),
  }).strict().optional(),
}).strict().superRefine((value, ctx) => {
  const total = value.messages.reduce((sum, message) => sum + message.content.length, 0)
  if (total > 12_000) {
    ctx.addIssue({ code: 'custom', path: ['messages'], message: 'Conversation is too large' })
  }
})

export const sentinelAnswerSchema = z.object({
  summary: z.string().trim().min(1).max(1_000),
  severity: z.enum(['critical', 'warning', 'info']),
  confirmedFacts: z.array(z.object({
    label: z.string().trim().min(1).max(80),
    value: z.string().trim().min(1).max(300),
  })).max(8),
  possibleCauses: z.array(z.string().trim().min(1).max(300)).max(6),
  recommendedChecks: z.array(z.string().trim().min(1).max(300)).max(6),
  operatorNote: z.string().trim().min(1).max(500),
}).strict()

export const sentinelResponseSchema = z.object({
  message: z.object({ role: z.literal('agent'), content: z.string().min(1).max(8_000) }),
  answer: sentinelAnswerSchema,
  activity: z.array(z.object({
    name: z.string().min(1).max(80),
    args: z.record(z.string(), z.unknown()),
    summary: z.string().min(1).max(500),
  })).max(12),
  references: z.array(z.object({
    kind: z.enum(['alert', 'vessel', 'telemetry']),
    id: z.string().min(1).max(100),
    label: z.string().min(1).max(200),
  })).max(20),
  actions: z.array(z.discriminatedUnion('type', [
    z.object({
      type: z.literal('filter-alerts'),
      severity: z.enum(['critical', 'warning', 'all']).optional(),
      search: z.string().max(100).optional(),
      label: z.string().min(1).max(100),
    }),
    z.object({
      type: z.literal('focus-vessel'),
      vesselId: z.number().int().positive(),
      label: z.string().min(1).max(100),
    }),
  ])).max(5),
})

export type ValidSentinelRequest = z.infer<typeof sentinelRequestSchema>
export type ValidSentinelAnswer = z.infer<typeof sentinelAnswerSchema>
