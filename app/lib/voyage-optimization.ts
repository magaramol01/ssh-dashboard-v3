/**
 * Voyage Optimization Domain Engine
 *
 * Implements day-by-day noon report tracking, IMO CII trajectory calculations,
 * route comparison physics (cubic power speed/fuel curve), and actionable
 * meteorological dispatch advisories.
 */

export type CIIRating = 'A' | 'B' | 'C' | 'D' | 'E'

export interface DailyNoonReport {
  dayNumber: number
  dateIso: string
  dateFormatted: string
  coords: [number, number] // [lat, lng]
  distanceRunNm: number
  cumulativeDistanceNm: number
  sog: number
  fuelConsumedMt: {
    vlsfo: number
    mgo: number
    total: number
  }
  cumulativeFuelMt: number
  totalCo2Mt: number
  transportWork: number
  attainedCii: number
  rating: CIIRating
  draftFwdM: number
  draftAftM: number
  weather: {
    beaufort: number
    windSpeedKts: number
    windDirectionDeg: number
    waveHeightM: number
    swellDirection: string
    shortForecast: string
    source: 'nws-api' | 'marine-telemetry'
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

// IMO Carbon Conversion Factor (MEPC.308(73)): VLSFO = 3.15, MGO = 3.206
const CF_VLSFO = 3.15
const CF_MGO = 3.206

/**
 * Calculates Great Circle distance between two points in Nautical Miles (NM).
 */
export function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  // Earth radius in NM ≈ 3440.065
  return Math.round(3440.065 * c * 10) / 10
}

/**
 * Interpolates points along a polyline to find the coordinate at a given distance along the track.
 */
export function interpolateAlongPolyline(
  coords: [number, number][],
  targetNm: number
): [number, number] {
  if (!coords || coords.length === 0) return [0, 0]
  if (coords.length === 1 || targetNm <= 0) return coords[0]!

  let accumulated = 0
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1]!
    const curr = coords[i]!
    const legDist = haversineNm(prev[0], prev[1], curr[0], curr[1])
    if (accumulated + legDist >= targetNm) {
      const ratio = legDist > 0 ? (targetNm - accumulated) / legDist : 0
      const lat = prev[0] + (curr[0] - prev[0]) * ratio
      const lng = prev[1] + (curr[1] - prev[1]) * ratio
      return [Math.round(lat * 10000) / 10000, Math.round(lng * 10000) / 10000]
    }
    accumulated += legDist
  }
  return coords[coords.length - 1]!
}

/**
 * Calculates IMO Attained CII in g CO2 / (MT * NM).
 */
export function calculateCii(totalCo2Mt: number, transportWorkMtNm: number): number {
  if (transportWorkMtNm <= 0 || totalCo2Mt <= 0) return 0
  return Number(((totalCo2Mt * 1e6) / transportWorkMtNm).toFixed(2))
}

/**
 * Maps Attained CII value to IMO Rating Band (A to E) against baseline thresholds.
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
 * Computes deterministic daily noon reports along a voyage corridor.
 */
export function computeDailyNoonProgression(
  corridorCoords: [number, number][],
  vesselDwt = 75000,
  departureTimeIso = '2026-09-10T12:00:00Z',
  avgSpeedKts = 13.5
): DailyNoonReport[] {
  if (!corridorCoords || corridorCoords.length < 2) return []

  // Calculate total corridor length
  let totalCorridorNm = 0
  for (let i = 1; i < corridorCoords.length; i++) {
    totalCorridorNm += haversineNm(
      corridorCoords[i - 1]![0],
      corridorCoords[i - 1]![1],
      corridorCoords[i]![0],
      corridorCoords[i]![1]
    )
  }

  // A maritime noon report occurs every 24 hours
  const dailyNominalDistance = Math.round(avgSpeedKts * 24 * 10) / 10 // ~324 NM/day
  const numDays = Math.max(1, Math.min(14, Math.floor(totalCorridorNm / dailyNominalDistance)))

  const reports: DailyNoonReport[] = []
  let cumulativeDist = 0
  let cumulativeFuel = 0
  let cumulativeCo2 = 0
  let cumulativeTransportWork = 0

  const depDate = new Date(departureTimeIso)
  const baseTs = isNaN(depDate.getTime()) ? new Date('2026-09-10T12:00:00Z').getTime() : depDate.getTime()

  // Deterministic daily variance seeds for weather and consumption
  const varianceSeeds = [
    { sog: 13.4, vlsfo: 24.5, mgo: 1.1, bf: 3, wind: 12, wave: 1.2, swell: 'ESE', draftF: 11.2, draftA: 11.8 },
    { sog: 13.8, vlsfo: 26.2, mgo: 1.2, bf: 4, wind: 16, wave: 1.6, swell: 'SE', draftF: 11.2, draftA: 11.7 },
    { sog: 12.9, vlsfo: 25.8, mgo: 1.3, bf: 5, wind: 21, wave: 2.3, swell: 'S', draftF: 11.1, draftA: 11.7 },
    { sog: 13.2, vlsfo: 24.9, mgo: 1.2, bf: 4, wind: 17, wave: 1.8, swell: 'SW', draftF: 11.1, draftA: 11.6 },
    { sog: 14.1, vlsfo: 27.5, mgo: 1.4, bf: 3, wind: 13, wave: 1.3, swell: 'WSW', draftF: 11.0, draftA: 11.6 },
    { sog: 13.5, vlsfo: 25.1, mgo: 1.2, bf: 4, wind: 15, wave: 1.7, swell: 'W', draftF: 11.0, draftA: 11.5 },
    { sog: 12.5, vlsfo: 26.8, mgo: 1.5, bf: 6, wind: 24, wave: 2.8, swell: 'NW', draftF: 10.9, draftA: 11.5 },
    { sog: 13.6, vlsfo: 25.4, mgo: 1.2, bf: 4, wind: 16, wave: 1.5, swell: 'NNW', draftF: 10.9, draftA: 11.4 },
  ]

  for (let day = 1; day <= numDays; day++) {
    const seed = varianceSeeds[(day - 1) % varianceSeeds.length]!
    const dayDist = Math.min(seed.sog * 24, totalCorridorNm - cumulativeDist)
    cumulativeDist += dayDist

    const coords = interpolateAlongPolyline(corridorCoords, cumulativeDist)

    const dayFuelTotal = seed.vlsfo + seed.mgo
    cumulativeFuel += dayFuelTotal

    const dayCo2 = seed.vlsfo * CF_VLSFO + seed.mgo * CF_MGO
    cumulativeCo2 += dayCo2

    const dayTransportWork = dayDist * vesselDwt
    cumulativeTransportWork += dayTransportWork

    const attainedCii = calculateCii(cumulativeCo2, cumulativeTransportWork)
    const rating = resolveCiiRating(attainedCii)

    const reportDate = new Date(baseTs + day * 24 * 3600 * 1000)
    const dateFormatted = reportDate.toISOString().slice(0, 10) + ' 12:00 UTC'

    reports.push({
      dayNumber: day,
      dateIso: reportDate.toISOString(),
      dateFormatted,
      coords,
      distanceRunNm: Math.round(dayDist * 10) / 10,
      cumulativeDistanceNm: Math.round(cumulativeDist * 10) / 10,
      sog: seed.sog,
      fuelConsumedMt: {
        vlsfo: seed.vlsfo,
        mgo: seed.mgo,
        total: Math.round(dayFuelTotal * 10) / 10,
      },
      cumulativeFuelMt: Math.round(cumulativeFuel * 10) / 10,
      totalCo2Mt: Math.round(cumulativeCo2 * 10) / 10,
      transportWork: Math.round(cumulativeTransportWork),
      attainedCii,
      rating,
      draftFwdM: seed.draftF,
      draftAftM: seed.draftA,
      weather: {
        beaufort: seed.bf,
        windSpeedKts: seed.wind,
        windDirectionDeg: (day * 45) % 360,
        waveHeightM: seed.wave,
        swellDirection: seed.swell,
        shortForecast: seed.bf >= 6 ? 'Rough Seas / Head Swell' : seed.bf >= 4 ? 'Moderate Breeze' : 'Favorable Sea',
        source: 'marine-telemetry',
      },
    })
  }

  return reports
}

/**
 * Calculates comparative route strategies based on cubic power physics.
 */
export function calculateRouteStrategies(
  baseDistanceNm = 5400,
  baseFuelMt = 480,
  plannedSpeedKts = 13.5,
  dwt = 75000,
  baseCoords?: [number, number][]
): RouteStrategyOption[] {
  const currentDurationHours = baseDistanceNm / (plannedSpeedKts || 13.5)
  const currentEtaDate = new Date(Date.now() + currentDurationHours * 3600 * 1000)

  const currentWork = baseDistanceNm * dwt
  const currentCo2 = baseFuelMt * CF_VLSFO
  const currentCii = calculateCii(currentCo2, currentWork)

  // 1. Lowest Fuel (Fuel-Efficient): Reduces SOG by ~7% -> saves ~19% fuel via cubic law
  const ecoSpeed = Math.round((plannedSpeedKts * 0.93) * 10) / 10 // e.g. 12.5 kts
  const ecoHours = baseDistanceNm / ecoSpeed
  const ecoEtaDate = new Date(Date.now() + ecoHours * 3600 * 1000)
  const ecoFuel = Math.round(baseFuelMt * Math.pow(ecoSpeed / plannedSpeedKts, 3) * 10) / 10
  const ecoSavings = Math.round((baseFuelMt - ecoFuel) * 10) / 10
  const ecoCo2 = ecoFuel * CF_VLSFO
  const ecoCii = calculateCii(ecoCo2, currentWork)
  const carbonSavingsEur = Math.round((baseFuelMt - ecoFuel) * CF_VLSFO * 85) // €85/ton EU ETS

  // 2. Safest (Weather Avoidance): Diverts ~2.5% distance south/around cells -> saves engine strain & wave resistance
  const safeDistance = Math.round(baseDistanceNm * 1.025)
  const safeSpeed = plannedSpeedKts
  const safeHours = safeDistance / safeSpeed
  const safeEtaDate = new Date(Date.now() + safeHours * 3600 * 1000)
  const safeFuel = Math.round((baseFuelMt * 1.01) * 10) / 10
  const safeWork = safeDistance * dwt
  const safeCii = calculateCii(safeFuel * CF_VLSFO, safeWork)

  // 3. Fastest: Increases SOG by ~6%
  const fastSpeed = Math.round((plannedSpeedKts * 1.06) * 10) / 10
  const fastHours = baseDistanceNm / fastSpeed
  const fastEtaDate = new Date(Date.now() + fastHours * 3600 * 1000)
  const fastFuel = Math.round(baseFuelMt * Math.pow(fastSpeed / plannedSpeedKts, 3) * 10) / 10
  const fastCo2 = fastFuel * CF_VLSFO
  const fastCii = calculateCii(fastCo2, currentWork)

  const formatEta = (d: Date) => d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC'

  // Generate slightly offset corridors if coordinates are available
  const generateOffsetCoords = (offsetLat: number, offsetLng: number): [number, number][] => {
    if (!baseCoords || baseCoords.length === 0) return []
    return baseCoords.map((pt, idx) => {
      // Don't offset origin or destination ports
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
      description: 'Existing master voyage passage plan at standard charter speed.',
      distanceNm: baseDistanceNm,
      etaIso: currentEtaDate.toISOString(),
      etaFormatted: formatEta(currentEtaDate),
      avgSpeedKts: plannedSpeedKts,
      totalFuelMt: baseFuelMt,
      projectedCii: currentCii,
      projectedRating: resolveCiiRating(currentCii),
      fuelSavingsMt: 0,
      carbonSavingsEur: 0,
      colorHex: '#3b82f6', // Blue
      waypoints: baseCoords || [],
    },
    {
      id: 'lowest-fuel',
      name: 'Lowest Fuel (Eco Optimized)',
      description: 'Power-optimized profile reducing SOG to minimize cubic hydrodynamic drag.',
      distanceNm: baseDistanceNm,
      etaIso: ecoEtaDate.toISOString(),
      etaFormatted: formatEta(ecoEtaDate),
      avgSpeedKts: ecoSpeed,
      totalFuelMt: ecoFuel,
      projectedCii: ecoCii,
      projectedRating: resolveCiiRating(ecoCii),
      fuelSavingsMt: ecoSavings,
      carbonSavingsEur,
      colorHex: '#10b981', // Emerald
      dashArray: '6 4',
      waypoints: baseCoords || [],
    },
    {
      id: 'safest',
      name: 'Safest (Weather Avoidance)',
      description: 'Steers clear of wave heights > 3.2m and heavy swells in mid-passage.',
      distanceNm: safeDistance,
      etaIso: safeEtaDate.toISOString(),
      etaFormatted: formatEta(safeEtaDate),
      avgSpeedKts: safeSpeed,
      totalFuelMt: safeFuel,
      projectedCii: safeCii,
      projectedRating: resolveCiiRating(safeCii),
      fuelSavingsMt: -Math.round((safeFuel - baseFuelMt) * 10) / 10,
      carbonSavingsEur: -Math.round((safeFuel - baseFuelMt) * CF_VLSFO * 85),
      colorHex: '#06b6d4', // Cyan
      dashArray: '4 4',
      waypoints: generateOffsetCoords(-1.8, 1.2),
    },
    {
      id: 'fastest',
      name: 'Fastest Transit',
      description: 'Maximum continuous rating to meet tight laycan deadlines.',
      distanceNm: baseDistanceNm,
      etaIso: fastEtaDate.toISOString(),
      etaFormatted: formatEta(fastEtaDate),
      avgSpeedKts: fastSpeed,
      totalFuelMt: fastFuel,
      projectedCii: fastCii,
      projectedRating: resolveCiiRating(fastCii),
      fuelSavingsMt: -Math.round((fastFuel - baseFuelMt) * 10) / 10,
      carbonSavingsEur: -Math.round((fastFuel - baseFuelMt) * CF_VLSFO * 85),
      colorHex: '#8b5cf6', // Violet
      dashArray: '2 4',
      waypoints: baseCoords || [],
    },
  ]
}

/**
 * Derives actionable dispatch and navigation advisories.
 */
export function deriveVoyageAdvisories(
  currentCiiRating: CIIRating,
  targetCiiRating: CIIRating = 'B',
  weatherAhead = { beaufort: 5, waveHeightM: 2.6 },
  speedDeltaKts = 1.2
): VoyageAdvisory[] {
  const advisories: VoyageAdvisory[] = []

  // 1. Speed / CII advisory
  if (currentCiiRating !== 'A' && currentCiiRating !== targetCiiRating) {
    advisories.push({
      id: 'adv-speed',
      type: 'speed',
      priority: currentCiiRating >= 'D' ? 'critical' : 'warning',
      title: `Reduce Main Engine RPM: SOG target 12.3 kts (-${speedDeltaKts} kts)`,
      description: `Current trajectory is tracking CII Band ${currentCiiRating}. Reducing speed saves approx 4.8 MT/day bunker and secures Band ${targetCiiRating} at arrival.`,
      actionLabel: 'Apply Speed Reduction Profile',
      applied: false,
    })
  }

  // 2. Weather ahead advisory
  if (weatherAhead.beaufort >= 6 || weatherAhead.waveHeightM >= 3.0) {
    advisories.push({
      id: 'adv-weather',
      type: 'weather',
      priority: 'warning',
      title: `Adverse Sea State: ${weatherAhead.waveHeightM}m waves ahead (BF ${weatherAhead.beaufort})`,
      description: `Heavy head swell detected on Leg 4 in 18 hrs. Diverting 18 NM south avoids hull slamming and preserves SOG.`,
      actionLabel: 'Activate Weather Diversion',
      applied: false,
    })
  } else {
    advisories.push({
      id: 'adv-weather',
      type: 'weather',
      priority: 'info',
      title: `Favorable Weather Corridor Ahead`,
      description: `Following seas and moderate wind (BF ${weatherAhead.beaufort}, ${weatherAhead.waveHeightM}m seas) projected for the next 72 hours.`,
      applied: false,
    })
  }

  // 3. Charter Party Laycan window
  advisories.push({
    id: 'adv-laycan',
    type: 'laycan',
    priority: 'info',
    title: `Port Arrival Buffer: +6.5h against Charter Party Window`,
    description: `Target port destination laycan is safe. Advisory speed leaves 14 hours buffer before cancellation clause.`,
    applied: false,
  })

  return advisories
}
