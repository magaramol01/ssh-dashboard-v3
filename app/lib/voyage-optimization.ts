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

/**
 * Leaflet plots raw longitude, so a track that crosses the antimeridian
 * (e.g. 179° -> -179°) gets drawn the "long way" around the globe instead
 * of the short way across the date line, and standalone markers on the far
 * side land ~360° away from the rest of the route. These "unwrap" longitude
 * — letting it run outside [-180, 180] — so every point stays on one
 * continuous number line. Only what's actually plotted on the map should go
 * through these; display values (e.g. a position readout) should keep the
 * raw, real-world coordinate.
 */
function unwrapLng(lng: number, refLng: number): number {
  let out = lng
  while (out - refLng > 180) out -= 360
  while (refLng - out > 180) out += 360
  return out
}

/** Unwraps an ordered track so consecutive points never jump more than 180° in longitude. */
export function unwrapTrackForMap(points: [number, number][], seedLng?: number): [number, number][] {
  let prevLng = seedLng ?? points[0]?.[1] ?? 0
  return points.map(([lat, lng]) => {
    const unwrapped = unwrapLng(lng, prevLng)
    prevLng = unwrapped
    return [lat, unwrapped]
  })
}

/** Unwraps a standalone marker point against a shared reference longitude (e.g. the corridor's origin). */
export function unwrapPointForMap(point: [number, number], refLng: number): [number, number] {
  return [point[0], unwrapLng(point[1], refLng)]
}

export type CIIRating = 'A' | 'B' | 'C' | 'D' | 'E'

export interface CiiDateRangeRecord {
  attainedCII: number
  reportDateTime: string
  voyage: string
  distance: number
  // Real API data is inconsistent per vessel/reporting-app version: some
  // send numeric avgSpeed, others a formatted string like "12.00".
  avgSpeed: number | string
  draftFwd: number | null
  draftAft: number | null
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
  // The API's own classification of which reportType strings count as
  // in-port activity (arrival, departure, anchorage, bunkering, etc.) vs
  // at-sea — used to exclude port events, which can have a small nonzero
  // `distance` (e.g. a 0.5 NM arrival shift) that a distance-only filter
  // would miss.
  utilizationType?: {
    seaReportTypes?: string[]
    portReportTypes?: string[]
  }
  noonreportdata?: {
    // Position format varies by vessel/reporting app: DMS string
    // ("24°13'5''S") for some, plain decimal degrees (number or numeric
    // string) for others. Absent/null on non-position event records.
    Latitude?: string | number | null
    Longitude?: string | number | null
    Wind_Force?: number
    Wind_Speed?: number
    Wind_Direction?: string | number
    Wave_Height?: number
    Swell_Direction?: string | number
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
  reportType: string
  utilizationCategory: 'sea' | 'port' | 'unknown'
  weather: {
    beaufort: number
    windSpeedKts: number
    windDirectionDeg: number
    waveHeightM: number
    swellDirection: string
    shortForecast: string
    source: 'cii-api'
  }
  // Hydrodynamic & Engine Telemetry
  slipPct?: number
  meRpm?: number
  shaftPowerKw?: number
  remarks?: string
  // AI Diagnostic Factor Analysis
  aiDiagnostics?: CiiDayAiDiagnostic
}

export interface CiiFactorImpact {
  key: 'weather' | 'slip' | 'speed' | 'fuel_rate' | 'distance'
  name: string
  scorePercent: number // 0-100% relative contribution
  severity: 'favorable' | 'moderate' | 'critical'
  metric: string       // e.g. "BF 7 (3.0m wave)", "52.7% Slip", "6.7 kts (-42%)"
  explanation: string  // concise domain explanation
}

export interface CiiDayAiDiagnostic {
  rating: CIIRating
  statusLabel: string     // e.g. "IMO Band E (Critical Degradation)"
  headline: string        // e.g. "Adverse MetOcean Resistance & Severe Propeller Slip"
  summary: string         // 2-3 sentences explaining why it dropped or excelled
  primaryDriver: 'weather' | 'slip' | 'speed' | 'fuel_burn' | 'distance' | 'optimal'
  driverLabel: string     // e.g. "Severe Weather & Propeller Cavitation"
  factors: CiiFactorImpact[]
  recommendation: string  // operational recommendation
  promptContext: string   // customized question to pass to Sentinel Copilot
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
 * How far back to query the CII date-range API to find the current voyage's
 * start. Real noon-report data does not reliably carry a Voyage_Start_Date
 * (observed null on live data), so callers instead fetch this wide a window
 * and filter to the current voyage number. 60 days comfortably covers
 * virtually any commercial voyage length.
 */
export const CII_LOOKBACK_DAYS = 60

/**
 * Resolves a noon-report position value to decimal degrees. Real API data
 * varies by vessel/reporting-app: DMS strings ("24°13'5''S"), plain decimal
 * numbers, numeric strings, or null/absent on non-position event records.
 */
function resolveNoonCoordinate(value: string | number | null | undefined): number {
  if (typeof value === 'number') return value
  if (value === null || value === undefined || value === '') return NaN
  const trimmed = value.trim()
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  return parseDmsCoordinate(trimmed)
}

export function roundTo2(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  if (Number.isNaN(n)) return 0
  return Math.round(n * 100) / 100
}

/**
 * Builds the noon-report weather summary from structured fields only.
 * `Remarks` varies wildly per vessel/reporting-app — sometimes a real
 * free-text note ("Ship clock 1 HR retard"), sometimes a raw data dump
 * ("Force 5/swell 2.5/wave 2.0/current 0.8") — so it's unsafe to surface
 * directly as a "forecast" description. A sentence built from the numeric
 * fields is reliable across every vessel's data.
 */
function buildNoonWeather(noon: CiiDateRangeRecord['noonreportdata']): DailyNoonReport['weather'] {
  const beaufort = roundTo2(noon?.Wind_Force || 0)
  const windSpeedKts = roundTo2(noon?.Wind_Speed || 0)
  const windDirectionDeg = roundTo2(Number(noon?.Wind_Direction) || 0)
  const waveHeightM = roundTo2(noon?.Wave_Height || 0)
  const swellDirection = String(noon?.Swell_Direction ?? '')

  const parts: string[] = []
  if (windSpeedKts > 0) parts.push(`${windSpeedKts}kt wind`)
  if (waveHeightM > 0) parts.push(`${waveHeightM}m seas`)
  if (swellDirection) parts.push(`${swellDirection}° swell`)

  return {
    beaufort,
    windSpeedKts,
    windDirectionDeg,
    waveHeightM,
    swellDirection,
    shortForecast: parts.length > 0 ? parts.join(', ') : 'Calm conditions',
    source: 'cii-api',
  }
}

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
 * Whether a CII date-range record represents a real at-sea noon/position
 * report rather than an in-port event (arrival, departure, anchorage,
 * bunkering, etc.). Port events can carry a small nonzero `distance` (e.g.
 * a 0.5 NM arrival shift), so distance alone isn't a reliable filter — this
 * also checks the record's own `utilizationType.portReportTypes`
 * classification, which is authoritative and self-describing per vessel/
 * reporting-app convention rather than a guessed string allowlist.
 */
export function isNoonReportRecord(record: CiiDateRangeRecord): boolean {
  if ((record.distance || 0) <= 0) return false
  const portTypes = record.utilizationType?.portReportTypes
  if (portTypes && portTypes.includes(record.reportType)) return false
  return true
}

/**
 * Collapses records down to at most one per calendar day (UTC), keeping the
 * one with the largest `distance`. A "Daily Noon Log" is one entry per day
 * by definition — this is a generic safeguard independent of any specific
 * vessel/reporting-app's reportType taxonomy: whatever duplicate, low-
 * distance, or event-adjacent records `isNoonReportRecord` doesn't catch
 * (taxonomies vary per vessel and can't all be enumerated in advance), the
 * genuine highest-distance report for that day wins.
 */
function collapseToOnePerDay(records: CiiDateRangeRecord[]): CiiDateRangeRecord[] {
  const byDate = new Map<string, CiiDateRangeRecord>()
  for (const record of records) {
    const dateKey = record.reportDateTime.slice(0, 10)
    const existing = byDate.get(dateKey)
    if (!existing || (record.distance || 0) > (existing.distance || 0)) {
      byDate.set(dateKey, record)
    }
  }
  return Array.from(byDate.values())
}

/**
 * Maps live CII date-range API records into the DailyNoonReport shape the
 * screen renders. The API interleaves real position/noon reports with
 * in-port event markers (sea-passage-end, anchorage, bunkering, arrival/
 * departure, etc. — observed as ~64% of records on live data) in the same
 * response; only genuine at-sea noon reports represent a real day. Records
 * are sorted chronologically and numbered D1..Dn.
 */
export function mapCiiRecordsToDailyNoons(records: CiiDateRangeRecord[]): DailyNoonReport[] {
  const noonRecords = collapseToOnePerDay(records.filter(isNoonReportRecord))

  const sorted = [...noonRecords].sort(
    (a, b) => new Date(a.reportDateTime).getTime() - new Date(b.reportDateTime).getTime()
  )

  let cumulativeDistance = 0
  let cumulativeFuel = 0

  return sorted.map((record, index) => {
    cumulativeDistance += record.distance || 0
    cumulativeFuel += record.totalConsumption || 0

    const lat = resolveNoonCoordinate(record.noonreportdata?.Latitude)
    const lng = resolveNoonCoordinate(record.noonreportdata?.Longitude)

    const byType: Record<string, { value: number; label: string }> = {}
    for (const [key, fuel] of Object.entries(record.consumptionData || {})) {
      byType[key] = { value: roundTo2(fuel.value), label: fuel.label }
    }

    const reportDate = new Date(record.reportDateTime)
    const rating = record.CIIRating?.band || resolveCiiRating(record.attainedCII)

    const rawSlip = record.noonreportdata?.Slip
    const slipPct = typeof rawSlip === 'number' ? rawSlip : parseFloat(String(rawSlip || '').replace(/%/g, ''))
    const rawRpm = record.noonreportdata?.ME_RPM
    const meRpm = typeof rawRpm === 'number' ? rawRpm : parseFloat(String(rawRpm || ''))
    const rawPower = record.noonreportdata?.ME_SHAFT_POWER_IN_KW
    const shaftPowerKw = typeof rawPower === 'number' ? rawPower : parseFloat(String(rawPower || ''))

    const noonItem: DailyNoonReport = {
      dayNumber: index + 1,
      dateIso: record.reportDateTime,
      dateFormatted: reportDate.toISOString().slice(0, 10) + ' 12:00 UTC',
      coords: [Number.isNaN(lat) ? 0 : lat, Number.isNaN(lng) ? 0 : lng],
      distanceRunNm: roundTo2(record.distance || 0),
      cumulativeDistanceNm: roundTo2(cumulativeDistance),
      sog: roundTo2(Number(record.avgSpeed) || 0),
      fuelConsumedMt: {
        byType,
        total: Math.round((record.totalConsumption || 0) * 10) / 10,
      },
      cumulativeFuelMt: roundTo2(cumulativeFuel),
      totalCo2Mt: roundTo2(record.massOfCo2 || 0),
      transportWork: roundTo2(record.transportWork || 0),
      attainedCii: roundTo2(record.attainedCII),
      rating,
      requiredCii: roundTo2(record.CIIRating?.requiredCII || 0),
      ciiBoundaries: {
        superior: roundTo2(record.CIIRating?.ciiBoundaries?.superior || 0),
        lower: roundTo2(record.CIIRating?.ciiBoundaries?.lower || 0),
        upper: roundTo2(record.CIIRating?.ciiBoundaries?.upper || 0),
        inferior: roundTo2(record.CIIRating?.ciiBoundaries?.inferior || 0),
      },
      draftFwdM: roundTo2(record.draftFwd || 0),
      draftAftM: roundTo2(record.draftAft || 0),
      reportType: record.reportType || '',
      utilizationCategory: (() => {
        const portTypes = record.utilizationType?.portReportTypes
        const seaTypes = record.utilizationType?.seaReportTypes
        if (portTypes?.includes(record.reportType)) return 'port'
        if (seaTypes?.includes(record.reportType)) return 'sea'
        return 'unknown'
      })(),
      weather: buildNoonWeather(record.noonreportdata),
      slipPct: Number.isFinite(slipPct) ? roundTo2(slipPct) : 0,
      meRpm: Number.isFinite(meRpm) ? roundTo2(meRpm) : 0,
      shaftPowerKw: Number.isFinite(shaftPowerKw) ? Math.round(shaftPowerKw) : 0,
      remarks: record.noonreportdata?.Remarks || '',
    }

    noonItem.aiDiagnostics = analyzeCiiRatingDrivers(noonItem, record.noonreportdata?.Vessel_Name || record.vesselInfo?.name)
    return noonItem
  })
}

/**
 * Analyzes the hydrodynamic, meteorological, and operational factors
 * contributing to a specific daily noon report's CII rating and degradation.
 */
export function analyzeCiiRatingDrivers(
  noon: Omit<DailyNoonReport, 'aiDiagnostics'>,
  vesselName?: string
): CiiDayAiDiagnostic {
  const rating = noon.rating
  const attained = noon.attainedCii
  const required = noon.requiredCii || 3.7
  const bf = noon.weather.beaufort || 0
  const wave = noon.weather.waveHeightM || 0
  const slip = noon.slipPct ?? 0
  const dist = noon.distanceRunNm || 0
  const sog = noon.sog || 0
  const fuel = noon.fuelConsumedMt.total || 0
  const fuelPerNm = dist > 0 ? Math.round((fuel / dist) * 1000) / 1000 : 0

  const isCriticalDegraded = rating === 'E'

  // 1. Weather Impact
  const hasWeather = bf > 0 || wave > 0
  let weatherWeight = 10
  let weatherSeverity: 'favorable' | 'moderate' | 'critical' = 'favorable'
  let weatherExplanation = hasWeather
    ? `Calm to moderate sea state (BF ${bf}, ${wave}m seas). Minimal wave-induced resistance.`
    : `MetOcean sea state not recorded in noon report.`
  if (bf >= 7 || wave >= 3.0) {
    weatherSeverity = 'critical'
    weatherWeight = 45 + Math.min(25, (bf - 6) * 10 + (wave - 2.5) * 8)
    weatherExplanation = `Severe adverse MetOcean conditions (BF ${bf}, ${wave}m wave). Significant added hydrodynamic resistance & wave slamming.`
  } else if (bf >= 5 || wave >= 2.0) {
    weatherSeverity = 'moderate'
    weatherWeight = 25 + (bf - 4) * 5
    weatherExplanation = `Fresh sea conditions (BF ${bf}, ${wave}m seas). Noticeable pitch/roll and wind resistance.`
  }

  // 2. Propeller Slip Impact
  const hasSlip = slip > 0
  let slipWeight = 10
  let slipSeverity: 'favorable' | 'moderate' | 'critical' = 'favorable'
  let slipExplanation = hasSlip
    ? `Slip (${slip.toFixed(1)}%) within optimal propulsion envelope.`
    : `Propeller slip not recorded in noon report.`
  if (slip >= 35) {
    slipSeverity = 'critical'
    slipWeight = 40 + Math.min(25, (slip - 35) * 1.5)
    slipExplanation = `Severe propeller slip (${slip.toFixed(1)}%). Significant engine power dissipated in propeller cavitation & heavy pitching rather than thrust.`
  } else if (slip >= 25) {
    slipSeverity = 'moderate'
    slipWeight = 25
    slipExplanation = `Elevated propeller slip (${slip.toFixed(1)}%) above standard 20% benchmark, indicating added hydrodynamic drag.`
  }

  // 3. Speed Loss / Transport Work Deficit
  let distWeight = 10
  let distSeverity: 'favorable' | 'moderate' | 'critical' = 'favorable'
  let distExplanation = `Good 24h run (${dist} NM at ${sog} kts) maximizing transport work denominator.`
  if (dist > 0 && dist < 190) {
    distSeverity = 'critical'
    distWeight = 35 + Math.min(20, (190 - dist) * 0.3)
    distExplanation = `Major distance deficit (${dist} NM vs ~270 NM nominal). Shrunk Transport Work denominator, forcing CII to surge.`
  } else if (dist > 0 && dist < 235) {
    distSeverity = 'moderate'
    distWeight = 20
    distExplanation = `Reduced daily ground run (${dist} NM). Moderate speed loss under sea margin.`
  }

  // 4. Fuel Burn Rate Intensity (MT / NM)
  let fuelWeight = 10
  let fuelSeverity: 'favorable' | 'moderate' | 'critical' = 'favorable'
  let fuelExplanation = `Specific consumption (${fuelPerNm.toFixed(3)} MT/NM) aligned with fuel-efficient steaming.`
  if (fuelPerNm >= 0.11) {
    fuelSeverity = 'critical'
    fuelWeight = 30
    fuelExplanation = `Disproportionate fuel burn rate (${fuelPerNm.toFixed(3)} MT/NM vs ~0.078 nominal). Engine pushing hard against heavy resistance.`
  } else if (fuelPerNm >= 0.09) {
    fuelSeverity = 'moderate'
    fuelWeight = 20
    fuelExplanation = `Elevated fuel burn rate (${fuelPerNm.toFixed(3)} MT/NM) due to moderate resistance or auxiliary load.`
  }

  // Normalize factor scores to sum to 100%
  const totalWeight = weatherWeight + slipWeight + distWeight + fuelWeight
  const factors: CiiFactorImpact[] = [
    {
      key: 'weather',
      name: 'MetOcean & Sea State',
      scorePercent: Math.round((weatherWeight / totalWeight) * 100),
      severity: weatherSeverity,
      metric: hasWeather ? `BF ${bf} · ${wave}m seas` : 'Not reported',
      explanation: weatherExplanation,
    },
    {
      key: 'slip',
      name: 'Propeller Slip & Thrust',
      scorePercent: Math.round((slipWeight / totalWeight) * 100),
      severity: slipSeverity,
      metric: hasSlip ? `${slip.toFixed(1)}% Slip` : 'Not recorded',
      explanation: slipExplanation,
    },
    {
      key: 'distance',
      name: 'Ground Distance & Transport Work',
      scorePercent: Math.round((distWeight / totalWeight) * 100),
      severity: distSeverity,
      metric: `${dist} NM · ${sog} kts`,
      explanation: distExplanation,
    },
    {
      key: 'fuel_rate',
      name: 'Specific Fuel Intensity',
      scorePercent: Math.round((fuelWeight / totalWeight) * 100),
      severity: fuelSeverity,
      metric: `${fuelPerNm.toFixed(3)} MT/NM`,
      explanation: fuelExplanation,
    },
  ]

  const sumScores = factors.reduce((s, f) => s + f.scorePercent, 0)
  if (sumScores !== 100 && factors.length > 0) {
    factors[0]!.scorePercent += 100 - sumScores
  }

  let primaryDriver: 'weather' | 'slip' | 'speed' | 'fuel_burn' | 'distance' | 'optimal' = 'optimal'
  let driverLabel = 'Optimal Sea Margin'
  let headline = `IMO Band ${rating}: Compliant Steaming`
  const weatherSummary = hasWeather ? `conditions (BF ${bf}, ${wave}m seas)` : 'standard steaming'
  const slipSummary = hasSlip ? `slip (${slip.toFixed(1)}%)` : 'nominal propulsion'
  let summary = `Attained CII of ${attained} g/MT·NM compliant with target ${required}. Favorable ${weatherSummary} and ${slipSummary} supported an efficient run of ${dist} NM on ${fuel} MT.`
  let recommendation = `Maintain current speed and RPM profile. Review downstream 48h MetOcean forecasts to anticipate unfavorable sea states.`

  if (isCriticalDegraded) {
    if (weatherSeverity === 'critical' || slipSeverity === 'critical') {
      primaryDriver = 'weather'
      driverLabel = 'Heavy Weather & Slip Drag'
      headline = `Band E Variance: Severe Sea Resistance & ${slip > 0 ? slip.toFixed(1) + '%' : ''} Propeller Slip`
      summary = `Attained CII of ${attained} g/MT·NM vs ${required} target. Adverse weather (Beaufort ${bf}, ${wave}m seas) and ${slip > 0 ? slip.toFixed(1) + '%' : 'high'} propeller slip caused ${sog} kts involuntary speed loss (${dist} NM run). Sustained engine load in head seas resulted in elevated specific fuel burn (${fuelPerNm.toFixed(3)} MT/NM).`
      recommendation = `In BF 7+ sea states, easing ME speed by 4–6 RPM alleviates propeller cavitation and slip, saving ~3.5 MT/day fuel with minimal ground speed impact.`
    } else if (distSeverity === 'critical') {
      primaryDriver = 'distance'
      driverLabel = 'Distance Run Deficit'
      headline = `Band E Variance: Ground Distance Deficit`
      summary = `Attained CII of ${attained} g/MT·NM vs ${required} target. Run was limited to ${dist} NM (vs ~270 NM nominal), reducing transport work while burning ${fuel} MT during maneuvering, drifting, or low-speed transit.`
      recommendation = `Resume uninterrupted transit at eco-speed as soon as operational conditions allow to recover daily transport work.`
    } else {
      primaryDriver = 'fuel_burn'
      driverLabel = 'Elevated Specific Fuel Burn'
      headline = `Band E Variance: High Fuel Intensity`
      summary = `Attained CII of ${attained} g/MT·NM due to heavy fuel burn (${fuel} MT over ${dist} NM = ${fuelPerNm.toFixed(3)} MT/NM), exceeding the nominal power envelope.`
      recommendation = `Inspect main engine SFOC and fuel purifier operation. Consider trimming speed by 1.0–1.5 kts to lower combustion resistance.`
    }
  } else if (rating === 'D') {
    if (weatherSeverity !== 'favorable' || slipSeverity !== 'favorable') {
      primaryDriver = 'weather'
      driverLabel = 'Added Sea Margin Resistance'
      headline = `Band D Variance: Added Sea Margin & Involuntary Speed Loss`
      summary = `Attained CII of ${attained} g/MT·NM vs ${required} target. Sea state (BF ${bf}, ${wave}m seas) and ${slip > 0 ? slip.toFixed(1) + '%' : 'elevated'} propeller slip produced added hydrodynamic drag, reducing 24h distance to ${dist} NM.`
      recommendation = `A -0.8 to -1.0 kt speed trim reduces engine load and aligns specific consumption with the Band B trajectory.`
    } else {
      primaryDriver = 'speed'
      driverLabel = 'Speed-Power Discrepancy'
      headline = `Band D Variance: Steaming Speed Discrepancy`
      summary = `Attained CII of ${attained} g/MT·NM (Band D). Fuel consumption of ${fuel} MT for ${dist} NM is trending above the optimal IMO trajectory.`
      recommendation = `Adjust speed towards the Lowest-Fuel profile to recover Band B status on subsequent passage legs.`
    }
  } else if (rating === 'C') {
    primaryDriver = 'speed'
    driverLabel = 'Standard Sea Margin'
    headline = `Band C Standard: Baseline Sea Margin`
    summary = `Attained CII of ${attained} g/MT·NM conforms to the standard Band C baseline (required: ${required}). Minor sea resistance (BF ${bf}) and steady run (${dist} NM) maintain stable operations.`
    recommendation = `A minor -0.5 kt speed optimization saves ~1.5 MT/day fuel, safely shifting the trajectory into Band B.`
  }

  const vName = vesselName || 'the vessel'
  const promptContext = `Why did ${vName} attain CII of ${attained} g/MT·NM (Band ${rating}) on Day ${noon.dayNumber} with Beaufort ${bf}, wave height ${wave}m, propeller slip ${slip.toFixed(1)}%, distance ${dist} NM, and fuel ${fuel} MT? Explain the physical and hydrodynamic factors, and give corrective operational recommendations to recover IMO Band B.`

  return {
    rating,
    statusLabel: `IMO Band ${rating}`,
    headline,
    summary,
    primaryDriver,
    driverLabel,
    factors,
    recommendation,
    promptContext,
  }
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
  const ecoSpeed = roundTo2(safeSpeed0 * 0.93)
  const ecoHours = baseDistanceNm / ecoSpeed
  const ecoEtaDate = new Date(Date.now() + ecoHours * 3600 * 1000)
  const ecoFuel = roundTo2(baseFuelMt * Math.pow(ecoSpeed / safeSpeed0, 3))
  const ecoSavings = roundTo2(baseFuelMt - ecoFuel)
  const ecoCo2 = ecoFuel * CF_VLSFO
  const ecoCii = calculateCii(ecoCo2, currentWork)
  const carbonSavingsEur = Math.round((baseFuelMt - ecoFuel) * CF_VLSFO * EU_ETS_CARBON_PRICE_EUR_PER_TON)

  // 2. Safest (Weather Avoidance): Diverts ~2.5% distance south/around cells -> saves engine strain & wave resistance
  const safeDistance = roundTo2(baseDistanceNm * 1.025)
  const safeSpeed = safeSpeed0
  const safeHours = safeDistance / safeSpeed
  const safeEtaDate = new Date(Date.now() + safeHours * 3600 * 1000)
  const safeFuel = roundTo2(baseFuelMt * 1.01)
  const safeWork = safeDistance * dwt
  const safeCii = calculateCii(safeFuel * CF_VLSFO, safeWork)

  // 3. Fastest: Increases SOG by ~6%
  const fastSpeed = roundTo2(safeSpeed0 * 1.06)
  const fastHours = baseDistanceNm / fastSpeed
  const fastEtaDate = new Date(Date.now() + fastHours * 3600 * 1000)
  const fastFuel = roundTo2(baseFuelMt * Math.pow(fastSpeed / safeSpeed0, 3))
  const fastCo2 = fastFuel * CF_VLSFO
  const fastCii = calculateCii(fastCo2, currentWork)

  const formatEta = (d: Date) => d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC'

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
      fuelSavingsMt: -roundTo2(safeFuel - baseFuelMt),
      carbonSavingsEur: -Math.round((safeFuel - baseFuelMt) * CF_VLSFO * EU_ETS_CARBON_PRICE_EUR_PER_TON),
      colorHex: '#06b6d4',
      dashArray: '4 4',
      waypoints: baseCoords || [],
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
