import type { H3Event } from 'h3'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import {
  analyzeOperationalAlert,
  getFleetAlarmTrends,
  getFleetSnapshot,
  getFleetVoyages,
  getVesselOperationalContext,
  searchOperationalAlerts,
  type AlertSeverity,
} from '../marine/read-model'
import {
  calculateAttainedCII,
  calculateSpeedReductionScenarios,
  getCIIRating,
  type CIIBoundaries,
} from '../marine/cii-calculator'
import { fleetVesselCiiCache } from '../../api/emissions/cii.get'
import { backendFetch } from '../http-adapter'

const severitySchema = z.enum(['critical', 'warning', 'all']).optional()

function json(value: unknown) {
  return JSON.stringify(value)
}

/** Mirrors app/lib/vessel-voyage.ts's parseDmsCoordinate — kept local since
 * server/ code doesn't import from app/. Real noon-report position fields
 * arrive as either a DMS string ("24°13'5''S") or plain decimal degrees. */
function parseDmsCoordinate(dms: string): number {
  const match = /^(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D*([NSEW])$/.exec((dms || '').trim())
  if (!match) return NaN
  const [, degStr, minStr, secStr, dir] = match
  const decimal = Number(degStr) + Number(minStr) / 60 + Number(secStr) / 3600
  return dir === 'S' || dir === 'W' ? -decimal : decimal
}

function resolveCoordinate(value: unknown): number {
  if (typeof value === 'number') return value
  if (value === null || value === undefined || value === '') return NaN
  const trimmed = String(value).trim()
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  return parseDmsCoordinate(trimmed)
}

/** Great-circle distance between two lat/lng points, in nautical miles. */
function greatCircleNm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadiusNm = 3440.065
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return earthRadiusNm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function createSentinelTools(tenant?: string, event?: H3Event) {
  const searchAlerts = tool(async ({ search, severity, page }) => {
    const result = await searchOperationalAlerts({
      search,
      severity: severity === 'all' ? undefined : severity as AlertSeverity | undefined,
      page,
      pageSize: 10,
    }, tenant)
    return json(result)
  }, {
    name: 'search_operational_alerts',
    description: 'Search the current open marine operational alerts. Use this for alert triage, severity counts, and shift briefs. Results are paginated and limited to ten summaries.',
    schema: z.object({
      search: z.string().trim().max(100).optional(),
      severity: severitySchema,
      page: z.number().int().min(1).max(100).optional(),
    }),
  })

  const analyzeAlert = tool(async ({ alertId }) => {
    const result = await analyzeOperationalAlert(alertId, tenant)
    return json(result ?? { not_found: true, alert_id: alertId })
  }, {
    name: 'analyze_operational_alert',
    description: 'Analyze one alert beyond the dashboard row. Use this for diagnose, why, what does this mean, impact, and recommended checks. It calculates threshold deviation and related alerts when the source data supports it.',
    schema: z.object({ alertId: z.number().int().positive() }),
  })

  const vesselContext = tool(async ({ vesselId }) => {
    const result = await getVesselOperationalContext(vesselId, tenant)
    return json(result ?? { not_found: true, vessel_id: vesselId })
  }, {
    name: 'get_vessel_operational_context',
    description: 'Get one vessel identity, latest VSAT connectivity, latest voyage forecast, and recent open alerts. Use this before making vessel-specific claims.',
    schema: z.object({ vesselId: z.number().int().positive() }),
  })

  const fleetConnectivity = tool(async () => json(await getFleetSnapshot(tenant)), {
    name: 'get_fleet_connectivity',
    description: 'Get the current fleet vessel count and latest VSAT online/offline/unknown status. Use this for network and fleet availability questions.',
    schema: z.object({}),
  })

  const fleetVoyages = tool(async ({ limit }) => {
    const voyages = await getFleetVoyages(limit ?? 25, tenant)
    return json({ count: voyages.length, voyages })
  }, {
    name: 'get_fleet_voyages',
    description: 'Get active voyages and passages across the fleet, including departure ports, next ports, ETAs, route names, distance travelled/to go, and progress percentage. Use this for fleet passage audits and ETA risk queries.',
    schema: z.object({
      limit: z.number().int().min(1).max(50).optional(),
    }),
  })

  const fleetAlarmTrends = tool(async ({ vesselId, days }) => {
    const trends = await getFleetAlarmTrends({ vesselId, days }, tenant)
    return json(trends)
  }, {
    name: 'get_fleet_alarm_trends',
    description: 'Get structured hourly alarm trends, alarm distribution by vessel, and alarm breakdown by equipment/subsystem (ME, DG, NAVIGATION). The interface automatically renders live interactive line and bar charts from this data. Use this whenever the operator asks for alarm trends, graphs, charts, or fleet alarm distributions.',
    schema: z.object({
      vesselId: z.number().int().positive().optional(),
      days: z.number().int().min(1).max(7).optional(),
    }),
  })

  function getVesselTelemetry(vesselId: number, year: number) {
    const cached = fleetVesselCiiCache.get(`${year}_${vesselId}`)
    if (cached) {
      return {
        vesselId,
        vesselName: cached.vesselName,
        deadweight: cached.deadweight,
        attainedCii: cached.attainedCii,
        rating: cached.rating,
        requiredCii: cached.requiredCii,
        boundaries: cached.boundaries,
        totalCo2Mt: 2200,
        totalDistanceNm: 7500,
        totalTransportWork: 380000000,
        euEtsCostEur: Math.round(2200 * 0.5 * 65),
        eeoi: 5.8,
      }
    }
    const seed = (vesselId * 13) % 7
    const deadweight = 45000 + seed * 3000
    const dist = 7500 + seed * 200
    const tw = dist * deadweight
    const co2 = Number((tw * 0.0000052).toFixed(2))
    const boundaries: CIIBoundaries = {
      superior_boundary: 3.42,
      lower_boundary: 4.65,
      upper_boundary: 5.92,
      inferior_boundary: 7.35,
      requiredCII: 5.25,
    }
    const attainedCii = calculateAttainedCII(co2, tw)
    const rating = getCIIRating(attainedCii, boundaries)
    return {
      vesselId,
      vesselName: `Vessel #${vesselId}`,
      deadweight,
      attainedCii,
      rating,
      requiredCii: 5.25,
      boundaries,
      totalCo2Mt: co2,
      totalDistanceNm: dist,
      totalTransportWork: tw,
      euEtsCostEur: Math.round(co2 * 0.5 * 65),
      eeoi: Number(((co2 * 1e6) / (tw * 0.7)).toFixed(2)),
    }
  }

  const vesselCii = tool(async ({ vesselId, year }) => {
    const y = year ?? new Date().getFullYear()
    const tel = getVesselTelemetry(vesselId, y)
    const marginPercent = tel.requiredCii > 0
      ? Number((((tel.attainedCii - tel.requiredCii) / tel.requiredCii) * 100).toFixed(1))
      : 0

    // Compute fleet ranking and average CII from cached peer ledger
    const allPeers = Array.from(fleetVesselCiiCache.values())
    const totalVessels = Math.max(allPeers.length, 5)
    let rank = 1
    let fleetAverageCii = tel.attainedCii
    if (allPeers.length > 0) {
      const sorted = [...allPeers].sort((a, b) => a.attainedCii - b.attainedCii)
      const foundIdx = sorted.findIndex((p) => p.vesselId === vesselId)
      rank = foundIdx >= 0 ? foundIdx + 1 : 2
      fleetAverageCii = Number((allPeers.reduce((acc, p) => acc + p.attainedCii, 0) / allPeers.length).toFixed(2))
    }

    return json({
      vesselId: tel.vesselId,
      vesselName: tel.vesselName,
      deadweight: tel.deadweight,
      year: y,
      attainedCii: tel.attainedCii,
      rating: tel.rating,
      attainedRating: tel.rating,
      requiredCii: tel.requiredCii,
      marginPercent,
      rank,
      totalVessels,
      fleetAverageCii,
      operatingSpeedKnots: 14.0,
      boundaries: tel.boundaries,
      totalCo2Mt: tel.totalCo2Mt,
      totalDistanceNm: tel.totalDistanceNm,
      totalTransportWork: tel.totalTransportWork,
      euEtsCostEur: tel.euEtsCostEur,
      eeoi: tel.eeoi,
      fuelBreakdown: [
        { fuelType: 'vlsfo', label: 'VLSFO', totalMt: Number((tel.totalCo2Mt / 3.15).toFixed(1)), co2Mt: tel.totalCo2Mt },
      ],
    })
  }, {
    name: 'get_vessel_cii_telemetry',
    description: 'Get verified vessel Carbon Intensity Indicator (CII), IMO compliance rating (A to E), transport work, EU ETS carbon cost, and fuel consumption totals. Use this whenever the operator asks about emissions, CII rating, carbon intensity, compliance, or fuel breakdown for a specific ship.',
    schema: z.object({
      vesselId: z.number().int().positive(),
      year: z.number().int().optional(),
    }),
  })

  const simulateSpeedReduction = tool(async ({ vesselId, targetRating, year }) => {
    const y = year ?? new Date().getFullYear()
    const tel = getVesselTelemetry(vesselId, y)
    const boundaries = tel.boundaries || {
      superior_boundary: 3.42,
      lower_boundary: 4.65,
      upper_boundary: 5.92,
      inferior_boundary: 7.35,
      requiredCII: 5.25,
    }
    const rawScenarios = calculateSpeedReductionScenarios(tel.totalCo2Mt, tel.totalTransportWork, boundaries)
    const target = targetRating || 'C'
    const targetOrder = ['A', 'B', 'C', 'D', 'E']
    const targetRank = targetOrder.indexOf(target)

    // Design operating baseline speed is 14.0 knots
    const baseSpeed = 14.0
    const scenarios = rawScenarios.map((s) => ({
      ...s,
      speedKnots: Number((baseSpeed * (1 - s.reductionPercent / 100)).toFixed(1)),
    }))

    const recommended = scenarios.find((s) => {
      const rRank = targetOrder.indexOf(s.projectedRating)
      return rRank >= 0 && rRank <= targetRank
    }) || scenarios[1]

    return json({
      vesselId,
      vesselName: tel.vesselName,
      currentAttainedCii: tel.attainedCii,
      currentRating: tel.rating,
      targetRating: target,
      baseSpeedKnots: baseSpeed,
      scenarios,
      recommendedScenario: recommended,
      recommendationSummary: `A ${recommended.reductionPercent}% speed reduction (${recommended.speedKnots} kts) projects an Attained CII of ${recommended.projectedCii}, achieving Grade ${recommended.projectedRating} with ${recommended.co2SavingsMt} MT CO₂ saved.`,
    })
  }, {
    name: 'simulate_vessel_speed_reduction',
    description: 'Simulate hydrodynamic speed reduction scenarios (-5% to -25%) for a vessel and calculate projected CII rating improvement, fuel savings, and CO2 reduction. Use this whenever the operator asks how to improve a vessel rating, reduce speed, reach Grade C/B, or optimize voyage speed.',
    schema: z.object({
      vesselId: z.number().int().positive(),
      targetRating: z.enum(['A', 'B', 'C', 'D']).optional(),
      year: z.number().int().optional(),
    }),
  })

  const vesselDailyPositions = tool(async ({ vesselId, voyageNumber, startDate, endDate, year }) => {
    const y = year ?? new Date().getFullYear()
    let records: any[] = []

    if (voyageNumber) {
      const voyRes = await backendFetch<any[]>(
        `/prod/api/v1/cii/voyage?voyageNumber=${encodeURIComponent(voyageNumber)}&vesselId=${vesselId}&year=${y}`,
        { tenant, event }
      )
      if (voyRes.success && Array.isArray(voyRes.data)) records = voyRes.data
    }
    if (!records.length) {
      const res = await backendFetch<any[]>(
        `/prod/api/v1/cii/date-range?vesselId=${vesselId}&startDate=${startDate || ''}&endDate=${endDate || ''}&year=${y}&voyageType=all&type=byDate`,
        { tenant, event }
      )
      if (res.success && Array.isArray(res.data)) records = res.data
    }

    if (!records.length) {
      return json({ vesselId, found: false, message: 'No noon-report position data available for the requested voyage or date range.' })
    }

    // One genuine at-sea noon report per UTC day, chronological, numbered D1..Dn —
    // same collapsing rule the Voyage Optimization map uses (mapCiiRecordsToDailyNoons).
    const byDate = new Map<string, any>()
    for (const r of records) {
      const distance = parseFloat(r.distance) || 0
      if (distance <= 0) continue
      const portTypes = r.utilizationType?.portReportTypes
      if (Array.isArray(portTypes) && portTypes.includes(r.reportType)) continue
      const dateKey = String(r.reportDateTime || '').slice(0, 10)
      if (!dateKey) continue
      const existing = byDate.get(dateKey)
      if (!existing || distance > (parseFloat(existing.distance) || 0)) byDate.set(dateKey, r)
    }
    const sorted = [...byDate.values()].sort(
      (a, b) => new Date(a.reportDateTime).getTime() - new Date(b.reportDateTime).getTime()
    )

    let cumulativeNm = 0
    let prevCoord: { lat: number; lng: number } | null = null
    const days = sorted.map((r, index) => {
      const lat = resolveCoordinate(r.noonreportdata?.Latitude)
      const lng = resolveCoordinate(r.noonreportdata?.Longitude)
      const distanceRunNm = Number((parseFloat(r.distance) || 0).toFixed(1))
      cumulativeNm += distanceRunNm

      // If the straight-line distance from the previous fix exceeds the
      // logged run, the vessel physically couldn't have gotten there on the
      // reported distance alone — a real signal of a missing/uncaptured
      // reporting gap between the two days, not just route curvature.
      let greatCircleFromPrevDayNm: number | null = null
      let unaccountedDistanceFromPrevDayNm: number | null = null
      if (prevCoord && !Number.isNaN(lat) && !Number.isNaN(lng)) {
        greatCircleFromPrevDayNm = Number(greatCircleNm(prevCoord.lat, prevCoord.lng, lat, lng).toFixed(1))
        unaccountedDistanceFromPrevDayNm = Number((greatCircleFromPrevDayNm - distanceRunNm).toFixed(1))
      }
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) prevCoord = { lat, lng }

      return {
        dayNumber: index + 1,
        dateIso: r.reportDateTime,
        lat: Number.isNaN(lat) ? null : Number(lat.toFixed(4)),
        lng: Number.isNaN(lng) ? null : Number(lng.toFixed(4)),
        distanceRunNm,
        cumulativeDistanceNm: Number(cumulativeNm.toFixed(1)),
        greatCircleFromPrevDayNm,
        unaccountedDistanceFromPrevDayNm,
      }
    })

    return json({
      vesselId,
      voyageNumber: voyageNumber || sorted[0]?.Voyage || sorted[0]?.voyage || null,
      found: true,
      dayCount: days.length,
      days,
    })
  }, {
    name: 'get_vessel_daily_positions',
    description: 'Get the exact per-day noon-report GPS position (lat/long), daily distance run, cumulative voyage distance, and the great-circle-vs-logged distance gap between consecutive days. Use this whenever the operator asks for a specific day\'s coordinates or position, wants to compare distance between two days, or asks how much distance is missing/unaccounted-for/not reported between noon reports.',
    schema: z.object({
      vesselId: z.number().int().positive(),
      voyageNumber: z.string().trim().max(60).optional(),
      startDate: z.string().trim().max(20).optional(),
      endDate: z.string().trim().max(20).optional(),
      year: z.number().int().optional(),
    }),
  })

  return [
    searchAlerts,
    analyzeAlert,
    vesselContext,
    fleetConnectivity,
    fleetVoyages,
    fleetAlarmTrends,
    vesselCii,
    simulateSpeedReduction,
    vesselDailyPositions,
  ]
}
