# Tactical Monochromatic Refinement Implementation Plan

**Goal:** Tone down the colorful/rainbow appearance of the Vessel Executive Operations Center dashboard and establish a cohesive, high-tech tactical monochromatic design system (deep obsidian `#0a0b0e` canvas, neutral slate `#121318` surfaces, single precision ice-blue `#38bdf8` accent, and anomaly-only status indicators).

**Architecture:** Nuxt 4, Vue 3, Tailwind CSS v4, ECharts, Leaflet.

**Spec Reference:** `docs/superpowers/specs/2026-09-10-vessel-dashboard-monochrome-refinement-design.md`

---

### Task 1: Analytics Palette & Threshold Logic Update

**Files:**
- Modify: `app/lib/vessel-analytics.ts`
- Modify: `tests/unit/vessel-analytics.test.ts`

- [ ] **Step 1: Update unit tests for nominal steel-slate cylinder color**
Update `tests/unit/vessel-analytics.test.ts` so `getCylinderStatusColor` returns `#334155` for nominal temperatures (<330 °C), `#f59e0b` for warnings (330–350 °C), and `#ef4444` for alarms (>350 °C).

- [ ] **Step 2: Update `app/lib/vessel-analytics.ts`**
Change nominal return value from green (`#10b981`) to steel-slate (`#334155`).

- [ ] **Step 3: Run unit tests**
Run: `npm test`
Expected: PASS (9 tests)

- [ ] **Step 4: Commit**
```bash
git add app/lib/vessel-analytics.ts tests/unit/vessel-analytics.test.ts
git commit -m "fix(analytics): update cylinder status color to tactical steel-slate for nominal state"
```

---

### Task 2: Refine Executive KPI Strip (`VesselKpiStrip.vue`)

**Files:**
- Modify: `app/components/vessel/VesselKpiStrip.vue`

- [ ] **Step 1: Remove multicolor borders and gradient card backgrounds**
Unify all 5 KPI cards with surface `#121318`, border `#1e2029`, crisp white numerical values (`text-slate-100`), cool slate secondary captions (`text-slate-400`), and uniform ice-blue sparklines (`#38bdf8`).

- [ ] **Step 2: Streamline voyage progress and alarms health card**
Use a minimalist slate track with ice-blue progress fill. Use a muted amber pip for active alarms instead of loud flashing gradients.

- [ ] **Step 3: Verify tests**
Run: `npm test`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add app/components/vessel/VesselKpiStrip.vue
git commit -m "style(kpi): refine VesselKpiStrip to tactical monochromatic slate and ice-blue"
```

---

### Task 3: Refine Radial Telemetry Cockpit (`VesselRadialCockpit.vue`)

**Files:**
- Modify: `app/components/vessel/VesselRadialCockpit.vue`

- [ ] **Step 1: Unify dial arcs to precision ice-blue**
Replace individual colored SVG arcs (cyan, green, yellow, orange) with uniform ice-blue `#38bdf8` arcs and dark tracks `#1a1c24`.

- [ ] **Step 2: De-saturate badge tags and tab toggles**
Replace bright green tags with subtle slate chips (`text-slate-400 bg-slate-800/40`). Style the tab switcher with dark pill styling (`#101115` with subtle ice-blue active border).

- [ ] **Step 3: Verify tests**
Run: `npm test`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add app/components/vessel/VesselRadialCockpit.vue
git commit -m "style(cockpit): de-saturate radial meters into uniform ice-blue tactical dials"
```

---

### Task 4: Refine 24h Timeline Chart & Cylinder Bars

**Files:**
- Modify: `app/components/vessel/VesselTelemetryChart.vue`
- Modify: `app/components/vessel/VesselCylinderBarChart.vue`

- [ ] **Step 1: De-saturate `VesselTelemetryChart.vue`**
- In Speed vs Fuel mode: Speed line in ice-blue (`#38bdf8`, 0.08 area fill opacity); Fuel line in clean neutral steel slate (`#94a3b8`, 0.04 area fill opacity).
- Single parameter modes: Unified ice-blue line, subtle `#181920` grid lines, slate labels `#64748b`.

- [ ] **Step 2: Refine `VesselCylinderBarChart.vue`**
- Nominal cylinders render in steel-slate (`#334155`).
- Anomaly cylinders render in muted amber (`#f59e0b`) or red (`#ef4444`).
- MarkLine: Dashed ice-blue (`#38bdf8` at 0.6 opacity).
- Replace colorful stat cards with a clean dark pill strip.

- [ ] **Step 3: Verify tests**
Run: `npm test`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add app/components/vessel/VesselTelemetryChart.vue app/components/vessel/VesselCylinderBarChart.vue
git commit -m "style(graphs): refine 24h timeline and cylinder bars to monochromatic palette"
```

---

### Task 5: Refine Machinery Diagnostics & Alarms Rail

**Files:**
- Modify: `app/components/vessel/VesselDiagnosticsMatrix.vue`
- Modify: `app/components/vessel/VesselAlarmsDrawer.vue`

- [ ] **Step 1: Refine `VesselDiagnosticsMatrix.vue`**
Replace bright emerald indicators and tabs with calm ice-blue tabs and subtle slate indicator pips.

- [ ] **Step 2: Refine `VesselAlarmsDrawer.vue`**
Remove glowing blur halos; render clean 6px indicator pips (red, amber, slate). Use neutral dark card rows and clean typography.

- [ ] **Step 3: Verify tests**
Run: `npm test`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add app/components/vessel/VesselDiagnosticsMatrix.vue app/components/vessel/VesselAlarmsDrawer.vue
git commit -m "style(diagnostics): tone down diagnostics matrix and alarms drawer"
```

---

### Task 6: Full System Verification & Production Build

**Files:**
- Modify: `app/pages/dashboard.vue` (ensure root canvas uses `#0a0b0e`)

- [ ] **Step 1: Verify canvas styling in `app/pages/dashboard.vue`**
Ensure background `#0a0b0e` and border `#1e2029`.

- [ ] **Step 2: Run test suite**
Run: `npm test`
Expected: PASS

- [ ] **Step 3: Run production build**
Run: `npm run build`
Expected: Exit code 0, clean build.

- [ ] **Step 4: Commit & finish**
```bash
git add app/pages/dashboard.vue
git commit -m "feat(dashboard): finalize tactical monochromatic executive operations center"
```
