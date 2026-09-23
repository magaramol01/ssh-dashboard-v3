# Design: End-to-End Voyage Performance Tools for Voyage Analytics Agent

## 1. Problem Statement & Operational Context

The Voyage Analytics agent in Sentinel Copilot currently provides high-level speed simulation and raw daily coordinates, but lacks deep operational diagnostic tools to answer real maritime questions about what is actually happening on a vessel's active voyage.

When operators and dispatchers monitor an active voyage, their core questions are:
1. **What is the current operational status of the voyage?** (Distance sailed vs to-go, overall fuel burn, current day, cumulative CII and rating band).
2. **Why did performance or CII degrade on specific days?** (Root-cause diagnosis attributing rating drops to heavy weather, excessive propeller slip, speed loss, or engine load issues).
3. **How is the propulsion system behaving?** (RPM vs speed over ground, apparent propeller slip percentage, and sea trial baseline deviation).
4. **What was the weather impact on fuel consumption?** (Quantifying added metric tonnes of fuel burned and CO₂ emitted due to adverse wind and sea conditions encountered during the voyage).
5. **How can the vessel recover a compliant rating for the rest of the voyage?** (Calculated speed and RPM adjustment recommendations across the remaining distance to go to hit Band B or C with ETA impact).

This design defines the end-to-end tool suite for the Voyage Analytics agent implemented with a pure TypeScript maritime calculation engine on the Nuxt server, requiring zero external Python runtime dependencies.

---

## 2. System Architecture & Components

```
                          ┌─────────────────────────────────────┐
                          │   Sentinel Copilot Chat Runtime     │
                          │   (server/api/sentinel/chat.post)   │
                          └──────────────────┬──────────────────┘
                                             │
                                             ▼
                          ┌─────────────────────────────────────┐
                          │  Agent Router: 'voyage-analytics'   │
                          │  (server/utils/sentinel/core)       │
                          └──────────────────┬──────────────────┘
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
┌───────────────────────────────────────────────┐ ┌───────────────────────────────────────────────┐
│              Diagnostic Tools                 │ │              Forward Recovery Tools           │
├───────────────────────────────────────────────┤ ├───────────────────────────────────────────────┤
│ • get_voyage_overview_and_progress            │ │ • calculate_voyage_recovery_plan              │
│ • diagnose_voyage_degradation                 │ │ • simulate_vessel_speed_reduction (existing)  │
│ • analyze_propulsion_and_slip                 │ └───────────────────────────────────────────────┘
│ • evaluate_weather_impact_on_fuel             │
│ • get_vessel_daily_positions (existing)       │
│ • get_fleet_voyages (existing)                │
└──────────────────────┬────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Pure TypeScript Maritime Calculation Engine (server/utils/sentinel/agents/voyage/skills.ts)     │
│ • Noon data normalizer & chronologist (extracts SOG, STW, RPM, ME/AE fuel, wind BF, sea state)  │
│ • Apparent Propeller Slip: ((STW - SOG) / STW) * 100 or ((Pitch * RPM * 60 - SOG*1852) / ...)   │
│ • Weather fuel penalty calculator: quadratic/cubic wind-wave resistance vs calm baseline        │
│ • Degradation root-cause classifier (weather vs slip vs engine speed vs load)                   │
│ • Passage recovery solver: remaining distance work & speed/RPM adjustment for target CII grade  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Tool Specifications & Schemas

### Tool 1: `get_voyage_overview_and_progress`
* **File**: `server/utils/sentinel/agents/voyage/tools/voyage-overview.ts`
* **Name**: `get_voyage_overview_and_progress`
* **Description**: "Get the comprehensive operational summary of a vessel's active voyage, including departure and destination ports, total voyage distance, distance sailed, distance to go, percentage completed, current voyage day count (D1..Dn), cumulative fuel consumption (ME, AE, Boiler in MT), and current Attained CII and IMO rating band (A-E). Use this to answer what is happening overall on the voyage or check voyage progress."
* **Input Schema (Zod)**:
  ```ts
  z.object({
    vesselId: z.number().int().positive(),
    voyageNumber: z.string().trim().max(60).optional(),
    year: z.number().int().optional(),
  })
  ```
* **Output Payload**:
  - `vesselId`, `vesselName`, `voyageNumber`
  - `departurePort`, `destinationPort`, `departureDate`, `etaDate`
  - `totalDistanceNm`, `distanceSailedNm`, `distanceToGoNm`, `progressPercent`
  - `totalDays`, `currentDayNumber`
  - `fuelSummary`: `meFuelMt`, `aeFuelMt`, `boilerFuelMt`, `totalFuelMt`
  - `ciiSummary`: `attainedCii`, `requiredCii`, `rating`, `ratingDescription`
  - `averageSogKnots`

---

### Tool 2: `diagnose_voyage_degradation`
* **File**: `server/utils/sentinel/agents/voyage/tools/diagnose-degradation.ts`
* **Name**: `diagnose_voyage_degradation`
* **Description**: "Diagnose days on the voyage where performance or CII rating degraded to Band D or E, or where severe speed loss / excessive fuel consumption occurred. Isolates and explains root causes: heavy weather resistance (Beaufort force/seas), high propeller slip (>15%), or engine RPM mismatch. Use this whenever the operator asks why rating dropped, what caused degradation, or asks to investigate poor voyage days."
* **Input Schema (Zod)**:
  ```ts
  z.object({
    vesselId: z.number().int().positive(),
    voyageNumber: z.string().trim().max(60).optional(),
    targetDayNumber: z.number().int().positive().optional(),
    year: z.number().int().optional(),
  })
  ```
* **Output Payload**:
  - `degradedDayCount`, `totalVoyageDays`
  - `degradedDays`: Array of:
    - `dayNumber`, `dateIso`, `rating`, `dailyCii`, `sog`, `stw`, `rpm`
    - `windForceBf`, `waveHeightM`, `seaState`
    - `slipPercent`, `fuelConsumptionMt`
    - `primaryRootCause`: `'heavy_weather' | 'high_slip_resistance' | 'engine_overload' | 'operational_speed_loss'`
    - `causeAnalysis`: String explanation of the degradation factors for that day
  - `overallDiagnosis`: Executive summary of the primary degradation drivers across the entire passage.

---

### Tool 3: `analyze_propulsion_and_slip`
* **File**: `server/utils/sentinel/agents/voyage/tools/propulsion-slip.ts`
* **Name**: `analyze_propulsion_and_slip`
* **Description**: "Analyze the vessel's propulsion efficiency, engine RPM, speed over ground (SOG) vs engine speed through water (STW), and apparent propeller slip percentage across the voyage days. Identifies hydrodynamic resistance anomalies, engine strain, or potential hull fouling indicators. Use this when the operator asks about propeller slip, engine RPM trends, or propulsion efficiency."
* **Input Schema (Zod)**:
  ```ts
  z.object({
    vesselId: z.number().int().positive(),
    voyageNumber: z.string().trim().max(60).optional(),
    year: z.number().int().optional(),
  })
  ```
* **Output Payload**:
  - `averageRpm`, `averageSog`, `averageStw`
  - `averageSlipPercent`, `maxSlipDay`: `{ dayNumber, slipPercent, windBf }`
  - `slipThresholdStatus`: `'normal' (slip <= 10%) | 'elevated' (10-15%) | 'critical' (> 15%)`
  - `propulsionTrend`: Array of `{ dayNumber, rpm, sog, stw, slipPercent, meConsumptionMt }`
  - `findings`: Key observations on propulsion efficiency and propeller-hull interaction.

---

### Tool 4: `evaluate_weather_impact_on_fuel`
* **File**: `server/utils/sentinel/agents/voyage/tools/weather-fuel-penalty.ts`
* **Name**: `evaluate_weather_impact_on_fuel`
* **Description**: "Evaluate the added fuel consumption (metric tonnes) and carbon emissions penalty incurred due to adverse weather and sea states experienced along the voyage. Compares actual fuel burn against calm-water baseline consumption using observed Beaufort wind scales, wave states, and speed loss. Use this whenever the operator asks about weather impact on fuel, carbon penalty from weather, or fuel lost to bad weather."
* **Input Schema (Zod)**:
  ```ts
  z.object({
    vesselId: z.number().int().positive(),
    voyageNumber: z.string().trim().max(60).optional(),
    year: z.number().int().optional(),
  })
  ```
* **Output Payload**:
  - `totalVoyageFuelMt`, `baselineCalmWaterFuelMt`
  - `weatherFuelPenaltyMt` (extra fuel burned due to adverse MetOcean conditions)
  - `weatherFuelPenaltyPercent` (percentage of fuel attributed to weather resistance)
  - `weatherCo2PenaltyMt` (metric tonnes of CO₂ directly attributable to weather penalty)
  - `averageSpeedLossKnots` (average knots lost to wind and wave resistance)
  - `heavyWeatherDaysCount` (days with Beaufort force >= 6 or wave height >= 3.0m)
  - `worstWeatherDay`: `{ dayNumber, windBf, waveHeightM, addedFuelMt, speedLossKts }`
  - `summary`: Clear operational narrative summarizing total fuel penalty and carbon cost.

---

### Tool 5: `calculate_voyage_recovery_plan`
* **File**: `server/utils/sentinel/agents/voyage/tools/voyage-recovery.ts`
* **Name**: `calculate_voyage_recovery_plan`
* **Description**: "Calculate actionable operational recovery options for the remaining passage to recover or maintain IMO Band B or C. Computes required speed over ground, recommended engine RPM, daily fuel consumption limits, projected final voyage CII score, and ETA impact across the remaining distance to go. Use this whenever the operator asks how to recover Band B, how to fix the voyage CII, or what speed/RPM to steam for the rest of the voyage."
* **Input Schema (Zod)**:
  ```ts
  z.object({
    vesselId: z.number().int().positive(),
    targetRating: z.enum(['A', 'B', 'C', 'D']).default('B'),
    voyageNumber: z.string().trim().max(60).optional(),
    year: z.number().int().optional(),
  })
  ```
* **Output Payload**:
  - `currentStatus`: `{ distanceToGoNm, currentAttainedCii, currentRating, baselineSpeedKts, baselineRpm }`
  - `targetRating`: Target IMO Band (e.g. 'B')
  - `isRecoveryFeasible`: Boolean
  - `recommendedPlan`:
    - `recommendedSpeedKts`, `speedReductionPercent`
    - `recommendedRpm`, `dailyFuelLimitMt`
    - `remainingFuelBurnMt`, `fuelSavedMt`, `co2SavedMt`
    - `projectedFinalCii`, `projectedFinalRating`
    - `etaDelayHours`, `recommendedActionSummary`
  - `alternativeOptions`: Array of candidate scenarios (-5%, -10%, -15%, -20%) with speed, RPM, ETA impact, and projected ratings.

---

## 4. Pure TypeScript Maritime Calculation Engine

In `server/utils/sentinel/agents/voyage/skills.ts`:

### A. Noon Report Normalization
Extracts and harmonizes the per-day noon report sequence from `/prod/api/v1/cii/voyage` or `/prod/api/v1/cii/date-range` or mock fallback:
- Filter port reports: keep genuine at-sea noon fixes.
- Chronologically sort days: $D_1 \dots D_n$.
- Extract: SOG, STW, RPM, ME fuel (MT), AE fuel (MT), Boiler fuel (MT), distance run (NM), Beaufort wind force, wave height (m), swell direction, daily and cumulative Attained CII.

### B. Apparent Propeller Slip Calculation
$$\text{Slip (\%)} = \frac{V_{\text{engine}} - V_{\text{observed}}}{V_{\text{engine}}} \times 100$$
Where:
- $V_{\text{observed}}$ is the Speed Over Ground (SOG) in knots.
- $V_{\text{engine}}$ is Speed Through Water (STW) or derived from Propeller Pitch and RPM:
  $$V_{\text{engine}} = \frac{\text{RPM} \times \text{Pitch (m)} \times 60}{1852}$$
- When pitch is not explicitly provisioned in telemetry, apparent slip is calculated directly from STW vs SOG:
  $$\text{Slip (\%)} = \frac{\text{STW} - \text{SOG}}{\text{STW}} \times 100$$
- Safe hydrodynamic clamping prevents nonsensical negative or infinite slip values (clamped between -5% and 40%).

### C. Weather Fuel Penalty & Speed Loss Estimation
- Uses standard maritime hydrodynamic resistance models (Admiralty coefficient and ISO 15016 weather power corrections):
  $$\Delta P_{\text{weather}} = P_{\text{baseline}} \times \left( k_{\text{wind}} \cdot (\text{BF} - 3)^2 + k_{\text{wave}} \cdot H_s^2 \right) \quad \text{for } \text{BF} > 3$$
- Speed loss in knots:
  $$\Delta V = V_{\text{calm}} \times \left(1 - \sqrt[3]{\frac{P_{\text{calm}}}{P_{\text{calm}} + \Delta P_{\text{weather}}}}\right)$$
- Fuel penalty in MT:
  $$\Delta \text{Fuel} = \text{Actual ME Fuel} - \text{Calm Baseline Fuel}$$
  where calm baseline fuel is computed via the cubic speed-power relationship:
  $$\text{Fuel}_{\text{calm}} = \text{Fuel}_{\text{design}} \times \left(\frac{\text{SOG}}{V_{\text{design}}}\right)^3$$

### D. Degradation Classification Logic
For any day where rating is 'D' or 'E' or daily CII $> \text{Required CII} \times 1.15$:
1. If $\text{Beaufort} \ge 6$ or $\text{WaveHeight} \ge 3.0\text{m}$: Classified as `'heavy_weather'`.
2. If $\text{Slip} > 15\%$ and $\text{Beaufort} < 6$: Classified as `'high_slip_resistance'`.
3. If $\text{RPM}$ is normal but $\text{SOG}$ dropped significantly without weather: Classified as `'operational_speed_loss'`.
4. Otherwise: Classified as `'engine_overload'`.

### E. Recovery Plan Solver
Over remaining distance $D_{\text{rem}}$:
1. Determine required total transport work and allowable total $\text{CO}_2$ emissions to achieve Target CII boundary:
   $$\text{Attained CII}_{\text{final}} = \frac{\text{CO}_{2,\text{past}} + \text{CO}_{2,\text{remaining}}}{\text{Capacity} \times (D_{\text{past}} + D_{\text{rem}})} \le \text{Boundary}(\text{Target})$$
2. Solve for maximum allowable $\text{CO}_{2,\text{remaining}}$:
   $$\text{CO}_{2,\text{remaining}}^{\text{max}} = \text{Boundary}(\text{Target}) \times \text{Capacity} \times (D_{\text{past}} + D_{\text{rem}}) - \text{CO}_{2,\text{past}}$$
3. If allowable remaining $\text{CO}_2 < 0$, mark recovery as physically infeasible for this single passage, and calculate closest achievable grade.
4. Calculate required speed $V_{\text{rec}}$ and proportional engine RPM adjustment using the cubic fuel law:
   $$\text{Fuel}_{\text{rem}} = \text{Fuel}_{\text{daily,base}} \times \left(\frac{V_{\text{rec}}}{V_{\text{base}}}\right)^3 \times \frac{D_{\text{rem}}}{24 \times V_{\text{rec}}}$$
5. Compute ETA delay:
   $$\Delta t = \frac{D_{\text{rem}}}{V_{\text{rec}}} - \frac{D_{\text{rem}}}{V_{\text{base}}}$$

---

## 5. Agent Prompt & Router Integration

1. Update `server/utils/sentinel/agents/voyage/prompt.ts`:
   - Instruct the LLM on which tool to invoke for specific operational inquiries:
     - Overview / progress queries $\to$ `get_voyage_overview_and_progress`
     - Rating drop / degradation / bad days $\to$ `diagnose_voyage_degradation`
     - RPM / slip / propulsion efficiency $\to$ `analyze_propulsion_and_slip`
     - Weather impact / fuel penalty / carbon penalty $\to$ `evaluate_weather_impact_on_fuel`
     - Recovery / speed reduction / Band B recovery $\to$ `calculate_voyage_recovery_plan`
     - GPS coordinates / missing distance gap $\to$ `get_vessel_daily_positions`
2. Update `server/utils/sentinel/agents/voyage/tools/index.ts`:
   - Export all 6 tools bundled via `getVoyageTools(tenant, event)`.

---

## 6. Testing & Verification Strategy

1. **Unit Tests** (`tests/server/voyage-analytics-tools.test.ts`):
   - Test apparent slip calculation with positive, zero, and boundary inputs.
   - Test weather fuel penalty and speed loss calculations against known baseline parameters.
   - Test degradation classification logic with synthetic heavy-weather, high-slip, and normal days.
   - Test recovery plan solver: verify speed reduction percentage, ETA delay, and CII target achievement.
   - Test all tool executors with mock noon reports to verify schema conformance and JSON output integrity.
2. **Build Verification**:
   - `npm run build` or `npx nuxi typecheck` to ensure zero TypeScript errors.
   - `npm test` to verify complete test suite passes.
