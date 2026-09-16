# Voyage Optimization Specification & Design Document

- **Author**: Antigravity & Engineering Team
- **Date**: 2026-09-16
- **Status**: Validated Design (Approved)
- **Target Path**: `app/pages/voyage-optimization.vue`

---

## 1. Overview & Business Objectives

The **Voyage Optimization** screen sits under **Voyage Operations** in the navigation hierarchy of Smart Ship Hub. Its mission is to empower dispatchers, vessel operators, and chartering teams to track an active voyage in real time, monitor ongoing day-by-day Carbon Intensity Indicator (CII) progression directly on the passage map, observe noon report positions, and receive actionable meteorological and speed advisories to safeguard both environmental compliance and charter party commitments.

### Core Goals
1. **Map-Centric Operations ("Major of activities on the map")**: An immersive full-canvas Leaflet chart displaying active routes, traveled track, remaining passage, daily noon positions, day-by-day CII ratings, weather cells, and optimized corridor alternatives.
2. **Single-Vessel Selector**: One vessel selected at a time with instant switching across the fleet (mirroring `app/pages/dashboard.vue`).
3. **Daily Noon Reports & Day-by-Day CII**: Clear visual pins for every 24-hour noon report along the voyage corridor, color-coded with IMO CII ratings (A through E), showing daily fuel consumption, transport work, and cumulative metrics.
4. **Resilient Weather Forecast Service**: Integration with the National Weather Service API (`https://api.weather.gov/`) for maritime weather forecasts (wave height, swell height/direction, wind speed/direction, marine hazards), paired with an automatic maritime meteorological fallback for international/open-ocean coordinates outside NWS jurisdiction.
5. **Multi-Route Optimization & Advisories (Ref: VPM Services)**: Actionable advisories (speed reduction, heading shift) comparing the Current Track against Lowest-Fuel (Eco), Safest (Weather-Avoidance), and Fastest corridors, including impact on ETA, bunker consumption, and EU ETS costs.

---

## 2. Navigation & Routing Architecture

### 2.1 Navigation Registration
Added to `app/lib/nav.ts` within the `Voyage Operations` section:

```ts
{
  label: "Voyage Optimization",
  to: "/voyage-optimization",
  icon: "Sliders",
  requires: "dispatcher",
}
```

* Persona gating: `requires: "dispatcher"` (visible to `dispatcher` and `admin`).
* Tenant aware: fully compatible with `navForPersona(persona, tenant)`.

### 2.2 Page Meta & SSR Safety
* Route: `app/pages/voyage-optimization.vue`
* Page Middleware: `definePageMeta({ middleware: 'require-dispatcher' })`
* SSR Strategy:
  - Map components wrapped in `<ClientOnly>` with a graphite/slate skeleton placeholder.
  - State managed via composables (`useVoyageOptimization`, `useVesselDashboard`, `useTheme`).
  - No nondeterministic state or hydration mismatches.

---

## 3. UI/UX Component Hierarchy

```
app/pages/voyage-optimization.vue
 ├── VoyageOptimizationHeaderBar.vue
 │    ├── Vessel Selector (ASIA UNITY, PACIFIC VOYAGER, etc.)
 │    ├── Active Voyage Fixture Info (PECLL → CNNDE, Voyage #2604)
 │    ├── Route Strategy Switcher (Current / Lowest Fuel / Safest / Fastest)
 │    └── Refresh & Drawer Toggle
 │
 ├── VoyageOptimizationMap.vue (Hero Canvas - Full Height)
 │    ├── Leaflet Map Instance (Esri Dark/Light Gray base tiles)
 │    ├── Traveled Track Polyline (Solid route up to live position)
 │    ├── Remaining Route Corridor Polyline (Planned passage)
 │    ├── Alternative Optimized Corridors (Lowest Fuel - green dashed, Safest - cyan dashed, Fastest - purple dashed)
 │    ├── Daily Noon Report Markers (Interactive D1, D2..Dn pins with A/B/C/D/E CII badges)
 │    ├── Live Vessel Marker (Heading arrow, pulsing AIS ping, SOG label)
 │    ├── Weather Nodes (Wind barb/direction, wave height pills along waypoints)
 │    └── Floating Map Controls (Layer toggle, zoom reset, corridor bounds fit)
 │
 ├── VoyageOptimizationKpiHud.vue (Top Floating Translucent HUD)
 │    ├── Tile 1: CII Trajectory (Current Band vs Target Band & Margin %)
 │    ├── Tile 2: Speed Advisory (Recommended SOG, ME RPM & Daily Fuel Savings)
 │    ├── Tile 3: Weather Alert (Adverse Swell / Beaufort warning on upcoming legs)
 │    ├── Tile 4: ETA & Laycan Buffer (Arrival buffer hours vs Charter Party window)
 │    └── Tile 5: Emission & Financial Impact (Projected CO2 delta & EU ETS cost savings)
 │
 └── VoyageOptimizationDrawer.vue (Slide-Out Right Inspection Panel)
      ├── Tab 1: Daily Noon Log (Active Day metrics: fuel breakdown, draft, transport work, weather)
      └── Tab 2: Strategy Comparison & Dispatch Advisories (Side-by-side route matrix & checklist actions)
```

---

## 4. Map & Visual Interaction Design

### 4.1 Day-by-Day CII Markers
Each 24-hour noon report coordinate along the traveled route is decorated with a custom Leaflet `divIcon`:
- Circular badge with day identifier (`D1`, `D2`, `D3`, `D4`...).
- Colored pill indicating attained CII rating for that 24h period:
  - **Band A**: `#10b981` (Emerald)
  - **Band B**: `#14b8a6` (Teal)
  - **Band C**: `#f59e0b` (Amber)
  - **Band D**: `#f97316` (Orange)
  - **Band E**: `#ef4444` (Rose/Red)
- **Click Behavior**: Highlights the corresponding leg on the polyline, pans the map, and opens the **Daily Inspection Drawer** for that specific day.

### 4.2 Route Strategy Corridors (VPM Optimization Reference)
Derived from the algorithms in `/vpm/voyagepm_be/services`:
1. **Current Active Route**: Follows master passage plan.
2. **Lowest Fuel (Eco)**: Adjusts speed dynamically by leg to minimize cubic power curve fuel burn (savings: 4% to 8% total bunker, elevates CII rating).
3. **Safest (Weather-Avoidance)**: Diverts around sea areas exceeding wave height > 3.0m or Beaufort > 6 to eliminate slamming, roll, and cargo lash strain.
4. **Fastest Route**: Max continuous rating speed on shortest nautical distance.

Dispatchers can toggle each corridor visibility using the floating map layer widget.

---

## 5. Weather Forecast Engine (`https://api.weather.gov/` + Marine Fallback)

### 5.1 Endpoint Specification: `GET /api/weather/forecast`
* **Query Parameters**:
  - `lat`: number (e.g. `33.74`)
  - `lng`: number (e.g. `-118.27`)
* **Headers**: Custom `User-Agent: (SmartShipHubVoyageOptimizer, ops@smartshiphub.com)` as required by NWS RFC.

### 5.2 Two-Tier Query & Fallback Logic
1. Request `https://api.weather.gov/points/{lat},{lng}`.
2. **If HTTP 200**:
   - Fetch `forecastGridData` (`/gridpoints/{wfo}/{x},{y}`) to extract exact quantitative parameters:
     - `waveHeight` (converted to meters)
     - `primarySwellHeight` & `primarySwellDirection`
     - `windSpeed` (converted from km/h to knots) & `windDirection` (degrees)
     - `wavePeriod` (seconds)
     - `hazards` (Gale Warning, Small Craft Advisory, etc.)
   - Fetch `/forecast` to extract `shortForecast`, `detailedForecast`, and NWS condition `icon`.
3. **If HTTP 404 (InvalidPoint - outside US/coastal coverage) or network failure**:
   - Seamlessly activate the **Maritime Meteorological Fallback**:
     - Computes deterministic weather state based on latitude, season, and vessel telemetry (Beaufort force 2-6, wave height 0.8m - 3.2m, swell direction, current speed).
     - Response structure is identical to NWS parsed response, ensuring the UI remains 100% robust for international waters (e.g. South Pacific, Indian Ocean, North Sea).
4. **In-Memory Cache**: 15-minute TTL keyed on `lat_lng` to respect rate limits and eliminate duplicate upstream calls.

---

## 6. Advisory Engine & Formulas

### 6.1 Carbon Intensity Indicator (IMO MEPC.336/337/338)
* **Transport Work**:
  $$\text{Transport Work} = \text{Distance Run (NM)} \times \text{Deadweight (MT)}$$
* **Attained CII**:
  $$\text{Attained CII} = \frac{\text{Total } \text{CO}_2 \text{ Mass (MT)} \times 10^6}{\text{Transport Work}}$$
* **Daily Progression**:
  Evaluated cumulatively at each noon report:
  $$\text{Cumulative CII}_n = \frac{\sum_{i=1}^n \text{CO}_{2,i} \times 10^6}{\sum_{i=1}^n (\text{Distance}_i \times \text{DWT})}$$

### 6.2 Speed & Power Advisory Model
* Implements the cubic fuel power law:
  $$\text{Fuel Rate}(V) \propto V^3$$
* Speed reduction advisory calculates recommended speed $V_{\text{target}}$ to move from current Band (e.g., C) to target Band (e.g., B):
  $$\Delta \text{Fuel} = \text{Base Fuel} \times \left(1 - \left(\frac{V_{\text{target}}}{V_{\text{current}}}\right)^3\right)$$
* Calculates arrival time buffer impact:
  $$\Delta t = \frac{D_{\text{remaining}}}{V_{\text{target}}} - \frac{D_{\text{remaining}}}{V_{\text{current}}}$$

---

## 7. Data Models & TypeScript Interfaces

```ts
export interface DailyNoonReport {
  dayNumber: number
  dateIso: string
  dateFormatted: string
  coords: [number, number]
  distanceRunNm: number
  cumulativeDistanceNm: number
  sog: number
  fuelConsumedMt: {
    vlsfo: number
    mgo: number
    total: number
  }
  cumulativeFuelMt: number
  totalCo2Mt: number
  transportWork: number
  attainedCii: number
  rating: 'A' | 'B' | 'C' | 'D' | 'E'
  draftFwdM: number
  draftAftM: number
  weather: {
    beaufort: number
    windSpeedKts: number
    windDirectionDeg: number
    waveHeightM: number
    swellDirection: string
    shortForecast: string
    source: 'nws-api' | 'marine-telemetry'
  }
}

export interface RouteStrategyOption {
  id: 'current' | 'lowest-fuel' | 'safest' | 'fastest'
  name: string
  distanceNm: number
  etaIso: string
  etaFormatted: string
  avgSpeedKts: number
  totalFuelMt: number
  projectedCii: number
  projectedRating: 'A' | 'B' | 'C' | 'D' | 'E'
  fuelSavingsMt: number
  carbonSavingsEur: number
  colorHex: string
  waypoints: [number, number][]
}

export interface VoyageAdvisory {
  id: string
  type: 'speed' | 'weather' | 'cii' | 'laycan'
  priority: 'critical' | 'warning' | 'info'
  title: string
  description: string
  actionLabel?: string
  applied: boolean
}
```

---

## 8. Verification & Test Plan

1. **Automated Unit Tests**:
   - `tests/marine/cii-voyage.test.ts`: Verify cumulative CII calculations across multi-day noon reports, edge cases (zero transport work, boundary transitions).
   - `tests/weather/weather-service.test.ts`: Verify `api.weather.gov` parser, conversion of WMO units, and graceful fallback when receiving 404 or simulated out-of-bounds coordinates.
2. **Typecheck & Build**:
   - `npx nuxi typecheck` to ensure no typing discrepancies.
   - `npm run build` to ensure zero SSR hydration issues and smooth production bundle generation.
3. **Interactive Visual Verification**:
   - Verify vessel selection switching reloads active route and noon reports.
   - Verify map marker click interaction opens daily drawer with correct telemetry.
   - Verify route strategy toggle alters corridor polylines and updates floating HUD metrics.
