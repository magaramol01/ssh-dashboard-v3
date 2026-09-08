export type ThresholdDirection = 'below' | 'above'

export type ThresholdAnalysis = {
  currentValue: number | null
  thresholdValue: number | null
  thresholdDirection: ThresholdDirection | null
  deviation: number | null
  deviationPercent: number | null
  breached: boolean | null
}

const NUMBER = '[-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][-+]?\\d+)?'
const THRESHOLD = new RegExp(`(?:less than|below|under|greater than|above|over)\\s*(${NUMBER})|([<>]=?)\\s*(${NUMBER})|([≤≥])\\s*(${NUMBER})`, 'i')
const FIRST_NUMBER = new RegExp(NUMBER)

function numericValue(value: unknown) {
  if (value === null || value === undefined) return null
  const match = String(value).replaceAll(',', '').match(FIRST_NUMBER)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

export function analyzeThreshold(message: unknown, liveValue: unknown): ThresholdAnalysis {
  const match = String(message ?? '').match(THRESHOLD)
  const currentValue = numericValue(liveValue)
  if (!match) {
    return { currentValue, thresholdValue: null, thresholdDirection: null, deviation: null, deviationPercent: null, breached: null }
  }

  const thresholdValue = numericValue(match[1] ?? match[3] ?? match[5])
  const operator = match[2] ?? match[4]
  const phrase = String(message ?? '').toLowerCase()
  const thresholdDirection: ThresholdDirection = operator
    ? (operator.startsWith('<') || operator === '≤' ? 'below' : 'above')
    : /less than|below|under/.test(phrase) ? 'below' : 'above'

  const deviation = currentValue !== null && thresholdValue !== null ? currentValue - thresholdValue : null
  const breached = deviation === null ? null : thresholdDirection === 'below' ? deviation < 0 : deviation > 0
  const deviationPercent = deviation !== null && thresholdValue !== null && thresholdValue !== 0
    ? Math.abs(deviation / thresholdValue * 100)
    : null

  return { currentValue, thresholdValue, thresholdDirection, deviation, deviationPercent, breached }
}
