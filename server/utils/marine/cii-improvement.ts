export interface DegradationDriver {
  key: 'speed' | 'hull' | 'auxiliary' | 'payload' | 'weather'
  label: string
  percentage: number
  description: string
  iconName: string
}

export interface CobelfretTelemetry {
  badWeatherPct?: number
  sfocCurrent?: number
  sfocExpected?: number
  propulsionTimeLossPct?: number
  operationalProfile?: {
    ladenPct?: number
    ballastPct?: number
    portPct?: number
  }
}

export interface CiiImprovementPlan {
  hasDegraded: boolean
  onset: {
    month: string
    voyageNumber: string
    initialRating: string
    currentRating: string
    ciiIncrease: number
    onsetMonthIndex: number
  }
  drivers: DegradationDriver[]
  summary: string
  actionItems: Array<{
    phase: 'Immediate' | 'Short-Term' | 'Strategic'
    title: string
    description: string
    impact: string
    status: 'pending' | 'in_progress' | 'recommended'
  }>
  recoveryTarget: {
    targetRating: string
    projectedDays: number
    targetCii: number
  }
  lastAuditedAt: string
}

export interface GeneratePlanParams {
  attainedCii: number
  requiredCii: number
  attainedRating: string
  monthlyTrend: Array<{
    month: string
    attainedCii: number | null
    rating: string | null
    co2Mt: number
    distanceNm: number
  }>
  availableVoyages: Array<{
    voyageNumber: string
    startPort: string
    destinationPort: string
  }>
  fuelBreakdown: Array<{
    fuelType: string
    totalMt: number
    co2Mt: number
  }>
  speedReductionScenarios: Array<{
    reductionPercent: number
    speedKnots?: number
    projectedCii: number
    projectedRating: string
    co2SavingsMt: number
    multiplier?: number
  }>
  activeScenarioIndex?: number
  cobelfretTelemetry?: CobelfretTelemetry
}

const RATING_ORDER = ['A', 'B', 'C', 'D', 'E']

export function generateCiiImprovementPlan(params: {
  attainedCii: number
  requiredCii: number
  attainedRating: string
  monthlyTrend: Array<{
    month: string
    attainedCii: number | null
    rating: string | null
    co2Mt: number
    distanceNm: number
  }>
  availableVoyages: Array<{
    voyageNumber: string
    startPort: string
    destinationPort: string
  }>
  fuelBreakdown: Array<{
    fuelType: string
    totalMt: number
    co2Mt: number
  }>
  speedReductionScenarios: Array<{
    reductionPercent: number
    speedKnots?: number
    projectedCii: number
    projectedRating: string
    co2SavingsMt: number
    multiplier?: number
  }>
  activeScenarioIndex?: number
  cobelfretTelemetry?: CobelfretTelemetry
}): CiiImprovementPlan {
  const {
    attainedCii,
    requiredCii,
    attainedRating,
    monthlyTrend,
    availableVoyages,
    speedReductionScenarios,
    activeScenarioIndex = 1,
    cobelfretTelemetry,
  } = params

  const validMonths = (monthlyTrend || []).filter((m) => m.attainedCii !== null && m.attainedCii > 0)
  const isCurrentlyCompliant = ['A', 'B', 'C'].includes(attainedRating) && attainedCii <= requiredCii

  // Find onset point: first month where attainedCii exceeded requiredCii or rating dropped to D/E
  let onsetIndex = -1
  for (let i = 0; i < validMonths.length; i++) {
    const m = validMonths[i]
    const ratingIdx = RATING_ORDER.indexOf(m.rating || 'C')
    const exceedsReq = (m.attainedCii ?? 0) > requiredCii
    const isDegradedGrade = ratingIdx >= 3 // 'D' or 'E'
    if (exceedsReq || isDegradedGrade) {
      onsetIndex = i
      break
    }
  }

  // If no previous month was strictly above, but current vessel is D or E
  if (onsetIndex === -1 && !isCurrentlyCompliant && validMonths.length > 0) {
    onsetIndex = Math.max(0, validMonths.length - 1)
  }

  const hasDegraded = !isCurrentlyCompliant && onsetIndex >= 0
  const onsetMonthRecord = hasDegraded ? validMonths[onsetIndex] : (validMonths[0] || { month: 'Jan', rating: attainedRating, attainedCii })
  const onsetMonth = onsetMonthRecord.month || 'Jan'
  const initialRating = hasDegraded && onsetIndex > 0 ? (validMonths[onsetIndex - 1]?.rating || 'C') : (onsetMonthRecord.rating || attainedRating)
  const initialCii = hasDegraded && onsetIndex > 0 ? (validMonths[onsetIndex - 1]?.attainedCii || onsetMonthRecord.attainedCii || attainedCii) : (onsetMonthRecord.attainedCii || attainedCii)
  const ciiIncrease = Number(Math.max(0, attainedCii - initialCii).toFixed(2))

  // Map onset to corresponding voyage if available
  const voyageIndex = Math.min(Math.max(0, onsetIndex), Math.max(0, (availableVoyages || []).length - 1))
  const onsetVoyage = (availableVoyages && availableVoyages[voyageIndex]?.voyageNumber) || `V0${Math.min(onsetIndex + 1, 4)}`

  // Calculate drivers (Speed, Hull Biofouling, Port Auxiliary, Transport Work Shortfall / Weather)
  let rawSpeed = 38
  let rawHull = 32
  let rawAux = 18
  let rawPayload = 12

  if (cobelfretTelemetry) {
    // If bad weather is significant (>15%)
    if (cobelfretTelemetry.badWeatherPct && cobelfretTelemetry.badWeatherPct > 15) {
      rawSpeed = Math.max(20, Math.round(cobelfretTelemetry.badWeatherPct * 0.8))
    }
    // If propulsion time loss indicates hull fouling (e.g. negative time loss > -3%)
    if (cobelfretTelemetry.propulsionTimeLossPct !== undefined && cobelfretTelemetry.propulsionTimeLossPct < -2) {
      rawHull = Math.min(45, Math.max(25, Math.round(Math.abs(cobelfretTelemetry.propulsionTimeLossPct) * 6)))
    }
    // If operational profile has high port %
    if (cobelfretTelemetry.operationalProfile?.portPct) {
      rawAux = Math.round(cobelfretTelemetry.operationalProfile.portPct * 0.6)
    }
    // If ballast % is high
    if (cobelfretTelemetry.operationalProfile?.ballastPct) {
      rawPayload = Math.round(cobelfretTelemetry.operationalProfile.ballastPct * 0.5)
    }
  }

  const rawSum = rawSpeed + rawHull + rawAux + rawPayload
  const pctSpeed = Math.round((rawSpeed / rawSum) * 100)
  const pctHull = Math.round((rawHull / rawSum) * 100)
  const pctAux = Math.round((rawAux / rawSum) * 100)
  const pctPayload = Math.max(0, 100 - (pctSpeed + pctHull + pctAux)) // Ensure exactly 100%

  const drivers: DegradationDriver[] = [
    {
      key: 'speed',
      label: 'Operational Speed Profile',
      percentage: pctSpeed,
      description: 'Charter speed excursions above eco-speed curve during transit legs.',
      iconName: 'Gauge',
    },
    {
      key: 'hull',
      label: 'Hydrodynamic Hull Resistance',
      percentage: pctHull,
      description: 'Biofouling and propeller roughness driving power & SFOC penalty.',
      iconName: 'Anchor',
    },
    {
      key: 'auxiliary',
      label: 'Auxiliary & Port Boiler Burn',
      percentage: pctAux,
      description: 'Extended anchorage & port idle fuel consumption without generating transport work.',
      iconName: 'Flame',
    },
    {
      key: 'payload',
      label: 'Transport Work / Ballast Leg Shortfall',
      percentage: pctPayload,
      description: 'Underladen transits lowering ton-miles denominator against total fuel burned.',
      iconName: 'Package',
    },
  ]

  // Active scenario impact
  const scenarios = speedReductionScenarios || []
  const selectedScenario = scenarios[activeScenarioIndex] || scenarios[0] || {
    reductionPercent: 10,
    speedKnots: 12.6,
    projectedCii: Number((attainedCii * 0.88).toFixed(2)),
    projectedRating: 'C',
    co2SavingsMt: 320,
    multiplier: 0.729,
  }

  const targetRating = selectedScenario.projectedRating || (attainedRating === 'E' ? 'D' : 'C')
  const targetCii = selectedScenario.projectedCii || Number((requiredCii * 0.98).toFixed(2))
  const projectedDays = selectedScenario.reductionPercent >= 15 ? 30 : selectedScenario.reductionPercent >= 10 ? 45 : 60

  const summary = hasDegraded
    ? `Degradation initiated in ${onsetMonth} during Voyage ${onsetVoyage}, where Attained CII surged from ${initialCii.toFixed(2)} (${initialRating}) to ${attainedCii.toFixed(2)} (${attainedRating}). Primary drivers include ${pctSpeed}% speed excursions and ${pctHull}% hull biofouling resistance.`
    : `Vessel performance remains within regulatory thresholds (Grade ${attainedRating}, CII ${attainedCii.toFixed(2)} vs required ${requiredCii.toFixed(2)}). Continuous eco-speed adherence and scheduled hull maintenance recommended.`

  const actionItems: CiiImprovementPlan['actionItems'] = hasDegraded
    ? [
        {
          phase: 'Immediate',
          title: `Apply -${selectedScenario.reductionPercent}% Charter Eco-Speed Trim (${selectedScenario.speedKnots ?? '12.6'} kts)`,
          description: `Trims main engine power load by ${Math.round((1 - (selectedScenario.multiplier ?? 0.729)) * 100)}%, saving approx. ${selectedScenario.co2SavingsMt} MT CO₂ and curbing exponential speed resistance.`,
          impact: `Projected CII: ${selectedScenario.projectedCii.toFixed(2)} (Rating ${selectedScenario.projectedRating})`,
          status: 'recommended',
        },
        {
          phase: 'Short-Term',
          title: 'Schedule In-Water Hull Inspection & Propeller Polish',
          description: 'High hydrodynamic resistance and SFOC drift indicate biofouling accumulation since drydock.',
          impact: 'Anticipated 6-8% power recovery and 0.4 gCO₂/tnm reduction',
          status: 'pending',
        },
        {
          phase: 'Strategic',
          title: 'Auxiliary Boiler & Port Idle Load Optimization',
          description: 'Transition auxiliary power to shaft generator / economizer during passages and minimize idle boiler burn during port turnarounds.',
          impact: 'Saves 1.8-2.4 MT fuel per port call',
          status: 'in_progress',
        },
      ]
    : [
        {
          phase: 'Immediate',
          title: 'Maintain Eco-Steaming Protocol',
          description: 'Ensure speed profile remains aligned with contractual eco-speed curves.',
          impact: 'Maintains Grade A/B compliance buffer',
          status: 'recommended',
        },
        {
          phase: 'Short-Term',
          title: 'Routine Hull & Engine Performance Monitoring',
          description: 'Track slip factor and SFOC across voyage legs to identify early resistance drift.',
          impact: 'Prevents mid-year rating degradation',
          status: 'in_progress',
        },
      ]

  return {
    hasDegraded,
    onset: {
      month: onsetMonth,
      voyageNumber: onsetVoyage,
      initialRating,
      currentRating: attainedRating,
      ciiIncrease,
      onsetMonthIndex: onsetIndex,
    },
    drivers,
    summary,
    actionItems,
    recoveryTarget: {
      targetRating,
      projectedDays,
      targetCii,
    },
    lastAuditedAt: new Date().toISOString(),
  }
}
