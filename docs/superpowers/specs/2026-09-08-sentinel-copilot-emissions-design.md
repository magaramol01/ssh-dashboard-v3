# Design: Reusable Sentinel Copilot Panel & Emissions AI Tools

**Date**: 2026-09-08  
**Status**: APPROVED  
**Category**: Architecture & Features  

## 1. Overview
This design introduces a reusable Sentinel Copilot component (`SentinelCopilotPanel.vue`) and composable (`useSentinelChat.ts`), and equips the LangChain AI agent with two dedicated marine emissions/CII tools. This allows operators to perform AI-driven carbon audits, speed reduction simulations, and peer benchmarking directly from the Emissions dashboard.

---

## 2. Architecture & Components

### 2.1 Reusable UI Component: `app/components/sentinel/SentinelCopilotPanel.vue`
Extracts common drawer/workbench UI from `control-tower.vue` and `live.vue` into a reusable component:
- **Props**:
  - `modelValue`: `boolean` (drawer open/closed state)
  - `title`: `string` (defaults to `"Fleet Operations Copilot"`)
  - `subtitle`: `string` (defaults to `"AI Marine Intelligence"`)
  - `quickDirectives`: `Array<{ label: string; prompt: string }>` (context-specific quick prompts)
  - `activeContext`: `Record<string, any>` (e.g., vesselId, year, attainedCii)
- **Emits**:
  - `update:modelValue`: `(open: boolean) => void`
  - `applyAction`: `(action: SentinelAction) => void`
- **Features**:
  - Docked right sidebar mode (`w-full sm:w-[440px] xl:w-[480px]`) and fullscreen mode.
  - Multi-block response rendering using `SentinelBlockRenderer.vue` (Markdown, KPI cards, interactive Line/Bar charts, and Data tables).
  - Session reset, chat history, loading indicators, and auto-scroll.

### 2.2 Chat Composable: `app/composables/useSentinelChat.ts`
- Manages `messages`, `isProcessing`, `input`, and `activeContext`.
- Handles `sendMessage(content, context)` via `$fetch<SentinelChatResponse>('/api/sentinel/chat')`.
- Handles error boundaries and fallback messages.

---

## 3. Backend AI Tools

### 3.1 `get_vessel_cii_telemetry` (`server/utils/sentinel/tools.ts`)
- **Schema**: `{ vesselId: number, year?: number }`
- **Behavior**: Retrieves official telemetry or cached records for the specified vessel.
- **Returns**:
  - `vesselName`, `deadweight`, `year`
  - `attainedCii`, `requiredCii`, `attainedRating`, `marginPercent`
  - `boundaries`: Superior, Lower, Upper, Inferior thresholds
  - `totalCo2Mt`, `totalDistanceNm`, `totalTransportWork`
  - `euEtsCostEur`, `eeoi`
  - `fuelBreakdown`: VLSFO, MGO, and other fuels

### 3.2 `simulate_vessel_speed_reduction` (`server/utils/sentinel/tools.ts`)
- **Schema**: `{ vesselId: number, year?: number, targetRating?: 'A' | 'B' | 'C' | 'D' }`
- **Behavior**: Applies hydrodynamic cubic power laws to simulate -5% through -25% speed reductions.
- **Returns**:
  - Scenarios array with: `speedKnots`, `projectedCii`, `projectedRating`, `co2SavingsMt`, `fuelCostSavingsEur`
  - `recommendedScenario`: The optimal minimal speed reduction required to hit the target rating.

### 3.3 System Prompt Extension (`server/utils/sentinel/prompts.ts`)
- Instructs Sentinel on how to interpret IMO CII grades (A through E), MEPC reference lines, EU ETS liabilities (€65/MT), and speed advisory recommendations.

---

## 4. Emissions Page Integration (`app/pages/emissions.vue`)
- Top action bar button with `<Sparkles />` icon triggering `isCopilotOpen = true`.
- Mounts `<SentinelCopilotPanel>` passing current `selectedVesselId`, `selectedYear`, and emissions KPIs.
- 4 quick directives:
  1. "Audit current CII rating & IMO compliance margin"
  2. "Simulate speed reduction to achieve Grade C compliance"
  3. "Benchmark vessel against fleet average and peer sisters"
  4. "Analyze fuel consumption breakdown and EU ETS carbon liability"
- Action dispatcher: Clicking a speed scenario action in Copilot switches the active scenario tab on the page.

---

## 5. Verification & Testing
- Unit tests for new Sentinel tools in `tests/sentinel.test.ts`.
- Regression test across all 26 existing tests (`npm test`).
- Production build verification (`npm run build`).
- **Constraint Check**: No changes committed to Git.
