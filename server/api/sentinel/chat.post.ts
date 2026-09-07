import { createError, defineEventHandler, readBody } from 'h3'
import type { SentinelChatRequest } from '../../../shared/types/sentinel'
import { runSentinelConversation } from '../../utils/sentinel/agent'
import { formatSentinelResponse } from '../../utils/sentinel/formatter'
import { sentinelRequestSchema, sentinelResponseSchema } from '../../utils/sentinel/schemas'

export default defineEventHandler(async (event) => {
  const body = await readBody<SentinelChatRequest>(event)
  const parsed = sentinelRequestSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Sentinel request' })
  }

  try {
    const raw = await runSentinelConversation(parsed.data)
    return sentinelResponseSchema.parse(formatSentinelResponse(raw))
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('Sentinel request failed', error instanceof Error ? error.message : 'unknown error')
    throw createError({ statusCode: 503, statusMessage: 'Sentinel is temporarily unavailable' })
  }
})
