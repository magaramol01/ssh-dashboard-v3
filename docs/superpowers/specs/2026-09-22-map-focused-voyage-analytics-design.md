# Design Spec: Map-Focused Voyage Analytics & Benchmarks Cockpit

**Date:** 2026-09-22  
**Status:** Approved by User  
**Target:** `app/pages/voyage-analytics.vue`, `app/components/voyage/VoyageOptimizationDrawer.vue`, `app/components/voyage/VoyageOptimizationHeaderBar.vue`

---

## 1. Problem Statement & Motivation
In the previous bottom-tray layout, three critical issues impaired the user experience:
1. **Squished Passage Map**: A 65vh bottom tray combined with the floating KPI HUD squeezed the Leaflet map into an ~80px slit, partially obscuring the vessel and the voyage route.
2. **CII Chart Y-Axis Scale Blowout**: On Day 8, `attainedCii` reached 165 g/MT·NM (due to minimal distance run during maneuvering/port operations). Unbounded y-axis scaling expanded the chart to 180, flattening all other 25 normal days (3.5 to 8.0 g/MT·NM) and the `Req 8.72` target line into flat lines near zero.
3. **Text Bloat & Inner Scrollbars**: Prose paragraphs repeating numbers and multiple zero-fuel rows (`0 MT VLSFO`, `0 MT ULSGO`) created unnecessary vertical scrolling inside the analytics container.

## 2. Architectural Design: Map-Focused Hero Layout

### 2.1 Hero Map Canvas (100% Viewport)
- The interactive Leaflet passage map occupies the full background width and height underneath the vessel header bar.
- The map corridor, waypoints, weather layers, and live vessel marker are 100% visible at all times.

### 2.2 Floating Bottom Passage Scrubber (44px Glass Bar)
- Positioned floating at the bottom of the map (`absolute bottom-4 left-4 right-4 max-w-5xl mx-auto z-20`).
- Features a horizontal carousel of voyage days (`D1 [Band A]`, `D2 [Band A]`, ..., `D19 [Band A]`).
- Clicking any day highlights the noon pin on the Leaflet map and updates the active day context.
- Includes a dedicated button: `[ 📈 Performance Benchmarks (Sea & Shop Trials) ]` to toggle the inspection drawer.

### 2.3 Slide-Over Performance & Benchmark Drawer (Right Side)
- Mounted as a full-height right-side slide-over drawer:
  - Width: `w-full sm:w-[540px] xl:w-[600px]` (standard) / `xl:w-[820px]` (expanded).
  - Preserves 100% vertical map height on the left without squishing the corridor.
- Header controls:
  - Inline tabs: `Noon Log (D19)`, `Sea Trial (Speed-Power)`, `Shop Trial (SFOC)`, `Advisories (2)`.
  - Expand/Contract button (`Maximize2` / `Minimize2`) to widen the panel when analyzing high-resolution engineering curves.
  - Close button (`X`).

### 2.4 Clamped CII Trajectory Chart (Resolving the Day 8 Outlier Scale)
- In `VoyageOptimizationDrawer.vue`:
  - Clamps the ECharts `yAxis.max` to `Math.max(12, Math.min(25, Math.ceil(requiredCii * 2)))` (typically 20 or 25).
  - Normal days (3.5 to 8.0) and the `Req 8.72` markline are scaled legibly across the full chart height.
  - For outlier days where `attainedCii > yAxisMax` (such as Day 8 at 165):
    - Visual bar is clamped to the top of the chart with an outlier diagonal stripe or cap indicator.
    - Bar label displays `165.0 ▲`.
    - Tooltip displays: `Attained CII: 165.0 g/MT·NM (Outlier / Port Maneuvering)`.

### 2.5 Elimination of Text Bloat & Zero-Fuel Clutter
- Remove the narrative paragraph under Factor Attribution ("Attained CII of 5.27 g/MT·NM compliant with target 8.72...").
- Keep concise diagnostic chips:
  - `[ 🌊 Heavy Weather: BF 6 · 2.5m ]`
  - `[ ⚙️ Propeller Slip: 2.2% (Optimal) ]`
  - `[ ⚡ SOG: 11.75 kts ]`
- In Fuel Consumed, filter out fuels with 0 consumption, showing only active fuels (e.g. `HFO: 14.2 MT`).
- Eliminates inner vertical scrollbars in the standard drawer height.

### 2.6 Benchmark Engineering Curves
- **Sea Trial**: Interactive Speed vs. Shaft Power cubic curve ($P = 4200 \times (V/14)^3$) vs. daily noon scatter dots. Click-to-inspect jumps to the corresponding day.
- **Shop Trial**: SFOC (g/kWh) vs. Engine Load % MCR testbed baseline vs. actual noon SFOC points colored by compliance.

### 2.7 Sentinel Copilot Integration
- Accessible from the top bar or via "Ask Copilot" action links inside the drawer.
- Clean docking without overlapping or distorting the passage map.

---

## 3. Verification Plan
1. Test map visibility: Verify Leaflet map retains full vertical and horizontal screen dimensions.
2. Test bottom scrubber: Verify clicking days updates map markers and noon telemetry.
3. Test drawer slide-over: Verify drawer opens from the right with expand/dock toggles.
4. Test CII chart scaling: Confirm Day 8 (165) displays an outlier indicator without distorting the y-axis for the other days.
5. Test Sea & Shop trial curves: Confirm smooth polynomial baseline curves and interactive scatter dots.
6. Verify build: Run `npm run build` to confirm zero SSR/TypeScript errors.
