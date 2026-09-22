# Map-Focused Voyage Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Voyage Analytics into a map-hero layout with 100% unobstructed passage map, a floating bottom day scrubber, a right-hand slide-over benchmark drawer with Sea & Shop trial curves, and a clamped CII trajectory chart that handles extreme outliers without distortion.

**Architecture:** 
- The interactive Leaflet passage map spans the entire viewport height and width.
- A slim 44px floating glass scrubber sits at the bottom of the map for day-by-day navigation and quick benchmark access.
- A full-height right-side slide-over drawer houses the Daily Noon Log, Sea Trial (Speed-Power curve), Shop Trial (SFOC curve), and Advisories, with expand/minimize toggles and zero text bloat.
- The CII trajectory bar chart clamps the y-axis ceiling (max 25) so Day 8's 165 outlier is clearly marked with an outlier badge without flattening normal days.

**Tech Stack:** Nuxt 4, Vue 3 (`<script setup>`), Tailwind CSS v4, ECharts / `vue-echarts`, Lucide Vue Next, Leaflet.

## Global Constraints
- SSR-safe: `vue-echarts` wrapped in `<ClientOnly>` with skeleton fallbacks.
- Tailwind v4 OKLCH semantic tokens (`bg-primary`, `border-border`, `text-muted-foreground`).
- Deterministic data handling and zero unnecessary prose.

---

### Task 1: Fix CII Trajectory Chart Scaling, Clamping, and Strip Text Bloat

**Files:**
- Modify: `app/components/voyage/VoyageOptimizationDrawer.vue`

- [ ] **Step 1: Clamp CII Trajectory EChart yAxis max and handle outlier bars**
In `ciiTrajectoryChartOption`:
- Set `yAxis.max` to `Math.max(12, Math.min(25, Math.ceil(requiredCii * 2)))` (default 20-25).
- For bars where `attainedCii > yAxisMax`, clamp `value: Math.min(n.attainedCii, yAxisMax)` for visual rendering, but provide `actualValue: n.attainedCii` and `isOutlier: true`.
- Add label formatter showing `▲ ${n.attainedCii}` on outlier bars.
- In the tooltip, display: `Attained CII: <b>${noon.attainedCii}</b> g/MT·NM ${isOutlier ? '(Outlier / Port / Manoeuvring)' : ''}`.

- [ ] **Step 2: Strip narrative text bloat and filter zero-consumption fuel rows**
- Remove the prose narrative paragraph from Factor Attribution ("Attained CII of 5.27 g/MT·NM compliant with target 8.72...").
- Keep the clean diagnostic chips (`[ 🌊 Heavy Weather: BF 6 · 2.5m ]`, `[ ⚙️ Propeller Slip: 2.2% ]`, `[ ⚡ SOG: 11.75 kts ]`).
- In Fuel Consumed, only render fuel categories where `fuel.value > 0`, avoiding multiple empty `0 MT` rows.

- [ ] **Step 3: Verify chart options and zero-fuel rendering**
Run `npm run build` or inspect Vue component to ensure TypeScript and template compile cleanly.

- [ ] **Step 4: Commit Task 1 changes**
`git add app/components/voyage/VoyageOptimizationDrawer.vue && git commit -m "fix(voyage): clamp cii chart y-axis for outliers and eliminate text bloat"`

---

### Task 2: Convert VoyageOptimizationDrawer to Full-Height Right Slide-Over Drawer

**Files:**
- Modify: `app/components/voyage/VoyageOptimizationDrawer.vue`

- [ ] **Step 1: Update container layout to right-hand sidebar**
- Replace bottom border and fixed tray heights (`h-[58vh]`, `h-[410px]`) with right-side drawer layout:
  `aside: h-full w-full sm:w-[540px] xl:w-[600px] border-l border-border bg-background/98 shadow-2xl flex flex-col shrink-0`
- Handle expand mode: when `isExpanded` is true, expand width to `xl:w-[820px]`.
- Update header toggle icons and tooltips to `Expand Drawer (820px)` and `Dock Drawer (600px)` with `Maximize2` / `Minimize2`.
- Update close button to `<X class="w-4 h-4" />`.

- [ ] **Step 2: Ensure 4 tabs render cleanly inside drawer without internal scrollbars**
- Tab 1: Noon Log (vertical stack: Day selector strip, Diagnostic chips, Clamped CII Trajectory chart, Factor Attribution Donut + Active Fuels).
- Tab 2: Sea Trial Benchmark (Speed vs. Shaft Power cubic curve $P \propto V^3$, hydrodynamic stats, superintendent guidance).
- Tab 3: Shop Trial Benchmark (SFOC vs. Load % curve, testbed baseline, thermal efficiency stats).
- Tab 4: Route Advisories & Strategies (Simulated speed profiles and dispatch cards).

- [ ] **Step 3: Verify drawer compiles**
Run `npm run build` to confirm template and style compliance.

- [ ] **Step 4: Commit Task 2 changes**
`git add app/components/voyage/VoyageOptimizationDrawer.vue && git commit -m "feat(voyage): convert optimization drawer to full-height right-side slide-over"`

---

### Task 3: Implement Floating Bottom Passage Scrubber & Hero Map Layout

**Files:**
- Modify: `app/pages/voyage-analytics.vue`

- [ ] **Step 1: Full-height Hero Map Canvas**
- Ensure the map container takes full height and width (`flex-1 relative w-full h-full min-h-0 overflow-hidden`).
- Position Leaflet map edge-to-edge.

- [ ] **Step 2: Add Floating Bottom Passage Scrubber**
- Add glass timeline scrubber floating along the bottom of the map (`absolute bottom-4 left-4 right-4 sm:left-6 sm:right-auto z-20`):
  - Day pills for `D1..Dn` with active selection, IMO band indicator dot, and SOG.
  - Quick action button `[ 📈 Performance & Benchmarks (Sea & Shop Trials) ]` that emits or triggers `isDrawerOpen = true`.
- If drawer is opened, adjust scrubber positioning or allow it to remain accessible.

- [ ] **Step 3: Dock Drawer and Sentinel Copilot beside the Map**
- In `app/pages/voyage-analytics.vue`:
  - Outer container: `flex flex-row h-full w-full overflow-hidden`.
  - Center: Map container (`flex-1 relative min-w-0 h-full`).
  - Right: `VoyageOptimizationDrawer` and `SentinelCopilotPanel` dock cleanly on the right without squishing the map vertically.

- [ ] **Step 4: Verify build and map sizing**
Run `npm run build` to verify clean build.

- [ ] **Step 5: Commit Task 3 changes**
`git add app/pages/voyage-analytics.vue && git commit -m "feat(voyage): add floating bottom passage scrubber and hero map layout"`

---

### Task 4: Header Bar & Integration Polish

**Files:**
- Modify: `app/components/voyage/VoyageOptimizationHeaderBar.vue`

- [ ] **Step 1: Update header toggle button**
- Update button title and label: `[ 📈 Performance Benchmarks ]` or `[ Benchmark Drawer ]`.
- Set active variant (`default` when open, `outline` when closed).

- [ ] **Step 2: Commit Task 4 changes**
`git add app/components/voyage/VoyageOptimizationHeaderBar.vue && git commit -m "polish(voyage): update header toggle button for benchmark drawer"`

---

### Task 5: Verification & End-to-End Validation

- [ ] **Step 1: Run complete build**
Run `npm run build` and verify 0 errors.

- [ ] **Step 2: Review all requirements**
- 100% full-height passage map.
- Floating bottom day scrubber.
- Clamped CII trajectory chart without Day 8 outlier distortion.
- Sea Trial Speed vs. Power curve and Shop Trial SFOC curve.
- Zero text bloat and no internal scrollbars.
