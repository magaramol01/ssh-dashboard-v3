# Design Specification: Tactical Monochromatic Refinement for Vessel Executive Operations Center

**Date:** 2026-09-10  
**Branch:** `feature/vessel-dashboard-realtime`  
**Status:** Pending Review  
**Objective:** Tone down excessive decorative colors across all dashboard components. Transition to a cohesive, tactical monochromatic design (deep obsidian slate canvas with a single precision ice-blue accent), reserving warning amber and alarm red strictly for abnormal telemetry.

---

## 1. Design System & Palette Constraints

### 1.1 Color Tokens & Hierarchy
- **Canvas & Background:** `#0a0b0e` (Obsidian black)
- **Cards & Surfaces:** `#121318` (Deep neutral slate surface)
- **Card Borders & Dividers:** `#1e2029` (Subtle hairline border)
- **Primary Accent:** Precision Ice-Blue (`#38bdf8` / `rgb(56, 189, 248)`)
- **Primary Data Text:** `#f8fafc` (Crisp white monospace for values)
- **Secondary Text:** `#94a3b8` (Cool slate for sub-metrics)
- **Labels & Captions:** `#64748b` (Muted slate for titles, units, and axes)

### 1.2 Strict Anomaly Coloring Rule
- **Nominal State:** Rendered in cool slate (`#64748b` / `#94a3b8`) or ice-blue (`#38bdf8`). Green is removed from normal states to eliminate the "Christmas tree" / rainbow effect.
- **Warning State:** Amber (`#f59e0b`) appears **only** when a sensor or parameter exceeds normal tolerance.
- **Alarm / Critical State:** Red (`#ef4444`) appears **only** when an active alarm or disconnect is detected.

---

## 2. Component Refinement Specifications

### 2.1 Top KPI Strip (`VesselKpiStrip.vue`)
- Remove multicolor glowing borders, badges, and disparate gradients.
- Unify all 5 cards with consistent `#121318` background, `#1e2029` border, and crisp typography:
  - Metric 1 (Speed): 14.2 kn (white) / STW 13.9 kn (slate) with ice-blue sparkline.
  - Metric 2 (Fuel Cons.): 18.8 t/day (white) / -4.8 kg/hr (slate) with ice-blue sparkline.
  - Metric 3 (Shaft Power): 8,450 kW (white) / 78.2% MCR (slate) with ice-blue sparkline.
  - Metric 4 (Voyage Progress): 10% (white) / 403 / 4,063 NM with minimalist slate track and ice-blue progress fill.
  - Metric 5 (Fleet Health & Alarms): Clean, non-intrusive badge showing `14 Active` with muted amber pip only.

### 2.2 Radial Telemetry Cockpit (`VesselRadialCockpit.vue`)
- Replace the multi-colored gauge arcs (cyan, green, yellow, orange) with a uniform, precision ice-blue arc styling:
  - Dial Track: `#1a1c24`
  - Dial Active Arc: `#38bdf8` (Ice-blue)
  - Values: High-contrast white monospace with slate unit captions.
  - Sub-badges: Removed bright green/teal tags; replaced with subtle slate status chips.
  - Tab Switcher: Minimalist dark pill toggle (`#101115` with ice-blue active border).

### 2.3 24-Hour Telemetry Timeline Chart (`VesselTelemetryChart.vue`)
- Strip loud rainbow gradients and replace with a disciplined, low-saturation visualization:
  - Speed vs Fuel: Speed line in ice-blue (`#38bdf8`, 0.08 area fill opacity); Fuel line in clean neutral slate (`#94a3b8`, 0.04 area fill opacity).
  - Single parameter modes (Power, Scavenge, Exhaust): Uniform ice-blue line with hairline grid `#181920` and muted axis labels `#64748b`.
  - Metric pill buttons: Subtle slate-800 tabs with ice-blue indicator.

### 2.4 Cylinder Exhaust Bar Comparison (`VesselCylinderBarChart.vue`)
- Replace the 6 green/amber/red bars with uniform cool steel-slate bars (`#334155` / `#475569`) for all cylinders operating within normal limits.
- If a cylinder exceeds the warning threshold (>330 °C), that specific bar highlights in muted amber (`#f59e0b`).
- Average MarkLine: Dashed ice-blue line (`#38bdf8` at 0.6 opacity) with crisp label `Avg 321.2°C`.
- Quick Stats Strip: Clean dark strip with slate labels and white monospace values.

### 2.5 Machinery Diagnostics Matrix (`VesselDiagnosticsMatrix.vue`)
- Replace bright emerald green indicator dots and tabs with calm ice-blue and neutral slate styling.
- Tab Buttons: Obsidian background with ice-blue active border.
- Parameter Rows: Deep dark rows (`#101115`), subtle slate indicator pips, crisp white sensor values.
- Auxiliary Generator Cards: Minimalist status tags (`ONLINE` in subtle ice-blue chip, `STANDBY` in muted slate chip).

### 2.6 Sliding Alarms Command Rail (`VesselAlarmsDrawer.vue`)
- Remove heavy neon glow filters around dots and flashing badges.
- Status Pips: Clean 6px solid dots without aggressive blur (Critical: `#ef4444`, Warning: `#f59e0b`, Info: `#64748b`).
- Filter Chips: Subtle slate backgrounds with crisp counters.
- Clean typography and refined spacing.

---

## 3. Verification & Testing
- **Visual Harmony**: Verify that all components share a unified `#0a0b0e` / `#121318` theme with `#38bdf8` accent and zero rainbow effect.
- **Unit Tests**: `npm test` passes all tests.
- **Production Build**: `npm run build` exits with code `0`.
