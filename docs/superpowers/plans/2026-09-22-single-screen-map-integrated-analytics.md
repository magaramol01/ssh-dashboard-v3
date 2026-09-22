# Single-Screen Map-Integrated Voyage Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Voyage Analytics screen into a true single-screen application where the map is 100% edge-to-edge, data is visualized directly on the map (CII-colored route segments, interactive on-map noon popovers), and the performance benchmark drawer floats as a translucent glass cockpit overlay without partitioning the screen.

**Architecture:**
- **Full-Screen Single Canvas:** The Leaflet map fills 100% of the screen under the header.
- **In-Map Data Visualization:** Route track polylines are segmented and color-coded by daily IMO CII rating (Band A/B/C/D/E); clicking a noon marker displays a rich glass popover on the map.
- **Floating Glass Benchmark Cockpit:** `VoyageOptimizationDrawer` becomes a floating translucent glass card (`absolute top-3 right-3 bottom-3 rounded-2xl backdrop-blur-xl bg-card/85 border border-white/10 shadow-2xl`) that floats over the map without altering the map's aspect ratio or partitioning the screen.

**Tech Stack:** Nuxt 4, Vue 3 (`<script setup>`), Tailwind CSS v4, Leaflet, ECharts, Lucide Vue Next.

---

### Task 1: Rich In-Map Data Visualizations in `VoyageOptimizationMap.vue`

**Files:**
- Modify: `app/components/voyage/VoyageOptimizationMap.vue`

- [ ] **Step 1: Color-code route segments by IMO CII rating**
In `renderDailyNoonPins()`:
- Instead of a single white dashed line between noons, iterate through pairs of consecutive noon reports (`noons[i]` and `noons[i+1]`) and draw a polyline colored with `ciiHexColor(noons[i+1].rating)` (e.g. green for A/B, amber for C, red for E) with weight 4 and glow.
- This visually reveals geographic degradation zones on the world map.

- [ ] **Step 2: Add interactive on-map rich popups to noon markers**
When clicking or binding popup to each noon marker in Leaflet:
- Render a glass popup with:
  - Day number, date, coordinates
  - IMO Band badge + Attained CII
  - SOG, Propeller Slip %, 24h distance
  - Beaufort wind & sea state
  - Button `[ 📈 View Sea/Shop Benchmark ]` that emits `select-day` and opens the benchmark overlay.

- [ ] **Step 3: Verify map rendering**
Test that Leaflet polyline segments and popups render without runtime errors.

- [ ] **Step 4: Commit Task 1**
`git add app/components/voyage/VoyageOptimizationMap.vue && git commit -m "feat(voyage): add cii-colored route segments and rich on-map noon popups"`

---

### Task 2: Transform `VoyageOptimizationDrawer.vue` into Floating Translucent Glass Cockpit

**Files:**
- Modify: `app/components/voyage/VoyageOptimizationDrawer.vue`

- [ ] **Step 1: Update container to absolute floating glass card**
Replace fixed layout classes on `<aside>`:
```vue
<aside
  v-show="isOpen"
  :class="[
    'absolute top-3 right-3 bottom-3 z-30 flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-background/85 dark:bg-card/85 backdrop-blur-xl shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-right-4',
    isExpanded ? 'w-full sm:w-[680px] xl:w-[760px]' : 'w-full sm:w-[480px] xl:w-[540px]'
  ]"
>
```
- Map is now visible behind and around the glass card; screen is unified, not partitioned!

- [ ] **Step 2: Commit Task 2**
`git add app/components/voyage/VoyageOptimizationDrawer.vue && git commit -m "feat(voyage): transform benchmark drawer into floating glass cockpit overlay"`

---

### Task 3: Update `app/pages/voyage-analytics.vue` for Single-Screen Layout

**Files:**
- Modify: `app/pages/voyage-analytics.vue`

- [ ] **Step 1: Simplify layout to edge-to-edge full map with floating overlays**
- Remove any flex partitioning between the map and the drawer.
- The map container takes `relative flex-1 w-full h-full min-h-0 overflow-hidden`.
- Overlaid on top of the map:
  - Floating 5-Tile KPI HUD (`absolute top-3 left-0 right-0 z-20`)
  - Floating Bottom Passage Scrubber (`absolute bottom-4 left-4 right-4 sm:left-6 sm:right-auto z-20`)
  - Floating Benchmark Glass Cockpit (`VoyageOptimizationDrawer`) (`absolute top-3 right-3 bottom-3 z-30`)
  - Floating Copilot Panel (`SentinelCopilotPanel`) (`z-40`)

- [ ] **Step 2: Commit Task 3**
`git add app/pages/voyage-analytics.vue && git commit -m "feat(voyage): unify page into single edge-to-edge map with floating overlays"`

---

### Task 4: Verification & Build Validation

- [ ] **Step 1: Run `npm run build`**
Confirm zero build or SSR errors.

- [ ] **Step 2: End-to-end sanity check**
Verify the map is 100% full screen, route segments are color-coded by CII, clicking pins shows on-map glass popups, and the benchmark cockpit floats gracefully as translucent glass.
