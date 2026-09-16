# Sensor Telemetry (Machinery Diagnostics Matrix) Overhaul Design Specification

**Date:** 2026-09-16  
**Status:** Approved  
**Target File:** `app/components/vessel/VesselDiagnosticsMatrix.vue`

---

## 1. Overview & Objective

Enhance the **Sensor Telemetry** (`Machinery Diagnostics Matrix`) component in the vessel operations dashboard (`app/pages/dashboard.vue`). The overhaul transforms the static 2-column parameter list and basic generator text boxes into a comprehensive, high-density industrial telemetry monitoring interface.

Key functional objectives:
1. **Main Engine Subsystem Segmentation**: Allow filtering and categorized inspection across 5 primary machinery subsystems: Air System, Cooling & Lube Oil, Fuel Oil, Turbocharger, and Bearings.
2. **Visual Operating Envelopes**: Render proportional safe-operating range bars for every sensor, highlighting the normal minimum/maximum envelope and immediate position marker.
3. **Telemetry Trends & Status Hierarchy**: Introduce deterministic trend direction arrows (`up`, `down`, `stable`) and semantic status badges (`nominal`, `warning`, `critical`).
4. **Enhanced Auxiliary Generators (DG1–3)**: Expand diesel generator monitoring to include comprehensive electrical generation metrics (Active Power kW, Load %, Bus Voltage, Frequency, Power Factor) alongside mechanical readings and 3-phase stator winding thermal spread.
5. **Clean Monochromatic Maritime Design**: Maintain strict consistency with the application's OKLCH design system, typography, and compact layout boundaries.

---

## 2. Architecture & Data Structures

### 2.1 Main Engine Telemetry Parameter Model

```typescript
export type SubsystemCategory = 'All' | 'Air System' | 'Cooling & LO' | 'Fuel Oil' | 'Turbocharger' | 'Bearings'

export interface TelemetryParameter {
  id: string
  subsystem: Exclude<SubsystemCategory, 'All'>
  label: string
  shortLabel?: string
  value: number
  unit: string
  nominalMin: number
  nominalMax: number
  absMin: number
  absMax: number
  trend: 'up' | 'down' | 'stable'
  status: 'nominal' | 'warning' | 'critical'
}
```

### 2.2 Main Engine Baseline Telemetry Dataset

1. **Air System**
   - `ME Control Air In Press`: 7.44 bar (nominal: 6.80 – 8.00 bar, abs: 0 – 10 bar, stable, nominal)
   - `ME Start Air In Press`: 27.50 bar (nominal: 20.00 – 30.00 bar, abs: 0 – 35 bar, stable, nominal)
2. **Cooling & LO**
   - `ME JCW In Press`: 2.85 bar (nominal: 2.20 – 3.50 bar, abs: 0 – 5 bar, stable, nominal)
   - `ME LO Inlet Press`: 2.40 bar (nominal: 2.00 – 3.00 bar, abs: 0 – 5 bar, stable, nominal)
   - `ME LO In Temp`: 43.50 °C (nominal: 38.00 – 48.00 °C, abs: 20 – 70 °C, up, nominal)
   - `ME PCO In Press`: 1.86 bar (nominal: 1.50 – 2.50 bar, abs: 0 – 4 bar, stable, nominal)
3. **Fuel Oil**
   - `ME FO In Press`: 7.66 bar (nominal: 7.00 – 8.50 bar, abs: 0 – 12 bar, stable, nominal)
   - `ME FO In Temp`: 132.00 °C (nominal: 125.00 – 140.00 °C, abs: 80 – 160 °C, down, nominal)
4. **Turbocharger**
   - `Scav. Air Receiver Press`: 1.85 bar (nominal: 1.40 – 2.20 bar, abs: 0 – 3 bar, up, nominal)
   - `ME TC LO In Press`: 1.45 bar (nominal: 1.20 – 2.00 bar, abs: 0 – 3 bar, stable, nominal)
   - `ME TC Exh Gas In Temp`: 385.00 °C (nominal: 340.00 – 420.00 °C, abs: 200 – 500 °C, up, nominal)
   - `ME TC Exh Gas Out Temp`: 275.00 °C (nominal: 230.00 – 310.00 °C, abs: 150 – 400 °C, stable, nominal)
5. **Bearings**
   - `ME Thrust Brg Temp`: 48.50 °C (nominal: 40.00 – 65.00 °C, abs: 20 – 85 °C, stable, nominal)
   - `Stern Tube Aft Brg Temp`: 42.00 °C (nominal: 35.00 – 60.00 °C, abs: 20 – 80 °C, stable, nominal)

### 2.3 Auxiliary Generator (DG 1–3) Model

```typescript
export interface DGGenerator {
  id: string
  name: string
  role: 'Base Load' | 'Synchronized' | 'Standby'
  status: 'online' | 'standby' | 'tripped'
  electrical: {
    activePowerKw: number
    maxPowerKw: number
    loadPercentage: number
    voltage: number
    frequency: number
    powerFactor: number
  }
  mechanical: {
    rpm: number
    htFwPress: number
    htFwTemp: number
    loPress: number
    loTemp: number
    foTemp: number
  }
  windings: {
    u: number
    v: number
    w: number
  }
}
```

#### Deterministic DG Datasets:
- **DG 1 (Base Load - Online)**:
  - Electrical: 840 kW / 1,050 kW (80.0% load), 440 V, 60.0 Hz, PF 0.88
  - Mechanical: 1,009 rpm, HT FW: 3.4 bar / 78 °C, LO: 4.4 bar / 66 °C, FO Temp: 124 °C
  - Windings: U: 75.7 °C, V: 78.2 °C, W: 76.6 °C (spread < 3 °C, balanced)
- **DG 2 (Synchronized - Online)**:
  - Electrical: 630 kW / 1,050 kW (60.0% load), 440 V, 60.1 Hz, PF 0.87
  - Mechanical: 1,009 rpm, HT FW: 3.5 bar / 72 °C, LO: 4.7 bar / 81 °C, FO Temp: 110 °C
  - Windings: U: 71.8 °C, V: 74.1 °C, W: 70.6 °C (spread < 4 °C, balanced)
- **DG 3 (Standby)**:
  - Electrical: 0 kW / 1,050 kW (0% load), 0 V, 0.0 Hz, PF 0.00
  - Mechanical: 0 rpm, HT FW: 0.9 bar / 68 °C (pre-heating loop), LO: 0.5 bar / 55 °C, FO Temp: 68 °C
  - Windings: U: 63.7 °C, V: 64.3 °C, W: 64.3 °C (ambient standby)

---

## 3. UI & Interaction Design

### 3.1 Header Controls & Global Status
- **Eyebrow**: `SENSOR BUS TELEMETRY` with small green status pulse dot.
- **Card Title**: `Machinery Diagnostics Matrix` with `Cpu` icon.
- **Subsystem Tally Badge**: `14 Sensors Nominal • 0 In Alarm` displayed inline.
- **Tab Switcher**: Toggle between `Main Engine (14)` and `Aux Gens (3)`.
- **Search Bar**: Instant filter on sensor names or subsystem tags with instant count update.

### 3.2 Main Engine View
- **Category Filter Pills**:
  `[ All 14 ] [ Air System 2 ] [ Cooling & LO 4 ] [ Fuel Oil 2 ] [ Turbocharger 4 ] [ Bearings 2 ]`
- **Parameter Card Grid (2-column on desktop)**:
  - Header: Subsystem tag pill + parameter label + trend icon (`TrendingUp` / `TrendingDown` / `Minus`).
  - Readout: Tabular mono value with unit and colored status pill.
  - Visual Range Bar:
    - Background track represents full measurable scale (`absMin` to `absMax`).
    - Highlighted middle band marks safe operating envelope (`nominalMin` to `nominalMax`).
    - Position indicator pin demonstrates exact current sensor reading relative to nominal boundaries.
    - Subtext displays `Low: {nominalMin} | Safe Target | High: {nominalMax}`.

### 3.3 Auxiliary Generator Cards (3-column responsive grid)
- **Header**: DG designation, role badge (`Base Load`, `Synchronized`, `Standby`), and online status indicator.
- **Electrical Metrics Bar**:
  - Prominent power gauge: `840 kW` / `1,050 kW` with animated load percentage bar.
  - Quick electrical badges: `440 V`, `60.0 Hz`, `cos φ 0.88`.
- **Mechanical Operation Matrix**:
  - Speed (`1,009 rpm`), HT Fresh Water (`3.4 bar / 78 °C`), Lube Oil (`4.4 bar / 66 °C`), Fuel Temp (`124 °C`).
- **3-Phase Stator Thermal Balance**:
  - Horizontal phase comparison: Phase U, V, and W with maximum spread calculation (`Δ 2.5 °C - Nominal`).

---

## 4. SSR, Nuxt 4 & Tailwind v4 Compliance

1. **Deterministic Data**: All initial mock sensor arrays and generator items use deterministic values without unseeded `Math.random()` or hydration-breaking dynamic clocks at module scope.
2. **Semantic OKLCH Tokens**: Uses Tailwind v4 semantic tokens (`bg-card`, `border-border/50`, `text-muted-foreground`, `text-primary`, `bg-emerald-500/10 text-emerald-400`, `bg-amber-500/10 text-amber-400`).
3. **Accessible & Responsive**: Fully responsive grid collapsing gracefully on tablet/mobile screens (`grid-cols-1 md:grid-cols-2 lg:grid-cols-2` for ME, `grid-cols-1 md:grid-cols-3` for DG).
