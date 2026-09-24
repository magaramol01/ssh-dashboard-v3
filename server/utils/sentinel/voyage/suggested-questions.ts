import { ChatOpenRouter } from '@langchain/openrouter'
import { getSentinelConfig } from '../core/config'

export interface SuggestedQuestionItem {
  label: string
  query: string
  category: 'degradation' | 'slip' | 'weather' | 'recovery' | 'audit' | 'general'
}

export interface SuggestedQuestionsPayload {
  vesselId?: number | string
  vesselName?: string
  voyage?: string
  selectedDay?: {
    dayNumber: number
    date?: string
    rating?: string
    attainedCii?: number
    requiredCii?: number
    sog?: number
    slipPct?: number
    weather?: {
      beaufort?: number
      waveHeightM?: number
      windSpeedKts?: number
    }
  }
  degradedDays?: Array<{
    dayNumber: number
    rating?: string
    attainedCii?: number
    requiredCii?: number
    sog?: number
    slipPct?: number
    weather?: {
      beaufort?: number
      waveHeightM?: number
    }
  }>
  heavyWeatherDays?: Array<{
    dayNumber: number
    beaufort?: number
    waveHeightM?: number
  }>
  highSlipDays?: Array<{
    dayNumber: number
    slipPct: number
  }>
  totalDays?: number
}

export function extractJsonArray<T = unknown>(text: string): T[] {
  try {
    const trimmed = text.trim()
    const arrayMatch = trimmed.match(/\[\s*\{[\s\S]*\}\s*\]/)
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0])
    }
    return JSON.parse(trimmed)
  } catch {
    return []
  }
}

export function sanitizeSuggestedQuestions(rawItems: unknown[]): SuggestedQuestionItem[] {
  if (!Array.isArray(rawItems)) return []
  return rawItems
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .filter((item) => typeof item.label === 'string' && typeof item.query === 'string' && item.label.trim().length > 0 && item.query.trim().length > 0)
    .map((item) => ({
      label: String(item.label).trim().slice(0, 45),
      query: String(item.query).trim(),
      category: (typeof item.category === 'string' && ['degradation', 'slip', 'weather', 'recovery', 'audit'].includes(item.category)
        ? item.category
        : 'general') as SuggestedQuestionItem['category'],
    }))
    .slice(0, 5)
}

export function buildSuggestedQuestionsPrompt(payload: SuggestedQuestionsPayload): string {
  const vessel = payload.vesselName || 'this vessel'
  const voyage = payload.voyage || 'active voyage'

  const anomalies: string[] = []

  if (payload.selectedDay) {
    const d = payload.selectedDay
    const bf = d.weather?.beaufort ?? 'unknown'
    const waves = d.weather?.waveHeightM ? `${d.weather.waveHeightM}m` : 'unknown'
    anomalies.push(
      `- User is currently viewing/selected: Day ${d.dayNumber} (Grade ${d.rating || 'C'}, Attained CII ${d.attainedCii ?? 'N/A'} vs Required ${d.requiredCii ?? 'N/A'}, SOG ${d.sog ?? 'N/A'} kts, Apparent Slip ${d.slipPct != null ? `${d.slipPct}%` : 'N/A'}, Weather: BF ${bf}, Waves: ${waves})`
    )
  }

  if (payload.degradedDays && payload.degradedDays.length > 0) {
    anomalies.push(
      `- Degraded CII days (Band D or E): ${payload.degradedDays.length} day(s). Details: ${JSON.stringify(payload.degradedDays.slice(0, 4))}`
    )
  }

  if (payload.heavyWeatherDays && payload.heavyWeatherDays.length > 0) {
    anomalies.push(
      `- Heavy weather encounters (Beaufort 6+ or wave >= 2.5m): ${payload.heavyWeatherDays.length} day(s). Details: ${JSON.stringify(payload.heavyWeatherDays.slice(0, 4))}`
    )
  }

  if (payload.highSlipDays && payload.highSlipDays.length > 0) {
    anomalies.push(
      `- Elevated apparent propeller slip (>= 12%): ${payload.highSlipDays.length} day(s). Details: ${JSON.stringify(payload.highSlipDays.slice(0, 4))}`
    )
  }

  return `You are ShipTrack Sentinel Marine AI. The human operator is currently viewing Voyage Analytics for vessel '${vessel}' on voyage '${voyage}'.

Observed voyage telemetry and detected anomalies:
${anomalies.length > 0 ? anomalies.join('\n') : '- Routine passage without severe anomalies.'}

Your task:
Analyze what the operator is seeing on screen. Formulate 4 sharp, highly contextual, domain-specific questions or directives that highlight suspicious, abnormal, or questionable findings on this voyage.
The operator will click one of these questions to immediately start an investigation with Sentinel Copilot.

Requirements:
1. Ground questions in actual numbers provided (exact Day numbers, slip %, Beaufort ratings, Grade D/E drops, SOG).
2. Cover key marine concerns: root cause of degradation, weather penalty vs speed loss, propulsion slip / resistance, and speed recovery to reach IMO Band B.
3. Return ONLY a valid JSON array of objects. Do not write markdown intro or outro.
Schema:
[
  {
    "label": "Short button label under 35 chars (e.g. 'Why did Day 16 drop to Grade E?')",
    "query": "Full detailed question to ask the Copilot agent",
    "category": "degradation" | "slip" | "weather" | "recovery" | "audit"
  }
]`
}

export function generateHeuristicQuestions(payload: SuggestedQuestionsPayload): SuggestedQuestionItem[] {
  const vesselName = payload.vesselName || 'this vessel'
  const voyNum = payload.voyage || 'active voyage'
  const items: SuggestedQuestionItem[] = []

  // 1. Contextual Day Selection (Highest priority if user explicitly clicked a day)
  if (payload.selectedDay) {
    const day = payload.selectedDay
    const dayRating = day.rating || 'C'
    const isDegraded = dayRating === 'D' || dayRating === 'E'
    items.push({
      label: `Audit Day ${day.dayNumber} (${isDegraded ? 'Degraded ' : ''}Grade ${dayRating})`,
      query: `Analyze Day ${day.dayNumber} performance on ${vesselName}. Why is attained CII ${day.attainedCii ?? 'N/A'} (Grade ${dayRating}) with ${day.sog ?? 'N/A'} kts SOG and ${day.slipPct ?? 'N/A'}% slip in BF ${day.weather?.beaufort || 0} conditions?`,
      category: 'degradation',
    })
  }

  // 2. Suspicious / Degraded Days
  if (payload.degradedDays && payload.degradedDays.length > 0) {
    const worstDay = payload.degradedDays.reduce((worst, d) => {
      if (d.rating === 'E' && worst.rating !== 'E') return d
      if (d.rating === worst.rating && (d.attainedCii || 0) > (worst.attainedCii || 0)) return d
      return worst
    }, payload.degradedDays[0]!)

    if (!payload.selectedDay || payload.selectedDay.dayNumber !== worstDay.dayNumber) {
      items.push({
        label: `Why did Day ${worstDay.dayNumber} drop to Grade ${worstDay.rating}?`,
        query: `Analyze why Day ${worstDay.dayNumber} degraded to Grade ${worstDay.rating} on ${vesselName} (attained CII ${worstDay.attainedCii ?? 'N/A'} vs required ${worstDay.requiredCii ?? 'N/A'}). What was the primary root cause?`,
        category: 'degradation',
      })
    }
  }

  // 3. Heavy Weather
  if (payload.heavyWeatherDays && payload.heavyWeatherDays.length > 0) {
    const peakWeather = payload.heavyWeatherDays.reduce((max, d) => {
      return (d.beaufort || 0) > (max.beaufort || 0) ? d : max
    }, payload.heavyWeatherDays[0]!)

    items.push({
      label: `Weather penalty (Day ${peakWeather.dayNumber}: BF ${peakWeather.beaufort || 6})`,
      query: `Evaluate the added weather fuel penalty and speed loss from BF ${peakWeather.beaufort || 6} heavy weather on Day ${peakWeather.dayNumber} and across this voyage for ${vesselName}.`,
      category: 'weather',
    })
  } else {
    items.push({
      label: 'Weather vs Fuel Trend',
      query: `Evaluate the added fuel consumption and carbon penalty caused by MetOcean weather conditions along this route for ${vesselName}.`,
      category: 'weather',
    })
  }

  // 4. Elevated Propeller Slip
  if (payload.highSlipDays && payload.highSlipDays.length > 0) {
    const peakSlip = payload.highSlipDays.reduce((max, d) => (d.slipPct > max.slipPct ? d : max), payload.highSlipDays[0]!)
    items.push({
      label: `Investigate ${peakSlip.slipPct.toFixed(1)}% slip on Day ${peakSlip.dayNumber}`,
      query: `Investigate the elevated propeller slip of ${peakSlip.slipPct.toFixed(1)}% on Day ${peakSlip.dayNumber} for ${vesselName}. Was it hull/propeller resistance, shallow water effect, or adverse currents?`,
      category: 'slip',
    })
  } else {
    items.push({
      label: 'Propulsion & Slip Analysis',
      query: `Analyze apparent propeller slip and engine RPM trends for ${vesselName} to verify propulsion efficiency.`,
      category: 'slip',
    })
  }

  // 5. Recovery or Laycan
  if (payload.degradedDays && payload.degradedDays.length > 0) {
    items.push({
      label: 'How to recover Band B?',
      query: `What speed reduction or RPM adjustment is required to recover IMO Band B trajectory for the remainder of this passage on ${vesselName}?`,
      category: 'recovery',
    })
  } else {
    items.push({
      label: 'Audit Noon Reports QA',
      query: `Run a Chief Engineer audit on the daily noon reports for ${vesselName} on voyage ${voyNum}. Identify any steaming hour discrepancies, GC distance gaps, or reported fuel balance issues.`,
      category: 'audit',
    })
  }

  return items.slice(0, 4)
}

export async function generateAiSuggestedQuestions(payload: SuggestedQuestionsPayload): Promise<{
  questions: SuggestedQuestionItem[]
  source: 'ai' | 'heuristic'
}> {
  try {
    const config = getSentinelConfig()
    const model = new ChatOpenRouter({
      apiKey: config.apiKey,
      model: config.model,
      temperature: 0.2,
      maxTokens: 1000,
      siteName: 'ShipTrack Sentinel',
    })

    const prompt = buildSuggestedQuestionsPrompt(payload)
    const response = await model.invoke(prompt)
    const content = typeof response.content === 'string' ? response.content : ''
    const rawParsed = extractJsonArray<unknown>(content)
    const sanitized = sanitizeSuggestedQuestions(rawParsed)

    if (sanitized.length >= 2) {
      return {
        questions: sanitized.slice(0, 4),
        source: 'ai',
      }
    }
  } catch (error) {
    console.warn('AI suggested questions failed, falling back to heuristic generation:', error instanceof Error ? error.message : error)
  }

  return {
    questions: generateHeuristicQuestions(payload),
    source: 'heuristic',
  }
}
