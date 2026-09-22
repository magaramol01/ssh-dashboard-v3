import { createError, createEventStream, defineEventHandler, readBody } from 'h3'
import type { SentinelChatRequest } from '../../../shared/types/sentinel'
import { runSentinelConversation, isRateLimitError } from '../../utils/sentinel/core/runtime'
import { formatSentinelResponse } from '../../utils/sentinel/core/formatter'
import { sentinelRequestSchema, sentinelResponseSchema } from '../../utils/sentinel/core/schemas'
import { tenantStorage } from '../../utils/tenant-context'

export default defineEventHandler(async (event) => {
  const body = await readBody<SentinelChatRequest>(event)
  const parsed = sentinelRequestSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Sentinel request' })
  }

  const tenant = event.context.tenant
  if (tenant) {
    tenantStorage.enterWith(tenant)
  }

  const isStreaming =
    parsed.data.stream === true ||
    Boolean(event.node.req.headers.accept?.includes('text/event-stream'))

  if (isStreaming) {
    const eventStream = createEventStream(event)

    ;(async () => {
      try {
        const raw = await runSentinelConversation(
          parsed.data,
          tenant,
          event,
          async (streamEvent) => {
            await eventStream.push({
              event: streamEvent.event,
              data: JSON.stringify(streamEvent.data),
            })
          }
        )
        const finalResponse = sentinelResponseSchema.parse(formatSentinelResponse(raw))
        await eventStream.push({
          event: 'final',
          data: JSON.stringify(finalResponse),
        })
      } catch (error: unknown) {
        console.error('Sentinel streaming error:', error instanceof Error ? error.message : error)
        const isQuota = isRateLimitError(error)
        await eventStream.push({
          event: 'error',
          data: JSON.stringify({
            message: isQuota
              ? 'AI rate limit reached (429). Please wait a moment before sending another query.'
              : 'Sentinel is temporarily unavailable.',
          }),
        })
      } finally {
        await eventStream.close()
      }
    })()

    return eventStream.send()
  }

  try {
    const raw = await runSentinelConversation(parsed.data, tenant, event)
    return sentinelResponseSchema.parse(formatSentinelResponse(raw))
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    const isQuota = isRateLimitError(error)
    console.error('Sentinel request failed', error instanceof Error ? error.message : 'unknown error')
    throw createError({
      statusCode: isQuota ? 429 : 503,
      statusMessage: isQuota
        ? 'AI rate limit reached (429). Please wait a moment before sending another query.'
        : 'Sentinel is temporarily unavailable',
    })
  }
})
