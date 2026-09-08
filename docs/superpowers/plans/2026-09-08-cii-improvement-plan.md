# CII Improvement Plan & Degradation Diagnostic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an automated, non-chat CII Improvement Plan widget on the Emissions Dashboard that pinpoints when and why degradation started, calculates root cause factor attributions, provides prescriptive recovery steps, and incorporates the interactive speed reduction advisory.

**Architecture:** Create a domain utility `server/utils/marine/cii-improvement.ts` to diagnose degradation onset, root causes (speed, hull resistance, auxiliary/port load, transport work shortfall), and generate recovery plans using telemetry logs and PostgreSQL fallback (`shipping_db.std_enoonreporttable`, `shipping_db.highfrequencydata`, `shipping_db.standardparameters`). Expose this via `server/api/emissions/cii.get.ts`, and render a responsive 3-pillar executive console on `app/pages/emissions.vue`.

**Tech Stack:** Nuxt 4, Vue 3, Tailwind v4 (OKLCH tokens), TypeScript, Lucide Icons, Node.js test runner (`tsx --test`).

## Global Constraints

- SSR-safe: deterministic calculations, zero `Math.random` or non-deterministic `Date.now()` at module scope.
- Tailwind v4 OKLCH semantic tokens (`text-primary`, `bg-muted/30`, `border-border/60`, `text-emerald-500`, `text-amber-500`).
- No Pinia: use `useState` and Vue reactive refs.
- No chat UI: purely structured, executive diagnostic widget with re-audit action.

---

### Task 1: Diagnostic Engine & Calculation Domain (`server/utils/marine/cii-improvement.ts`)

**Files:**
- Create: `server/utils/marine/cii-improvement.ts`
- Test: `tests/cii-improvement.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface DegradationDriver {
    key: 'speed' | 'hull' | 'auxiliary' | 'payload'
    label: string
    percentage: number
    description: string
    iconName: string
  }

  export interface CiiImprovementPlan {
    hasDegraded: boolean
    onset: {
      month: string
      voyageNumber: string
      initialRating: string
      currentRating: string
      ciiIncrease: number
      onsetMonthIndex: number
    }
    drivers: DegradationDriver[]
    summary: string
    actionItems: Array<{
      phase: 'Immediate' | 'Short-Term' | 'Strategic'
      title: string
      description: string
      impact: string
      status: 'pending' | 'in_progress' | 'recommended'
    }>
    recoveryTarget: {
      targetRating: string
      projectedDays: number
      targetCii: number
    }
    lastAuditedAt: string
  }

  export function generateCiiImprovementPlan(params: {
    attainedCii: number
    requiredCii: number
    attainedRating: string
    monthlyTrend: Array<{ month: string; attainedCii: number | null; rating: string | null; co2Mt: number; distanceNm: number }>
    availableVoyages: Array<{ voyageNumber: string; startPort: string; destinationPort: string }>
    fuelBreakdown: Array<{ fuelType: string; totalMt: number; co2Mt: number }>
    speedReductionScenarios: any[]
    activeScenarioIndex?: number
  }): CiiImprovementPlan
  ```

- [ ] **Step 1: Write the failing tests in `tests/cii-improvement.test.ts`**

```typescript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateCiiImprovementPlan } from '../server/utils/marine/cii-improvement'

test('detects degradation onset when monthly CII crosses required threshold', () => {
  const monthlyTrend = [
    { month: 'Jan', attainedCii: 4.8, rating: 'B', co2Mt: 200, distanceNm: 1500 },
    { month: 'Feb', attainedCii: 5.1, rating: 'C', co2Mt: 210, distanceNm: 1450 },
    { month: 'Mar', attainedCii: 6.2, rating: 'D', co2Mt: 270, distanceNm: 1400 },
    { month: 'Apr', attainedCii: 6.5, rating: 'D', co2Mt: 280, distanceNm: 1350 },
  ]
  const availableVoyages = [
    { voyageNumber: 'ROT-SIN-01', startPort: 'Rotterdam', destinationPort: 'Singapore' },
    { voyageNumber: 'SIN-SHA-02', startPort: 'Singapore', destinationPort: 'Shanghai' },
    { voyageNumber: 'SHA-LAX-03', startPort: 'Shanghai', destinationPort: 'Los Angeles' },
  ]

  const plan = generateCiiImprovementPlan({
    attainedCii: 6.5,
    requiredCii: 5.25,
    attainedRating: 'D',
    monthlyTrend,
    availableVoyages,
    fuelBreakdown: [{ fuelType: 'vlsfo', totalMt: 800, co2Mt: 2520 }],
    speedReductionScenarios: [
      { reductionPercent: 10, speedKnots: 12.6, projectedCii: 5.2, projectedRating: 'C', co2SavingsMt: 320, multiplier: 0.729 },
    ],
  })

  assert.equal(plan.hasDegraded, true)
  assert.equal(plan.onset.month, 'Mar')
  assert.ok(plan.onset.ciiIncrease > 0)
  assert.equal(plan.drivers.length, 4)
  const totalPct = plan.drivers.reduce((acc, d) => acc + d.percentage, 0)
  assert.equal(totalPct, 100)
  assert.ok(plan.actionItems.length >= 3)
})

test('gracefully handles compliant vessel with Grade A/B', () => {
  const monthlyTrend = [
    { month: 'Jan', attainedCii: 3.8, rating: 'A', co2Mt: 160, distanceNm: 1500 },
    { month: 'Feb', attainedCii: 3.9, rating: 'A', co2Mt: 165, distanceNm: 1450 },
  ]
  const plan = generateCiiImprovementPlan({
    attainedCii: 3.9,
    requiredCii: 5.25,
    attainedRating: 'A',
    monthlyTrend,
    availableVoyages: [{ voyageNumber: 'ROT-SIN-01', startPort: 'Rotterdam', destinationPort: 'Singapore' }],
    fuelBreakdown: [{ fuelType: 'vlsfo', totalMt: 500, co2Mt: 1575 }],
    speedReductionScenarios: [],
  })

  assert.equal(plan.hasDegraded, false)
  assert.equal(plan.onset.initialRating, 'A')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/cii-improvement.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `server/utils/marine/cii-improvement.ts`**

Create `server/utils/marine/cii-improvement.ts` with accurate onset detection, normalized driver percentages (summing to 100%), actionable multi-tier recommendations, and milestone projections.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/cii-improvement.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/utils/marine/cii-improvement.ts tests/cii-improvement.test.ts
git commit -m "feat: add CII degradation diagnostic and improvement plan calculation engine"
```

---

### Task 2: Integrate Improvement Plan in API (`server/api/emissions/cii.get.ts`)

**Files:**
- Modify: `server/api/emissions/cii.get.ts`
- Test: `tests/emissions-api.test.ts`

**Interfaces:**
- Extends `EmissionsCiiResponse` to include `improvementPlan: CiiImprovementPlan`.

- [ ] **Step 1: Update `EmissionsCiiResponse` interface and test expectation in `tests/emissions-api.test.ts`**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Call `generateCiiImprovementPlan` in `cii.get.ts` and return `improvementPlan`**
- [ ] **Step 4: Run `npx tsx --test tests/emissions-api.test.ts` to verify pass**
- [ ] **Step 5: Commit**

```bash
git add server/api/emissions/cii.get.ts tests/emissions-api.test.ts
git commit -m "feat: include improvement plan payload in emissions CII API response"
```

---

### Task 3: Build `CiiImprovementPlanCard.vue` UI Component

**Files:**
- Create: `app/components/emissions/CiiImprovementPlanCard.vue`

**Design:**
- Full-width executive 3-pillar console:
  - **Left Pillar**: Degradation Onset & Timeline badge, Attained CII drift (+X.XX), and Drivers Progress Breakdown (Excess Speed, Biofouling / Resistance, Auxiliary/Port Load, Cargo Deadweight utilization).
  - **Center Pillar**: Speed Reduction Advisory Scenario Pills (`-5%` to `-25%`), Projected Grade turnaround badge, avoided CO₂ (MT), and power reduction factor.
  - **Right Pillar**: Prioritized Corrective Action Roadmap (Immediate, Short-Term, Strategic), Recovery Timeline badge, "Re-run AI Audit" trigger, and "Copy Plan" action.
- Uses Tailwind OKLCH design tokens (`border-border/60`, `bg-muted/20`, `text-primary`, `text-emerald-500`, `text-amber-500`).

- [ ] **Step 1: Write `app/components/emissions/CiiImprovementPlanCard.vue`**
- [ ] **Step 2: Verify props interface and reactive scenario emits**
- [ ] **Step 3: Commit**

```bash
git add app/components/emissions/CiiImprovementPlanCard.vue
git commit -m "feat: create 3-pillar CiiImprovementPlanCard component"
```

---

### Task 4: Integrate Card into `app/pages/emissions.vue`

**Files:**
- Modify: `app/pages/emissions.vue`

- [ ] **Step 1: Replace standalone Speed Reduction Advisory card with `<CiiImprovementPlanCard>`**
- [ ] **Step 2: Bind reactive `activeScenarioIndex` and support manual "Re-run AI Audit" action**
- [ ] **Step 3: Run `npm test` to verify full test suite passes**
- [ ] **Step 4: Commit**

```bash
git add app/pages/emissions.vue
git commit -m "feat: integrate CII Improvement Plan executive widget into emissions screen"
```

---

### Task 5: Full Regression Testing & Verification

- [ ] **Step 1: Run complete test suite (`npm test`)**
- [ ] **Step 2: Check git diff and verify clean code formatting**
