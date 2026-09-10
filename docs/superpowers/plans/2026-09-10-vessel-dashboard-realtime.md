# Vessel Dashboard Real-Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the `/dashboard` page into a real-time maritime Vessel Dashboard backed by live SmartShip Hub APIs, matching the production UI layout with vessel selector, telemetry carousels, Leaflet voyage map, engine cylinders/auxiliaries with ECharts strip, and alarms drawer.

**Architecture:** Nuxt 4 server proxy routes (`server/api/vessels/...`) forward session auth and tenant tokens to backend endpoints; a dedicated reactive composable (`useVesselDashboard.ts`) coordinates multi-endpoint state and vessel selection; modular Vue 3 components render the top bar, telemetry carousels, Leaflet map, engine section, and alarms drawer styled with Tailwind v4 OKLCH tokens.

**Tech Stack:** Nuxt 4, Vue 3 Composition API, Leaflet, `vue-echarts`, shadcn-vue, Tailwind CSS v4, TypeScript, Vitest.

## Global Constraints
- Nuxt 4 auto-imports: `components: [{ path: '~/components', pathPrefix: false }]`.
- Tailwind v4 OKLCH tokens only (`text-success`, `bg-warning`, etc.). No hardcoded color codes except chart colors.
- Deterministic SSR: Wrap Leaflet map and ECharts in `<ClientOnly>` with `<Skeleton>` fallbacks.
- State is SSR-safe using `useState` and composables; no Pinia.

---

### Task 1: Server API Proxies for Vessel Dashboard

**Files:**
- Create: `server/api/vessels/sister-group.post.ts`
- Create: `server/api/vessels/dashboard-state.get.ts`
- Create: `server/api/vessels/windy-geojson.get.ts`
- Create: `server/api/vessels/mrv-latest.get.ts`
- Create: `server/api/vessels/connectivity-status.get.ts`
- Create: `server/api/vessels/rhs-panel-flags.get.ts`
- Create: `server/api/vessels/rhs-panel-flags.post.ts`
- Create: `server/api/vessels/rechart-data.post.ts`
- Create: `server/api/vessels/graph-avg-values.get.ts`
- Create: `tests/server/vessels-api.test.ts`

**Interfaces:**
- Consumes: `backendFetch` from `server/utils/http-adapter.ts`
- Produces: Normalized endpoints `/api/vessels/*` delivering typed JSON responses

- [ ] **Step 1: Write integration tests for vessel endpoints**

Create `tests/server/vessels-api.test.ts` checking endpoint handlers:
```ts
import { describe, it, expect } from 'vitest'
import sisterGroupHandler from '../../server/api/vessels/sister-group.post'
import dashboardStateHandler from '../../server/api/vessels/dashboard-state.get'

describe('Vessel API Server Proxies', () => {
  it('defines handlers properly', () => {
    expect(typeof sisterGroupHandler).toBe('function')
    expect(typeof dashboardStateHandler).toBe('function')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/vessels-api.test.ts`
Expected: FAIL due to missing files.

- [ ] **Step 3: Implement server endpoints**

Create:
1. `server/api/vessels/sister-group.post.ts`:
```ts
import { defineEventHandler, readBody } from 'h3'
import { backendFetch } from '../../utils/http-adapter'

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  const payload = { id: body?.id || 'Select All' }
  const res = await backendFetch('/prod/api/v1/getShipBySisterGroup', {
    method: 'POST',
    body: payload,
    event,
  })
  return res.data || []
})
```

2. `server/api/vessels/dashboard-state.get.ts`:
```ts
import { defineEventHandler, getQuery } from 'h3'
import { backendFetch } from '../../utils/http-adapter'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const vesselId = query.vesselId || '28'
  const res = await backendFetch(`/prod/api/v1/getDashboardState?vesselId=${vesselId}`, {
    method: 'GET',
    event,
  })
  return res.data || {}
})
```

3. `server/api/vessels/windy-geojson.get.ts`:
```ts
import { defineEventHandler, getQuery } from 'h3'
import { backendFetch } from '../../utils/http-adapter'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const vesselId = query.vesselId || '28'
  const res = await backendFetch(`/prod/api/v1/getWindyMapGeoJson?vesselId=${vesselId}`, {
    method: 'GET',
    event,
  })
  return res.data || {}
})
```

4. `server/api/vessels/mrv-latest.get.ts`:
```ts
import { defineEventHandler, getQuery } from 'h3'
import { backendFetch } from '../../utils/http-adapter'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const vesselId = query.vesselId || '28'
  const res = await backendFetch(`/prod/api/v1/getMRVLatestData?vesselId=${vesselId}`, {
    method: 'GET',
    event,
  })
  return res.data?.mrvlatestDataJson || res.data || {}
})
```

5. `server/api/vessels/connectivity-status.get.ts`:
```ts
import { defineEventHandler, getQuery } from 'h3'
import { backendFetch } from '../../utils/http-adapter'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const vesselId = query.vesselId || '28'
  const res = await backendFetch(`/prod/api/v1/getSystemConnectivityStatus?vesselId=${vesselId}`, {
    method: 'GET',
    event,
  })
  return res.data || { status: false, message: 'Offline', code: 'red' }
})
```

6. `server/api/vessels/rhs-panel-flags.get.ts` & `server/api/vessels/rhs-panel-flags.post.ts`:
```ts
// get.ts
import { defineEventHandler } from 'h3'
import { backendFetch } from '../../utils/http-adapter'

export default defineEventHandler(async (event) => {
  const res = await backendFetch('/prod/api/v1/getRHSPanalFlag', {
    method: 'GET',
    event,
  })
  return res.data?.panelFlags || []
})
```
```ts
// post.ts
import { defineEventHandler, readBody } from 'h3'
import { backendFetch } from '../../utils/http-adapter'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const res = await backendFetch('/prod/api/v1/updateRSHPanelFlag', {
    method: 'POST',
    body,
    event,
  })
  return res.data || { success: true }
})
```

7. `server/api/vessels/rechart-data.post.ts` & `server/api/vessels/graph-avg-values.get.ts`:
```ts
// rechart-data.post.ts
import { defineEventHandler, readBody } from 'h3'
import { backendFetch } from '../../utils/http-adapter'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const res = await backendFetch('/prod/api/v1/getRechartData', {
    method: 'POST',
    body,
    event,
  })
  return res.data || []
})
```
```ts
// graph-avg-values.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { backendFetch } from '../../utils/http-adapter'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const vesselId = query.vesselId || query.vesselid || '28'
  const res = await backendFetch(`/prod/api/v1/getGraphAvgValues?vesselid=${vesselId}`, {
    method: 'GET',
    event,
  })
  return res.data || []
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/vessels-api.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/api/vessels tests/server/vessels-api.test.ts
git commit -m "feat(api): add server endpoints for vessel real-time dashboard"
```

---

### Task 2: Vessel Dashboard Composable (`useVesselDashboard.ts`)

**Files:**
- Create: `app/composables/useVesselDashboard.ts`
- Create: `tests/unit/useVesselDashboard.test.ts`

**Interfaces:**
- Produces: `useVesselDashboard()` returning reactive vessel lists, active vessel selection, state objects, loading indicators, and refresh actions.

- [ ] **Step 1: Write test for useVesselDashboard logic**

Create `tests/unit/useVesselDashboard.test.ts` verifying default values and filtering logic.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/useVesselDashboard.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement useVesselDashboard composable**

Create `app/composables/useVesselDashboard.ts` managing:
- `selectedVesselId` (ref initialized to 28 or first available)
- `selectedSisterGroup` (ref, default `'Select All'`)
- `vesselsList` (ref of `{ id, name, mappingname, sistergroup }`)
- `dashboardState` (ref containing widgets 1 to 9)
- `mrvData` (ref containing voyage details)
- `windyMapData` (ref containing GeoJSON points and route)
- `connectivity` (ref containing VSAT status)
- `rhsFlags` (ref containing panel flags)
- `activeEngineTab` (number: 0 = Main Engine, 1 = Aux Engine, 2 = Auxiliaries)
- `selectedParamId` (string: active parameter plotted in chart)
- Auto-fetch on `selectedVesselId` change

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/useVesselDashboard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/composables/useVesselDashboard.ts tests/unit/useVesselDashboard.test.ts
git commit -m "feat: add useVesselDashboard composable for real-time state management"
```

---

### Task 3: Top Navigation Bar Component (`VesselHeaderBar.vue`)

**Files:**
- Create: `app/components/vessel/VesselHeaderBar.vue`

**Interfaces:**
- Consumes: `useVesselDashboard()`
- Produces: Top bar rendering View By toggle, Sister Group filter, Vessel dropdown, VSAT connectivity status badge, and UTC clock

- [ ] **Step 1: Implement `VesselHeaderBar.vue`**

Build component with:
- Sister vessel toggle
- Sister group `<Select>` dropdown
- Vessel selection `<Select>` dropdown
- Connectivity dot (`bg-success` when online) + last updated timestamp
- UTC timezone badge
- Emits / updates `selectedVesselId` and `selectedSisterGroup`

- [ ] **Step 2: Verify type check and template validity**

Run: `npx nuxi typecheck`
Expected: No type errors on `VesselHeaderBar.vue`.

- [ ] **Step 3: Commit**

```bash
git add app/components/vessel/VesselHeaderBar.vue
git commit -m "feat(ui): add VesselHeaderBar component with vessel dropdown and VSAT indicator"
```

---

### Task 4: Top-Left Telemetry Cards (`VesselTelemetryCard.vue`)

**Files:**
- Create: `app/components/vessel/VesselTelemetryCard.vue`

**Interfaces:**
- Consumes: `dashboardState.widget_1` from `useVesselDashboard()`
- Produces: Multi-carousel telemetry grid rendering Fuel & Speed, Shaft Power Meter, Navigation, and MetOcean stats with pagination dots

- [ ] **Step 1: Implement `VesselTelemetryCard.vue`**

Map `widget_1.configuration.body.data` for `carousel1` (Fuel & Vessel Speed + Shaft Power Meter), `carousel2` (Fuel + Navigation), and `carousel3`:
- ME & AE Fuel Consumption Rate, Speed Over Ground, Speed Through Water, SFOC
- Shaft Power, Torque, %MCR, Shaft RPM, Est. Engine Load, Mean Draft
- Pagination dots at bottom allowing carousel switching

- [ ] **Step 2: Verify component rendering**

Run: `npx nuxi typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/components/vessel/VesselTelemetryCard.vue
git commit -m "feat(ui): add VesselTelemetryCard with fuel and shaft power meter carousels"
```

---

### Task 5: Center Voyage Map with Floating Ribbon (`VesselVoyageMap.vue`)

**Files:**
- Create: `app/components/vessel/VesselVoyageMap.vue`

**Interfaces:**
- Consumes: `windyMapData` and `mrvData` from `useVesselDashboard()`
- Produces: Leaflet voyage map with floating MRV voyage ribbon, port-to-port line, vessel icon with heading orientation

- [ ] **Step 1: Implement `VesselVoyageMap.vue`**

Build with:
- Top floating glassmorphic voyage ribbon:
  - `Vsl.Name`, `Voy.No.`, `Source Port`, `Dest. Port`, `ETA`, `Dist. TR/DTG`, `Vsl. TZone`
- Leaflet map instance inside `<ClientOnly>` with fallback `<Skeleton>`
- Polyline connecting source to destination and historical track points
- Custom vessel marker rotated to `vesselHeading`
- Tile layer respecting dark/light theme

- [ ] **Step 2: Verify component validity**

Run: `npx nuxi typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/components/vessel/VesselVoyageMap.vue
git commit -m "feat(ui): add VesselVoyageMap with Leaflet route tracking and voyage banner"
```

---

### Task 6: Bottom Engine & Auxiliary Telemetry Section (`VesselEngineSection.vue`)

**Files:**
- Create: `app/components/vessel/VesselEngineSection.vue`

**Interfaces:**
- Consumes: `widget_3` from `useVesselDashboard()`, `getRechartData` API
- Produces: Carousel switcher between Main Engine and Aux Engines, 6 cylinder arc dials / 3 DG RPM dials, ECharts time-series strip, and 3-column operating data table

- [ ] **Step 1: Implement `VesselEngineSection.vue`**

Build:
- Section header: "Main Engine" / "Auxiliary Engines" with `<` and `>` navigation arrows
- Cylinder dials (when Main Engine active):
  - 6 semi-circular SVG arc gauges for `ME EXH.GAS OUT T.CYL.1..6`
  - Underneath: `ME CFW OUTLET TEMP` and `ME PCO OUTLET TEMP`
- Generator dials (when Aux Engines active):
  - 3 semi-circular SVG dials for DG1, DG2, DG3 RPM and 3-phase winding temps
- Telemetry Timeline Chart:
  - Client-side ECharts (`vue-echarts`) showing 24h temperature / RPM line (150°C–600°C or 0–3000 RPM)
- Operating Data Tables:
  - 3 column grid matching `tableData` (Control air, Scav air, Start air, JCW, PCO, TC LO, Bearing temps)

- [ ] **Step 2: Verify component validity**

Run: `npx nuxi typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/components/vessel/VesselEngineSection.vue
git commit -m "feat(ui): add VesselEngineSection with arc gauges, ECharts strip, and data tables"
```

---

### Task 7: RHS Alarms & Alerts Drawer (`VesselAlarmsDrawer.vue`)

**Files:**
- Create: `app/components/vessel/VesselAlarmsDrawer.vue`

**Interfaces:**
- Consumes: `rhsFlags`, `dashboardState.widget_4..8` from `useVesselDashboard()`
- Produces: Collapsible drawer for alarms and alerts, tab count badges, and panel visibility dialog

- [ ] **Step 1: Implement `VesselAlarmsDrawer.vue`**

Build:
- Collapsible sidebar drawer
- Header with search input
- Tab icon badges: Settings gear, Bell (Alerts count), Globe (Alarms count), Mute bell (Muted count)
- List of active alarms and alerts
- Settings dialog to toggle active widgets (Alerts, Alarms, Digital Alarm, Navigation Alert, Charter Party) backed by `/api/vessels/rhs-panel-flags`

- [ ] **Step 2: Verify component validity**

Run: `npx nuxi typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/components/vessel/VesselAlarmsDrawer.vue
git commit -m "feat(ui): add VesselAlarmsDrawer component for active alarms and settings"
```

---

### Task 8: Assemble Vessel Dashboard Page (`app/pages/dashboard.vue`) & End-to-End Verification

**Files:**
- Modify: `app/pages/dashboard.vue`

**Interfaces:**
- Assembles: `VesselHeaderBar`, `VesselTelemetryCard`, `VesselVoyageMap`, `VesselEngineSection`, `VesselAlarmsDrawer`
- Replaces: All legacy dummy mock data (`KPI_TILES`, `SHIPMENT_VOLUME`, `STATUS_SPLIT`, etc.)

- [ ] **Step 1: Update `app/pages/dashboard.vue`**

Replace dummy data with the unified Vessel Dashboard layout:
- Title: `useHead({ title: 'Vessel Dashboard · Smart Ship Hub' })`
- Top: `<VesselHeaderBar />`
- Main grid:
  - Left column: `<VesselTelemetryCard />`
  - Center/Right column: `<VesselVoyageMap />`
  - Right edge: `<VesselAlarmsDrawer />`
  - Bottom row: `<VesselEngineSection />`

- [ ] **Step 2: Run build and type check**

Run: `npm run build`
Expected: Nuxt production build completes with 0 errors.

- [ ] **Step 3: Run Vitest unit & integration tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/pages/dashboard.vue
git commit -m "feat(dashboard): overhaul dashboard page to live real-time vessel dashboard"
```
