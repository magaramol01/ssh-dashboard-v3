# Voyage Analytics Agent End-to-End Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete suite of operational Voyage Performance LangChain tools for the Voyage Analytics agent in Sentinel Copilot, powered by a self-contained pure TypeScript maritime calculation engine on the Nuxt server.

**Architecture:** Pure TypeScript calculation modules in `server/utils/sentinel/agents/voyage/skills.ts` provide noon report normalization, apparent propeller slip, weather fuel/speed penalty, degradation root-cause diagnostics, and passage recovery optimization. Five modular LangChain tools (`voyage-overview`, `diagnose-degradation`, `propulsion-slip`, `weather-fuel-penalty`, and `voyage-recovery`) expose these capabilities with strict Zod schemas and bundle into `getVoyageTools()`.

**Tech Stack:** Nuxt 4 (server Nitro), LangChain Core (`@langchain/core/tools`), Zod (`zod`), Node.js `node:test` and `node:assert/strict`. Zero external Python runtime dependencies.

## Global Constraints

- No external Python dependencies: all calculations must be implemented in pure TypeScript.
- No client-side imports in `server/` code (keep server isolated).
- Preserve existing tools: `get_fleet_voyages`, `simulate_vessel_speed_reduction`, and `get_vessel_daily_positions`.
- Strict typing with zero TypeScript compilation errors.
- Every task must include dedicated unit tests using Node.js native test runner (`node:test`).

---

### Task 1: Maritime Calculation Engine in `skills.ts`

**Files:**
- Modify: `server/utils/sentinel/agents/voyage/skills.ts`
- Test: `tests/server/voyage-skills.test.ts`

**Interfaces:**
- Consumes: Raw noon report records from backend or mock telemetry.
- Produces:
  - `parseDmsCoordinate(dms: string): number`
  - `resolveCoordinate(value: unknown): number`
  - `greatCircleNm(lat1: number, lng1: number, lat2: number, lng2: number): number`
  - `calculateApparentSlip(sog: number, stwOrEngineSpeed: number): number`
  - `calculateWeatherFuelPenalty(meFuelMt: number, sog: number, windBf: number, waveHeightM: number, designSpeed?: number): { weatherFuelPenaltyMt: number; speedLossKts: number; weatherCo2PenaltyMt: number }`
  - `classifyDegradedDay(day: { rating: string; windBf: number; waveHeightM: number; slipPct: number; sog: number; rpm: number }): { primaryRootCause: string; causeAnalysis: string }`
  - `solveVoyageRecovery(params: { remainingDistanceNm: number; pastCo2Mt: number; pastDistanceNm: number; dwt: number; targetRating: 'A' | 'B' | 'C' | 'D'; boundaries: { superior_boundary: number; lower_boundary: number; upper_boundary: number; inferior_boundary: number }; baselineSpeedKts?: number; baselineRpm?: number; dailyFuelBaseMt?: number }): { isFeasible: boolean; recommendedSpeedKts: number; speedReductionPercent: number; recommendedRpm: number; dailyFuelLimitMt: number; remainingFuelBurnMt: number; fuelSavedMt: number; co2SavedMt: number; projectedFinalCii: number; projectedFinalRating: string; etaDelayHours: number }`

- [ ] **Step 1: Write the failing test for maritime calculations**

Create `tests/server/voyage-skills.test.ts`:
```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateApparentSlip,
  calculateWeatherFuelPenalty,
  classifyDegradedDay,
  solveVoyageRecovery,
} from '../../server/utils/sentinel/agents/voyage/skills'

test('calculateApparentSlip calculates apparent propeller slip percentage clamped accurately', () => {
  // STW = 14 kts, SOG = 12 kts -> (14 - 12) / 14 * 100 = 14.29%
  const slip = calculateApparentSlip(12, 14)
  assert.equal(slip, 14.3)

  // Zero STW returns 0
  assert.equal(calculateApparentSlip(12, 0), 0)

  // Extreme negative clamped to -5
  assert.equal(calculateApparentSlip(20, 10), -5)

  // Extreme positive clamped to 40
  assert.equal(calculateApparentSlip(5, 20), 40)
})

test('calculateWeatherFuelPenalty computes added fuel and speed loss in adverse conditions', () => {
  // Calm conditions: wind BF 3, wave 1.0m -> zero penalty
  const calm = calculateWeatherFuelPenalty(25.0, 14.0, 3, 1.0)
  assert.equal(calm.weatherFuelPenaltyMt, 0)
  assert.equal(calm.speedLossKts, 0)

  // Heavy weather: wind BF 7, wave 4.5m
  const rough = calculateWeatherFuelPenalty(25.0, 12.0, 7, 4.5)
  assert.ok(rough.weatherFuelPenaltyMt > 0)
  assert.ok(rough.speedLossKts > 0)
  assert.ok(rough.weatherCo2PenaltyMt > 0)
})

test('classifyDegradedDay identifies heavy weather, high slip, and engine overload causes', () => {
  // Heavy weather day
  const weatherDay = classifyDegradedDay({
    rating: 'E',
    windBf: 7,
    waveHeightM: 4.2,
    slipPct: 12.0,
    sog: 10.5,
    rpm: 85,
  })
  assert.equal(weatherDay.primaryRootCause, 'heavy_weather')

  // High slip day in calm weather
  const slipDay = classifyDegradedDay({
    rating: 'D',
    windBf: 3,
    waveHeightM: 1.2,
    slipPct: 18.5,
    sog: 11.0,
    rpm: 85,
  })
  assert.equal(slipDay.primaryRootCause, 'high_slip_resistance')
})

test('solveVoyageRecovery determines speed reduction and RPM adjustment for target rating', () => {
  const result = solveVoyageRecovery({
    remainingDistanceNm: 2000,
    pastCo2Mt: 800,
    pastDistanceNm: 2500,
    dwt: 65000,
    targetRating: 'B',
    boundaries: {
      superior_boundary: 3.42,
      lower_boundary: 4.65,
      upper_boundary: 5.92,
      inferior_boundary: 7.35,
    },
    baselineSpeedKts: 14.0,
    baselineRpm: 88,
    dailyFuelBaseMt: 26.0,
  })

  assert.ok(typeof result.isFeasible === 'boolean')
  assert.ok(result.recommendedSpeedKts <= 14.0)
  assert.ok(result.recommendedRpm <= 88)
  assert.ok(result.speedReductionPercent >= 0)
  assert.ok(['A', 'B'].includes(result.projectedFinalRating))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/server/voyage-skills.test.ts`
Expected: FAIL with missing exports in `skills.ts`.

- [ ] **Step 3: Implement calculation functions in `server/utils/sentinel/agents/voyage/skills.ts`**

Update `server/utils/sentinel/agents/voyage/skills.ts` with:
- `calculateApparentSlip(sog: number, stwOrEngineSpeed: number): number`
- `calculateWeatherFuelPenalty(meFuelMt: number, sog: number, windBf: number, waveHeightM: number, designSpeed = 14.0): { weatherFuelPenaltyMt: number; speedLossKts: number; weatherCo2PenaltyMt: number }`
- `classifyDegradedDay(...)`
- `solveVoyageRecovery(...)`
(preserving existing `parseDmsCoordinate`, `resolveCoordinate`, and `greatCircleNm`).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/server/voyage-skills.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/utils/sentinel/agents/voyage/skills.ts tests/server/voyage-skills.test.ts
git commit -m "feat(sentinel): add pure typescript maritime calculation engine in voyage skills"
```

---

### Task 2: Implement `get_voyage_overview_and_progress` Tool

**Files:**
- Create: `server/utils/sentinel/agents/voyage/tools/voyage-overview.ts`
- Test: `tests/server/voyage-overview-tool.test.ts`

**Interfaces:**
- Consumes: `backendFetch` (`/prod/api/v1/cii/voyage` or `/prod/api/v1/cii/date-range`), `getVesselTelemetry` (`server/utils/marine/read-model.ts`).
- Produces: `voyageOverviewTool(tenant?: string, event?: H3Event)` returning LangChain `tool` named `get_voyage_overview_and_progress`.

- [ ] **Step 1: Write the failing test for `voyage-overview.ts`**

Create `tests/server/voyage-overview-tool.test.ts`:
```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { voyageOverviewTool } from '../../server/utils/sentinel/agents/voyage/tools/voyage-overview'

test('voyageOverviewTool has correct name and schema', () => {
  const toolInstance = voyageOverviewTool()
  assert.equal(toolInstance.name, 'get_voyage_overview_and_progress')
  assert.ok(toolInstance.description.includes('operational summary'))
})

test('voyageOverviewTool executes and returns structured voyage overview', async () => {
  const toolInstance = voyageOverviewTool()
  const raw = await toolInstance.invoke({ vesselId: 1, year: 2026 })
  const result = JSON.parse(raw as string)

  assert.equal(result.vesselId, 1)
  assert.ok(result.vesselName)
  assert.ok(typeof result.totalDistanceNm === 'number')
  assert.ok(typeof result.distanceSailedNm === 'number')
  assert.ok(typeof result.distanceToGoNm === 'number')
  assert.ok(typeof result.progressPercent === 'number')
  assert.ok(result.fuelSummary)
  assert.ok(typeof result.fuelSummary.totalFuelMt === 'number')
  assert.ok(result.ciiSummary)
  assert.ok(['A', 'B', 'C', 'D', 'E'].includes(result.ciiSummary.rating))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/server/voyage-overview-tool.test.ts`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Implement `server/utils/sentinel/agents/voyage/tools/voyage-overview.ts`**

Implement `voyageOverviewTool` fetching active voyage records via `backendFetch` with fallback to vessel telemetry, calculating progress %, fuel breakdown (ME, AE, Boiler), and returning structured JSON.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/server/voyage-overview-tool.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/utils/sentinel/agents/voyage/tools/voyage-overview.ts tests/server/voyage-overview-tool.test.ts
git commit -m "feat(sentinel): implement get_voyage_overview_and_progress tool"
```

---

### Task 3: Implement `diagnose_voyage_degradation` Tool

**Files:**
- Create: `server/utils/sentinel/agents/voyage/tools/diagnose-degradation.ts`
- Test: `tests/server/diagnose-degradation-tool.test.ts`

**Interfaces:**
- Consumes: `backendFetch`, `classifyDegradedDay` and noon parsing from `skills.ts`.
- Produces: `diagnoseDegradationTool(tenant?: string, event?: H3Event)` returning LangChain `tool` named `diagnose_voyage_degradation`.

- [ ] **Step 1: Write the failing test for `diagnose-degradation.ts`**

Create `tests/server/diagnose-degradation-tool.test.ts`:
```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { diagnoseDegradationTool } from '../../server/utils/sentinel/agents/voyage/tools/diagnose-degradation'

test('diagnoseDegradationTool has correct name and schema', () => {
  const toolInstance = diagnoseDegradationTool()
  assert.equal(toolInstance.name, 'diagnose_voyage_degradation')
  assert.ok(toolInstance.description.includes('Band D or E'))
})

test('diagnoseDegradationTool diagnoses degraded days with root cause analysis', async () => {
  const toolInstance = diagnoseDegradationTool()
  const raw = await toolInstance.invoke({ vesselId: 1, year: 2026 })
  const result = JSON.parse(raw as string)

  assert.equal(result.vesselId, 1)
  assert.ok(typeof result.degradedDayCount === 'number')
  assert.ok(Array.isArray(result.degradedDays))
  assert.ok(typeof result.overallDiagnosis === 'string')

  if (result.degradedDays.length > 0) {
    const firstDegraded = result.degradedDays[0]
    assert.ok(firstDegraded.dayNumber)
    assert.ok(['D', 'E'].includes(firstDegraded.rating))
    assert.ok(firstDegraded.primaryRootCause)
    assert.ok(firstDegraded.causeAnalysis)
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/server/diagnose-degradation-tool.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `server/utils/sentinel/agents/voyage/tools/diagnose-degradation.ts`**

Implement `diagnoseDegradationTool`: fetches noon report logs, identifies days with rating 'D'/'E' or severe speed/fuel degradation, evaluates Beaufort wind force, wave height, slip %, and RPM, invokes `classifyDegradedDay`, and generates the overall diagnostic summary.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/server/diagnose-degradation-tool.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/utils/sentinel/agents/voyage/tools/diagnose-degradation.ts tests/server/diagnose-degradation-tool.test.ts
git commit -m "feat(sentinel): implement diagnose_voyage_degradation tool"
```

---

### Task 4: Implement `analyze_propulsion_and_slip` Tool

**Files:**
- Create: `server/utils/sentinel/agents/voyage/tools/propulsion-slip.ts`
- Test: `tests/server/propulsion-slip-tool.test.ts`

**Interfaces:**
- Consumes: `backendFetch`, `calculateApparentSlip` from `skills.ts`.
- Produces: `propulsionSlipTool(tenant?: string, event?: H3Event)` returning LangChain `tool` named `analyze_propulsion_and_slip`.

- [ ] **Step 1: Write the failing test for `propulsion-slip.ts`**

Create `tests/server/propulsion-slip-tool.test.ts`:
```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { propulsionSlipTool } from '../../server/utils/sentinel/agents/voyage/tools/propulsion-slip'

test('propulsionSlipTool has correct name and schema', () => {
  const toolInstance = propulsionSlipTool()
  assert.equal(toolInstance.name, 'analyze_propulsion_and_slip')
  assert.ok(toolInstance.description.includes('propeller slip'))
})

test('propulsionSlipTool returns propulsion metrics and slip analysis', async () => {
  const toolInstance = propulsionSlipTool()
  const raw = await toolInstance.invoke({ vesselId: 1, year: 2026 })
  const result = JSON.parse(raw as string)

  assert.equal(result.vesselId, 1)
  assert.ok(typeof result.averageRpm === 'number')
  assert.ok(typeof result.averageSog === 'number')
  assert.ok(typeof result.averageSlipPercent === 'number')
  assert.ok(['normal', 'elevated', 'critical'].includes(result.slipThresholdStatus))
  assert.ok(Array.isArray(result.propulsionTrend))
  assert.ok(result.findings)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/server/propulsion-slip-tool.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `server/utils/sentinel/agents/voyage/tools/propulsion-slip.ts`**

Implement `propulsionSlipTool`: extracts daily RPM, SOG, STW, and calculated slip %, flags high slip days, categorizes overall threshold (`normal` $\le 10\%$, `elevated` $10-15\%$, `critical` $>15\%$), and outputs operational insights.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/server/propulsion-slip-tool.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/utils/sentinel/agents/voyage/tools/propulsion-slip.ts tests/server/propulsion-slip-tool.test.ts
git commit -m "feat(sentinel): implement analyze_propulsion_and_slip tool"
```

---

### Task 5: Implement `evaluate_weather_impact_on_fuel` Tool

**Files:**
- Create: `server/utils/sentinel/agents/voyage/tools/weather-fuel-penalty.ts`
- Test: `tests/server/weather-fuel-penalty-tool.test.ts`

**Interfaces:**
- Consumes: `backendFetch`, `calculateWeatherFuelPenalty` from `skills.ts`.
- Produces: `weatherFuelPenaltyTool(tenant?: string, event?: H3Event)` returning LangChain `tool` named `evaluate_weather_impact_on_fuel`.

- [ ] **Step 1: Write the failing test for `weather-fuel-penalty.ts`**

Create `tests/server/weather-fuel-penalty-tool.test.ts`:
```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { weatherFuelPenaltyTool } from '../../server/utils/sentinel/agents/voyage/tools/weather-fuel-penalty'

test('weatherFuelPenaltyTool has correct name and schema', () => {
  const toolInstance = weatherFuelPenaltyTool()
  assert.equal(toolInstance.name, 'evaluate_weather_impact_on_fuel')
  assert.ok(toolInstance.description.includes('added fuel consumption'))
})

test('weatherFuelPenaltyTool returns calculated weather fuel and carbon penalties', async () => {
  const toolInstance = weatherFuelPenaltyTool()
  const raw = await toolInstance.invoke({ vesselId: 1, year: 2026 })
  const result = JSON.parse(raw as string)

  assert.equal(result.vesselId, 1)
  assert.ok(typeof result.totalVoyageFuelMt === 'number')
  assert.ok(typeof result.baselineCalmWaterFuelMt === 'number')
  assert.ok(typeof result.weatherFuelPenaltyMt === 'number')
  assert.ok(typeof result.weatherCo2PenaltyMt === 'number')
  assert.ok(typeof result.heavyWeatherDaysCount === 'number')
  assert.ok(typeof result.summary === 'string')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/server/weather-fuel-penalty-tool.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `server/utils/sentinel/agents/voyage/tools/weather-fuel-penalty.ts`**

Implement `weatherFuelPenaltyTool`: sums total fuel consumed, calculates calm-water baseline fuel using design speed and cubic relationship, calculates weather fuel delta (MT), resulting CO₂ penalty ($MT \times 3.114$), speed loss (kts), and highlights the worst weather day.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/server/weather-fuel-penalty-tool.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/utils/sentinel/agents/voyage/tools/weather-fuel-penalty.ts tests/server/weather-fuel-penalty-tool.test.ts
git commit -m "feat(sentinel): implement evaluate_weather_impact_on_fuel tool"
```

---

### Task 6: Implement `calculate_voyage_recovery_plan` Tool

**Files:**
- Create: `server/utils/sentinel/agents/voyage/tools/voyage-recovery.ts`
- Test: `tests/server/voyage-recovery-tool.test.ts`

**Interfaces:**
- Consumes: `solveVoyageRecovery` from `skills.ts`, `getVesselTelemetry` from emissions read-model.
- Produces: `voyageRecoveryTool(tenant?: string, event?: H3Event)` returning LangChain `tool` named `calculate_voyage_recovery_plan`.

- [ ] **Step 1: Write the failing test for `voyage-recovery.ts`**

Create `tests/server/voyage-recovery-tool.test.ts`:
```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { voyageRecoveryTool } from '../../server/utils/sentinel/agents/voyage/tools/voyage-recovery'

test('voyageRecoveryTool has correct name and schema', () => {
  const toolInstance = voyageRecoveryTool()
  assert.equal(toolInstance.name, 'calculate_voyage_recovery_plan')
  assert.ok(toolInstance.description.includes('recovery options'))
})

test('voyageRecoveryTool computes actionable recovery scenario for Band B', async () => {
  const toolInstance = voyageRecoveryTool()
  const raw = await toolInstance.invoke({ vesselId: 1, targetRating: 'B', year: 2026 })
  const result = JSON.parse(raw as string)

  assert.equal(result.vesselId, 1)
  assert.equal(result.targetRating, 'B')
  assert.ok(result.recommendedPlan)
  assert.ok(typeof result.recommendedPlan.recommendedSpeedKts === 'number')
  assert.ok(typeof result.recommendedPlan.recommendedRpm === 'number')
  assert.ok(typeof result.recommendedPlan.speedReductionPercent === 'number')
  assert.ok(typeof result.recommendedPlan.projectedFinalCii === 'number')
  assert.ok(Array.isArray(result.alternativeOptions))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/server/voyage-recovery-tool.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `server/utils/sentinel/agents/voyage/tools/voyage-recovery.ts`**

Implement `voyageRecoveryTool`: derives remaining distance to go and past transport work from voyage noon logs/telemetry, calls `solveVoyageRecovery`, builds alternative scenarios (-5%, -10%, -15%, -20%), and outputs recommended RPM, speed, ETA delay, and fuel savings.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/server/voyage-recovery-tool.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/utils/sentinel/agents/voyage/tools/voyage-recovery.ts tests/server/voyage-recovery-tool.test.ts
git commit -m "feat(sentinel): implement calculate_voyage_recovery_plan tool"
```

---

### Task 7: Tool Bundle Registration & Prompt Alignment

**Files:**
- Modify: `server/utils/sentinel/agents/voyage/tools/index.ts`
- Modify: `server/utils/sentinel/agents/voyage/prompt.ts`
- Test: `tests/server/voyage-tools-integration.test.ts`

**Interfaces:**
- Consumes: All 6 voyage tools.
- Produces: `getVoyageTools(tenant, event)` array with all 6 tools, updated `voyagePrompt` with tool routing rules.

- [ ] **Step 1: Write the failing integration test**

Create `tests/server/voyage-tools-integration.test.ts`:
```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { getVoyageTools } from '../../server/utils/sentinel/agents/voyage/tools'
import { voyagePrompt } from '../../server/utils/sentinel/agents/voyage/prompt'

test('getVoyageTools bundles all operational tools', () => {
  const tools = getVoyageTools()
  const names = tools.map((t) => t.name)

  assert.ok(names.includes('get_voyage_overview_and_progress'), 'overview tool present')
  assert.ok(names.includes('diagnose_voyage_degradation'), 'degradation diagnostic tool present')
  assert.ok(names.includes('analyze_propulsion_and_slip'), 'propulsion & slip tool present')
  assert.ok(names.includes('evaluate_weather_impact_on_fuel'), 'weather fuel penalty tool present')
  assert.ok(names.includes('calculate_voyage_recovery_plan'), 'recovery plan tool present')
  assert.ok(names.includes('get_vessel_daily_positions'), 'daily positions tool present')
  assert.ok(names.includes('get_fleet_voyages'), 'fleet voyages tool present')
  assert.ok(names.includes('simulate_vessel_speed_reduction'), 'speed simulation tool present')
})

test('voyagePrompt includes evidence rules for new operational tools', () => {
  assert.ok(voyagePrompt.includes('get_voyage_overview_and_progress'))
  assert.ok(voyagePrompt.includes('diagnose_voyage_degradation'))
  assert.ok(voyagePrompt.includes('analyze_propulsion_and_slip'))
  assert.ok(voyagePrompt.includes('evaluate_weather_impact_on_fuel'))
  assert.ok(voyagePrompt.includes('calculate_voyage_recovery_plan'))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/server/voyage-tools-integration.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `server/utils/sentinel/agents/voyage/tools/index.ts` and `server/utils/sentinel/agents/voyage/prompt.ts`**

Register the new tools in `getVoyageTools` and update `voyagePrompt` with explicit routing guidance for operators querying status, degradation, slip, weather impact, and recovery.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/server/voyage-tools-integration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/utils/sentinel/agents/voyage/tools/index.ts server/utils/sentinel/agents/voyage/prompt.ts tests/server/voyage-tools-integration.test.ts
git commit -m "feat(sentinel): bundle operational voyage tools and update voyage agent prompt"
```

---

### Task 8: Full Verification & Type Check

**Files:**
- Verification: Entire test suite and Nuxt build

- [ ] **Step 1: Run complete unit test suite**

Run: `node --test tests/server/voyage*.test.ts tests/sentinel*.test.ts`
Expected: All tests PASS.

- [ ] **Step 2: Build verification**

Run: `npm run build`
Expected: Exit code 0, production bundle built cleanly without TypeScript or bundler errors.

- [ ] **Step 3: Commit and summarize**

```bash
git commit --allow-empty -m "chore(sentinel): verify complete voyage analytics tool suite"
```
