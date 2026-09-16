# Voyage Optimization Live CII Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Voyage Optimization screen's synthetic 8-day "variance seed" table and hardcoded constants (DWT, distance, fuel-burn rate) with real per-day data from the live `smartshipweb.com` CII date-range API, reusing this repo's existing `backendFetch` auth pattern, while clearly labeling the few numbers (EU ETS price, laycan buffer, alternate-route strategies) that have no real data source.

**Architecture:** A new thin server route (`server/api/vessels/cii-date-range.get.ts`) proxies the live `/prod/api/v1/cii/date-range` endpoint via the existing `backendFetch()` helper (no new auth, no new env vars). The `useVoyageOptimization` composable fetches it and a new pure mapping function (`mapCiiRecordsToDailyNoons`) turns the raw API records into the `DailyNoonReport[]` the UI already renders. Real vessel deadweight, fuel consumption, weather, and CII rating/boundaries come straight from the API. Route-strategy comparisons and the laycan buffer stay as documented models (no live source exists) but get named constants and an "Estimated" UI marker instead of being disguised as live data.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, `node:test` (`tsx --test`), h3 (Nuxt server routes).

**Spec:** `docs/superpowers/specs/2026-09-16-voyage-optimization-live-cii-design.md`

## Global Constraints

- No auth tokens, API keys, or secrets in source, env files, or commits — auth flows through `backendFetch()`'s existing per-request cookie/header resolution, exactly like every other `server/api/vessels/*` route.
- No new env vars — `BACKEND_SERVER_URL`/`BACKEND_API_URL` (both already defined in `server/utils/http-adapter.ts`) are sufficient.
- `npx nuxi typecheck` must pass after every task that touches `.ts`/`.vue` files (the `DailyNoonReport` type change ripples into two components).
- `npm test` (`tsx --test tests/**/*.test.ts`) must stay green after every task.
- Anything with no real data source (EU ETS price, laycan buffer, alternate-route strategies) is a named constant with a comment explaining why, and gets a visible "Estimated" marker in the UI — never presented as live telemetry.
- Nuxt 4 auto-import: components under `app/components` need no path prefix. Tailwind v4 semantic tokens only (no hardcoded hex, except the existing route-strategy `colorHex` map, which matches this repo's stated chart-color exception).

---

### Task 1: DMS Coordinate Parser

**Files:**
- Modify: `app/lib/vessel-voyage.ts`
- Test: `tests/unit/vessel-voyage.test.ts`

**Interfaces:**
- Produces: `parseDmsCoordinate(dms: string): number` — parses a degrees-minutes-seconds string like `"24°13'5''S"` into signed decimal degrees. Returns `NaN` for unparseable input.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/vessel-voyage.test.ts` (add `parseDmsCoordinate` to the existing import list at the top):

```ts
import {
  parseVesselCurrentPosition,
  parsePlannedCorridor,
  parseTravelledTrack,
  deriveWaypoints,
  resolvePortCoordinates,
  parseDmsCoordinate,
  KNOWN_PORT_COORDS,
} from '../../app/lib/vessel-voyage'
```

Append at the end of the file:

```ts
test('parseDmsCoordinate converts a southern-hemisphere DMS latitude to negative decimal degrees', () => {
  const result = parseDmsCoordinate("24°13'5''S")
  assert.ok(Math.abs(result - -24.218056) < 0.001)
})

test('parseDmsCoordinate converts an eastern DMS longitude to positive decimal degrees', () => {
  const result = parseDmsCoordinate("050°31'0''E")
  assert.ok(Math.abs(result - 50.516667) < 0.001)
})

test('parseDmsCoordinate handles northern and western hemispheres', () => {
  assert.ok(Math.abs(parseDmsCoordinate("10°0'0''N") - 10) < 0.001)
  assert.ok(Math.abs(parseDmsCoordinate("10°0'0''W") - -10) < 0.001)
})

test('parseDmsCoordinate returns NaN for unparseable input', () => {
  assert.ok(Number.isNaN(parseDmsCoordinate('')))
  assert.ok(Number.isNaN(parseDmsCoordinate('not a coordinate')))
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test tests/unit/vessel-voyage.test.ts`
Expected: FAIL (`parseDmsCoordinate is not a function` / import error)

- [ ] **Step 3: Implement `parseDmsCoordinate` in `app/lib/vessel-voyage.ts`**

Add at the end of `app/lib/vessel-voyage.ts`:

```ts
/**
 * Parses a degrees-minutes-seconds coordinate string (e.g. "24°13'5''S")
 * into signed decimal degrees. Returns NaN for unparseable input.
 */
export function parseDmsCoordinate(dms: string): number {
  const match = /^(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D*([NSEW])$/.exec((dms || '').trim())
  if (!match) return NaN
  const [, degStr, minStr, secStr, dir] = match
  const deg = Number(degStr)
  const min = Number(minStr)
  const sec = Number(secStr)
  const decimal = deg + min / 60 + sec / 3600
  return dir === 'S' || dir === 'W' ? -decimal : decimal
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test tests/unit/vessel-voyage.test.ts`
Expected: PASS, all tests including the 4 new ones.

- [ ] **Step 5: Commit**

```bash
git add app/lib/vessel-voyage.ts tests/unit/vessel-voyage.test.ts
git commit -m "feat(voyage): add DMS coordinate parser for real noon-report positions"
```

---

### Task 2: Server Proxy Route for Live CII Date-Range Data

**Files:**
- Create: `server/api/vessels/cii-date-range.get.ts`
- Test: `tests/server/vessels-api.test.ts` (modify)

**Interfaces:**
- Consumes: `backendFetch<T>(endpoint, { event })` from `server/utils/http-adapter.ts` (existing, unchanged).
- Produces: `GET /api/vessels/cii-date-range?vesselId&startDate&endDate&year&voyageType` → `{ success: boolean; records: unknown[] }`. Real shape of each record is documented in Task 3's `CiiDateRangeRecord` type; this route intentionally returns `unknown[]` (no import from `app/lib` needed) to keep server and app layers decoupled — the composable does the typed mapping.

- [ ] **Step 1: Write the failing test**

Modify `tests/server/vessels-api.test.ts` — add the import and assertion:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import sisterGroupHandler from '../../server/api/vessels/sister-group.post'
import dashboardStateHandler from '../../server/api/vessels/dashboard-state.get'
import windyGeojsonHandler from '../../server/api/vessels/windy-geojson.get'
import mrvLatestHandler from '../../server/api/vessels/mrv-latest.get'
import connectivityStatusHandler from '../../server/api/vessels/connectivity-status.get'
import rhsPanelFlagsGetHandler from '../../server/api/vessels/rhs-panel-flags.get'
import rhsPanelFlagsPostHandler from '../../server/api/vessels/rhs-panel-flags.post'
import rechartDataHandler from '../../server/api/vessels/rechart-data.post'
import graphAvgValuesHandler from '../../server/api/vessels/graph-avg-values.get'
import alarmsHandler from '../../server/api/vessels/alarms.get'
import ciiDateRangeHandler from '../../server/api/vessels/cii-date-range.get'

test('Vessel API Server Proxies defines all route handlers properly', () => {
  assert.equal(typeof sisterGroupHandler, 'function')
  assert.equal(typeof dashboardStateHandler, 'function')
  assert.equal(typeof windyGeojsonHandler, 'function')
  assert.equal(typeof mrvLatestHandler, 'function')
  assert.equal(typeof connectivityStatusHandler, 'function')
  assert.equal(typeof rhsPanelFlagsGetHandler, 'function')
  assert.equal(typeof rhsPanelFlagsPostHandler, 'function')
  assert.equal(typeof rechartDataHandler, 'function')
  assert.equal(typeof graphAvgValuesHandler, 'function')
  assert.equal(typeof alarmsHandler, 'function')
  assert.equal(typeof ciiDateRangeHandler, 'function')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/server/vessels-api.test.ts`
Expected: FAIL (`Cannot find module '../../server/api/vessels/cii-date-range.get'`)

- [ ] **Step 3: Implement `server/api/vessels/cii-date-range.get.ts`**

```ts
import { defineEventHandler, getQuery } from 'h3'
import { backendFetch } from '../../utils/http-adapter'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const vesselId = query.vesselId || '1'
  const startDate = query.startDate
  const endDate = query.endDate
  const year = query.year || new Date().getUTCFullYear()
  const voyageType = query.voyageType || 'all'

  const endpoint = `/prod/api/v1/cii/date-range?vesselId=${vesselId}&startDate=${startDate}&endDate=${endDate}&year=${year}&voyageType=${voyageType}&type=byDate`
  const res = await backendFetch<unknown[]>(endpoint, { event })

  return {
    success: res.success,
    records: res.success && Array.isArray(res.data) ? res.data : [],
  }
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/server/vessels-api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/api/vessels/cii-date-range.get.ts tests/server/vessels-api.test.ts
git commit -m "feat(voyage): add server proxy route for live CII date-range data"
```

---

### Task 3: Domain Engine Rewrite — Real-Data Mapping, Named Estimate Constants

**Files:**
- Modify: `app/lib/voyage-optimization.ts`
- Test: `tests/marine/voyage-optimization.test.ts` (rewritten in Task 7, after this task's own build/typecheck check)

**Interfaces:**
- Consumes: `parseDmsCoordinate` from `./vessel-voyage` (Task 1).
- Produces (replaces prior exports of the same file):
  - `CiiDateRangeRecord` (new type — raw API record shape)
  - `DailyNoonReport` (changed: `fuelConsumedMt.vlsfo/mgo` → `fuelConsumedMt.byType: Record<string, {value,label}>`; added `requiredCii`, `ciiBoundaries`)
  - `RouteStrategyOption` (changed: added `basis: 'live' | 'modeled-estimate'`)
  - `mapCiiRecordsToDailyNoons(records: CiiDateRangeRecord[]): DailyNoonReport[]` (new — replaces `computeDailyNoonProgression`)
  - `resolveVesselDeadweightMt(records: CiiDateRangeRecord[]): number` (new)
  - `EU_ETS_CARBON_PRICE_EUR_PER_TON = 85` (new named constant, replaces 3 literal `85`s)
  - `DEFAULT_LAYCAN_BUFFER_HOURS = 8.5` (new named constant)
  - `calculateCii`, `resolveCiiRating`, `calculateRouteStrategies`, `deriveVoyageAdvisories`, `CIIRating`, `VoyageAdvisory` (kept, `calculateRouteStrategies` signature unchanged except no more default parameter values — composable now always supplies real-derived inputs)
  - Removed: `computeDailyNoonProgression`, `interpolateAlongPolyline`, `haversineNm` (all three were only used by the removed synthetic-progression logic; confirmed via repo-wide grep that nothing else imports them)

- [ ] **Step 1: Replace the entire contents of `app/lib/voyage-optimization.ts`**

```ts
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
```

Note: this fixes a pre-existing inconsistency — the old code showed `+8.5h` in the KPI HUD (`kpiSummary.laycanBufferHours`) but a hardcoded, different `"+6.5h"` in the advisory text. Both now reference the same `DEFAULT_LAYCAN_BUFFER_HOURS` constant.

- [ ] **Step 2: Typecheck (expected to show errors in dependent files — fixed in Tasks 4–6)**

Run: `npx nuxi typecheck`
Expected: FAIL — errors in `app/composables/useVoyageOptimization.ts` (imports `computeDailyNoonProgression`/`haversineNm`, which no longer exist) and in `app/components/voyage/VoyageOptimizationDrawer.vue` (`fuelConsumedMt.vlsfo`/`.mgo` no longer exist). This is expected; do not fix those files in this task.

- [ ] **Step 3: Commit**

```bash
git add app/lib/voyage-optimization.ts
git commit -m "feat(voyage): rewrite domain engine to map real CII API records, remove synthetic variance-seed table"
```

---

### Task 4: Composable Rewrite — Fetch and Wire Real CII Data

**Files:**
- Modify: `app/composables/useVoyageOptimization.ts`

**Interfaces:**
- Consumes: `mapCiiRecordsToDailyNoons`, `calculateRouteStrategies`, `deriveVoyageAdvisories`, `resolveVesselDeadweightMt`, `EU_ETS_CARBON_PRICE_EUR_PER_TON`, `DEFAULT_LAYCAN_BUFFER_HOURS`, and the `CiiDateRangeRecord`/`DailyNoonReport`/`RouteStrategyOption`/`VoyageAdvisory`/`CIIRating` types from `~/lib/voyage-optimization` (Task 3). Consumes `GET /api/vessels/cii-date-range` (Task 2).
- Produces (composable return object — added keys `isCiiLoading`, `ciiLoadError`, `fetchCiiDateRange`; all prior keys kept unchanged so `VoyageOptimizationHeaderBar.vue`, `VoyageOptimizationMap.vue`, and `app/pages/voyage-optimization.vue` need no changes): unchanged from before except `activeStrategyOption` may now be `null` when no CII data has loaded yet.

- [ ] **Step 1: Replace the entire contents of `app/composables/useVoyageOptimization.ts`**

```ts
import { ref, computed, watch, shallowRef } from 'vue'
import { useVesselDashboard } from '~/composables/useVesselDashboard'
import {
  mapCiiRecordsToDailyNoons,
  calculateRouteStrategies,
  deriveVoyageAdvisories,
  resolveVesselDeadweightMt,
  EU_ETS_CARBON_PRICE_EUR_PER_TON,
  DEFAULT_LAYCAN_BUFFER_HOURS,
  type DailyNoonReport,
  type RouteStrategyOption,
  type VoyageAdvisory,
  type CIIRating,
  type CiiDateRangeRecord,
} from '~/lib/voyage-optimization'
import {
  parsePlannedCorridor,
  parseVesselCurrentPosition,
  parseTravelledTrack,
} from '~/lib/vessel-voyage'
import type { MarineWeatherForecast } from '~~/server/utils/weather-adapter'

export interface VoyageOptimizationKpiSummary {
  attainedCii: number
  attainedRating: CIIRating
  requiredCii: number
  targetRating: CIIRating
  ciiMarginPct: number
  recommendedSpeedKts: number
  speedDeltaKts: number
  dailyFuelSavingsMt: number
  weatherAlertHeadline: string
  weatherAlertSubtext: string
  weatherRiskLevel: 'low' | 'moderate' | 'high'
  laycanBufferHours: number
  carbonSavingsEur: number
  projectedVoyageFuelMt: number
}

// Module-level persistent state across screen transitions
const activeStrategy = ref<'current' | 'lowest-fuel' | 'safest' | 'fastest'>('current')
const selectedDay = ref<DailyNoonReport | null>(null)
const advisoriesList = ref<VoyageAdvisory[]>([])
const weatherAlongRoute = shallowRef<MarineWeatherForecast[]>([])
const isWeatherLoading = ref(false)
const ciiRecords = shallowRef<CiiDateRangeRecord[]>([])
const isCiiLoading = ref(false)
const ciiLoadError = ref(false)

export function useVoyageOptimization() {
  const {
    selectedVesselId,
    selectedVessel,
    vesselsList,
    mrvData,
    windyMapData,
    isMapLoading,
    refreshAll,
  } = useVesselDashboard()

  // 1. Parse current passage and vessel geometry
  const parsedCorridor = computed(() => parsePlannedCorridor(windyMapData.value))
  const parsedVessel = computed(() => parseVesselCurrentPosition(windyMapData.value))
  const parsedTravelled = computed(() => parseTravelledTrack(windyMapData.value))

  // Fallback corridor points if API is still loading or sparse
  // (unrelated to CII data — this drives the live map's polyline, not the KPI/log numbers)
  const effectiveCorridorCoords = computed<[number, number][]>(() => {
    if (parsedCorridor.value.coords && parsedCorridor.value.coords.length >= 2) {
      return parsedCorridor.value.coords
    }
    return [
      [-12.05, -77.15],
      [-8.2, -85.4],
      [-3.5, -95.0],
      [2.1, -110.5],
      [8.4, -130.0],
      [15.2, -150.0],
      [20.5, -170.0],
      [24.0, 170.0],
      [25.5, 145.0],
      [26.66, 119.52],
    ]
  })

  // 2. Fetch real per-day CII noon report data for the active vessel.
  // Window is a trailing 14 days ending at the latest known noon report date
  // (the API has no "whole voyage" query; true voyage-start-aware ranging is
  // a documented follow-up, not implemented here to avoid guessing at data
  // this composable doesn't have).
  async function fetchCiiDateRange() {
    isCiiLoading.value = true
    ciiLoadError.value = false
    try {
      const endDate = (mrvData.value?.rptdate || new Date().toISOString()).slice(0, 10)
      const endDt = new Date(endDate)
      const startDt = new Date(endDt.getTime() - 13 * 24 * 3600 * 1000)
      const startDate = startDt.toISOString().slice(0, 10)
      const year = endDt.getUTCFullYear()

      const res = await $fetch<{ success: boolean; records: CiiDateRangeRecord[] }>(
        '/api/vessels/cii-date-range',
        { params: { vesselId: selectedVesselId.value, startDate, endDate, year } }
      )
      ciiRecords.value = res.success ? res.records : []
      ciiLoadError.value = !res.success
    } catch {
      ciiRecords.value = []
      ciiLoadError.value = true
    } finally {
      isCiiLoading.value = false
    }
  }

  // 3. Map real CII records into Daily Noon Reports — no synthetic data
  const dailyNoons = computed<DailyNoonReport[]>(() => mapCiiRecordsToDailyNoons(ciiRecords.value))

  // 4. Compute comparative route strategies from real voyage/CII aggregates
  const routeStrategies = computed<RouteStrategyOption[]>(() => {
    if (ciiRecords.value.length === 0) return []

    const coords = effectiveCorridorCoords.value
    const totalDistRaw = parseFloat(String(mrvData.value?.totaldistrun || '').replace(/,/g, ''))
    const distToGoRaw = parseFloat(String(mrvData.value?.disttogo || '').replace(/,/g, ''))
    const baseDist =
      !isNaN(totalDistRaw) && !isNaN(distToGoRaw) && totalDistRaw + distToGoRaw > 500
        ? totalDistRaw + distToGoRaw
        : 5400 // Fallback only when live voyage-distance telemetry is unavailable

    const totalCiiDist = ciiRecords.value.reduce((sum, r) => sum + (r.distance || 0), 0)
    const totalCiiFuel = ciiRecords.value.reduce((sum, r) => sum + (r.totalConsumption || 0), 0)
    const avgSpeed =
      totalCiiDist > 0
        ? ciiRecords.value.reduce((sum, r) => sum + (r.avgSpeed || 0) * (r.distance || 0), 0) / totalCiiDist
        : parsedVessel.value.sog || 13.5

    // Real fuel-burn rate (MT/NM) from the fetched noon-report window, scaled to the full voyage distance
    const fuelBurnRateMtPerNm = totalCiiDist > 0 ? totalCiiFuel / totalCiiDist : 0
    const baseFuel = Math.round(fuelBurnRateMtPerNm * baseDist * 10) / 10
    const dwt = resolveVesselDeadweightMt(ciiRecords.value)

    return calculateRouteStrategies(baseDist, baseFuel, avgSpeed, dwt, coords)
  })

  const activeStrategyOption = computed<RouteStrategyOption | null>(() => {
    if (routeStrategies.value.length === 0) return null
    return routeStrategies.value.find((s) => s.id === activeStrategy.value) || routeStrategies.value[0]!
  })

  // 5. Update advisories reactively when vessel or noons change
  watch(
    [dailyNoons, activeStrategy],
    () => {
      const latestNoon = dailyNoons.value[dailyNoons.value.length - 1]
      const currentRating = latestNoon?.rating || 'C'
      const weatherAhead = {
        beaufort: latestNoon?.weather.beaufort || 4,
        waveHeightM: latestNoon?.weather.waveHeightM || 1.8,
      }
      advisoriesList.value = deriveVoyageAdvisories(currentRating, 'B', weatherAhead, 1.2)
    },
    { immediate: true }
  )

  // 6. Compute Advisory KPI Summary HUD
  const kpiSummary = computed<VoyageOptimizationKpiSummary>(() => {
    const latestNoon = dailyNoons.value[dailyNoons.value.length - 1]
    const activeOpt = activeStrategyOption.value
    const currentOpt = routeStrategies.value.find((s) => s.id === 'current')
    const isEco = activeStrategy.value === 'lowest-fuel'

    const currentCii = latestNoon?.attainedCii ?? 0
    const currentRating = latestNoon?.rating ?? 'C'
    const requiredCii = latestNoon?.requiredCii || 0
    const marginPct = requiredCii > 0 ? Math.round(((requiredCii - currentCii) / requiredCii) * 1000) / 10 : 0

    const recSpeed = Math.round((activeOpt?.avgSpeedKts || 0) * 10) / 10
    const speedDelta =
      isEco && activeOpt && currentOpt ? Math.round((currentOpt.avgSpeedKts - activeOpt.avgSpeedKts) * 10) / 10 : 0
    const fuelSavings = isEco && activeOpt ? activeOpt.fuelSavingsMt : 0

    const weatherLevel: 'low' | 'moderate' | 'high' =
      (latestNoon?.weather.beaufort || 3) >= 6 ? 'high' : (latestNoon?.weather.beaufort || 3) >= 5 ? 'moderate' : 'low'

    return {
      attainedCii: currentCii,
      attainedRating: currentRating,
      requiredCii,
      targetRating: 'B',
      ciiMarginPct: marginPct,
      recommendedSpeedKts: recSpeed,
      speedDeltaKts: speedDelta,
      dailyFuelSavingsMt: fuelSavings,
      weatherAlertHeadline:
        weatherLevel === 'high'
          ? `Adverse swell ${latestNoon?.weather.waveHeightM}m ahead`
          : weatherLevel === 'moderate'
          ? `Moderate winds BF ${latestNoon?.weather.beaufort}`
          : 'Favorable passage weather',
      weatherAlertSubtext: latestNoon?.weather.shortForecast || 'Nominal resistance',
      weatherRiskLevel: weatherLevel,
      laycanBufferHours: DEFAULT_LAYCAN_BUFFER_HOURS,
      carbonSavingsEur: activeOpt && activeOpt.carbonSavingsEur > 0 ? activeOpt.carbonSavingsEur : 0,
      projectedVoyageFuelMt: activeOpt?.totalFuelMt || 0,
    }
  })

  // 7. Fetch live meteorological forecast along passage
  async function fetchRouteWeather() {
    if (isWeatherLoading.value) return
    isWeatherLoading.value = true
    try {
      const coords = effectiveCorridorCoords.value
      const pointsToSample: [number, number][] = []
      if (coords.length > 0) pointsToSample.push(coords[0]!)
      if (parsedVessel.value.isValid) pointsToSample.push([parsedVessel.value.lat, parsedVessel.value.lng])
      if (coords.length > 3) pointsToSample.push(coords[Math.floor(coords.length * 0.65)]!)
      if (coords.length > 1) pointsToSample.push(coords[coords.length - 1]!)

      const results = await Promise.allSettled(
        pointsToSample.map((pt) =>
          $fetch<{ success: boolean; data: MarineWeatherForecast }>('/api/weather/forecast', {
            params: { lat: pt[0], lng: pt[1] },
          }).then((res) => res.data)
        )
      )

      const weatherList: MarineWeatherForecast[] = []
      for (const res of results) {
        if (res.status === 'fulfilled' && res.value) {
          weatherList.push(res.value)
        }
      }
      weatherAlongRoute.value = weatherList
    } catch {
      // Fallback already guaranteed by server endpoint
    } finally {
      isWeatherLoading.value = false
    }
  }

  function setStrategy(strategy: 'current' | 'lowest-fuel' | 'safest' | 'fastest') {
    activeStrategy.value = strategy
  }

  function selectDay(day: DailyNoonReport | null) {
    selectedDay.value = day
  }

  function applyAdvisory(id: string) {
    const found = advisoriesList.value.find((a) => a.id === id)
    if (found) {
      found.applied = true
      if (found.type === 'speed') {
        activeStrategy.value = 'lowest-fuel'
      }
    }
  }

  // Auto-fetch CII data and weather when vessel changes
  watch(
    () => selectedVesselId.value,
    () => {
      selectedDay.value = null
      fetchCiiDateRange()
      fetchRouteWeather()
    },
    { immediate: true }
  )

  return {
    selectedVesselId,
    selectedVessel,
    vessels: vesselsList,
    vesselsList,
    mrvData,
    windyMapData,
    isMapLoading,
    parsedCorridor,
    parsedVessel,
    parsedTravelled,
    effectiveCorridorCoords,
    dailyNoons,
    isCiiLoading,
    ciiLoadError,
    routeStrategies,
    activeStrategy,
    activeStrategyOption,
    selectedDay,
    advisories: advisoriesList,
    kpiSummary,
    weatherAlongRoute,
    isWeatherLoading,
    setStrategy,
    selectDay,
    applyAdvisory,
    fetchRouteWeather,
    fetchCiiDateRange,
    refreshAll,
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx nuxi typecheck`
Expected: FAIL only in `app/components/voyage/VoyageOptimizationDrawer.vue` (still references `fuelConsumedMt.vlsfo`/`.mgo`, fixed in Task 5). No errors should remain in `useVoyageOptimization.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add app/composables/useVoyageOptimization.ts
git commit -m "feat(voyage): wire composable to fetch and derive from real CII date-range data"
```

---

### Task 5: Drawer Component — Dynamic Fuel Breakdown, Empty State, Estimate Labels

**Files:**
- Modify: `app/components/voyage/VoyageOptimizationDrawer.vue`

**Interfaces:**
- Consumes: `isCiiLoading`, `ciiLoadError` (new, Task 4) in addition to the composable properties already destructured at line 36–45. Renders `DailyNoonReport.fuelConsumedMt.byType` (Task 3's new shape) instead of the removed `.vlsfo`/`.mgo` fields.

- [ ] **Step 1: Add `isCiiLoading`/`ciiLoadError` to the composable destructure**

In the `<script setup>` block, change:

```ts
const {
  selectedDay,
  dailyNoons,
  routeStrategies,
  activeStrategy,
  advisories,
  setStrategy,
  applyAdvisory,
  selectDay,
} = useVoyageOptimization()
```

to:

```ts
const {
  selectedDay,
  dailyNoons,
  routeStrategies,
  activeStrategy,
  advisories,
  isCiiLoading,
  ciiLoadError,
  setStrategy,
  applyAdvisory,
  selectDay,
} = useVoyageOptimization()
```

- [ ] **Step 2: Replace the fuel breakdown block to iterate real fuel types**

Replace (current lines 192–207):

```html
              <!-- Fuel Consumption Breakdown -->
              <div class="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-2">
                <div class="flex items-center justify-between text-xs font-semibold">
                  <span class="flex items-center gap-1.5 text-foreground">
                    <Fuel class="w-3.5 h-3.5 text-amber-500" />
                    24h Fuel Consumed
                  </span>
                  <span class="font-mono text-primary font-bold">{{ currentNoon.fuelConsumedMt.total }} MT</span>
                </div>
                <div class="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1 border-t border-border/60">
                  <div>VLSFO: <strong class="text-foreground font-mono">{{ currentNoon.fuelConsumedMt.vlsfo }} MT</strong></div>
                  <div>LSMGO: <strong class="text-foreground font-mono">{{ currentNoon.fuelConsumedMt.mgo }} MT</strong></div>
                  <div>24h CO₂: <strong class="text-foreground font-mono">{{ currentNoon.totalCo2Mt }} MT</strong></div>
                  <div>Voyage Total: <strong class="text-foreground font-mono">{{ currentNoon.cumulativeFuelMt }} MT</strong></div>
                </div>
              </div>
```

with:

```html
              <!-- Fuel Consumption Breakdown (real per-fuel-type data from the CII API) -->
              <div class="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-2">
                <div class="flex items-center justify-between text-xs font-semibold">
                  <span class="flex items-center gap-1.5 text-foreground">
                    <Fuel class="w-3.5 h-3.5 text-amber-500" />
                    24h Fuel Consumed
                  </span>
                  <span class="font-mono text-primary font-bold">{{ currentNoon.fuelConsumedMt.total }} MT</span>
                </div>
                <div class="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1 border-t border-border/60">
                  <div v-for="(fuel, key) in currentNoon.fuelConsumedMt.byType" :key="key">
                    {{ fuel.label }}: <strong class="text-foreground font-mono">{{ fuel.value }} MT</strong>
                  </div>
                  <div>24h CO₂: <strong class="text-foreground font-mono">{{ currentNoon.totalCo2Mt }} MT</strong></div>
                  <div>Voyage Total: <strong class="text-foreground font-mono">{{ currentNoon.cumulativeFuelMt }} MT</strong></div>
                </div>
              </div>
```

- [ ] **Step 3: Add an empty/error state for when no live CII data is available**

Replace (current lines 228–229):

```html
        </template>
      </div>
```

with:

```html
        </template>
        <div
          v-else-if="!isCiiLoading"
          class="p-4 rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground"
        >
          {{ ciiLoadError ? 'Live CII data unavailable — upstream request failed.' : 'No noon report data for this vessel in the selected window.' }}
        </div>
        <div v-else class="p-4 text-center text-xs text-muted-foreground">
          Loading live noon report data…
        </div>
      </div>
```

- [ ] **Step 4: Label the Route Strategies Comparison as partly modeled**

Replace (current lines 234–241):

```html
        <div class="space-y-2">
          <div class="text-xs font-semibold text-foreground flex items-center justify-between">
            <span class="flex items-center gap-1.5">
              <Layers class="w-3.5 h-3.5 text-primary" />
              Route Strategies Comparison
            </span>
            <span class="text-[10px] text-muted-foreground">Select to simulate</span>
          </div>
```

with:

```html
        <div class="space-y-2">
          <div class="text-xs font-semibold text-foreground flex items-center justify-between">
            <span class="flex items-center gap-1.5">
              <Layers class="w-3.5 h-3.5 text-primary" />
              Route Strategies Comparison
            </span>
            <span class="text-[10px] text-muted-foreground">Select to simulate</span>
          </div>
          <div class="text-[10px] text-muted-foreground">
            "Current" reflects live voyage data; alternates are modeled estimates.
          </div>
```

Then, in the per-strategy card badge (current lines 256–262), add a small estimate marker for the three modeled strategies by changing:

```html
                <Badge
                  variant="outline"
                  class="font-mono text-[10px] font-bold"
                  :class="strat.fuelSavingsMt > 0 ? 'text-emerald-600 border-emerald-500/40 bg-emerald-500/10' : 'text-muted-foreground'"
                >
                  {{ strat.fuelSavingsMt > 0 ? `-${strat.fuelSavingsMt} MT Fuel` : `${strat.totalFuelMt} MT` }}
                </Badge>
```

to:

```html
                <div class="flex items-center gap-1.5">
                  <span v-if="strat.basis === 'modeled-estimate'" class="text-[9px] uppercase font-bold text-muted-foreground/70">Est.</span>
                  <Badge
                    variant="outline"
                    class="font-mono text-[10px] font-bold"
                    :class="strat.fuelSavingsMt > 0 ? 'text-emerald-600 border-emerald-500/40 bg-emerald-500/10' : 'text-muted-foreground'"
                  >
                    {{ strat.fuelSavingsMt > 0 ? `-${strat.fuelSavingsMt} MT Fuel` : `${strat.totalFuelMt} MT` }}
                  </Badge>
                </div>
```

- [ ] **Step 5: Typecheck**

Run: `npx nuxi typecheck`
Expected: PASS, 0 errors.

- [ ] **Step 6: Commit**

```bash
git add app/components/voyage/VoyageOptimizationDrawer.vue
git commit -m "feat(voyage): render real per-fuel-type breakdown, add empty state, label modeled route strategies"
```

---

### Task 6: KPI HUD Component — Estimate Labels

**Files:**
- Modify: `app/components/voyage/VoyageOptimizationKpiHud.vue`

**Interfaces:**
- Consumes: `kpiSummary`, `activeStrategy` (unchanged destructure). Purely a copy/label change — no new props.

- [ ] **Step 1: Mark the Charter Laycan tile as an estimate**

Replace (current lines 138–160):

```html
      <!-- Tile 4: ETA & Charter Buffer -->
      <div class="flex flex-col justify-between p-2.5 rounded-lg bg-background/50 border border-border/60">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <Clock class="w-3.5 h-3.5 text-blue-500" />
            Charter Laycan
          </span>
          <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400">
            Safe
          </span>
        </div>
        <div class="mt-2 flex items-baseline justify-between">
          <span class="text-base sm:text-lg font-bold font-mono tracking-tight text-foreground">
            +{{ kpiSummary.laycanBufferHours }}h
          </span>
          <span class="text-[10px] text-muted-foreground">
            Window Buffer
          </span>
        </div>
        <div class="mt-1 text-[10px] text-muted-foreground truncate">
          Arrival well within charter party
        </div>
      </div>
```

with:

```html
      <!-- Tile 4: ETA & Charter Buffer -->
      <div class="flex flex-col justify-between p-2.5 rounded-lg bg-background/50 border border-border/60">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <Clock class="w-3.5 h-3.5 text-blue-500" />
            Charter Laycan
          </span>
          <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            Estimated
          </span>
        </div>
        <div class="mt-2 flex items-baseline justify-between">
          <span class="text-base sm:text-lg font-bold font-mono tracking-tight text-foreground">
            +{{ kpiSummary.laycanBufferHours }}h
          </span>
          <span class="text-[10px] text-muted-foreground">
            Window Buffer
          </span>
        </div>
        <div class="mt-1 text-[10px] text-muted-foreground truncate">
          Modeled — no live charter-party feed connected
        </div>
      </div>
```

- [ ] **Step 2: Mark the EU ETS / Carbon tile as an estimate**

Replace (current lines 162–184):

```html
      <!-- Tile 5: Emission & Financial Savings -->
      <div class="col-span-2 sm:col-span-1 flex flex-col justify-between p-2.5 rounded-lg bg-background/50 border border-border/60">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <Coins class="w-3.5 h-3.5 text-amber-500" />
            EU ETS / Carbon
          </span>
          <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            Savings
          </span>
        </div>
        <div class="mt-2 flex items-baseline justify-between">
          <span class="text-base sm:text-lg font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
            €{{ kpiSummary.carbonSavingsEur.toLocaleString() }}
          </span>
          <span class="text-[10px] text-muted-foreground font-mono">
            {{ kpiSummary.projectedVoyageFuelMt }} MT
          </span>
        </div>
        <div class="mt-1 text-[10px] text-muted-foreground truncate">
          Allowance savings vs standard speed
        </div>
      </div>
```

with:

```html
      <!-- Tile 5: Emission & Financial Savings -->
      <div class="col-span-2 sm:col-span-1 flex flex-col justify-between p-2.5 rounded-lg bg-background/50 border border-border/60">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <Coins class="w-3.5 h-3.5 text-amber-500" />
            EU ETS / Carbon
          </span>
          <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            Estimated
          </span>
        </div>
        <div class="mt-2 flex items-baseline justify-between">
          <span class="text-base sm:text-lg font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
            €{{ kpiSummary.carbonSavingsEur.toLocaleString() }}
          </span>
          <span class="text-[10px] text-muted-foreground font-mono">
            {{ kpiSummary.projectedVoyageFuelMt }} MT
          </span>
        </div>
        <div class="mt-1 text-[10px] text-muted-foreground truncate">
          Modeled at €85/ton EU ETS — no live price feed connected
        </div>
      </div>
```

- [ ] **Step 3: Typecheck**

Run: `npx nuxi typecheck`
Expected: PASS, 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/components/voyage/VoyageOptimizationKpiHud.vue
git commit -m "feat(voyage): label Charter Laycan and EU ETS tiles as modeled estimates"
```

---

### Task 7: Domain Engine Test Suite — Real Fixture Coverage

**Files:**
- Modify: `tests/marine/voyage-optimization.test.ts`
- Fixture (already created): `tests/fixtures/cii-date-range-sample.json` — 2 real per-day records captured 2026-09-16 from the live endpoint for vessel "CHINA EXPRESS" (public shipping-registry data: IMO/MMSI/callsign, no auth material).

**Interfaces:**
- Consumes: `mapCiiRecordsToDailyNoons`, `resolveVesselDeadweightMt`, `calculateRouteStrategies`, `deriveVoyageAdvisories`, `CiiDateRangeRecord` from `../../app/lib/voyage-optimization.ts` (Task 3).

- [ ] **Step 1: Replace the entire contents of `tests/marine/voyage-optimization.test.ts`**

```ts
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  mapCiiRecordsToDailyNoons,
  resolveVesselDeadweightMt,
  calculateRouteStrategies,
  deriveVoyageAdvisories,
  type CiiDateRangeRecord,
} from '../../app/lib/voyage-optimization.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturePath = join(__dirname, '../fixtures/cii-date-range-sample.json')
const sampleRecords: CiiDateRangeRecord[] = JSON.parse(readFileSync(fixturePath, 'utf-8'))

describe('Voyage Optimization Domain Engine', () => {
  test('mapCiiRecordsToDailyNoons maps real CII API records into ordered daily noon reports', () => {
    const noons = mapCiiRecordsToDailyNoons(sampleRecords)
    assert.equal(noons.length, 2)

    const day1 = noons[0]!
    assert.equal(day1.dayNumber, 1)
    assert.equal(day1.rating, 'A')
    assert.equal(day1.attainedCii, 3.390250870505968)
    assert.equal(day1.distanceRunNm, 320)
    assert.equal(day1.fuelConsumedMt.total, 24.3)
    assert.equal(day1.fuelConsumedMt.byType.hfo!.value, 24.21)
    assert.equal(day1.fuelConsumedMt.byType.hfo!.label, 'Heavy Fuel Oil')
    assert.ok(Math.abs(day1.coords[0] - -24.218056) < 0.001, 'parses southern latitude correctly')
    assert.ok(Math.abs(day1.coords[1] - 50.516667) < 0.001, 'parses eastern longitude correctly')

    const day2 = noons[1]!
    assert.equal(day2.dayNumber, 2)
    assert.equal(day2.cumulativeDistanceNm, 623)
  })

  test('resolveVesselDeadweightMt reads real deadweight from a CII record', () => {
    assert.equal(resolveVesselDeadweightMt(sampleRecords), 69787)
  })

  test('calculateRouteStrategies returns 4 standard comparative strategies with basis labels', () => {
    const strategies = calculateRouteStrategies(5400, 480, 13.5, 75000)
    assert.equal(strategies.length, 4)

    const ids = strategies.map((s) => s.id)
    assert.ok(ids.includes('current'))
    assert.ok(ids.includes('lowest-fuel'))
    assert.ok(ids.includes('safest'))
    assert.ok(ids.includes('fastest'))

    const current = strategies.find((s) => s.id === 'current')!
    assert.equal(current.basis, 'live')

    const lowestFuel = strategies.find((s) => s.id === 'lowest-fuel')!
    const fastest = strategies.find((s) => s.id === 'fastest')!
    assert.equal(lowestFuel.basis, 'modeled-estimate')
    assert.ok(lowestFuel.totalFuelMt < fastest.totalFuelMt, 'Lowest fuel must consume less than fastest')
    assert.ok(lowestFuel.fuelSavingsMt > 0, 'Lowest fuel must show positive fuel savings')
  })

  test('deriveVoyageAdvisories provides actionable speed and weather advisories', () => {
    const advisories = deriveVoyageAdvisories('C', 'B', { beaufort: 6, waveHeightM: 3.4 }, 1.5)
    assert.ok(advisories.length >= 2)
    const speedAdv = advisories.find((a) => a.type === 'speed')
    assert.ok(speedAdv)
    assert.equal(speedAdv.applied, false)
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx tsx --test tests/marine/voyage-optimization.test.ts`
Expected: PASS, all 4 tests.

- [ ] **Step 3: Commit**

```bash
git add tests/marine/voyage-optimization.test.ts tests/fixtures/cii-date-range-sample.json
git commit -m "test(voyage): cover mapCiiRecordsToDailyNoons and real-deadweight resolution with live API fixture"
```

---

### Task 8: End-to-End Verification

**Files:**
- Verify only — no new files.

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: All tests pass (baseline was 70; this plan adds ~9 net new tests across Tasks 1, 2, 7).

- [ ] **Step 2: Typecheck**

Run: `npx nuxi typecheck`
Expected: 0 errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: Clean build, 0 errors.

- [ ] **Step 4: Manual verification in the running app**

Run: `npm run dev`, open `/voyage-optimization` as a dispatcher/admin persona. Confirm:
- Daily Noon Log day chips (D1, D2, …) count matches the number of real records returned for the selected vessel's trailing 14-day window (not a fixed variance-seed cycle).
- Fuel breakdown tile shows the vessel's actual fuel types (e.g. "Heavy Fuel Oil" / "Ultra Low Sulphur Gas Oil"), not a fixed VLSFO/LSMGO pair.
- Charter Laycan and EU ETS tiles show the new "Estimated" badge and modeled-estimate subtext.
- Route Strategies Comparison shows "Est." next to the three modeled alternates but not next to "Current Active Track".
- If the vessel has no CII data in range, the Daily Noon Log tab shows the new empty/error state instead of a blank panel.

- [ ] **Step 5: Commit any final fixes found during manual verification**

```bash
git add -A
git commit -m "chore(voyage): verify build and live CII integration end-to-end"
```
