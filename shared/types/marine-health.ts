export type HealthStatus = 'ready' | 'insufficient_data'
export type ComponentState = 'normal' | 'watch' | 'attention' | 'insufficient_data'

export type HealthComponentInput = {
  id: string
  label: string
  unit: string | null
  weight: number
  packets: number
  nonnull: number
  valid: number
  latestPackets: number
  latestValid: number
  baselineMedian: number | null
  baselineP05: number | null
  baselineP95: number | null
  latestMedian: number | null
}

export type HealthComponent = HealthComponentInput & {
  coverage: number
  healthIndex: number | null
  confidence: number
  state: ComponentState
  deviation: number | null
}

export type VesselHealth = {
  healthIndex: number | null
  confidence: number
  status: HealthStatus
  components: HealthComponent[]
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function scoreVesselHealth(inputs: HealthComponentInput[]): VesselHealth {
  const components = inputs.map((input): HealthComponent => {
    const coverage = input.packets > 0 ? input.nonnull / input.packets : 0
    const confidence = input.baselineMedian == null || input.latestMedian == null
      ? 0
      : clamp(
        Math.min(coverage / 0.95, 1) *
        Math.min(input.valid / 1000, 1) *
        Math.min(input.latestValid / 100, 1),
        0,
        1,
      )

    if (confidence === 0) {
      return { ...input, coverage, healthIndex: null, confidence, state: 'insufficient_data', deviation: null }
    }

    const spread = Math.max(((input.baselineP95 ?? 0) - (input.baselineP05 ?? 0)) / 2, 0.000001)
    const deviation = Math.abs(input.latestMedian - input.baselineMedian) / spread
    const healthIndex = clamp(100 - Math.max(0, deviation - 1) * 25, 0, 100)
    const state: ComponentState = healthIndex < 50 ? 'attention' : healthIndex < 75 ? 'watch' : 'normal'

    return { ...input, coverage, healthIndex, confidence, state, deviation }
  })

  const usable = components.filter((component) => component.healthIndex != null)
  if (!usable.length) return { healthIndex: null, confidence: 0, status: 'insufficient_data', components }

  const totalWeight = usable.reduce((sum, component) => sum + component.weight, 0)
  const healthIndex = usable.reduce((sum, component) => sum + (component.healthIndex ?? 0) * component.weight, 0) / totalWeight
  const confidence = usable.reduce((sum, component) => sum + component.confidence * component.weight, 0) / totalWeight

  return { healthIndex, confidence, status: 'ready', components }
}
