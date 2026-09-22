# Design Spec: Single-Screen Map-Integrated Voyage Analytics & Floating Benchmark Cockpit

**Date:** 2026-09-22  
**Status:** Approved by User  
**Target:** `app/pages/voyage-analytics.vue`, `app/components/voyage/VoyageOptimizationMap.vue`, `app/components/voyage/VoyageOptimizationDrawer.vue`, `app/components/voyage/VoyageOptimizationHeaderBar.vue`

---

## 1. Problem Statement & Motivation
User feedback on the partitioned 50/50 layout:
> *"still need improvement we not using the map for showing data try to use maximum map to show data its looks like partition screen instead on single screen"*

The previous design partitioned the screen into a left-side map box and a right-side solid dark sidebar. This halved the map's usable area and failed to use the map canvas for data visualization.

## 2. Architectural Design: Single-Screen Map-Integrated System

### 2.1 100% Edge-to-Edge Hero Map Canvas
- The Leaflet passage map spans **100% width and 100% height** of the entire screen beneath the header bar.
- There is **no split-screen partition** or flex column resizing the map. The map is the continuous background canvas of the application.

### 2.2 Rich Data Visualization Directly on the Map Canvas
1. **CII Performance Colored Voyage Track**:
   - The route connecting noon positions is rendered as segmented polylines color-coded by the IMO CII rating of each day:
     - Band A (Superior): Emerald (`#10b981`)
     - Band B (Compliant): Teal (`#14b8a6`)
     - Band C (Standard): Amber (`#f59e0b`)
     - Band D (Action Required): Orange (`#f97316`)
     - Band E (Degraded): Rose (`#ef4444`)
   - Superintendents can visually identify geographic zones of degradation (e.g. heavy weather corridors around Cape of Good Hope) directly on the world map.
2. **Interactive On-Map Noon Popups / Cards**:
   - Clicking any day marker on the map opens a glass popover anchored to that geographic point:
     - Day number, Date, and Coordinates
     - Attained CII & IMO Band Pill
     - SOG & Propeller Slip %
     - MetOcean weather (Beaufort, wave height, swell)
     - 24h Fuel consumption
     - Direct button to open the Performance Benchmark overlay.
3. **Floating Glass Passage Timeline Scrubber (Bottom)**:
   - Positioned at `absolute bottom-4 left-4 right-4 sm:left-6 sm:right-auto z-20 pointer-events-auto`.
   - Translucent frosted glass card (`bg-background/90 backdrop-blur-md border border-border/80 rounded-xl shadow-lg`).
   - Scrub through days `D1..Dn` with active state, IMO band color dots, and speed indicators.

### 2.3 Floating Performance Benchmark Glass Cockpit (`VoyageOptimizationDrawer.vue`)
- Instead of a rigid partitioned sidebar that splits the screen, the analytics panel is rendered as a **floating translucent glass overlay**:
  - `absolute top-3 right-3 bottom-3 w-full sm:w-[500px] xl:w-[560px] rounded-2xl border border-border/80 bg-background/85 dark:bg-card/85 backdrop-blur-xl shadow-2xl z-30 overflow-hidden flex flex-col animate-in fade-in slide-in-from-right-4 duration-300`
  - The map stays 100% full-screen behind and around the glass panel.
  - Translucent glass styling maintains the visual feeling of a single unified screen.
  - Can be toggled open/closed from the floating timeline button or top header bar.
  - Features 4 clean tabs:
    - **Noon Log**: Clamped CII trajectory chart (max 25, outlier handling), factor attribution donut, active fuel metrics.
    - **Sea Trial**: Speed vs. Shaft Power cubic baseline curve ($P \propto V^3$) with daily noon scatter dots.
    - **Shop Trial**: SFOC vs. ME Load % testbed baseline curve.
    - **Advisories**: Simulated speed cuts and dispatch recommendations.

### 2.4 Sentinel Copilot Integration
- Copilot opens as a floating glass sidebar overlay, preserving the map canvas behind it.

---

## 3. Verification Plan
1. Test map dimensions: Verify the Leaflet map occupies 100% of the screen under all viewport sizes.
2. Test colored route polylines: Verify segments reflect their respective IMO Band colors (A to E).
3. Test map pin popups: Verify clicking any noon pin opens an interactive on-map popover with telemetry.
4. Test floating glass drawer: Verify the benchmark cockpit floats over the map with rounded corners and backdrop blur without resizing the map canvas.
5. Verify build: Run `npm run build` and ensure zero errors.
