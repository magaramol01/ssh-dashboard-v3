/**
 * Voyage Optimization Domain Engine
 *
 * Maps real per-day CII noon report data (from `/api/vessels/cii-date-range`)
 * into the shapes the Voyage Optimization screen renders, and derives
 * comparative route strategies and dispatch advisories. Route-strategy and
 * advisory formulas are documented models — see EU_ETS_CARBON_PRICE_EUR_PER_TON
 * and DEFAULT_LAYCAN_BUFFER_HOURS for the two inputs with no live data source.
 */

import { parseDmsCoordinate } from './vessel-voyage'

export type CIIRating = 'A' | 'B' | 'C' | 'D' | 'E'

export interface CiiDateRangeRecord {
  attainedCII: number
  reportDateTime: string
  voyage: string
  distance: number
  avgSpeed: number
  draftFwd: number
  draftAft: number
  massOfCo2: number
  transportWork: number
  totalConsumption: number
  deadweight: string
  vessel: string
  reportType: string
  CIIRating: {
    band: CIIRating
    bandColor: string
    requiredCII: number
    attainedCII: number
    ciiBoundaries: { superior: number; lower: number; upper: number; inferior: number }
  }
  consumptionData: Record<string, { value: number; label: string; coefficient: number }>
  vesselInfo?: { deadweight?: string }
  noonreportdata?: {
    Latitude?: string
    Longitude?: string
    Wind_Force?: number
    Wind_Speed?: number
    Wind_Direction?: string
    Wave_Height?: number
    Swell_Direction?: string
    Remarks?: string
  }
}

export interface DailyNoonReport {
  dayNumber: number
  dateIso: string
  dateFormatted: string
  coords: [number, number] // [lat, lng]
  distanceRunNm: number
  cumulativeDistanceNm: number
  sog: number
  fuelConsumedMt: {
    byType: Record<string, { value: number; label: string }>
    total: number
  }
  cumulativeFuelMt: number
  totalCo2Mt: number
  transportWork: number
  attainedCii: number
  rating: CIIRating
  requiredCii: number
  ciiBoundaries: { superior: number; lower: number; upper: number; inferior: number }
  draftFwdM: number
  draftAftM: number
  weather: {
    beaufort: number
    windSpeedKts: number
    windDirectionDeg: number
    waveHeightM: number
    swellDirection: string
    shortForecast: string
    source: 'cii-api'
  }
}

export interface RouteStrategyOption {
  id: 'current' | 'lowest-fuel' | 'safest' | 'fastest'
  name: string
  description: string
  distanceNm: number
  etaIso: string
  etaFormatted: string
  avgSpeedKts: number
  totalFuelMt: number
  projectedCii: number
  projectedRating: CIIRating
  fuelSavingsMt: number
  carbonSavingsEur: number
  colorHex: string
  dashArray?: string
  waypoints: [number, number][]
  basis: 'live' | 'modeled-estimate'
}

export interface VoyageAdvisory {
  id: string
  type: 'speed' | 'weather' | 'cii' | 'laycan'
  priority: 'critical' | 'warning' | 'info'
  title: string
  description: string
  actionLabel?: string
  applied: boolean
}

// IMO Carbon Conversion Factor (MEPC.308(73)) for VLSFO-equivalent fuel
const CF_VLSFO = 3.15

/** Modeled placeholder: no live EU ETS price feed is wired up yet. */
export const EU_ETS_CARBON_PRICE_EUR_PER_TON = 85

/** Modeled placeholder: no charter-party/laycan feed is wired up yet. */
export const DEFAULT_LAYCAN_BUFFER_HOURS = 8.5

/**
 * Calculates IMO Attained CII in g CO2 / (MT * NM).
 * Fallback only — real per-day records already carry `attainedCII` from the API.
 */
export function calculateCii(totalCo2Mt: number, transportWorkMtNm: number): number {
  if (transportWorkMtNm <= 0 || totalCo2Mt <= 0) return 0
  return Number(((totalCo2Mt * 1e6) / transportWorkMtNm).toFixed(2))
}

/**
 * Maps Attained CII value to IMO Rating Band (A to E).
 * Fallback only — real per-day records already carry `CIIRating.band` from the API.
 */
export function resolveCiiRating(cii: number): CIIRating {
  if (cii <= 0) return 'C'
  if (cii <= 3.3) return 'A'
  if (cii <= 4.0) return 'B'
  if (cii <= 4.9) return 'C'
  if (cii <= 5.8) return 'D'
  return 'E'
}

/**
 * Maps live CII date-range API records into the DailyNoonReport shape the
 * screen renders. Records are sorted chronologically and numbered D1..Dn.
 */
export function mapCiiRecordsToDailyNoons(records: CiiDateRangeRecord[]): DailyNoonReport[] {
  const sorted = [...records].sort(
    (a, b) => new Date(a.reportDateTime).getTime() - new Date(b.reportDateTime).getTime()
  )

  let cumulativeDistance = 0
  let cumulativeFuel = 0

  return sorted.map((record, index) => {
    cumulativeDistance += record.distance || 0
    cumulativeFuel += record.totalConsumption || 0

    const lat = parseDmsCoordinate(record.noonreportdata?.Latitude || '')
    const lng = parseDmsCoordinate(record.noonreportdata?.Longitude || '')

    const byType: Record<string, { value: number; label: string }> = {}
    for (const [key, fuel] of Object.entries(record.consumptionData || {})) {
      byType[key] = { value: fuel.value, label: fuel.label }
    }

    const reportDate = new Date(record.reportDateTime)
    const rating = record.CIIRating?.band || resolveCiiRating(record.attainedCII)

    return {
      dayNumber: index + 1,
      dateIso: record.reportDateTime,
      dateFormatted: reportDate.toISOString().slice(0, 10) + ' 12:00 UTC',
      coords: [Number.isNaN(lat) ? 0 : lat, Number.isNaN(lng) ? 0 : lng],
      distanceRunNm: record.distance || 0,
      cumulativeDistanceNm: Math.round(cumulativeDistance * 10) / 10,
      sog: record.avgSpeed || 0,
      fuelConsumedMt: {
        byType,
        total: Math.round((record.totalConsumption || 0) * 10) / 10,
      },
      cumulativeFuelMt: Math.round(cumulativeFuel * 10) / 10,
      totalCo2Mt: Math.round((record.massOfCo2 || 0) * 100) / 100,
      transportWork: Math.round(record.transportWork || 0),
      attainedCii: record.attainedCII,
      rating,
      requiredCii: record.CIIRating?.requiredCII || 0,
      ciiBoundaries: record.CIIRating?.ciiBoundaries || { superior: 0, lower: 0, upper: 0, inferior: 0 },
      draftFwdM: record.draftFwd || 0,
      draftAftM: record.draftAft || 0,
      weather: {
        beaufort: record.noonreportdata?.Wind_Force || 0,
        windSpeedKts: record.noonreportdata?.Wind_Speed || 0,
        windDirectionDeg: Number(record.noonreportdata?.Wind_Direction) || 0,
        waveHeightM: record.noonreportdata?.Wave_Height || 0,
        swellDirection: record.noonreportdata?.Swell_Direction || '',
        shortForecast: record.noonreportdata?.Remarks || record.reportType || '',
        source: 'cii-api',
      },
    }
  })
}

/**
 * Reads the vessel's real deadweight (MT) from a CII date-range record.
 */
export function resolveVesselDeadweightMt(records: CiiDateRangeRecord[]): number {
  const withDwt = records.find((r) => r.vesselInfo?.deadweight || r.deadweight)
  return Number(withDwt?.vesselInfo?.deadweight || withDwt?.deadweight || 0)
}

/**
 * Calculates comparative route strategies based on cubic power physics.
 * `current` reflects real voyage data (basis: 'live'); the other three are
 * documented percentage models with no live routing/weather-avoidance
 * engine behind them (basis: 'modeled-estimate').
 */
export function calculateRouteStrategies(
  baseDistanceNm: number,
  baseFuelMt: number,
  plannedSpeedKts: number,
  dwt: number,
  baseCoords?: [number, number][]
): RouteStrategyOption[] {
  const safeSpeed0 = plannedSpeedKts || 13.5
  const currentDurationHours = baseDistanceNm / safeSpeed0
  const currentEtaDate = new Date(Date.now() + currentDurationHours * 3600 * 1000)

  const currentWork = baseDistanceNm * dwt
  const currentCo2 = baseFuelMt * CF_VLSFO
  const currentCii = calculateCii(currentCo2, currentWork)

  // 1. Lowest Fuel (Fuel-Efficient): Reduces SOG by ~7% -> saves ~19% fuel via cubic law
  const ecoSpeed = Math.round(safeSpeed0 * 0.93 * 10) / 10
  const ecoHours = baseDistanceNm / ecoSpeed
  const ecoEtaDate = new Date(Date.now() + ecoHours * 3600 * 1000)
  const ecoFuel = Math.round(baseFuelMt * Math.pow(ecoSpeed / safeSpeed0, 3) * 10) / 10
  const ecoSavings = Math.round((baseFuelMt - ecoFuel) * 10) / 10
  const ecoCo2 = ecoFuel * CF_VLSFO
  const ecoCii = calculateCii(ecoCo2, currentWork)
  const carbonSavingsEur = Math.round((baseFuelMt - ecoFuel) * CF_VLSFO * EU_ETS_CARBON_PRICE_EUR_PER_TON)

  // 2. Safest (Weather Avoidance): Diverts ~2.5% distance south/around cells -> saves engine strain & wave resistance
  const safeDistance = Math.round(baseDistanceNm * 1.025)
  const safeSpeed = safeSpeed0
  const safeHours = safeDistance / safeSpeed
  const safeEtaDate = new Date(Date.now() + safeHours * 3600 * 1000)
  const safeFuel = Math.round(baseFuelMt * 1.01 * 10) / 10
  const safeWork = safeDistance * dwt
  const safeCii = calculateCii(safeFuel * CF_VLSFO, safeWork)

  // 3. Fastest: Increases SOG by ~6%
  const fastSpeed = Math.round(safeSpeed0 * 1.06 * 10) / 10
  const fastHours = baseDistanceNm / fastSpeed
  const fastEtaDate = new Date(Date.now() + fastHours * 3600 * 1000)
  const fastFuel = Math.round(baseFuelMt * Math.pow(fastSpeed / safeSpeed0, 3) * 10) / 10
  const fastCo2 = fastFuel * CF_VLSFO
  const fastCii = calculateCii(fastCo2, currentWork)

  const formatEta = (d: Date) => d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC'

  const generateOffsetCoords = (offsetLat: number, offsetLng: number): [number, number][] => {
    if (!baseCoords || baseCoords.length === 0) return []
    return baseCoords.map((pt, idx) => {
      if (idx === 0 || idx === baseCoords.length - 1) return pt
      const weight = Math.sin((idx / (baseCoords.length - 1)) * Math.PI)
      return [
        Math.round((pt[0] + offsetLat * weight) * 10000) / 10000,
        Math.round((pt[1] + offsetLng * weight) * 10000) / 10000,
      ]
    })
  }

  return [
    {
      id: 'current',
      name: 'Current Active Track',
      description: 'Real voyage distance, fuel burn rate, and deadweight from live noon-report data.',
      distanceNm: baseDistanceNm,
      etaIso: currentEtaDate.toISOString(),
      etaFormatted: formatEta(currentEtaDate),
      avgSpeedKts: safeSpeed0,
      totalFuelMt: baseFuelMt,
      projectedCii: currentCii,
      projectedRating: resolveCiiRating(currentCii),
      fuelSavingsMt: 0,
      carbonSavingsEur: 0,
      colorHex: '#3b82f6',
      waypoints: baseCoords || [],
      basis: 'live',
    },
    {
      id: 'lowest-fuel',
      name: 'Lowest Fuel (Eco Optimized)',
      description: 'Modeled: power-optimized profile reducing SOG to minimize cubic hydrodynamic drag.',
      distanceNm: baseDistanceNm,
      etaIso: ecoEtaDate.toISOString(),
      etaFormatted: formatEta(ecoEtaDate),
      avgSpeedKts: ecoSpeed,
      totalFuelMt: ecoFuel,
      projectedCii: ecoCii,
      projectedRating: resolveCiiRating(ecoCii),
      fuelSavingsMt: ecoSavings,
      carbonSavingsEur,
      colorHex: '#10b981',
      dashArray: '6 4',
      waypoints: baseCoords || [],
      basis: 'modeled-estimate',
    },
    {
      id: 'safest',
      name: 'Safest (Weather Avoidance)',
      description: 'Modeled: steers clear of wave heights > 3.2m and heavy swells in mid-passage.',
      distanceNm: safeDistance,
      etaIso: safeEtaDate.toISOString(),
      etaFormatted: formatEta(safeEtaDate),
      avgSpeedKts: safeSpeed,
      totalFuelMt: safeFuel,
      projectedCii: safeCii,
      projectedRating: resolveCiiRating(safeCii),
      fuelSavingsMt: -Math.round((safeFuel - baseFuelMt) * 10) / 10,
      carbonSavingsEur: -Math.round((safeFuel - baseFuelMt) * CF_VLSFO * EU_ETS_CARBON_PRICE_EUR_PER_TON),
      colorHex: '#06b6d4',
      dashArray: '4 4',
      waypoints: generateOffsetCoords(-1.8, 1.2),
      basis: 'modeled-estimate',
    },
    {
      id: 'fastest',
      name: 'Fastest Transit',
      description: 'Modeled: maximum continuous rating to meet tight laycan deadlines.',
      distanceNm: baseDistanceNm,
      etaIso: fastEtaDate.toISOString(),
      etaFormatted: formatEta(fastEtaDate),
      avgSpeedKts: fastSpeed,
      totalFuelMt: fastFuel,
      projectedCii: fastCii,
      projectedRating: resolveCiiRating(fastCii),
      fuelSavingsMt: -Math.round((fastFuel - baseFuelMt) * 10) / 10,
      carbonSavingsEur: -Math.round((fastFuel - baseFuelMt) * CF_VLSFO * EU_ETS_CARBON_PRICE_EUR_PER_TON),
      colorHex: '#8b5cf6',
      dashArray: '2 4',
      waypoints: baseCoords || [],
      basis: 'modeled-estimate',
    },
  ]
}

/**
 * Derives actionable dispatch and navigation advisories.
 * Modeled: no live routing/charter-party engine backs these decisions yet.
 */
export function deriveVoyageAdvisories(
  currentCiiRating: CIIRating,
  targetCiiRating: CIIRating = 'B',
  weatherAhead = { beaufort: 5, waveHeightM: 2.6 },
  speedDeltaKts = 1.2
): VoyageAdvisory[] {
  const advisories: VoyageAdvisory[] = []

  if (currentCiiRating !== 'A' && currentCiiRating !== targetCiiRating) {
    advisories.push({
      id: 'adv-speed',
      type: 'speed',
      priority: currentCiiRating >= 'D' ? 'critical' : 'warning',
      title: `Reduce Main Engine RPM: target -${speedDeltaKts} kts`,
      description: `Current trajectory is tracking CII Band ${currentCiiRating}. Reducing speed toward the modeled Eco strategy secures Band ${targetCiiRating} at arrival.`,
      actionLabel: 'Apply Speed Reduction Profile',
      applied: false,
    })
  }

  if (weatherAhead.beaufort >= 6 || weatherAhead.waveHeightM >= 3.0) {
    advisories.push({
      id: 'adv-weather',
      type: 'weather',
      priority: 'warning',
      title: `Adverse Sea State: ${weatherAhead.waveHeightM}m waves ahead (BF ${weatherAhead.beaufort})`,
      description: `Heavy head swell recorded at the last noon position. The modeled Safest strategy diverts around it.`,
      actionLabel: 'Activate Weather Diversion',
      applied: false,
    })
  } else {
    advisories.push({
      id: 'adv-weather',
      type: 'weather',
      priority: 'info',
      title: `Favorable Weather Corridor Ahead`,
      description: `Following seas and moderate wind (BF ${weatherAhead.beaufort}, ${weatherAhead.waveHeightM}m seas) recorded at the last noon position.`,
      applied: false,
    })
  }

  advisories.push({
    id: 'adv-laycan',
    type: 'laycan',
    priority: 'info',
    title: `Port Arrival Buffer: Modeled Charter Party Window`,
    description: `Laycan buffer is a modeled estimate (${DEFAULT_LAYCAN_BUFFER_HOURS}h) — no live charter-party feed is wired up yet.`,
    applied: false,
  })

  return advisories
}
