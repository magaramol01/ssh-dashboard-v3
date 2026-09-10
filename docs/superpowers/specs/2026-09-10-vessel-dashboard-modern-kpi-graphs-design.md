# Modern Vessel Executive Operations Center Dashboard Design Spec

- **Date**: 2026-09-10
- **Status**: Approved by User
- **Route**: `/dashboard`
- **Target Audience**: Dispatchers, Fleet Managers, Ship Operators, Technical Superintendents

---

## 1. Overview & Vision

The objective is to replace the legacy tabular layout with a modern, high-contrast, KPI-rich maritime Executive Operations Center dashboard. 
The dashboard provides immediate situational awareness, telemetry monitoring, multi-graph diagnostics, and voyage tracking backed by real SmartShip Hub backend APIs:
- `/prod/api/v1/getShipBySisterGroup`
- `/prod/api/v1/getDashboardState`
- `/prod/api/v1/getWindyMapGeoJson`
- `/prod/api/v1/getMRVLatestData`
- `/prod/api/v1/getSystemConnectivityStatus`
- `/prod/api/v1/getRechartData`
- `/prod/api/v1/getGraphAvgValues`
- `/prod/api/v1/getRHSPanalFlag` / `updateRSHPanelFlag`

---

## 2. Visual Theme & Design Tokens

- **Canvas Background**: Deep dark maritime navy `#0d0e12` / `#121318`
- **Card Containers**: Elevated dark slate `#17181f` with subtle border `#262833` and soft shadow `0 4px 20px rgba(0, 0, 0, 0.4)`
- **Accent Palette**:
  - Primary Cyan: `#38bdf8` / `#00e5ff` (propulsion, links, headers)
  - Success Emerald: `#10b981` / `#0fcc45` (online status, nominal cylinder temps, port origin)
  - Warning Amber: `#f59e0b` / `#ffb900` (time-series chart line, minor telemetry deviations)
  - Critical Crimson: `#ef4444` / `#f43f5e` (critical alarms, sailed path, port destination)
- **Typography**: Clean system font hierarchy, font-mono for numbers, units, and timestamps.

---

## 3. Dashboard Structure & Layout

### 3.1 Top Bar & Vessel Selector
- **Left**:
  - View By: `Sister Vessel` vs `Fleet` toggle switch.
  - Sister Group Dropdown: Populated from `deriveSisterGroups`.
  - Vessel Selector Dropdown: Displays vessel name, IMO/mapping name, and sister group badge.
- **Right**:
  - Live Connectivity Pill: Pulsing green status dot with timestamp `Last Updated: YYYY-MM-DD HH:mm:ss UTC`.
  - Timezone Selector / UTC Badge.
  - Quick Drawer Trigger for active alarms.

---

### 3.2 Top Tier: 5 Executive KPI Cards with Mini Sparklines

1. **Speed Over Ground (SOG)**:
   - Primary: `14.2 kn` (or live SOG from API)
   - Secondary: `STW: 13.9 kn` | Trend: +0.4 kn
   - Visual: 6-hour SVG trend sparkline with gradient fill.
2. **Main Engine Fuel Rate**:
   - Primary: `18.8 t/day` (or `kg/hr`)
   - Secondary: `SFOC: 168.4 g/kWh` | Efficiency: Optimal
   - Visual: Fuel consumption mini sparkline.
3. **Shaft Power & Load**:
   - Primary: `8,450 kW`
   - Secondary: `78.2% MCR` | `84.5 RPM`
   - Visual: Power load sparkline.
4. **Voyage Progress & ETA**:
   - Primary: `403 / 4,063 NM` (10% completed)
   - Secondary: `ETA: 18 Sep 11:00 UTC` | `To Go: 3,660 NM`
   - Visual: Linear percentage progress bar with vessel icon.
5. **System Health & Active Alarms**:
   - Primary: `14 Active` (2 Critical, 8 Warnings, 4 Info)
   - Secondary: `VSAT: Online (99.8%)`
   - Visual: Health indicator badge, clickable to slide out alarms drawer.

---

### 3.3 Middle Tier: Voyage Map & Telemetry Radial Cockpit

#### Left (60% Width): High-Definition Leaflet Voyage Map
- **Tile Layer**: High-contrast CartoDB Voyager / OpenStreetMap tiles with distinct blue oceans, coastlines, and geography.
- **Floating Frosted Ribbon**:
  - Banner columns: `Vsl. Name`, `Voy. No.`, `Source Port` (Green), `Dest. Port` (Red), `ETA` (formatted `YYYY-MM-DD HH:mm`), `Dist. TR / DTG` (NM), `Timezone`.
- **Map Layers**:
  - Sailed route: Solid crimson red polyline (`#ef4444`, weight 3.5).
  - Planned route to target: Dashed nautical blue polyline (`#0284c7`, weight 2, dashArray `6, 6`).
  - Source & Destination markers with port name tooltips.
  - Vessel Marker: Directional vessel chevron icon rotated to current heading/course with a pulsing radar aura.

#### Right (40% Width): Live Telemetry Radial Cockpit
- Replaces plain text with **4 radial gauge meters**:
  1. **Speed Dial**: Semicircular dial showing 0–25 kn with live SOG needle & STW indicator.
  2. **Engine Load (% MCR)**: Radial gauge showing 0–100% MCR with color zones (Green <85%, Amber 85–95%, Red >95%).
  3. **Shaft RPM Dial**: Circular dial showing 0–120 RPM with torque readout (`kNm`).
  4. **Fuel Efficiency Dial**: Metric gauge for fuel rate and SFOC score.
- **Cockpit Carousel Tabs**:
  - Tab 1: Propulsion & Speed (SOG, STW, Shaft Power, %MCR, RPM).
  - Tab 2: Environmental & Sea State (Rel/True Wind Speed & Direction, Wave Height, Swell, Draft).

---

### 3.4 Bottom Tier: Multi-Graph Analytics & Diagnostics Suite

1. **24-Hour Telemetry Line / Area Chart (ECharts)**:
   - High-resolution interactive timeline chart.
   - Dual-axis capability: Speed (kn) on Left Y-axis vs Fuel Rate (t/day) on Right Y-axis.
   - Parameter switcher buttons: `Speed vs Fuel`, `Shaft Power`, `Scavenge Air Pressure`, `Exhaust Temperatures`.
   - Rich hover crosshair tooltip showing exact timestamp, parameter values, and deviation.
2. **Cylinder Exhaust Gas Temp Bar Comparison (ECharts)**:
   - 6-bar comparison chart for Main Engine Cylinders 1 through 6.
   - Dynamic colors: Green for nominal temps (310–330 °C), Amber for elevated (>340 °C), Red for alarms.
   - Horizontal threshold line indicating average cylinder exhaust temperature.
3. **Live Operating Diagnostics Matrix (Tabbed Tables)**:
   - Main Engine Operating Parameters: Control Air Press, JCW Inlet/Outlet, LO Pressure, FO Temp & Pressure, PCO Pressures.
   - Auxiliary Generators (DG1, DG2, DG3): RPM, HT FW Press/Temp, LO Press, Winding Temps.

---

### 3.5 Collapsible Alerts & Alarms Command Drawer
- Sliding drawer on the right side with toggle chevron (`>` / `<`).
- Quick search bar, counter badges (`Alerts 0`, `Alarms 14`, `Muted 0`).
- Priority indicator dots: Red (`A-xx`), Amber (`W-xx`), Blue (`I-xx`).
- Detailed alarm items with code, message, timestamp, and mute/ack buttons.

---

## 4. Technical Architecture & Component Hierarchy

```
app/pages/dashboard.vue
 ├── VesselHeaderBar.vue (Vessel selector, Sister Group, VSAT status, UTC)
 ├── VesselKpiStrip.vue (5 KPI summary cards with mini sparklines)
 ├── Middle Grid (60 / 40 split)
 │    ├── VesselVoyageMap.vue (Leaflet map, frosted ribbon, rotated vessel)
 │    └── VesselRadialCockpit.vue (4 radial meters: Speed, %MCR, RPM, Fuel)
 ├── Bottom Analytics Suite
 │    ├── VesselTelemetryChart.vue (ECharts 24h timeline area chart with metric switchers)
 │    ├── VesselCylinderBarChart.vue (ECharts 6-cylinder exhaust temp bar comparison)
 │    └── VesselDiagnosticsMatrix.vue (Tabbed operating data tables for ME & DG1-3)
 └── VesselAlarmsDrawer.vue (Collapsible RHS alarms rail)
```

---

## 5. Verification & Testing Plan
- **Unit Tests**: Test telemetry data parsers, KPI aggregators, and dial percentage calculations in `tests/unit/useVesselDashboard.test.ts`.
- **Component Tests**: Ensure ECharts and Leaflet render with `<ClientOnly>` without SSR hydration errors.
- **Build Verification**: Run `npm test` and `npm run build` to confirm zero type errors or bundle issues.
