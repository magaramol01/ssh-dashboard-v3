import { createError } from 'h3'

export function getSentinelConfig() {
  const config = useRuntimeConfig()
  const apiKey = String(config.openrouterApiKey || process.env.OPENROUTER_API_KEY || process.env.NUXT_OPENROUTER_API_KEY || '')
  if (!apiKey) {
    throw createError({ statusCode: 503, statusMessage: 'Sentinel provider is not configured' })
  }

  return {
    apiKey,
    model: String(config.sentinelModel || process.env.OPENROUTER_MODEL || process.env.NUXT_SENTINEL_MODEL || 'openai/gpt-4o-mini'),
  }
}
