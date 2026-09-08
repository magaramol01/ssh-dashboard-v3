# Environmental & Technical Performance Widgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and integrate 4 specialized maritime performance widgets (Weather Impact, Hull Biofouling & Propulsion, Engine SFOC & Health, Operational Profile & Port Idle Audit) powered by `getCobelfretWidgetData` and `shipping_db` PostgreSQL fallback into the Emissions Dashboard.

**Architecture:** Create a domain utility `server/utils/marine/performance-widgets.ts` to parse, normalize, and calculate technical KPIs from upstream widget data (`widget_1`, `widget_4`, `widget_5`, `widget_6`) and database fallbacks. Expose this via `server/api/emissions/cii.get.ts`, create 4 modular Vue components under `app/components/emissions/widgets/`, and integrate them as a 2x2 grid in `app/pages/emissions.vue`.

**Tech Stack:** Nuxt 4, Vue 3, Tailwind v4 (OKLCH tokens), TypeScript, Lucide Icons, Node.js test runner (`tsx --test`).

## Global Constraints

- SSR-safe: deterministic calculations, zero non-deterministic `Date.now()` at module scope.
- Tailwind v4 OKLCH semantic tokens (`text-primary`, `bg-muted/30`, `border-border/60`, `text-emerald-500`, `text-amber-500`, `text-rose-500`).
- No Pinia: use `useState` and Vue reactive refs.

---

### Task 1: Performance Widgets Domain Engine (`server/utils/marine/performance-widgets.ts`)

**Files:**
- Create: `server/utils/marine/performance-widgets.ts`
- Test: `tests/performance-widgets.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface WeatherImpactData {
    badWeatherPct: number
    averageBadWeatherDays: number
    shipsAffectedPct: number
    speedLossKnots: number
    excessCo2Mt: number
    imoExclusionEligible: boolean
  }

  export interface HullPropulsionData {
    timeLossPct: number
    engineSlipPct: number
    dragPenaltyPct: number
    cleaningStatus: 'optimal' | 'monitoring' | 'recommended' | 'critical'
    powerRecoveryPotentialPct: number
  }

  export interface EngineSfocData {
    currentSfoc: number
    expectedSfoc: number
    fleetAvgSfoc: number
    trendValue: number
    sfocDelta: number
    status: 'optimal' | 'normal' | 'elevated'
  }

  export interface OperationalProfileData {
    ladenPct: number
    ballastPct: number
    portPct: number
    anchoragePct: number
    maneuveringPct: number
    nonProductiveFuelMt: number
  }

  export interface PerformanceWidgetsPayload {
    weather: WeatherImpactData
    propulsion: HullPropulsionData
    engine: EngineSfocData
    operations: OperationalProfileData
  }

  export function extractPerformanceWidgetsData(params: {
    cobelfretRaw?: any
    dbSlip?: number
    totalCo2Mt: number
    totalFuelMt: number
    attainedCii: number
  }): PerformanceWidgetsPayload
  ```

- [ ] **Step 1: Write the failing tests in `tests/performance-widgets.test.ts`**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Implement `server/utils/marine/performance-widgets.ts`**
- [ ] **Step 4: Run test to verify pass**
- [ ] **Step 5: Commit**

```bash
git add server/utils/marine/performance-widgets.ts tests/performance-widgets.test.ts
git commit -m "feat: add performance widgets normalization and calculation engine"
```

---

### Task 2: API Integration in `server/api/emissions/cii.get.ts`

**Files:**
- Modify: `server/api/emissions/cii.get.ts`
- Test: `tests/emissions-api.test.ts`

**Interfaces:**
- Extends `EmissionsCiiResponse` to include `performanceWidgets: PerformanceWidgetsPayload`.

- [ ] **Step 1: Update `EmissionsCiiResponse` interface and test expectation in `tests/emissions-api.test.ts`**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Call `extractPerformanceWidgetsData` in `cii.get.ts` and return `performanceWidgets`**
- [ ] **Step 4: Run `npx tsx --test tests/emissions-api.test.ts` to verify pass**
- [ ] **Step 5: Commit**

```bash
git add server/api/emissions/cii.get.ts tests/emissions-api.test.ts
git commit -m "feat: include performance widgets payload in emissions API"
```

---

### Task 3: Build the 4 Modular Widget Components

**Files:**
- Create: `app/components/emissions/widgets/WeatherImpactCard.vue`
- Create: `app/components/emissions/widgets/HullPropulsionCard.vue`
- Create: `app/components/emissions/widgets/EngineSfocCard.vue`
- Create: `app/components/emissions/widgets/OperationalProfileCard.vue`

- [ ] **Step 1: Build `WeatherImpactCard.vue`**
- [ ] **Step 2: Build `HullPropulsionCard.vue`**
- [ ] **Step 3: Build `EngineSfocCard.vue`**
- [ ] **Step 4: Build `OperationalProfileCard.vue`**
- [ ] **Step 5: Commit**

```bash
git add app/components/emissions/widgets/*.vue
git commit -m "feat: build modular performance intelligence widget components"
```

---

### Task 4: Integrate Widgets 2x2 Grid into `app/pages/emissions.vue`

**Files:**
- Modify: `app/pages/emissions.vue`

- [ ] **Step 1: Import widgets into `app/pages/emissions.vue`**
- [ ] **Step 2: Add 2x2 grid section between CII Improvement Plan and Monthly Rolling Trend Chart**
- [ ] **Step 3: Run `npm test` to verify zero regressions**
- [ ] **Step 4: Commit**

```bash
git add app/pages/emissions.vue
git commit -m "feat: integrate 2x2 performance intelligence widgets on emissions dashboard"
```

---

### Task 5: Verification & Full Test Suite

- [ ] **Step 1: Run complete test suite (`npm test`)**
- [ ] **Step 2: Verify git status is clean**
