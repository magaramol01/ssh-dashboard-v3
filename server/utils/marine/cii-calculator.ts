/**
 * IMO Carbon Intensity Indicator (CII) & Emissions Calculation Engine.
 * Implements IMO MEPC.336(76), MEPC.337(76), and MEPC.338(76) guidelines.
 */

export interface CIIBoundaries {
  superior_boundary: number
  lower_boundary: number
  upper_boundary: number
  inferior_boundary: number
  requiredCII?: number
}

export type CIIRating = 'A' | 'B' | 'C' | 'D' | 'E'

export const DEFAULT_FUEL_LABELS: Record<string, string> = {
  hfo: 'Heavy Fuel Oil (HFO)',
  vlsfo: 'Very Low Sulfur Fuel Oil (VLSFO)',
  ulsgo: 'Ultra Low Sulfur Gas Oil (ULSGO)',
  vlsgo: 'Very Low Sulfur Gas Oil (VLSGO)',
  mgo: 'Marine Gas Oil (MGO)',
  lsmgo: 'Low Sulfur Marine Gas Oil (LSMGO)',
  lfo: 'Light Fuel Oil (LFO)',
  lng: 'Liquefied Natural Gas (LNG)',
}

/**
 * Standard IMO CF Carbon conversion factors (tonnes CO2 / tonne fuel).
 * MEPC.308(73) / MEPC.336(76).
 */
export const DEFAULT_FUEL_COEFFICIENTS: Record<string, number> = {
  hfo: 3.114,
  vlsfo: 3.15,
  ulsgo: 3.206,
  vlsgo: 3.206,
  mgo: 3.206,
  lsmgo: 3.206,
  lfo: 3.115,
  lng: 2.75,
}

/**
 * Speed reduction factors based on cubic propulsion power curve.
 */
export const SPEED_REDUCTION_FACTORS = {
  fivePercent: 0.857662686383333,
  tenPercent: 0.7768532265,
  fifteenPercent: 0.614446353166667,
  twentyPercent: 0.511799218,
  twentyFivePercent: 0.421580749833333,
}

/**
 * Transport work = Distance (NM) * Deadweight (MT).
 */
export function calculateTransportWork(distanceNm: number, deadweightMt: number): number {
  if (distanceNm <= 0 || deadweightMt <= 0) return 0
  return Number((distanceNm * deadweightMt).toFixed(2))
}

/**
 * Attained CII in g CO2 / (MT * NM).
 * Attained CII = (Total Mass of CO2 in MT * 10^6) / Transport Work.
 */
export function calculateAttainedCII(totalMassOfCo2Mt: number, transportWork: number): number {
  if (!transportWork || transportWork <= 0 || !totalMassOfCo2Mt || totalMassOfCo2Mt <= 0) {
    return 0
  }
  return Number(((totalMassOfCo2Mt * 1e6) / transportWork).toFixed(2))
}

/**
 * Determine IMO rating band (A through E) from Attained CII against boundary thresholds.
 */
export function getCIIRating(attainedCii: number, boundaries: CIIBoundaries): CIIRating {
  if (!boundaries || attainedCii <= 0) return 'C'

  const val = typeof attainedCii === 'number' ? attainedCii : parseFloat(attainedCii)
  if (val <= boundaries.superior_boundary) return 'A'
  if (val <= boundaries.lower_boundary) return 'B'
  if (val <= boundaries.upper_boundary) return 'C'
  if (val <= boundaries.inferior_boundary) return 'D'
  return 'E'
}

export interface SpeedReductionScenario {
  reductionPercent: number
  multiplier: number
  projectedCii: number
  projectedRating: CIIRating
  co2SavingsMt: number
  projectedCo2Mt: number
}

/**
 * Calculate What-If Speed Reduction scenarios (-5%, -10%, -15%, -20%, -25%).
 */
export function calculateSpeedReductionScenarios(
  actualMassOfCo2Mt: number,
  transportWork: number,
  boundaries: CIIBoundaries
): SpeedReductionScenario[] {
  if (!transportWork || transportWork <= 0 || !actualMassOfCo2Mt || actualMassOfCo2Mt <= 0) {
    return [5, 10, 15, 20, 25].map((pct) => ({
      reductionPercent: pct,
      multiplier: 1,
      projectedCii: 0,
      projectedRating: 'C',
      co2SavingsMt: 0,
      projectedCo2Mt: 0,
    }))
  }

  const steps = [
    { pct: 5, mult: SPEED_REDUCTION_FACTORS.fivePercent },
    { pct: 10, mult: SPEED_REDUCTION_FACTORS.tenPercent },
    { pct: 15, mult: SPEED_REDUCTION_FACTORS.fifteenPercent },
    { pct: 20, mult: SPEED_REDUCTION_FACTORS.twentyPercent },
    { pct: 25, mult: SPEED_REDUCTION_FACTORS.twentyFivePercent },
  ]

  return steps.map(({ pct, mult }) => {
    const projectedCo2 = actualMassOfCo2Mt * mult
    const projectedCii = Number(((projectedCo2 * 1e6) / transportWork).toFixed(2))
    const projectedRating = getCIIRating(projectedCii, boundaries)
    const co2Savings = Number((actualMassOfCo2Mt - projectedCo2).toFixed(2))

    return {
      reductionPercent: pct,
      multiplier: Number(mult.toFixed(4)),
      projectedCii,
      projectedRating,
      co2SavingsMt: co2Savings,
      projectedCo2Mt: Number(projectedCo2.toFixed(2)),
    }
  })
}

export interface FuelConsumptionDetail {
  fuelType: string
  fuelLabel: string
  coefficient: number
  seaMt: number
  portMt: number
  totalMt: number
  co2Mt: number
}

/**
 * Calculate total fuel consumption by fuel grade, splitting into At Sea vs At Port.
 */
export function calculateFuelTotals(
  ciiRecords: any[],
  customCoeffs: Record<string, number> = DEFAULT_FUEL_COEFFICIENTS,
  customLabels: Record<string, string> = DEFAULT_FUEL_LABELS
): FuelConsumptionDetail[] {
  const fuelMap = new Map<string, { sea: number; port: number }>()

  for (const rec of ciiRecords || []) {
    const isPort =
      rec.reportType === 'NOON_PORT' ||
      rec.reportType === 'PORT' ||
      rec.reportType === 'ARRIVAL' ||
      (rec.runningHoursAtPort && rec.runningHoursAtPort > (rec.runningHoursAtSea || 0))

    const cons = rec.consumptionData || {}
    for (const [fuelKey, fuelObj] of Object.entries(cons)) {
      const cleanKey = fuelKey.toLowerCase().trim()
      const val = typeof fuelObj === 'object' && fuelObj !== null && 'value' in fuelObj
        ? parseFloat((fuelObj as any).value) || 0
        : parseFloat(fuelObj as any) || 0

      if (val <= 0) continue

      const existing = fuelMap.get(cleanKey) || { sea: 0, port: 0 }
      if (isPort) {
        existing.port += val
      } else {
        existing.sea += val
      }
      fuelMap.set(cleanKey, existing)
    }
  }

  const results: FuelConsumptionDetail[] = []
  for (const [fuelType, amounts] of fuelMap.entries()) {
    const coeff = customCoeffs[fuelType] ?? 3.15
    const label = customLabels[fuelType] ?? fuelType.toUpperCase()
    const sea = Number(amounts.sea.toFixed(2))
    const port = Number(amounts.port.toFixed(2))
    const total = Number((sea + port).toFixed(2))
    const co2 = Number((total * coeff).toFixed(2))

    results.push({
      fuelType,
      fuelLabel: label,
      coefficient: coeff,
      seaMt: sea,
      portMt: port,
      totalMt: total,
      co2Mt: co2,
    })
  }

  // Sort descending by total tonnage
  return results.sort((a, b) => b.totalMt - a.totalMt)
}

/**
 * Aggregate operational hours: Sea vs Port.
 */
export function calculateOperationalHours(ciiRecords: any[]): { seaHours: number; portHours: number } {
  let seaHours = 0
  let portHours = 0

  for (const rec of ciiRecords || []) {
    seaHours += parseFloat(rec.runningHoursAtSea) || 0
    portHours += parseFloat(rec.runningHoursAtPort) || 0
  }

  return {
    seaHours: Number(seaHours.toFixed(1)),
    portHours: Number(portHours.toFixed(1)),
  }
}

/**
 * Calculate average forward and aft drafts.
 */
export function calculateDraftAverages(ciiRecords: any[]): { draftFwd: number | null; draftAft: number | null } {
  const fwds: number[] = []
  const afts: number[] = []

  for (const rec of ciiRecords || []) {
    if (rec.draftFwd !== undefined && rec.draftFwd !== null) {
      const f = parseFloat(rec.draftFwd)
      if (!isNaN(f) && f > 0) fwds.push(f)
    }
    if (rec.draftAft !== undefined && rec.draftAft !== null) {
      const a = parseFloat(rec.draftAft)
      if (!isNaN(a) && a > 0) afts.push(a)
    }
  }

  const draftFwd = fwds.length ? Number((fwds.reduce((acc, c) => acc + c, 0) / fwds.length).toFixed(2)) : null
  const draftAft = afts.length ? Number((afts.reduce((acc, c) => acc + c, 0) / afts.length).toFixed(2)) : null

  return { draftFwd, draftAft }
}
