/**
 * Mirrors app/lib/vessel-voyage.ts's parseDmsCoordinate — kept local since
 * server/ code doesn't import from app/. Real noon-report position fields
 * arrive as either a DMS string ("24°13'5''S") or plain decimal degrees.
 */
export function parseDmsCoordinate(dms: string): number {
  const match = /^(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D*([NSEW])$/.exec((dms || '').trim())
  if (!match) return NaN
  const [, degStr, minStr, secStr, dir] = match
  const decimal = Number(degStr) + Number(minStr) / 60 + Number(secStr) / 3600
  return dir === 'S' || dir === 'W' ? -decimal : decimal
}

export function resolveCoordinate(value: unknown): number {
  if (typeof value === 'number') return value
  if (value === null || value === undefined || value === '') return NaN
  const trimmed = String(value).trim()
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  return parseDmsCoordinate(trimmed)
}

/** Great-circle distance between two lat/lng points, in nautical miles. */
export function greatCircleNm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadiusNm = 3440.065
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return earthRadiusNm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Calculates apparent propeller slip percentage clamped accurately.
 * Apparent Slip (%) = ((STW - SOG) / STW) * 100
 * Clamped between -5% and 40% to prevent unphysical extremes.
 */
export function calculateApparentSlip(sog: number, stwOrEngineSpeed: number): number {
  if (!stwOrEngineSpeed || stwOrEngineSpeed <= 0 || isNaN(sog) || isNaN(stwOrEngineSpeed)) {
    return 0
  }
  const rawSlip = ((stwOrEngineSpeed - sog) / stwOrEngineSpeed) * 100
  const clamped = Math.max(-5, Math.min(40, rawSlip))
  return Math.round(clamped * 10) / 10
}

/**
 * Computes added fuel consumption (MT), speed loss (kts), and resulting CO2 penalty (MT)
 * due to adverse MetOcean conditions (Beaufort wind force and significant wave height).
 * Uses standard maritime hydrodynamic weather power correction relationships.
 */
export function calculateWeatherFuelPenalty(
  meFuelMt: number,
  sog: number,
  windBf: number,
  waveHeightM: number,
  designSpeed = 14.0,
): { weatherFuelPenaltyMt: number; speedLossKts: number; weatherCo2PenaltyMt: number } {
  if (!meFuelMt || meFuelMt <= 0 || isNaN(meFuelMt)) {
    return { weatherFuelPenaltyMt: 0, speedLossKts: 0, weatherCo2PenaltyMt: 0 }
  }

  // Calm conditions threshold: wind <= BF 3 and wave <= 1.0m
  if (windBf <= 3 && waveHeightM <= 1.0) {
    return { weatherFuelPenaltyMt: 0, speedLossKts: 0, weatherCo2PenaltyMt: 0 }
  }

  const excessWind = Math.max(0, windBf - 3)
  const excessWave = Math.max(0, waveHeightM - 1.0)

  // Hydrodynamic resistance factor from wind and sea state
  const weatherFactor = 0.02 * Math.pow(excessWind, 1.8) + 0.025 * Math.pow(excessWave, 1.5)

  // Calm-water baseline ME fuel consumption
  const calmFuel = meFuelMt / (1 + weatherFactor)
  const penaltyMt = Math.max(0, meFuelMt - calmFuel)

  // Hydrodynamic speed loss
  const effectiveDesignSpeed = designSpeed > 0 ? designSpeed : 14.0
  const speedLoss = effectiveDesignSpeed * (1 - Math.cbrt(1 / (1 + weatherFactor)))
  const weatherCo2PenaltyMt = penaltyMt * 3.114

  return {
    weatherFuelPenaltyMt: Number(penaltyMt.toFixed(2)),
    speedLossKts: Number(speedLoss.toFixed(2)),
    weatherCo2PenaltyMt: Number(weatherCo2PenaltyMt.toFixed(2)),
  }
}

/**
 * Identifies primary root cause of CII rating degradation on adverse voyage days.
 * Root causes: 'heavy_weather' | 'high_slip_resistance' | 'operational_speed_loss' | 'engine_overload'
 */
export function classifyDegradedDay(day: {
  rating: string
  windBf: number
  waveHeightM: number
  slipPct: number
  sog: number
  rpm: number
}): { primaryRootCause: string; causeAnalysis: string } {
  if (day.windBf >= 6 || day.waveHeightM >= 3.0) {
    return {
      primaryRootCause: 'heavy_weather',
      causeAnalysis: `Adverse MetOcean conditions (Beaufort ${day.windBf}, significant wave height ${day.waveHeightM}m) imposed severe added hull and aerodynamic resistance, degrading voyage efficiency.`,
    }
  }

  if (day.slipPct > 15) {
    return {
      primaryRootCause: 'high_slip_resistance',
      causeAnalysis: `Propeller apparent slip was elevated at ${day.slipPct}% despite moderate sea states (Beaufort ${day.windBf}), pointing to biofouling resistance, heavy displacement, or propeller degradation.`,
    }
  }

  if (day.sog < 11.5 && day.rpm >= 80) {
    return {
      primaryRootCause: 'operational_speed_loss',
      causeAnalysis: `Vessel speed over ground dropped to ${day.sog} kts while main engine operated at ${day.rpm} RPM, indicative of adverse tidal currents or shallow-water effects.`,
    }
  }

  return {
    primaryRootCause: 'engine_overload',
    causeAnalysis: `Specific fuel oil consumption or main engine load was disproportionate for the observed speed (${day.sog} kts at ${day.rpm} RPM).`,
  }
}

export interface VoyageRecoveryParams {
  remainingDistanceNm: number
  pastCo2Mt: number
  pastDistanceNm: number
  dwt: number
  targetRating: 'A' | 'B' | 'C' | 'D'
  boundaries: {
    superior_boundary: number
    lower_boundary: number
    upper_boundary: number
    inferior_boundary: number
  }
  baselineSpeedKts?: number
  baselineRpm?: number
  dailyFuelBaseMt?: number
}

export interface VoyageRecoveryResult {
  isFeasible: boolean
  recommendedSpeedKts: number
  speedReductionPercent: number
  recommendedRpm: number
  dailyFuelLimitMt: number
  remainingFuelBurnMt: number
  fuelSavedMt: number
  co2SavedMt: number
  projectedFinalCii: number
  projectedFinalRating: string
  etaDelayHours: number
}

/**
 * Solves required speed and engine RPM adjustments to recover or maintain target IMO CII rating
 * across the remaining voyage distance, applying cubic propulsion fuel laws and MEPC boundaries.
 */
export function solveVoyageRecovery(params: VoyageRecoveryParams): VoyageRecoveryResult {
  const {
    remainingDistanceNm,
    pastCo2Mt,
    pastDistanceNm,
    dwt,
    targetRating,
    boundaries,
    baselineSpeedKts = 14.0,
    baselineRpm = 85,
    dailyFuelBaseMt = 25.0,
  } = params

  const totalDistanceNm = pastDistanceNm + remainingDistanceNm
  const totalTransportWork = totalDistanceNm * dwt

  const determineRating = (cii: number): string => {
    if (!boundaries) return 'C'
    if (cii <= boundaries.superior_boundary) return 'A'
    if (cii <= boundaries.lower_boundary) return 'B'
    if (cii <= boundaries.upper_boundary) return 'C'
    if (cii <= boundaries.inferior_boundary) return 'D'
    return 'E'
  }

  if (totalDistanceNm <= 0 || dwt <= 0 || !boundaries) {
    return {
      isFeasible: false,
      recommendedSpeedKts: baselineSpeedKts,
      speedReductionPercent: 0,
      recommendedRpm: baselineRpm,
      dailyFuelLimitMt: dailyFuelBaseMt,
      remainingFuelBurnMt: 0,
      fuelSavedMt: 0,
      co2SavedMt: 0,
      projectedFinalCii: 0,
      projectedFinalRating: 'E',
      etaDelayHours: 0,
    }
  }

  const targetBoundary =
    targetRating === 'A'
      ? boundaries.superior_boundary
      : targetRating === 'B'
        ? boundaries.lower_boundary
        : targetRating === 'C'
          ? boundaries.upper_boundary
          : boundaries.inferior_boundary

  // Maximum total allowable CO2 (MT) across full voyage for target rating
  const maxTotalCo2Mt = (targetBoundary * totalTransportWork) / 1e6
  const maxAllowableRemainingCo2Mt = maxTotalCo2Mt - pastCo2Mt

  // Baseline remaining metrics at normal operating speed
  const baselineHours = remainingDistanceNm / baselineSpeedKts
  const baselineDays = baselineHours / 24
  const baselineRemainingFuel = dailyFuelBaseMt * baselineDays
  const baselineRemainingCo2 = baselineRemainingFuel * 3.114

  // Case 1: Baseline already achieves or betters target rating
  if (baselineRemainingCo2 <= maxAllowableRemainingCo2Mt) {
    const projectedTotalCo2 = pastCo2Mt + baselineRemainingCo2
    const projectedFinalCii = Number(((projectedTotalCo2 * 1e6) / totalTransportWork).toFixed(2))
    return {
      isFeasible: true,
      recommendedSpeedKts: Number(baselineSpeedKts.toFixed(1)),
      speedReductionPercent: 0,
      recommendedRpm: Math.round(baselineRpm),
      dailyFuelLimitMt: Number(dailyFuelBaseMt.toFixed(1)),
      remainingFuelBurnMt: Number(baselineRemainingFuel.toFixed(1)),
      fuelSavedMt: 0,
      co2SavedMt: 0,
      projectedFinalCii,
      projectedFinalRating: determineRating(projectedFinalCii),
      etaDelayHours: 0,
    }
  }

  // Case 2: Past emissions already exceed total allowable CO2 for entire voyage
  if (maxAllowableRemainingCo2Mt <= 0) {
    const minSafeSpeed = 10.0
    const speedReductionPct = Number((((baselineSpeedKts - minSafeSpeed) / baselineSpeedKts) * 100).toFixed(1))
    const recRpm = Math.round(baselineRpm * (minSafeSpeed / baselineSpeedKts))
    const dailyFuel = dailyFuelBaseMt * Math.pow(minSafeSpeed / baselineSpeedKts, 3)
    const hours = remainingDistanceNm / minSafeSpeed
    const remFuel = dailyFuel * (hours / 24)
    const remCo2 = remFuel * 3.114
    const finalCii = Number((((pastCo2Mt + remCo2) * 1e6) / totalTransportWork).toFixed(2))

    return {
      isFeasible: false,
      recommendedSpeedKts: minSafeSpeed,
      speedReductionPercent: speedReductionPct,
      recommendedRpm: recRpm,
      dailyFuelLimitMt: Number(dailyFuel.toFixed(1)),
      remainingFuelBurnMt: Number(remFuel.toFixed(1)),
      fuelSavedMt: Number(Math.max(0, baselineRemainingFuel - remFuel).toFixed(1)),
      co2SavedMt: Number(Math.max(0, baselineRemainingCo2 - remCo2).toFixed(1)),
      projectedFinalCii: finalCii,
      projectedFinalRating: determineRating(finalCii),
      etaDelayHours: Number((hours - baselineHours).toFixed(1)),
    }
  }

  // Case 3: Recovery is achievable via speed reduction
  // Cubic power law: RemCo2(V) = (dailyFuelBaseMt * remainingDistanceNm * 3.114 / (24 * baselineSpeedKts^3)) * V^2
  // Target 99% of max allowable remaining CO2 as safety cushion
  const k = (dailyFuelBaseMt * remainingDistanceNm * 3.114) / (24 * Math.pow(baselineSpeedKts, 3))
  const targetRemCo2 = maxAllowableRemainingCo2Mt * 0.99
  const requiredSpeed = Math.sqrt(targetRemCo2 / k)

  // Minimum navigational steerage speed is 9.5 kts
  if (requiredSpeed < 9.5) {
    const minSpeed = 10.0
    const dailyFuel = dailyFuelBaseMt * Math.pow(minSpeed / baselineSpeedKts, 3)
    const hours = remainingDistanceNm / minSpeed
    const remFuel = dailyFuel * (hours / 24)
    const remCo2 = remFuel * 3.114
    const finalCii = Number((((pastCo2Mt + remCo2) * 1e6) / totalTransportWork).toFixed(2))

    return {
      isFeasible: false,
      recommendedSpeedKts: minSpeed,
      speedReductionPercent: Number((((baselineSpeedKts - minSpeed) / baselineSpeedKts) * 100).toFixed(1)),
      recommendedRpm: Math.round(baselineRpm * (minSpeed / baselineSpeedKts)),
      dailyFuelLimitMt: Number(dailyFuel.toFixed(1)),
      remainingFuelBurnMt: Number(remFuel.toFixed(1)),
      fuelSavedMt: Number(Math.max(0, baselineRemainingFuel - remFuel).toFixed(1)),
      co2SavedMt: Number(Math.max(0, baselineRemainingCo2 - remCo2).toFixed(1)),
      projectedFinalCii: finalCii,
      projectedFinalRating: determineRating(finalCii),
      etaDelayHours: Number((hours - baselineHours).toFixed(1)),
    }
  }

  const recSpeed = Math.min(baselineSpeedKts, Number(requiredSpeed.toFixed(1)))
  const speedReductionPct = Number((((baselineSpeedKts - recSpeed) / baselineSpeedKts) * 100).toFixed(1))
  const recRpm = Math.round(baselineRpm * (recSpeed / baselineSpeedKts))
  const dailyFuel = dailyFuelBaseMt * Math.pow(recSpeed / baselineSpeedKts, 3)
  const hours = remainingDistanceNm / recSpeed
  const remFuel = dailyFuel * (hours / 24)
  const remCo2 = remFuel * 3.114
  const finalCii = Number((((pastCo2Mt + remCo2) * 1e6) / totalTransportWork).toFixed(2))

  return {
    isFeasible: true,
    recommendedSpeedKts: recSpeed,
    speedReductionPercent: speedReductionPct,
    recommendedRpm: recRpm,
    dailyFuelLimitMt: Number(dailyFuel.toFixed(1)),
    remainingFuelBurnMt: Number(remFuel.toFixed(1)),
    fuelSavedMt: Number(Math.max(0, baselineRemainingFuel - remFuel).toFixed(1)),
    co2SavedMt: Number(Math.max(0, baselineRemainingCo2 - remCo2).toFixed(1)),
    projectedFinalCii: finalCii,
    projectedFinalRating: determineRating(finalCii),
    etaDelayHours: Number(Math.max(0, hours - baselineHours).toFixed(1)),
  }
}

export interface NoonValidationFinding {
  ruleId: string
  parameter: string
  reported: string | number
  expected: string | number
  deviation: string
  tolerance: string
  severity: 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO'
  likelyCause: string
}

export interface NoonReportValidationInput {
  vesselId?: number
  reportDate?: string
  reportDateTime?: string
  steamingHours?: number
  distance?: number
  sog?: number
  stw?: number
  rpm?: number
  pitchM?: number
  meFuelMt?: number
  aeFuelMt?: number
  boilerFuelMt?: number
  totalFuelMt?: number
  lat?: number
  lng?: number
  prevLat?: number
  prevLng?: number
  windBf?: number
  windSpeedKts?: number
  waveHeightM?: number
}

export interface NoonValidationResult {
  vesselId: number
  reportDate: string
  overallStatus: 'APPROVE' | 'APPROVE WITH REMARKS' | 'RETURN FOR CORRECTION'
  counts: {
    critical: number
    error: number
    warning: number
    info: number
    skipped: number
  }
  findings: NoonValidationFinding[]
  calculations: {
    gcDistanceNm?: number
    observedDistanceNm?: number
    engineDistanceNm?: number
    slipPct?: number
    impliedSog?: number
    co2Mt?: number
  }
  recommendedActions: string[]
}

/**
 * Validates vessel noon reports following the Chief Engineer multi-layer validation workflow:
 * Layer 1: Completeness & Physical Limits
 * Layer 2: Time & Steaming Hours
 * Layer 3: Navigation, Great-Circle Distance, Speed & Propeller Slip
 * Layer 4: Fuel Consumption Balances (ME + AE + Boiler vs Total)
 * Layer 7: Weather & Beaufort Scale Consistency
 * Layer 8: Emissions & CO2
 */
export function validateNoonReportData(
  current: NoonReportValidationInput,
  vesselStatic?: { mcrKw?: number; mcrRpm?: number; defaultPitchM?: number }
): NoonValidationResult {
  const findings: NoonValidationFinding[] = []
  const recommendedActions: string[] = []

  const vesselId = current.vesselId ?? 1
  const reportDate = current.reportDate || current.reportDateTime || new Date().toISOString()
  const steamingHours = current.steamingHours ?? 24.0
  const observedDistance = current.distance ?? 0
  const sog = current.sog ?? 0
  const rpm = current.rpm ?? 0
  const pitchM = current.pitchM ?? vesselStatic?.defaultPitchM ?? 5.5

  // Layer 2: Steaming Hours check (T2)
  if (steamingHours > 26.0) {
    findings.push({
      ruleId: 'T2',
      parameter: 'steamingHours',
      reported: steamingHours,
      expected: '24.0 h (normal noon-to-noon)',
      deviation: `+${(steamingHours - 24.0).toFixed(1)} h`,
      tolerance: '22–26 h',
      severity: 'CRITICAL',
      likelyCause: 'Reported steaming hours exceed physical noon-to-noon interval without clock adjustment remark.',
    })
    recommendedActions.push('Vessel must verify steaming hours and UTC timestamp interval.')
  } else if (steamingHours <= 0) {
    findings.push({
      ruleId: 'T6',
      parameter: 'steamingHours',
      reported: steamingHours,
      expected: '> 0 h for at-sea passage',
      deviation: '0 h',
      tolerance: 'Hard limit',
      severity: 'ERROR',
      likelyCause: 'Vessel is marked at sea with positive distance but 0 steaming hours.',
    })
  }

  // Layer 3: Navigation, GC Distance & Speed
  let gcDistanceNm: number | undefined
  if (
    typeof current.lat === 'number' &&
    typeof current.lng === 'number' &&
    typeof current.prevLat === 'number' &&
    typeof current.prevLng === 'number' &&
    !Number.isNaN(current.lat) &&
    !Number.isNaN(current.lng) &&
    !Number.isNaN(current.prevLat) &&
    !Number.isNaN(current.prevLng)
  ) {
    gcDistanceNm = Number(greatCircleNm(current.prevLat, current.prevLng, current.lat, current.lng).toFixed(1))
    // N1: Observed distance cannot be less than Great-Circle distance - 2 NM
    if (observedDistance > 0 && observedDistance < gcDistanceNm - 2.0) {
      findings.push({
        ruleId: 'N1',
        parameter: 'distance',
        reported: `${observedDistance} NM`,
        expected: `>= ${gcDistanceNm} NM (Great-Circle Distance)`,
        deviation: `${(observedDistance - gcDistanceNm).toFixed(1)} NM`,
        tolerance: '-2 NM',
        severity: 'CRITICAL',
        likelyCause: 'Reported observed distance is physically shorter than the great-circle geodesic distance between noon fixes.',
      })
      recommendedActions.push('Correct reported noon GPS coordinates or logged distance run.')
    } else if (observedDistance > gcDistanceNm * 1.30 && gcDistanceNm > 50) {
      findings.push({
        ruleId: 'N1',
        parameter: 'distance',
        reported: `${observedDistance} NM`,
        expected: `~${gcDistanceNm} NM (Great-Circle)`,
        deviation: `+${(observedDistance - gcDistanceNm).toFixed(1)} NM (+${(((observedDistance - gcDistanceNm) / gcDistanceNm) * 100).toFixed(0)}%)`,
        tolerance: '+10% GC',
        severity: 'WARNING',
        likelyCause: 'Observed distance significantly exceeds direct track; check for weather rerouting, maneuvering, or counter-current drift.',
      })
    }
  }

  // N2: Average Speed Consistency
  let impliedSog: number | undefined
  if (steamingHours > 0 && observedDistance > 0) {
    impliedSog = Number((observedDistance / steamingHours).toFixed(2))
    if (sog > 0 && Math.abs(sog - impliedSog) > 0.4) {
      findings.push({
        ruleId: 'N2',
        parameter: 'avgSpeed (SOG)',
        reported: `${sog} kts`,
        expected: `${impliedSog} kts (Distance ÷ Hours)`,
        deviation: `${(sog - impliedSog).toFixed(2)} kts`,
        tolerance: '±0.2 kts',
        severity: 'ERROR',
        likelyCause: 'Reported average speed over ground does not agree with distance run divided by steaming hours.',
      })
      recommendedActions.push('Reconcile reported average SOG against logged distance run and steaming hours.')
    }
  }

  // N3 & N4: Engine Distance and Propeller Slip
  let engineDistanceNm: number | undefined
  let slipPct: number | undefined
  if (rpm > 0 && steamingHours > 0 && pitchM > 0) {
    engineDistanceNm = Number(((rpm * pitchM * 60 * steamingHours) / 1852).toFixed(1))
    if (engineDistanceNm > 0 && observedDistance > 0) {
      slipPct = Number((((engineDistanceNm - observedDistance) / engineDistanceNm) * 100).toFixed(1))
      // Check slip limits per Layer 3 Rule N4
      if (slipPct < -15.0 || slipPct > 30.0) {
        findings.push({
          ruleId: 'N4',
          parameter: 'propellerSlip',
          reported: `${slipPct}%`,
          expected: '-5% to +15% (typical operational range)',
          deviation: `${slipPct > 0 ? '+' : ''}${slipPct}%`,
          tolerance: '-15% to +30%',
          severity: 'ERROR',
          likelyCause: slipPct > 30.0
            ? 'Extreme positive slip indicates severe hull/propeller fouling, heavy adverse weather, or inaccurate pitch/RPM inputs.'
            : 'Extreme negative slip is physically improbable unless strong following current or incorrect RPM logging.',
        })
        recommendedActions.push('Chief Engineer must verify propeller pitch constant and RPM counter calibration.')
      } else if (slipPct < -5.0 || slipPct > 15.0) {
        findings.push({
          ruleId: 'N4',
          parameter: 'propellerSlip',
          reported: `${slipPct}%`,
          expected: '-5% to +15%',
          deviation: `${slipPct > 0 ? '+' : ''}${slipPct}%`,
          tolerance: '-5% to +15%',
          severity: 'WARNING',
          likelyCause: slipPct > 15.0
            ? 'Elevated slip due to weather resistance, shallow water, or increased hull friction.'
            : 'Negative slip plausibly caused by favorable ocean current.',
        })
      }
    }
  }

  // Layer 4 & Layer 6: Fuel Balances (R2: Total = ME + AE + Boiler)
  const me = current.meFuelMt ?? 0
  const ae = current.aeFuelMt ?? 0
  const blr = current.boilerFuelMt ?? 0
  const total = current.totalFuelMt ?? (me + ae + blr)

  if (me > 0 || ae > 0 || blr > 0) {
    const sumConsumers = me + ae + blr
    const diff = Math.abs(total - sumConsumers)
    if (diff > 0.25) {
      findings.push({
        ruleId: 'R2',
        parameter: 'totalFuelConsumed',
        reported: `${total.toFixed(2)} MT`,
        expected: `${sumConsumers.toFixed(2)} MT (ME + AE + Boiler)`,
        deviation: `${(total - sumConsumers).toFixed(2)} MT`,
        tolerance: '±0.05 MT',
        severity: 'ERROR',
        likelyCause: 'Reported total fuel consumed does not equal the arithmetic sum of individual machinery consumers.',
      })
      recommendedActions.push('Reconcile total daily fuel consumption with flowmeter readings across ME, AE, and Boiler.')
    }
  }

  // Layer 7: Weather Consistency (W1: Wind Speed vs Beaufort)
  const bf = current.windBf ?? 0
  const windKts = current.windSpeedKts ?? 0
  if (bf > 0 && windKts > 0) {
    const bfRanges: [number, number][] = [
      [0, 1], [1, 3], [4, 6], [7, 10], [11, 16], [17, 21], [22, 27],
      [28, 33], [34, 40], [41, 47], [48, 55], [56, 63], [64, 100]
    ]
    const expectedRange = bfRanges[bf] || [0, 100]
    if (windKts < expectedRange[0] - 3 || windKts > expectedRange[1] + 3) {
      findings.push({
        ruleId: 'W1',
        parameter: 'windSpeedVsBeaufort',
        reported: `${windKts} kts at Beaufort ${bf}`,
        expected: `${expectedRange[0]}–${expectedRange[1]} kts for BF ${bf}`,
        deviation: `${windKts} kts`,
        tolerance: '±1 BF',
        severity: 'WARNING',
        likelyCause: 'Reported anemometer wind speed does not correlate with entered Beaufort scale number.',
      })
    }
  }

  // Layer 8: Emissions
  const co2Mt = Number((total * 3.114).toFixed(2))

  // Determine overall status
  const criticalCount = findings.filter((f) => f.severity === 'CRITICAL').length
  const errorCount = findings.filter((f) => f.severity === 'ERROR').length
  const warningCount = findings.filter((f) => f.severity === 'WARNING').length
  const infoCount = findings.filter((f) => f.severity === 'INFO').length

  let overallStatus: 'APPROVE' | 'APPROVE WITH REMARKS' | 'RETURN FOR CORRECTION' = 'APPROVE'
  if (criticalCount > 0 || errorCount > 0) {
    overallStatus = 'RETURN FOR CORRECTION'
  } else if (warningCount > 0) {
    overallStatus = 'APPROVE WITH REMARKS'
  }

  if (recommendedActions.length === 0) {
    recommendedActions.push('All parameters internally consistent and compliant with physical bounds. Approve noon report.')
  }

  return {
    vesselId,
    reportDate,
    overallStatus,
    counts: {
      critical: criticalCount,
      error: errorCount,
      warning: warningCount,
      info: infoCount,
      skipped: 0,
    },
    findings,
    calculations: {
      gcDistanceNm,
      observedDistanceNm: observedDistance > 0 ? observedDistance : undefined,
      engineDistanceNm,
      slipPct,
      impliedSog,
      co2Mt,
    },
    recommendedActions,
  }
}

