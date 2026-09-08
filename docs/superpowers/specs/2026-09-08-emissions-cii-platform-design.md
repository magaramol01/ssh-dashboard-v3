# Emissions & IMO CII Compliance Platform Design Spec

**Date**: 2026-09-08  
**Topic**: Emissions & Carbon Intensity Indicator (CII) Platform Consolidation  
**Target Route**: `/emissions`  
**API Endpoint**: `GET /api/emissions/cii`

---

## 1. Executive Summary & Goals
The objective is to replace the legacy, multi-request React CII screen (`src/RTCM/screens/Emissions/CII_/index.jsx`) with a unified, high-performance Nuxt 4 server-driven emissions monitoring platform:
1. **Server Consolidation**: Shift heavy client-side mathematical calculations (CO2 summation, transport work, IMO boundary evaluations, speed reduction models, draft averages) to a single backend endpoint (`GET /api/emissions/cii`), reducing roundtrips from 5–6 to 1.
2. **Navigation Alignment**: Rename the legacy "Inbound" navigation item in `app/lib/nav.ts` to "Emissions" pointing to `/emissions`.
3. **Insight-Rich Dashboard**: Replace monolithic, raw-border HTML tables with an executive-level cockpit featuring IMO rating badges (A to E), compliance gauges, fuel mix cards, operational time ratios, an interactive speed reduction simulator, and monthly rolling trend charts.

---

## 2. Server Architecture (`GET /api/emissions/cii`)

### 2.1 Query Parameters
- `vesselId` (optional number / string, defaults to active fleet vessel)
- `year` (optional number, defaults to current calendar year)
- `startDate` (optional ISO date string, e.g. `YYYY-MM-DD`)
- `endDate` (optional ISO date string, e.g. `YYYY-MM-DD`)
- `voyageNumber` (optional string for filtering by specific voyage)
- `voyageType` (optional string: `'all'` | `'laden'` | `'ballast'`, default `'all'`)

### 2.2 Data Fetching & Upstream Adapters
- Server queries the upstream backend via `backendFetch`:
  - Upstream URL: `/prod/api/v1/cii/date-range` (or `/prod/api/v1/cii/voyage` when `voyageNumber` is provided)
  - Also fetches available voyages via `/prod/api/v1/voyages` (cached per vessel)
- In-memory standard IMO carbon factors ($C_F$):
  - **HFO**: 3.114
  - **VLSFO**: 3.150
  - **MGO / LSMGO / ULSGO**: 3.206
  - **LFO**: 3.115

### 2.3 Server-Side Business Logic & Math Formulas
1. **Transport Work**:
   $$\text{Transport Work} = \sum (\text{Distance (NM)} \times \text{Deadweight (MT)})$$
2. **Total Mass of CO2**:
   $$\text{Total CO2} = \sum_{\text{fuels}} (\text{Fuel Tonnage} \times C_F)$$
3. **Attained CII**:
   $$\text{Attained CII} = \frac{\text{Total CO2} \times 10^6}{\text{Transport Work}} \quad (\text{g CO}_2 / \text{MT}\cdot\text{NM})$$
4. **IMO Rating Classification (A to E)**:
   - Evaluated against IMO boundaries (`superior_boundary`, `lower_boundary`, `upper_boundary`, `inferior_boundary`):
     - $\le \text{superior}$: **Rating A** (Superior)
     - $(\text{superior}, \text{lower}]$: **Rating B** (Minor Superior)
     - $(\text{lower}, \text{upper}]$: **Rating C** (Moderate / Target)
     - $(\text{upper}, \text{inferior}]$: **Rating D** (Minor Inferior - Warning)
     - $> \text{inferior}$: **Rating E** (Inferior - Non-compliant)
5. **Speed & Fuel Reduction Simulation**:
   Calculates simulated attained CII for speed reductions:
   - $-5\%$ Speed: multiplier $0.85766$
   - $-10\%$ Speed: multiplier $0.77685$
   - $-15\%$ Speed: multiplier $0.61445$
   - $-20\%$ Speed: multiplier $0.51180$
   - $-25\%$ Speed: multiplier $0.42158$
6. **Operational Hours & Draft Breakdown**:
   - Total hours at sea vs total hours in port
   - Average forward draft and aft draft (mts)
   - Fuel consumed at sea vs fuel consumed in port (MT)

### 2.4 Unified Response Schema
```typescript
export interface EmissionsCiiResponse {
  vessel: {
    vesselId: number
    vesselName: string
    deadweight: number
    year: number
  }
  summary: {
    attainedCii: number
    attainedRating: 'A' | 'B' | 'C' | 'D' | 'E'
    requiredCii: number
    marginPercent: number
    boundaries: {
      superior: number
      lower: number
      upper: number
      inferior: number
    }
    totalCo2Mt: number
    totalTransportWork: number
    totalDistanceNm: number
    runningHoursAtSea: number
    runningHoursAtPort: number
    averageDraftFwdMts: number | null
    averageDraftAftMts: number | null
  }
  fuelBreakdown: Array<{
    fuelType: string
    fuelLabel: string
    coefficient: number
    seaMt: number
    portMt: number
    totalMt: number
    co2Mt: number
  }>
  speedReductionAdvisory: Array<{
    reductionPercent: number
    multiplier: number
    projectedCii: number
    projectedRating: 'A' | 'B' | 'C' | 'D' | 'E'
    co2SavingsMt: number
  }>
  monthlyTrend: Array<{
    month: string
    attainedCii: number | null
    rating: string | null
    co2Mt: number
    distanceNm: number
  }>
  availableVoyages: Array<{
    voyageNumber: string
    startPort: string
    destinationPort: string
    departureTime: string
    arrivalTime: string
  }>
}
```

---

## 3. Frontend UI Architecture (`app/pages/emissions.vue`)

### 3.1 Header Controls
- **Vessel Selector**: Select vessel from fleet.
- **Year Selector**: Range from 2017 to current year.
- **Filter Type Toggle**: "By Year / Date Range" vs "By Voyage".
- **Export Action**: Quick CSV / summary report download.

### 3.2 Visual Components & Cards
1. **Hero CII Compliance Card**:
   - Attained CII grade hero badge (A/B/C/D/E) with standard maritime compliance palette.
   - Gauge bar visualizing where the vessel currently sits between IMO boundary thresholds.
   - Status directive: Compliant / At-Risk / Non-Compliant.
2. **Operational KPI Grid (4 Tiles)**:
   - `Total CO2 Emissions`: Metric in Metric Tonnes + carbon intensity indicator.
   - `Transport Work Done`: Metric in MT·NM.
   - `Distance Sailed`: Nautical miles with sea-to-port running hours ratio.
   - `Vessel Trim & Draft`: Mean forward & aft draft in meters.
3. **Fuel Mix & Consumption Card**:
   - Breakdown of VLSFO, HFO, MGO, and LSMGO.
   - Tabular and visual split comparing At-Sea consumption vs At-Port auxiliary boiler/generator consumption.
4. **Interactive What-If Speed Reduction Advisor**:
   - Interactive slider or pill buttons (-5%, -10%, -15%, -20%, -25%).
   - Dynamic simulation feedback showing estimated tons of fuel saved, CO2 reduced, and whether the vessel can jump from Rating C to B or D to C.
5. **CII Chronological & Monthly Trend Chart**:
   - Client-only `<ClientOnly>` ECharts line chart plotting monthly attained CII alongside IMO boundary lines.

---

## 4. Sidebar Navigation Update
In `app/lib/nav.ts`:
```diff
- {
-   label: "Inbound",
-   items: [{ label: "Containers", to: "/containers", icon: "Ship", requires: "dispatcher" }],
- },
+ {
+   label: "Emissions",
+   items: [{ label: "CII Tracking", to: "/emissions", icon: "Gauge", requires: "dispatcher" }],
+ },
```

---

## 5. Verification & Testing
- Unit tests validating the calculation engine:
  - Transport work calculation.
  - Carbon factors & CO2 summation.
  - Rating boundary classification (A, B, C, D, E).
  - Speed reduction multiplier calculations.
- Endpoint test for `GET /api/emissions/cii`.
- `npm test` passing with 100% test coverage on calculations.
- `npm run build` compilation verification.
