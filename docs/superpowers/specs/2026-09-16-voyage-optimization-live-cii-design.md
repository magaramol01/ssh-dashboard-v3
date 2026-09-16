# Voyage Optimization — Live CII Integration Design

- **Author**: Engineering (Claude Code session)
- **Date**: 2026-09-16
- **Status**: Draft
- **Supersedes (partially)**: `2026-09-16-voyage-optimization-design.md` §7 (`DailyNoonReport` interface), §6 (advisory formulas) — route-strategy/advisory formulas are retained, relabeled as estimates.
- **Target files**: `server/api/vessels/cii-date-range.get.ts` (new), `app/composables/useVoyageOptimization.ts`, `app/lib/voyage-optimization.ts`, `app/lib/vessel-voyage.ts`, `app/components/voyage/VoyageOptimizationDrawer.vue`, `app/components/voyage/VoyageOptimizationKpiHud.vue`

---

## 1. Problem

The shipped Voyage Optimization screen (`app/pages/voyage-optimization.vue` + supporting files) computes almost every number shown to the dispatcher — daily fuel, weather, draft, CII, deadweight — from a fixed 8-entry "variance seed" lookup table and hardcoded constants (`dwt = 75000`, fallback distance `5400`, fallback speed `13.5`, baseline fuel rate `26.5 MT/day`). None of it reflects the actual vessel or voyage. Full inventory captured in-session; see conversation history — no need to re-derive.

The org backend already exposes real per-day noon-report + CII data:

```
GET https://smartshipweb.com/prod/api/v1/cii/date-range
  ?vesselId=<id>&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&year=YYYY&voyageType=all&type=byDate
```

Verified live (2026-09-16) — sample record includes real `attainedCII`, `attainedRollingCII`, `CIIRating.{band,requiredCII,ciiBoundaries}`, `vesselInfo.deadweight`, `consumptionData` (fuel-type keyed), `noonreportdata` (weather, draft, position as DMS strings, ports), `distance`, `avgSpeed`, `voyage`, `etaNextPort`.

This repo already has a proven, working integration with this exact endpoint: `app/pages/emissions.vue` → `server/api/emissions/cii.get.ts` → `backendFetch()` (`server/utils/http-adapter.ts`). Auth (`x-auth-id`/`x-refresh-id`/`x-tenant-id`) is resolved per-request from the incoming session's cookies/headers inside `backendFetch` — there is no stored token, no `.env` secret, and this design introduces none.

## 2. Goal

Replace the synthetic voyage-optimization data engine with real data from this endpoint, reusing the existing `backendFetch` auth pattern exactly as `emissions/cii.get.ts` does. Anything the endpoint genuinely cannot provide (EU ETS carbon price, charter-party laycan buffer, alternate-route strategy comparison) stays as an explicitly-labeled modeled estimate in the UI rather than being removed or disguised as live data — per direct instruction from the repo owner.

## 3. Architecture

### 3.1 New server route

`server/api/vessels/cii-date-range.get.ts` — thin proxy, same shape as sibling routes in `server/api/vessels/`:

```ts
const { vesselId, startDate, endDate, year, voyageType = 'all' } = getQuery(event)
const endpoint = `/prod/api/v1/cii/date-range?vesselId=${vesselId}&startDate=${startDate}&endDate=${endDate}&year=${year}&voyageType=${voyageType}&type=byDate`
const res = await backendFetch<CiiDateRangeRecord[]>(endpoint, { event })
```

No new env vars. No client-visible auth headers — the browser never sees `x-auth-id`; the Nuxt server route relays the session's existing cookies exactly like every other `/api/vessels/*` route already does.

**Resilience fallback**: if `backendFetch` reports `success: false` (upstream error/timeout), the route returns an explicit `{ success: false, records: [] }` rather than synthesizing fake records. The emissions route's `generateDeterministicMockRecords()` fallback exists for that dashboard's chart-continuity needs; this operational voyage screen instead shows a visible "data unavailable" state in the Daily Noon Log, so a dispatcher never mistakes stale/fake data for a live report. This is a deliberate divergence from the emissions-route pattern, consistent with "don't hardcode anything" — revisit only if the plan review surfaces a strong operational reason to soften it.

### 3.2 Composable (`useVoyageOptimization.ts`) rewrite

- Fetch range: `startDate` = voyage departure date (from existing `mrvData.value?.rptdate` / voyage start already available), `endDate` = latest available noon date (today, or latest `mrvData` report date).
- Replace `computeDailyNoonProgression(coords, dwt, depTime, speed)` (local synthesis) with a mapping function `mapCiiRecordsToDailyNoons(records: CiiDateRangeRecord[])` that:
  - Assigns `dayNumber` by sequential index (or date-diff from voyage start — same result for a contiguous daily range).
  - Takes `attainedCii`/`rating` directly from `record.CIIRating.band` / `record.attainedCII` (no client-side `calculateCii`/`resolveCiiRating` — those become fallback-only, used solely when a record is malformed).
  - Takes `cumulativeFuelMt`, `totalCo2Mt`, `transportWork` from `record.totalConsumption`, `record.massOfCo2`, `record.transportWork` (cumulative rollups derived client-side by summing across the fetched range, same as today, just from real per-day numbers instead of seed numbers).
  - Takes weather from `record.noonreportdata` (`Wind_Force`→beaufort, `Wind_Speed`, `Wave_Height`, `Swell_Direction`, `Report_Type`/forecast text where available) instead of the seed table.
  - Takes position from `record.noonreportdata.Latitude`/`Longitude` (DMS strings, e.g. `"24°13'5''S"`) via a new small parser (see 3.4) instead of corridor interpolation.
- `dwt` sourced once from `record.vesselInfo.deadweight` (string → `Number()`), not hardcoded `75000`. Falls back to `useVesselDashboard`'s existing vessel data only if the CII response has no `vesselInfo` for some reason.

### 3.3 `DailyNoonReport` interface change

`fuelConsumedMt: { vlsfo: number; mgo: number; total: number }` is wrong for vessels burning other fuel types (the sample vessel burns `hfo`/`ulsgo`, not `vlsfo`/`mgo`). Change to:

```ts
fuelConsumedMt: {
  byType: Record<string, number>  // e.g. { hfo: 24.21, ulsgo: 0.1 }
  total: number
}
```

`VoyageOptimizationDrawer.vue`'s fuel-breakdown tile must iterate `Object.entries(byType)` with a label lookup instead of two fixed fields — this is the one real breaking change to a consumer component. `consumptionData[key].label` from the API already supplies a human-readable name ("Heavy Fuel Oil"), so no local label map is needed.

### 3.4 DMS coordinate parser

No existing parser found in `vessel-voyage.ts` or elsewhere. Add `parseDmsCoordinate(dms: string): number` to `app/lib/vessel-voyage.ts` (small, pure, unit-testable): parses `"24°13'5''S"` → signed decimal degrees. Used only for CII noon-report positions; the live corridor/track polyline (from windy-geojson) is untouched.

### 3.5 What stays as a labeled estimate

No real source exists in this codebase or the reachable API for: EU ETS carbon price, charter-party laycan buffer, or alternate-route (Lowest-Fuel/Safest/Fastest) comparisons — confirmed by this session's research; nothing else in the repo provides them.

- `voyage-optimization.ts`: consolidate the three duplicated `€85`-per-ton literals into one named export, `EU_ETS_CARBON_PRICE_EUR_PER_TON = 85`, with a comment noting it is a modeled placeholder pending a real EU ETS price feed.
- `calculateRouteStrategies` keeps its current multiplier-based formulas (0.93/1.025/1.06 etc.) — these already read as a documented model in the code (the function has explanatory comments), they just aren't wired to real routing data. Add a `basis: 'modeled-estimate'` field to `RouteStrategyOption` (except `id: 'current'`, which is real).
- `kpiSummary.laycanBufferHours` stays a named constant (extracted from the inline `8.5` into `DEFAULT_LAYCAN_BUFFER_HOURS`) with the same estimate labeling.
- UI: `VoyageOptimizationKpiHud.vue`'s Charter Laycan tile and the Route Strategy comparison in the drawer get a small "Estimated" badge/subtext so dispatchers can distinguish these from the now-live CII/weather/fuel tiles. (CII Trajectory, Speed data, and Weather-from-noon-report tiles become live; the Speed Advisory recommendation itself is still a modeled suggestion layered on live current-speed data, so it keeps a lighter "Modeled" label too.)

## 4. Testing

- `tests/marine/voyage-optimization.test.ts` (already exists per the prior plan): update to test `mapCiiRecordsToDailyNoons` against a **saved fixture** of the real API shape (captured this session, sanitized — vessel telemetry only, no auth material) instead of asserting against the old synthetic generator.
- New unit tests for `parseDmsCoordinate` (`vessel-voyage.ts` test file) covering N/S/E/W and edge cases (0°, 90°, seconds rounding).
- `server/api/vessels/cii-date-range.get.ts`: a request-shape test verifying it calls `backendFetch` with the expected endpoint string and passes `event` through (mirrors how sibling `server/api/vessels/*` routes are tested, if such tests exist — confirm during planning).
- `npx nuxi typecheck` — required given the `DailyNoonReport` interface change ripples into `VoyageOptimizationDrawer.vue`.

## 5. Out of scope

- Charter-party/laycan integration, VPM routing-service integration, EU ETS live pricing feed — no accessible source; left as clearly-labeled estimates per explicit decision.
- Changes to the live corridor/track polyline (windy-geojson-based) — unaffected, already real.
- Changes to `/api/weather/forecast` (NWS + marine fallback) — already a real integration with a documented, non-deceptive fallback; out of scope here.
