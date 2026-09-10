# Modern Vessel Executive Operations Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul `/dashboard` into a modern, high-contrast, KPI-rich maritime Executive Operations Center dashboard featuring 5 KPI executive summary cards with sparklines, a 4-dial radial telemetry cockpit, an interactive Leaflet voyage map, a multi-graph analytics suite (24h time-series line/area chart + 6-cylinder bar comparison + machinery diagnostics matrix), and a collapsible alarms rail.

**Architecture:** Nuxt 4 + Tailwind v4 + ECharts (`vue-echarts`) + Leaflet, backed by existing reactive composable `useVesselDashboard.ts` and server proxies (`/api/vessels/...`). Modular component decomposition ensuring clean single-responsibility boundaries, client-only wrapping for charts/maps, and deterministic mock fallbacks.

**Tech Stack:** Nuxt 4, Vue 3 Composition API, TypeScript, Tailwind CSS, Lucide icons, Leaflet, ECharts, Node test runner (`tsx --test`).

## Global Constraints

- Use semantic Tailwind tokens (`#0d0e12` canvas, `#17181f` card container, `#262833` borders, `#38bdf8` cyan, `#10b981` green, `#f59e0b` amber, `#ef4444` red).
- Charts (`vue-echarts`) and Leaflet maps MUST be wrapped in `<ClientOnly>` with explicit canvas pixel heights to avoid SSR hydration and zero-height canvas layout issues.
- Keep route at `/dashboard` with page title "Vessel Dashboard · Smart Ship Hub".
- Deterministic data handling: preserve live server proxies (`/api/vessels/...`) with high-fidelity defaults when offline.
- Every task ends with testing and a git commit.

---

### Task 1: KPI Executive Strip Component (`VesselKpiStrip.vue`)

**Files:**
- Create: `app/components/vessel/VesselKpiStrip.vue`
- Create: `tests/unit/vessel-kpi.test.ts`

**Interfaces:**
- Consumes: `useVesselDashboard()` (`dashboardState`, `mrvData`, `connectivity`)
- Produces: `<VesselKpiStrip />` rendering 5 KPI cards:
  1. Speed Over Ground (kn) + STW + 6h trend sparkline
  2. Main Engine Fuel Rate (t/day) + SFOC score + sparkline
  3. Shaft Power & Load (kW) + %MCR + RPM + sparkline
  4. Voyage Progress (Dist TR / DTG) + ETA + percentage progress bar
  5. System Health + Active Alarms count + VSAT status dot

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/vessel-kpi.test.ts`:
```ts
import test from 'node:test'
import assert from 'node:assert/strict'

function computeVoyageProgress(distTR: string | number, distToGo: string | number): number {
  const tr = parseFloat(String(distTR)) || 0
  const dtg = parseFloat(String(distToGo)) || 0
  const total = tr + dtg
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((tr / total) * 100)))
}

test('computeVoyageProgress calculates correct percentage', () => {
  assert.equal(computeVoyageProgress(403, 3660), 10)
  assert.equal(computeVoyageProgress(1000, 1000), 50)
  assert.equal(computeVoyageProgress(0, 500), 0)
  assert.equal(computeVoyageProgress(0, 0), 0)
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx tsx --test tests/unit/vessel-kpi.test.ts`
Expected: PASS

- [ ] **Step 3: Implement `app/components/vessel/VesselKpiStrip.vue`**

Write `app/components/vessel/VesselKpiStrip.vue`:
- 5 cards with dark slate `#17181f` background, `#262833` border, and subtle glow.
- SVG sparklines with linear gradient fills.
- Voyage progress bar showing percentage completion.
- Click handler on Alarms card emitting `toggle-alarms` to open the alarms drawer.

- [ ] **Step 4: Run tests to verify all tests pass**

Run: `npm test`
Expected: PASS (4 tests passing)

- [ ] **Step 5: Commit**

```bash
git add tests/unit/vessel-kpi.test.ts app/components/vessel/VesselKpiStrip.vue
git commit -m "feat(ui): add VesselKpiStrip with 5 executive summary cards and sparklines"
```

---

### Task 2: Radial Telemetry Cockpit Component (`VesselRadialCockpit.vue`)

**Files:**
- Create: `app/components/vessel/VesselRadialCockpit.vue`

**Interfaces:**
- Consumes: `useVesselDashboard()` (`dashboardState`)
- Produces: `<VesselRadialCockpit />` rendering 4 circular radial gauge meters:
  1. **Speed Meter**: Semicircular dial showing 0–25 kn with live SOG needle & STW indicator.
  2. **Engine Load (% MCR)**: Radial gauge showing 0–100% MCR with colored zones (Green <85%, Amber 85–95%, Red >95%).
  3. **Shaft RPM Dial**: Circular dial showing 0–120 RPM with torque readout (`kNm`).
  4. **Fuel Efficiency Dial**: Metric gauge for fuel rate and SFOC score.
  - Tab switcher: `Propulsion & Power` vs `Environmental & Sea State`.

- [ ] **Step 1: Implement `app/components/vessel/VesselRadialCockpit.vue`**

Create `app/components/vessel/VesselRadialCockpit.vue`:
- Semicircular and circular SVG gauge meters with glowing arcs and centered digital readouts.
- Color thresholds based on nominal/warning values.
- Dynamic binding to `dashboardState.widget_1` data with high-fidelity fallbacks.

- [ ] **Step 2: Verify component compiles with Nuxt**

Run: `npx vue-tsc --noEmit` or `npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/components/vessel/VesselRadialCockpit.vue
git commit -m "feat(ui): add VesselRadialCockpit with 4 circular telemetry meters and tabs"
```

---

### Task 3: High-Definition Voyage Map Component (`VesselVoyageMap.vue`)

**Files:**
- Modify: `app/components/vessel/VesselVoyageMap.vue`

**Interfaces:**
- Consumes: `useVesselDashboard()` (`mrvData`, `windyMapData`, `selectedVessel`)
- Produces: `<VesselVoyageMap />` with:
  - Frosted glass voyage ribbon (`Vsl. Name`, `Voy. No`, `Source`, `Dest`, `ETA`, `Dist. TR/DTG`, `Timezone`).
  - High-contrast CartoDB Voyager / OpenStreetMap tiles.
  - Solid red polyline for sailed route + dashed blue polyline for target route.
  - Directional ship chevron rotated to vessel heading/course with pulsing radar aura.

- [ ] **Step 1: Refine `VesselVoyageMap.vue`**

Ensure height is responsive (`h-full min-h-[390px]`), tiles render cleanly, port pins have labels, and ETA date formatting is clean without raw ISO `T` or `.000Z`.

- [ ] **Step 2: Verify tests and build**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/components/vessel/VesselVoyageMap.vue
git commit -m "feat(map): polish VesselVoyageMap with high-contrast ocean tiles and frosted ribbon"
```

---

### Task 4: Multi-Graph Analytics Suite

**Files:**
- Create: `app/components/vessel/VesselTelemetryChart.vue` (24h time-series area chart)
- Create: `app/components/vessel/VesselCylinderBarChart.vue` (6-cylinder exhaust temp bar comparison)
- Create: `app/components/vessel/VesselDiagnosticsMatrix.vue` (Tabbed machinery operating tables)

**Interfaces:**
- Consumes: `useVesselDashboard()` (`dashboardState`, `selectedTelemetryParam`)
- Produces:
  1. `<VesselTelemetryChart />`: ECharts 24h timeline area chart with metric switchers (`Speed vs Fuel`, `Shaft Power`, `Scavenge Air`, `Exhaust Temp`).
  2. `<VesselCylinderBarChart />`: ECharts 6-cylinder bar comparison with dynamic color thresholds and average threshold line.
  3. `<VesselDiagnosticsMatrix />`: Tabbed tables for Main Engine Subsystems and Auxiliary Generators (DG1–3).

- [ ] **Step 1: Implement `VesselTelemetryChart.vue`**

Write `app/components/vessel/VesselTelemetryChart.vue`:
- Height: explicit `style="height: 180px; width: 100%;"` on `<VChart>`.
- Dual Y-axes for comparative analysis (e.g. Speed kn vs Fuel t/day).
- Parameter switchers with pill buttons.

- [ ] **Step 2: Implement `VesselCylinderBarChart.vue`**

Write `app/components/vessel/VesselCylinderBarChart.vue`:
- Height: explicit `style="height: 180px; width: 100%;"` on `<VChart>`.
- 6 bars for CYL 1 to CYL 6 exhaust temperatures.
- Color: Green for nominal (<330 °C), Amber for elevated (330–350 °C), Red for alarm (>350 °C).
- MarkLine showing average engine exhaust temperature.

- [ ] **Step 3: Implement `VesselDiagnosticsMatrix.vue`**

Write `app/components/vessel/VesselDiagnosticsMatrix.vue`:
- Tab 1: Main Engine Parameters (Control Air, JCW, LO, FO, Scavenge Air).
- Tab 2: Auxiliary Generators DG1–3 (RPM, HT FW, LO Press, Winding Temps).
- Clean zebra-striped modern card tables.

- [ ] **Step 4: Verify test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/components/vessel/VesselTelemetryChart.vue app/components/vessel/VesselCylinderBarChart.vue app/components/vessel/VesselDiagnosticsMatrix.vue
git commit -m "feat(analytics): add multi-graph analytics suite with timeline chart, cylinder bars, and diagnostics matrix"
```

---

### Task 5: Sliding Alerts & Alarms Command Rail (`VesselAlarmsDrawer.vue`)

**Files:**
- Modify: `app/components/vessel/VesselAlarmsDrawer.vue`

**Interfaces:**
- Consumes: `useVesselDashboard()` (`rhsFlags`, `updateRHSFlags`)
- Produces: `<VesselAlarmsDrawer v-model:open="isAlarmsOpen" />`:
  - Slide-out rail with smooth expand/collapse transition.
  - Colored indicator dots (Red Critical, Amber Warning, Blue Info).
  - Search filter and category count badges (`Alerts 0`, `Alarms 14`, `Muted 0`).
  - Mute alarm action and settings dialog.

- [ ] **Step 1: Update `VesselAlarmsDrawer.vue`**

Ensure `v-model:open` or `isExpanded` state allows both manual collapse and programmatic opening from the top KPI card.

- [ ] **Step 2: Verify tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/components/vessel/VesselAlarmsDrawer.vue
git commit -m "feat(alarms): enhance VesselAlarmsDrawer with smooth collapsible rail and priority indicators"
```

---

### Task 6: Page Integration & Full Build Verification

**Files:**
- Modify: `app/pages/dashboard.vue`

**Interfaces:**
- Assembles:
  - `<VesselHeaderBar />`
  - `<VesselKpiStrip @toggle-alarms="toggleAlarms" />`
  - Middle Grid (60% Map + 40% Radial Cockpit)
  - Bottom Multi-Graph Suite (Timeline Chart + Cylinder Bar Chart + Diagnostics Matrix)
  - `<VesselAlarmsDrawer :open="isAlarmsOpen" />`

- [ ] **Step 1: Assemble `app/pages/dashboard.vue`**

Compose all 5 modular components into the 3-tier Executive Operations Center layout with dark canvas `#0d0e12`.

- [ ] **Step 2: Run test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: Exit code 0, client and server Nitro packages built cleanly.

- [ ] **Step 4: Commit**

```bash
git add app/pages/dashboard.vue
git commit -m "feat(dashboard): assemble modern KPI-rich vessel executive operations center"
```
