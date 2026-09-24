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
  originPort?: string
  destinationPort?: string
  hud?: {
    attainedCii?: number
    requiredCii?: number
    rating?: string
    ciiMarginPct?: number
    speedKts?: number
    weatherAlertHeadline?: string
    weatherAlertSubtext?: string
    weatherRiskLevel?: string
    laycanBufferHours?: number
    carbonSavingsEur?: number
  }
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
  const route = payload.originPort && payload.destinationPort ? `${payload.originPort} → ${payload.destinationPort}` : ''

  const screenContext: string[] = []

  if (route) {
    screenContext.push(`- Route: ${route}`)
  }

  if (payload.hud) {
    const h = payload.hud
    screenContext.push(
      `- Active KPI HUD: CII Trajectory ${h.attainedCii ?? 'N/A'} (Band ${h.rating || 'C'}, Req ${h.requiredCii ?? 'N/A'}, ${h.ciiMarginPct != null ? `${h.ciiMarginPct > 0 ? '+' : ''}${h.ciiMarginPct}% margin` : ''}), Active Speed ${h.speedKts ?? 'N/A'} kts, Weather Alert: '${h.weatherAlertHeadline || 'Fair'}' (${h.weatherAlertSubtext || ''}), Laycan Buffer: +${h.laycanBufferHours ?? 8.5}h`
    )
  }

  if (payload.selectedDay) {
    const d = payload.selectedDay
    const bf = d.weather?.beaufort ?? 'unknown'
    const waves = d.weather?.waveHeightM ? `${d.weather.waveHeightM}m` : 'unknown'
    screenContext.push(
      `- Operator Clicked / Selected Day: Day ${d.dayNumber} (Grade ${d.rating || 'C'}, Attained CII ${d.attainedCii ?? 'N/A'} vs Required ${d.requiredCii ?? 'N/A'}, SOG ${d.sog ?? 'N/A'} kts, Apparent Slip ${d.slipPct != null ? `${d.slipPct}%` : 'N/A'}, Weather: BF ${bf}, Waves: ${waves})`
    )
  }

  if (payload.degradedDays && payload.degradedDays.length > 0) {
    screenContext.push(
      `- Degraded Days Visible on Screen: ${payload.degradedDays.map((d) => `Day ${d.dayNumber} (Grade ${d.rating})`).join(', ')}`
    )
  } else {
    screenContext.push('- No degraded days on screen (all days compliant Band A/B/C).')
  }

  if (payload.heavyWeatherDays && payload.heavyWeatherDays.length > 0) {
    screenContext.push(
      `- Heavy Weather Encounters: ${payload.heavyWeatherDays.map((d) => `Day ${d.dayNumber} (BF ${Math.min(12, d.beaufort || 6)})`).join(', ')}`
    )
  }

  if (payload.highSlipDays && payload.highSlipDays.length > 0) {
    screenContext.push(
      `- Elevated Slip Days (>= 12%): ${payload.highSlipDays.map((d) => `Day ${d.dayNumber} (${d.slipPct.toFixed(1)}%)`).join(', ')}`
    )
  }

  return `You are ShipTrack Sentinel Marine AI. The human operator is currently looking at Voyage Analytics for '${vessel}' on voyage '${voyage}'.

WHAT THE OPERATOR IS CURRENTLY SEEING ON SCREEN:
${screenContext.join('\n')}

YOUR TASK:
Generate 4 sharp, highly contextual questions or directives that match EXACTLY what the operator sees on their screen right now.
The operator will click one of these questions to immediately start an investigation with Sentinel Copilot.

CRITICAL RULES:
1. ONLY reference days and metrics that actually appear in the screen data above! If Day 4 is the only degraded day, refer ONLY to Day 4. NEVER invent or hallucinate other days.
2. Reference the exact numbers shown on screen (speed ${payload.hud?.speedKts || '10.5'} kts, laycan buffer +${payload.hud?.laycanBufferHours || '8.5'}h, weather alert '${payload.hud?.weatherAlertHeadline || 'weather'}', CII ${payload.hud?.attainedCii || '4.06'}).
3. Beaufort scale is strictly 0 to 12. Never output numbers > 12 for Beaufort.
4. Keep button labels concise (under 35 chars).

Return ONLY a valid JSON array of objects:
[
  {
    "label": "Short button label under 35 chars (e.g. 'Why did Day 4 drop to Grade D?')",
    "query": "Full detailed question to ask the Copilot agent",
    "category": "degradation" | "slip" | "weather" | "recovery" | "audit"
  }
]`
}

export function generateHeuristicQuestions(payload: SuggestedQuestionsPayload): SuggestedQuestionItem[] {
  const vesselName = payload.vesselName || 'this vessel'
  const items: SuggestedQuestionItem[] = []

  // 1. Contextual Day Selection (Highest priority if user explicitly clicked a day)
  if (payload.selectedDay) {
    const day = payload.selectedDay
    const dayRating = day.rating || 'C'
    const isDegraded = dayRating === 'D' || dayRating === 'E'
    const bf = Math.min(12, day.weather?.beaufort || 0)
    items.push({
      label: `Audit Day ${day.dayNumber} (${isDegraded ? 'Degraded ' : ''}Grade ${dayRating})`,
      query: `Analyze Day ${day.dayNumber} performance on ${vesselName}. Why is attained CII ${day.attainedCii ?? 'N/A'} (Grade ${dayRating}) with ${day.sog ?? 'N/A'} kts SOG and ${day.slipPct ?? 'N/A'}% slip in BF ${bf} conditions?`,
      category: 'degradation',
    })
  }

  // 2. Real Degraded Days from Screen (Band D or E)
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

  // 3. Weather Alert from Screen HUD or heavy weather encounters
  if (payload.hud?.weatherAlertHeadline && payload.hud.weatherAlertHeadline !== 'Favorable passage weather') {
    const headline = payload.hud.weatherAlertHeadline
    const sub = payload.hud.weatherAlertSubtext || ''
    const parts = sub.split(',').map((p) => p.trim()).filter(Boolean)
    const weatherPillText = parts.length >= 2
      ? `${parts[0]}, ${parts[1]}`
      : (sub.replace(/,\s*$/, '').trim().slice(0, 22).replace(/,\s*$/, '').trim() || 'Adverse Sea State')

    items.push({
      label: `Weather Ahead (${weatherPillText})`,
      query: `Evaluate the operational impact, weather fuel penalty, and speed loss from ${headline} (${payload.hud.weatherAlertSubtext || ''}) on ${vesselName}.`,
      category: 'weather',
    })
  } else if (payload.heavyWeatherDays && payload.heavyWeatherDays.length > 0) {
    const peakWeather = payload.heavyWeatherDays.reduce((max, d) => {
      return (d.beaufort || 0) > (max.beaufort || 0) ? d : max
    }, payload.heavyWeatherDays[0]!)
    const bf = Math.min(12, peakWeather.beaufort || 6)

    items.push({
      label: `Weather penalty (Day ${peakWeather.dayNumber}: BF ${bf})`,
      query: `Evaluate the added weather fuel penalty and speed loss from BF ${bf} conditions on Day ${peakWeather.dayNumber} for ${vesselName}.`,
      category: 'weather',
    })
  } else {
    items.push({
      label: 'Weather vs Fuel Trend',
      query: `Evaluate the added fuel consumption and carbon penalty caused by MetOcean weather conditions along this route for ${vesselName}.`,
      category: 'weather',
    })
  }

  // 4. Speed Advisory & Laycan Buffer from Screen HUD
  if (payload.hud?.laycanBufferHours != null && payload.hud.speedKts != null) {
    const speed = payload.hud.speedKts
    const buffer = payload.hud.laycanBufferHours
    items.push({
      label: `Speed ${speed} kts vs Laycan (+${buffer}h)`,
      query: `Evaluate if the cruising speed of ${speed} kts on ${vesselName} can be optimized while preserving the +${buffer}h charter laycan buffer.`,
      category: 'recovery',
    })
  } else if (payload.highSlipDays && payload.highSlipDays.length > 0) {
    const peakSlip = payload.highSlipDays.reduce((max, d) => (d.slipPct > max.slipPct ? d : max), payload.highSlipDays[0]!)
    items.push({
      label: `Investigate ${peakSlip.slipPct.toFixed(1)}% slip on Day ${peakSlip.dayNumber}`,
      query: `Investigate the elevated propeller slip of ${peakSlip.slipPct.toFixed(1)}% on Day ${peakSlip.dayNumber} for ${vesselName}.`,
      category: 'slip',
    })
  }

  // 5. CII Trajectory Target Recovery / Optimization
  if (payload.hud?.attainedCii != null) {
    const cii = payload.hud.attainedCii
    const req = payload.hud.requiredCii || 4.10
    const margin = payload.hud.ciiMarginPct != null ? `${payload.hud.ciiMarginPct > 0 ? '+' : ''}${payload.hud.ciiMarginPct}%` : ''
    items.push({
      label: `Maintain Band B (${cii} vs ${req} Req)`,
      query: `What adjustments to steaming speed and RPM are needed to maintain compliant IMO Band B trajectory (${cii} attained vs ${req} required, ${margin} margin) on ${vesselName}?`,
      category: 'recovery',
    })
  } else {
    items.push({
      label: 'How to recover Band B?',
      query: `What speed reduction or RPM adjustment is required to recover IMO Band B trajectory for the remainder of this passage on ${vesselName}?`,
      category: 'recovery',
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
