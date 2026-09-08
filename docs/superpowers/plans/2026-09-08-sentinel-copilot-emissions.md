# Sentinel Copilot Emissions & Reusable Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate full AI Copilot capabilities into the Emissions dashboard by creating a reusable Copilot panel component (`SentinelCopilotPanel.vue`), adding 2 dedicated read-only marine emissions tools to the LangChain AI agent (`get_vessel_cii_telemetry` and `simulate_vessel_speed_reduction`), and connecting the Emissions UI.

**Architecture:** 
A reusable UI panel component (`SentinelCopilotPanel.vue`) and composable (`useSentinelChat.ts`) encapsulate message history, auto-scroll, drawer/fullscreen modes, and action dispatching. The backend agent in `server/utils/sentinel/tools.ts` is equipped with two new marine tools leveraging existing CII calculation and telemetry engines, allowing the Copilot to audit vessel ratings and simulate speed reduction scenarios.

**Tech Stack:** Nuxt 4, Vue 3, Tailwind CSS v4, Lucide icons, LangChain (`@langchain/core`, `@langchain/openrouter`), Zod, Node test runner (`tsx --test`).

## Global Constraints
- Do NOT run `git commit` or `git push`. Keep all changes in the working tree uncommitted per user rule.
- Preserve SSR safety (`import.meta.server` safe; no localStorage during SSR).
- All AI tools remain strictly read-only; no database mutations or arbitrary execution.

---

### Task 1: Add Emissions AI Tools to Sentinel Agent

**Files:**
- Modify: `server/utils/sentinel/tools.ts`
- Modify: `server/utils/sentinel/prompts.ts`
- Test: `tests/sentinel-emissions-tools.test.ts`

**Interfaces:**
- Produces:
  - `get_vessel_cii_telemetry`: tool returning `{ vesselName, deadweight, year, attainedCii, requiredCii, attainedRating, marginPercent, totalCo2Mt, totalDistanceNm, totalTransportWork, euEtsCostEur, eeoi, fuelBreakdown }`
  - `simulate_vessel_speed_reduction`: tool returning `{ scenarios, recommendedScenario }`

- [ ] **Step 1: Write failing test for emissions tools**
Create `tests/sentinel-emissions-tools.test.ts` verifying that `createSentinelTools` provides `get_vessel_cii_telemetry` and `simulate_vessel_speed_reduction`, and both return structured JSON responses.

- [ ] **Step 2: Run test to confirm failure**
Run `npx tsx --test tests/sentinel-emissions-tools.test.ts` to confirm missing tools.

- [ ] **Step 3: Implement the two emissions tools in `server/utils/sentinel/tools.ts`**
Import `calculateTransportWork`, `calculateAttainedCII`, `getCIIRating`, `calculateSpeedReductionScenarios`, `calculateFuelTotals` from `../marine/cii-calculator`.
Implement `get_vessel_cii_telemetry` using cached telemetry or deterministic records.
Implement `simulate_vessel_speed_reduction` calling `calculateSpeedReductionScenarios` and computing the optimal scenario for target rating.
Export them in `createSentinelTools()`.

- [ ] **Step 4: Update system prompt in `server/utils/sentinel/prompts.ts`**
Add instructions for interpreting IMO CII grades (A–E), EEOI, and EU ETS liabilities (€65/MT) and recommending speed reductions.

- [ ] **Step 5: Run tests to ensure passing**
Run `npm test` to verify all tests pass.

---

### Task 2: Create Reusable Copilot Chat Composable and Panel Component

**Files:**
- Create: `app/composables/useSentinelChat.ts`
- Create: `app/components/sentinel/SentinelCopilotPanel.vue`
- Test: Build verification with `npm run build`

**Interfaces:**
- Produces:
  - `useSentinelChat(options)`: returns `{ messages, isProcessing, input, sendMessage, resetSession, applyAction }`
  - `SentinelCopilotPanel`: component taking `modelValue`, `title`, `subtitle`, `quickDirectives`, `activeContext` and emitting `update:modelValue` and `applyAction`.

- [ ] **Step 1: Create `app/composables/useSentinelChat.ts`**
Manages message state, call to `/api/sentinel/chat`, session reset, and error boundaries.

- [ ] **Step 2: Create `app/components/sentinel/SentinelCopilotPanel.vue`**
Build the panel supporting docked right-sidebar mode (`w-full sm:w-[440px] xl:w-[480px]`) and fullscreen mode (`fixed inset-0`).
Include header, action buttons (reset, fullscreen, close), message stream with `SentinelBlockRenderer`, page-specific quick prompt directives, and bottom input form.

- [ ] **Step 3: Verify TypeScript and bundle compile**
Verify component imports and types.

---

### Task 3: Integrate Sentinel Copilot into Emissions Dashboard

**Files:**
- Modify: `app/pages/emissions.vue`
- Test: Manual interaction test & test suite `npm test`

**Interfaces:**
- Consumes:
  - `SentinelCopilotPanel` from `app/components/sentinel/SentinelCopilotPanel.vue`
  - Active vessel state: `selectedVesselId`, `selectedYear`, `ciiData`

- [ ] **Step 1: Add AI Copilot header button**
In [`app/pages/emissions.vue`](file:///home/developer/Desktop/DAY%20TO%20DAY/ssh-dashboard-v3/app/pages/emissions.vue), add the `AI Copilot` button in the header toolbar next to `Export Audit Report`.

- [ ] **Step 2: Mount `<SentinelCopilotPanel>` in `app/pages/emissions.vue`**
Bind `v-model="isCopilotOpen"`.
Supply emissions quick directives:
1. "Audit current CII rating & IMO compliance margin"
2. "Simulate speed reduction to achieve Grade C compliance"
3. "Benchmark vessel against fleet average and peer sisters"
4. "Analyze fuel consumption breakdown and EU ETS carbon liability"
Pass `activeContext`: `{ vesselId, vesselName, year, attainedCii, rating, requiredCii }`.

- [ ] **Step 3: Wire action handler**
Implement `applyAgentAction(action)` so clicking a recommended speed scenario action in Copilot activates the corresponding speed reduction scenario tab on the page.

---

### Task 4: Verification & Regression Check

**Files:**
- Test: `npm test`
- Build: `npm run build`
- Git: `git status`

- [ ] **Step 1: Run full unit test suite**
Run `npm test` to confirm all 26+ tests pass.

- [ ] **Step 2: Run production build**
Run `npm run build` to confirm zero Nuxt/Nitro SSR errors.

- [ ] **Step 3: Verify Git working tree**
Run `git status` to ensure NO commits or tags were created.
