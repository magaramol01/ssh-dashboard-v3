# Consolidated Emissions & IMO CII Compliance Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a consolidated, insight-rich Emissions and Carbon Intensity Indicator (CII) platform with a single high-performance server aggregation endpoint, replacing 5-6 fragmented frontend requests and dated HTML tables.

**Architecture:** A unified Nuxt server endpoint (`server/api/emissions/cii.get.ts`) encapsulates all mathematical aggregations (CO2 summation, transport work, IMO boundary evaluation, speed reduction simulator, draft averages, and sea/port operational ratios) using a modular calculation engine (`server/utils/marine/cii-calculator.ts`). The frontend (`app/pages/emissions.vue`) consumes this single payload to render executive compliance gauges, KPI tiles, fuel mix tables, what-if speed simulation cards, and monthly rolling trend charts.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Tailwind CSS v4, shadcn-vue tokens, vue-echarts (`<ClientOnly>`), Node test runner (`tsx --test`).

## Global Constraints
- SSR-Safe: Deterministic only. Wrap charts in `<ClientOnly>` with `<Skeleton>` fallbacks.
- Single API roundtrip: Frontend only calls `GET /api/emissions/cii`.
- Palette: Use semantic tokens (`text-success`, `bg-warning`, etc.) and standard IMO grade colors.

---

### Task 1: Core CII & Emissions Calculation Engine

**Files:**
- Create: `server/utils/marine/cii-calculator.ts`
- Test: `tests/cii-calculator.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface CIIBoundaries {
    superior_boundary: number
    lower_boundary: number
    upper_boundary: number
    inferior_boundary: number
    requiredCII?: number
  }
  export type CIIRating = 'A' | 'B' | 'C' | 'D' | 'E'
  export function getCIIRating(attainedCii: number, boundaries: CIIBoundaries): CIIRating
  export function calculateTransportWork(distanceNm: number, deadweightMt: number): number
  export function calculateAttainedCII(totalMassOfCo2Mt: number, transportWork: number): number
  export function calculateSpeedReductionScenarios(actualMassOfCo2Mt: number, transportWork: number, boundaries: CIIBoundaries)
  export function calculateFuelTotals(ciiRecords: any[], customCoeffs?: Record<string, number>, customLabels?: Record<string, string>)
  export function calculateOperationalHours(ciiRecords: any[])
  export function calculateDraftAverages(ciiRecords: any[])
  ```

- [ ] **Step 1: Write the failing tests**
Write tests in `tests/cii-calculator.test.ts` covering IMO rating classification, transport work, attained CII, speed reduction simulations, and fuel aggregation.

- [ ] **Step 2: Run test to verify it fails**
Run: `npx tsx --test tests/cii-calculator.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Write the calculation engine**
Create `server/utils/marine/cii-calculator.ts` implementing IMO resolution MEPC formulas and constants.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx tsx --test tests/cii-calculator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add server/utils/marine/cii-calculator.ts tests/cii-calculator.test.ts
git commit -m "feat(emissions): implement IMO CII and emissions calculation engine"
```

---

### Task 2: Consolidated Nuxt Server Endpoint (`GET /api/emissions/cii`)

**Files:**
- Create: `server/api/emissions/cii.get.ts`
- Test: `tests/emissions-api.test.ts`

**Interfaces:**
- Consumes: `server/utils/marine/cii-calculator.ts`, `server/utils/http-adapter.ts`
- Produces: `GET /api/emissions/cii` returning `EmissionsCiiResponse`

- [ ] **Step 1: Write endpoint test**
Create `tests/emissions-api.test.ts` testing query parsing, aggregation, and response structure.

- [ ] **Step 2: Run test to verify it fails**
Run: `npx tsx --test tests/emissions-api.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `server/api/emissions/cii.get.ts`**
Handle query params (`vesselId`, `year`, `startDate`, `endDate`, `voyageNumber`, `voyageType`). Call upstream API via `backendFetch` with fallback to deterministic mock telemetry. Compute summaries, ratings, fuel breakdowns, speed reduction scenarios, and monthly trends into a single response.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx tsx --test tests/emissions-api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add server/api/emissions/cii.get.ts tests/emissions-api.test.ts
git commit -m "feat(emissions): add consolidated GET /api/emissions/cii endpoint"
```

---

### Task 3: Sidebar Navigation Update

**Files:**
- Modify: `app/lib/nav.ts:38-42`

- [ ] **Step 1: Update navigation tree**
Rename "Inbound" section to "Emissions", replace "Containers" with `{ label: "CII Tracking", to: "/emissions", icon: "Gauge", requires: "dispatcher" }`.

- [ ] **Step 2: Run tests to ensure nav tests still pass**
Run: `npx tsx --test tests/tenant-routes.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**
```bash
git add app/lib/nav.ts
git commit -m "refactor(nav): rename inbound to emissions in sidebar"
```

---

### Task 4: Insight-Rich Emissions & CII Dashboard Page

**Files:**
- Create: `app/pages/emissions.vue`

**Key UI Components:**
- Header with Vessel selector, Year dropdown (2017-Present), filter toggles, and CSV export.
- Hero CII Compliance Card: Visual IMO grade badge (A–E), linear boundary gauge bar, margin %, and regulatory compliance directive.
- 4-Tile Operational KPI Grid: Total CO2 (MT), Transport Work Done (MT·NM), Distance Sailed (NM) with Sea/Port ratio, and Average Draft Fwd/Aft.
- Fuel Mix & Emissions Table: VLSFO, HFO, MGO tonnages and CO2 output divided into At-Sea vs At-Port.
- Interactive Speed Reduction Advisory Card: Scenario buttons (-5% to -25%) displaying simulated fuel savings, avoided CO2, and projected grade improvement.
- Monthly Rolling Trend Chart: Client-only ECharts line chart with benchmark boundary lines.

- [ ] **Step 1: Create `app/pages/emissions.vue`**
Build the page with loading skeleton states, reactive filters, and executive visual hierarchy using Tailwind v4 OKLCH tokens.

- [ ] **Step 2: Verify page build with TypeScript and Nuxt build**
Run: `npm run build`
Expected: Clean compilation with 0 errors.

- [ ] **Step 3: Commit**
```bash
git add app/pages/emissions.vue
git commit -m "feat(emissions): build executive insight-rich Emissions & CII dashboard"
```

---

### Task 5: Full Suite Verification

**Files:**
- All created and modified files

- [ ] **Step 1: Run complete test suite**
Run: `npm test`
Expected: All tests pass (20+ tests).

- [ ] **Step 2: Verify SSR production build**
Run: `npm run build`
Expected: `✨ Build complete!`

- [ ] **Step 3: Commit any final polishing**
```bash
git status
git commit -m "chore(emissions): finalize consolidated Emissions and CII platform" || true
```
