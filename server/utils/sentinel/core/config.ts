import fs from 'node:fs'
import path from 'node:path'
import { createError } from 'h3'

function getFreshEnv(): Record<string, string> {
  try {
    const envPath = path.resolve(process.cwd(), '.env')
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8')
      const env: Record<string, string> = {}
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim()
          let val = trimmed.slice(eqIdx + 1).trim()
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1)
          }
          env[key] = val
        }
      }
      return env
    }
  } catch {}
  return {}
}

export function getSentinelConfig() {
  const freshEnv = getFreshEnv()
  let config: Record<string, any> = {}
  try {
    if (typeof useRuntimeConfig === 'function') {
      config = useRuntimeConfig()
    }
  } catch {}

  const apiKey = String(
    freshEnv.OPENROUTER_API_KEY ||
    freshEnv.NUXT_OPENROUTER_API_KEY ||
    config.openrouterApiKey ||
    process.env.OPENROUTER_API_KEY ||
    process.env.NUXT_OPENROUTER_API_KEY ||
    ''
  )

  if (!apiKey) {
    throw createError({ statusCode: 503, statusMessage: 'Sentinel provider is not configured' })
  }

  const model = String(
    freshEnv.OPENROUTER_MODEL ||
    freshEnv.NUXT_SENTINEL_MODEL ||
    config.sentinelModel ||
    process.env.OPENROUTER_MODEL ||
    process.env.NUXT_SENTINEL_MODEL ||
    'openai/gpt-4o-mini'
  )

  return {
    apiKey,
    model,
  }
}
