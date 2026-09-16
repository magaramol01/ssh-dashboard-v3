# Voyage Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-canvas, map-centric Voyage Optimization screen under Voyage Operations that tracks active vessel voyages, displays day-by-day CII ratings and noon report positions along the passage route, queries weather forecasts from `https://api.weather.gov/` with maritime fallback, and presents actionable speed and routing advisories inspired by `vpm` services.

**Architecture:** A full-height interactive Leaflet map serves as the primary operational canvas with Esri dark/light tiles, overlaying daily noon report markers color-coded with IMO CII ratings (A–E), live vessel AIS telemetry, route alternative corridors (Lowest Fuel, Safest, Fastest), and a floating 5-tile advisory KPI HUD. A slide-out right-edge drawer provides detailed telemetry for any selected noon report day alongside a multi-route comparison matrix and dispatch advisory actions.

**Tech Stack:** Nuxt 4, Vue 3, Leaflet, Tailwind CSS v4, Lucide Vue Next, TypeScript, Node `tsx --test`.

## Global Constraints
- Nuxt 4 auto-import: components in `app/components` without path prefix.
- Tailwind v4 OKLCH semantic tokens (`text-success`, `bg-warning`, etc.).
- Client-only wrapping: Leaflet must be wrapped in `<ClientOnly>` with a skeleton fallback.
- SSR safety: Cookie-based theme (`useTheme`), deterministic mock constants, no client-only APIs in setup.
- Persona protection: `definePageMeta({ middleware: 'require-dispatcher' })`.

---

### Task 1: Voyage Optimization Engine & Formulas

**Files:**
- Create: `app/lib/voyage-optimization.ts`
- Test: `tests/marine/voyage-optimization.test.ts`

**Interfaces:**
- Consumes: `server/utils/marine/cii-calculator.ts` (`calculateAttainedCII`, `calculateTransportWork`, `getCIIRating`)
- Produces:
  - `DailyNoonReport`
  - `RouteStrategyOption`
  - `VoyageAdvisory`
  - `computeDailyNoonProgression(corridorCoords, vesselDwt, initialDeparture, avgSpeedKts)`
  - `calculateRouteStrategies(baseDistanceNm, baseFuelMt, plannedSpeedKts, dwt)`
  - `deriveVoyageAdvisories(currentCii, targetCii, weatherAhead, speedDeltaKts)`

- [ ] **Step 1: Write the failing unit test**

```ts
// tests/marine/voyage-optimization.test.ts
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeDailyNoonProgression,
  calculateRouteStrategies,
  deriveVoyageAdvisories,
} from '../../app/lib/voyage-optimization.js'

describe('Voyage Optimization Domain Engine', () => {
  const dummyCoords: [number, number][] = [
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

  test('computeDailyNoonProgression computes deterministic daily noon reports with valid CII', () => {
    const noons = computeDailyNoonProgression(dummyCoords, 75000, '2026-09-10T12:00:00Z', 13.5)
    assert.ok(noons.length >= 3, 'Should generate at least 3 daily noon points')
    
    const day1 = noons[0]
    assert.equal(day1.dayNumber, 1)
    assert.ok(day1.distanceRunNm > 0)
    assert.ok(day1.cumulativeDistanceNm >= day1.distanceRunNm)
    assert.ok(day1.cumulativeFuelMt > 0)
    assert.ok(day1.transportWork > 0)
    assert.ok(['A', 'B', 'C', 'D', 'E'].includes(day1.rating))
    assert.ok(day1.weather.windSpeedKts > 0)
  })

  test('calculateRouteStrategies returns 4 standard comparative strategies', () => {
    const strategies = calculateRouteStrategies(5400, 480, 13.5, 75000)
    assert.equal(strategies.length, 4)
    
    const ids = strategies.map((s) => s.id)
    assert.ok(ids.includes('current'))
    assert.ok(ids.includes('lowest-fuel'))
    assert.ok(ids.includes('safest'))
    assert.ok(ids.includes('fastest'))

    const lowestFuel = strategies.find((s) => s.id === 'lowest-fuel')!
    const fastest = strategies.find((s) => s.id === 'fastest')!
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

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/marine/voyage-optimization.test.ts`
Expected: FAIL (`Cannot find module '../../app/lib/voyage-optimization.js'`)

- [ ] **Step 3: Implement `app/lib/voyage-optimization.ts`**

Create `app/lib/voyage-optimization.ts` exporting data interfaces (`DailyNoonReport`, `RouteStrategyOption`, `VoyageAdvisory`), formulas for cubic fuel consumption, daily noon step interpolation along route coordinates, transport work, attained CII, and strategy generators.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/marine/voyage-optimization.test.ts`
Expected: PASS with 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add app/lib/voyage-optimization.ts tests/marine/voyage-optimization.test.ts
git commit -m "feat(voyage): add voyage optimization domain engine and daily CII calculator"
```

---

### Task 2: Weather Forecast API with `api.weather.gov` & Fallback

**Files:**
- Create: `server/api/weather/forecast.get.ts`
- Test: `tests/weather/weather-forecast.test.ts`

**Interfaces:**
- Consumes: Query params `lat` (number), `lng` (number)
- Produces: JSON response with `success: true`, `source: 'nws-api' | 'marine-fallback'`, `data: WeatherForecastPayload`

- [ ] **Step 1: Write the failing unit test**

```ts
// tests/weather/weather-forecast.test.ts
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { parseNwsForecastGrid, synthesizeMarineWeather } from '../../server/utils/weather-adapter.js'

describe('Weather Adapter & NWS Parser', () => {
  test('synthesizeMarineWeather returns robust marine data for international waters', () => {
    const weather = synthesizeMarineWeather(-12.05, -77.15)
    assert.ok(weather.windSpeedKts >= 0)
    assert.ok(weather.waveHeightM >= 0)
    assert.ok(weather.beaufort >= 0 && weather.beaufort <= 12)
    assert.equal(weather.source, 'marine-fallback')
  })

  test('parseNwsForecastGrid converts NWS grid data accurately', () => {
    const mockGrid = {
      properties: {
        waveHeight: { values: [{ validTime: '2026-09-16T12:00:00Z', value: 1.82 }] },
        primarySwellHeight: { values: [{ validTime: '2026-09-16T12:00:00Z', value: 1.5 }] },
        primarySwellDirection: { values: [{ validTime: '2026-09-16T12:00:00Z', value: 290 }] },
        windSpeed: { values: [{ validTime: '2026-09-16T12:00:00Z', value: 25.5 }] }, // km/h
        windDirection: { values: [{ validTime: '2026-09-16T12:00:00Z', value: 315 }] },
        hazards: { values: [] },
      },
    }
    const parsed = parseNwsForecastGrid(mockGrid)
    assert.equal(parsed.waveHeightM, 1.82)
    assert.equal(parsed.primarySwellHeightM, 1.5)
    assert.equal(parsed.primarySwellDirectionDeg, 290)
    assert.equal(parsed.windSpeedKts, Math.round(25.5 * 0.539957 * 10) / 10) // ~13.8 kts
    assert.equal(parsed.source, 'nws-api')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/weather/weather-forecast.test.ts`
Expected: FAIL (`Cannot find module '../../server/utils/weather-adapter.js'`)

- [ ] **Step 3: Implement `server/utils/weather-adapter.ts` and `server/api/weather/forecast.get.ts`**

Implement the parser and the endpoint with:
1. Two-tier query: `https://api.weather.gov/points/{lat},{lng}` -> `forecastGridData` and `forecast`.
2. In-memory cache with 15-minute TTL.
3. Proper `User-Agent: (SmartShipHubVoyageOptimizer, contact@smartshiphub.com)`.
4. Resilient marine fallback on status 404/out-of-bounds or timeouts.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/weather/weather-forecast.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/utils/weather-adapter.ts server/api/weather/forecast.get.ts tests/weather/weather-forecast.test.ts
git commit -m "feat(weather): add weather forecast API with api.weather.gov integration and marine fallback"
```

---

### Task 3: Voyage Optimization State Composable

**Files:**
- Create: `app/composables/useVoyageOptimization.ts`

**Interfaces:**
- Consumes: `useVesselDashboard()`, `app/lib/voyage-optimization.ts`, `$fetch('/api/weather/forecast')`
- Produces:
  - `selectedVesselId: Ref<string>`
  - `activeStrategy: Ref<'current' | 'lowest-fuel' | 'safest' | 'fastest'>`
  - `selectedDay: Ref<DailyNoonReport | null>`
  - `dailyNoons: ComputedRef<DailyNoonReport[]>`
  - `routeStrategies: ComputedRef<RouteStrategyOption[]>`
  - `activeStrategyOption: ComputedRef<RouteStrategyOption>`
  - `advisories: Ref<VoyageAdvisory[]>`
  - `kpiSummary: ComputedRef<KpiSummary>`
  - `isWeatherLoading: Ref<boolean>`
  - `applyAdvisory(id: string): void`
  - `resetStrategy(): void`

- [ ] **Step 1: Write `app/composables/useVoyageOptimization.ts`**

Implement composable integrating fleet telemetry from `useVesselDashboard`, interpolating daily noons via `computeDailyNoonProgression`, generating comparative strategies, fetching weather along key passage points, and managing interactive selection state.

- [ ] **Step 2: Verify type check**

Run: `npx nuxi typecheck`
Expected: PASS with 0 type errors.

- [ ] **Step 3: Commit**

```bash
git add app/composables/useVoyageOptimization.ts
git commit -m "feat(voyage): add useVoyageOptimization state composable"
```

---

### Task 4: UI Components — Header Bar & Floating 5-Tile Advisory HUD

**Files:**
- Create: `app/components/voyage/VoyageOptimizationHeaderBar.vue`
- Create: `app/components/voyage/VoyageOptimizationKpiHud.vue`

**Interfaces:**
- Consumes: `useVoyageOptimization`, `useVesselDashboard`
- Produces:
  - Header: Vessel dropdown selector, voyage fixture badge (Origin → Dest, Voyage #), active strategy switcher pills, refresh button, and drawer toggle button.
  - Floating HUD: 5 glassmorphism cards:
    1. Attained CII vs Target (Rating badges & Margin %)
    2. Speed Advisory (Recommended SOG, RPM, Daily Bunker Savings)
    3. Weather Risk Ahead (Beaufort, wave height, swell vector)
    4. ETA Buffer (Laycan charter party window variance)
    5. Carbon & EU ETS Financial Savings

- [ ] **Step 1: Implement `app/components/voyage/VoyageOptimizationHeaderBar.vue`**
- [ ] **Step 2: Implement `app/components/voyage/VoyageOptimizationKpiHud.vue`**
- [ ] **Step 3: Verify template syntax and typecheck**

Run: `npx nuxi typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/components/voyage/VoyageOptimizationHeaderBar.vue app/components/voyage/VoyageOptimizationKpiHud.vue
git commit -m "feat(voyage): add voyage optimization header bar and floating advisory KPI HUD"
```

---

### Task 5: UI Component — Hero Leaflet Voyage Map

**Files:**
- Create: `app/components/voyage/VoyageOptimizationMap.vue`

**Interfaces:**
- Consumes: `useVoyageOptimization`, `useTheme`
- Produces:
  - Hero interactive Leaflet canvas with dark/light gray Esri tiles.
  - Polyline layers: Traveled passage (solid), Remaining planned passage (translucent), Lowest-Fuel corridor (emerald dashed), Safest corridor (cyan dashed), Fastest corridor (indigo dashed).
  - Interactive Daily Noon Pins: Leaflet custom `divIcon` pills showing `D1..Dn` and colored IMO CII rating (`A`..`E`). Clicking selects `selectedDay` and emits event to open drawer.
  - Live Vessel Marker: Heading arrow, pulsing AIS ping, current SOG label.
  - Weather Nodes: Wind direction arrows and wave height pills along passage waypoints.
  - Map Controls: Fit corridor bounds, reset view, layer visibility toggle.

- [ ] **Step 1: Implement `app/components/voyage/VoyageOptimizationMap.vue`**
- [ ] **Step 2: Verify Leaflet icon styles and reactive layer updates on strategy switch**
- [ ] **Step 3: Commit**

```bash
git add app/components/voyage/VoyageOptimizationMap.vue
git commit -m "feat(voyage): add full-canvas interactive Leaflet map with daily CII markers and route corridors"
```

---

### Task 6: UI Component — Right-Edge Inspection Drawer

**Files:**
- Create: `app/components/voyage/VoyageOptimizationDrawer.vue`

**Interfaces:**
- Consumes: `useVoyageOptimization`
- Produces:
  - Slide-out right panel with close button.
  - **Tab 1: Daily Noon Telemetry**:
    - Day header, date/time UTC, coordinates.
    - Large IMO CII badge with attained value (`g/MT·NM`).
    - 24h distance run, SOG, draft fwd/aft, transport work.
    - Fuel consumption breakdown (VLSFO, MGO) and total CO2.
    - Recorded noon weather (Beaufort, wave height, swell direction, forecast narrative).
  - **Tab 2: Route Optimization & Advisories**:
    - Multi-route comparison table (Current vs Lowest Fuel vs Safest vs Fastest).
    - Actionable Dispatch Advisories list with checklist toggles and "Apply Advisory" simulation.

- [ ] **Step 1: Implement `app/components/voyage/VoyageOptimizationDrawer.vue`**
- [ ] **Step 2: Verify typecheck**

Run: `npx nuxi typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/components/voyage/VoyageOptimizationDrawer.vue
git commit -m "feat(voyage): add right-edge inspection drawer for daily noon logs and route advisories"
```

---

### Task 7: Main Page & Navigation Integration

**Files:**
- Modify: `app/lib/nav.ts`
- Create: `app/pages/voyage-optimization.vue`

**Interfaces:**
- Consumes: All components from Tasks 4, 5, 6.
- Produces: New route `/voyage-optimization` registered in `NAV` under `Voyage Operations`.

- [ ] **Step 1: Update `app/lib/nav.ts`**
Add `{ label: "Voyage Optimization", to: "/voyage-optimization", icon: "Sliders", requires: "dispatcher" }` under `Voyage Operations`.

- [ ] **Step 2: Create `app/pages/voyage-optimization.vue`**
Wrap `VoyageOptimizationMap` in `<ClientOnly>` with a skeleton placeholder, dock `VoyageOptimizationHeaderBar`, float `VoyageOptimizationKpiHud`, and mount `VoyageOptimizationDrawer`.

- [ ] **Step 3: Verify page build and navigation**

Run: `npx nuxi typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/lib/nav.ts app/pages/voyage-optimization.vue
git commit -m "feat(voyage): integrate Voyage Optimization screen under Voyage Operations"
```

---

### Task 8: End-to-End Verification & Production Build

**Files:**
- Verify: All tests in `tests/**/*.test.ts`
- Verify: Production build output

- [ ] **Step 1: Run complete test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Clean build with 0 errors.

- [ ] **Step 3: Commit any final polishing changes**

```bash
git commit -m "chore(voyage): verify build and complete voyage optimization implementation"
```
