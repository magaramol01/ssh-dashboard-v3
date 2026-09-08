# CII Visual Charts & KPI Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the text-heavy sections of the Emissions Dashboard into high-impact visual instruments (Root-Cause Radar Chart, CII vs. Speed Hydrodynamic Curve, and Visual Milestone Pipeline), stripping out dense paragraphs in favor of charts, gauges, and compact KPI chips.

**Architecture:** Update `app/components/emissions/CiiImprovementPlanCard.vue` with ECharts Radar and Line Chart options wrapped in `<ClientOnly>` with `<Skeleton>` fallbacks. Streamline the 4 performance widgets (`WeatherImpactCard`, `HullPropulsionCard`, `EngineSfocCard`, `OperationalProfileCard`) to remove text paragraphs and emphasize bold visual metrics.

**Tech Stack:** Nuxt 4, Vue 3, ECharts (`vue-echarts`), Tailwind v4, TypeScript, Lucide Icons.

## Global Constraints

- Charts client-side only: wrap in `<ClientOnly>` with `<Skeleton>` fallback.
- Tailwind v4 OKLCH semantic tokens.
- Deterministic and SSR-safe.

---

### Task 1: Integrate Radar & Sensitivity Charts in `CiiImprovementPlanCard.vue`

**Files:**
- Modify: `app/components/emissions/CiiImprovementPlanCard.vue`

**Interfaces:**
- Pillar 1: ECharts Radar Chart comparing vessel driver values vs. optimal baseline.
- Pillar 2: ECharts Line Chart plotting Speed (kts) vs. Attained CII with grade boundaries and active scenario marker.
- Pillar 3: Compact visual milestone pipeline.

- [ ] **Step 1: Construct ECharts options for Radar Chart and Speed Curve**
- [ ] **Step 2: Replace text lists in Pillar 1 with `<ClientOnly><v-chart :option="radarChartOption" ... />`**
- [ ] **Step 3: Replace text descriptions in Pillar 2 with `<ClientOnly><v-chart :option="speedCurveOption" ... />`**
- [ ] **Step 4: Streamline Pillar 3 into compact milestone steps with KPI chips**
- [ ] **Step 5: Commit**

```bash
git add app/components/emissions/CiiImprovementPlanCard.vue
git commit -m "feat: replace text with root-cause radar chart and speed sensitivity curve in improvement plan"
```

---

### Task 2: Streamline 2x2 Performance Widgets (Strip Paragraphs)

**Files:**
- Modify: `app/components/emissions/widgets/WeatherImpactCard.vue`
- Modify: `app/components/emissions/widgets/HullPropulsionCard.vue`
- Modify: `app/components/emissions/widgets/EngineSfocCard.vue`
- Modify: `app/components/emissions/widgets/OperationalProfileCard.vue`

- [ ] **Step 1: Clean up `WeatherImpactCard.vue`**
- [ ] **Step 2: Clean up `HullPropulsionCard.vue`**
- [ ] **Step 3: Clean up `EngineSfocCard.vue`**
- [ ] **Step 4: Clean up `OperationalProfileCard.vue`**
- [ ] **Step 5: Commit**

```bash
git add app/components/emissions/widgets/*.vue
git commit -m "refactor: eliminate text paragraphs in performance widgets for high-contrast visual display"
```

---

### Task 3: Verification & Test Suite

- [ ] **Step 1: Run `npm test`**
- [ ] **Step 2: Verify git working tree is clean**
