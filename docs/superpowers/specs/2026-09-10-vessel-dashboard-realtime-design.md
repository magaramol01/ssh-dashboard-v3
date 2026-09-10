# Vessel Dashboard Real-Time API & Dynamic Layout Design

**Date**: 2026-09-10  
**Target Route**: `/dashboard`  
**Page Title**: Vessel Dashboard  
**Source Reference**: Legacy `DashboardHome.js`, `dashboardGridLayout.js`, `panel.js`, `HederUI.js`

---

## 1. Overview

Replace the dummy logistics boilerplate on `/dashboard` with a real-time maritime **Vessel Dashboard** powered by live SmartShip Hub production APIs. The layout faithfully reproduces the production UI captured in the reference screenshots:
1. **Top Header & Vessel Selector**: View By toggle, Sister Group filter (`getShipBySisterGroup`), Vessel Dropdown, VSAT connectivity status indicator (`getSystemConnectivityStatus`), UTC clock.
2. **Top-Left Telemetry Carousel (Widget 1)**: Multi-group performance metrics (Fuel & Vessel Speed, Shaft Power Meter, Navigation, MetOcean) with 3-dot carousel pagination.
3. **Center-Right Leaflet Map (Widget 2)**: Embedded voyage map (`getWindyMapGeoJson`) with floating voyage details ribbon (`getMRVLatestData`: Vessel name, Voyage #, Source/Dest ports, ETA, Distance run/to go), port-to-port trajectory, vessel heading marker.
4. **Right-Hand Side (RHS) Panel (Widgets 4–8 & 9)**: Collapsible drawer for Alarms & Alerts with search and badge tabs (Alarms, Alerts, Muted, Settings).
5. **Bottom Telemetry & Engine Performance (Widget 3)**:
   - Carousel navigation (`<` / `>`) between **Main Engine**, **Auxiliary Engines** (DG1, DG2, DG3), and **Auxiliaries**.
   - Arc gauges (Cylinder exhaust temps, DG RPM & winding temps) with active parameter selection.
   - Interactive time-series telemetry chart (`getRechartData` / ECharts).
   - Detailed operating data table (pressures & temperatures).

---

## 2. Server API Proxy Architecture

All external API communication is routed through Nuxt server endpoints (`server/api/vessels/...`) leveraging `backendFetch` in `server/utils/http-adapter.ts`. This dynamically attaches the user's active `x-tenant-id`, `x-request-id`, `x-auth-id`, and `x-refresh-id` tokens, with fallback headers:

| Server Endpoint | Method | External Backend URL | Purpose |
|---|---|---|---|
| `/api/vessels/sister-group` | `POST` | `/prod/api/v1/getShipBySisterGroup` | Fetch vessels grouped by sister class with `{ id: "Select All" }` |
| `/api/vessels/dashboard-state` | `GET` | `/prod/api/v1/getDashboardState?vesselId={id}` | Complete widget hierarchy (`widget_1` to `widget_9`) and real-time sensor points |
| `/api/vessels/windy-geojson` | `GET` | `/prod/api/v1/getWindyMapGeoJson?vesselId={id}` | Port-to-port route line, vessel coordinates, heading, and track points |
| `/api/vessels/mrv-latest` | `GET` | `/prod/api/v1/getMRVLatestData?vesselId={id}` | Active voyage data (ETA, destination, voyage #, distances) |
| `/api/vessels/connectivity-status` | `GET` | `/prod/api/v1/getSystemConnectivityStatus?vesselId={id}` | VSAT connectivity indicator (Online/Offline, last packet timestamp) |
| `/api/vessels/rhs-panel-flags` | `GET/POST` | `/prod/api/v1/getRHSPanalFlag` & `/updateRSHPanelFlag` | RHS panel visibility preferences |
| `/api/vessels/rechart-data` | `POST` | `/prod/api/v1/getRechartData` | Time-series telemetry points for chart (`{ vesselId, parameterId }`) |
| `/api/vessels/graph-avg-values` | `GET` | `/prod/api/v1/getGraphAvgValues?vesselid={id}` | Historical daily moving average statistics |
| `/api/vessels/session-sync` | `POST` | `/prod/api/v1/addVesselDetailsToSession` & `saveAuditInfo` | Synchronizes active vessel in backend session & audit log |

---

## 3. UI Component Architecture

### A. Top Navigation Bar (`app/components/vessel/VesselHeaderBar.vue`)
- **View By**: Toggle between `Sister Vessel` and `Fleet`.
- **Sister Group Filter**: Dropdown with options derived from `getShipBySisterGroup` (e.g. `Select All`, `CX 5.0`, `YZJ 4.7m`, etc.).
- **Vessel Select**: Dropdown of vessels filtered by the chosen sister group. Defaults to vessel ID 28 (`ASIA UNITY`) or the first vessel. Selecting a new vessel triggers a reactive update across all dashboard queries.
- **VSAT Status Badge**: Pulsing dot (Green when online, Red when offline) + `Last Updated: YYYY-MM-DD HH:mm:ss`.
- **Timezone Selector**: UTC / Local toggle.

### B. Top-Left Telemetry Card (`app/components/vessel/VesselTelemetryCard.vue`)
- Maps `widget_1.configuration.body.data`:
  - `carousel1`: "Fuel and Vessel Speed" (ME & AE fuel rates, SOG, STW, SFOC) + "Shaft Power Meter" (Shaft power, torque, %MCR, RPM, load, draft).
  - `carousel2`: "Fuel" + "Navigation" (Wave height/direction, swell, currents).
  - `carousel3`: Extended navigation telemetry.
- Includes carousel pagination dots at the bottom.

### C. Center-Right Voyage Map (`app/components/vessel/VesselVoyageMap.vue`)
- Wrapped in `<ClientOnly>` with a skeleton placeholder during SSR.
- **Floating Voyage Ribbon**:
  - Displays: `Vsl.Name`, `Voy.No.`, `Source Port`, `Dest. Port`, `ETA`, `Dist. TR/DTG`, `Vsl. TZone`.
- **Leaflet Map**:
  - OpenStreetMap base layer with dark/light mode switching.
  - Red polyline representing port-to-port route and travelled track.
  - Vessel marker with rotated ship icon corresponding to `vesselHeading`.
  - Zoom and layer controls.

### D. Bottom Engine & Auxiliary Telemetry (`app/components/vessel/VesselEngineSection.vue`)
- Maps `widget_3.configuration.body.data`:
  - `carousel1`: **Main Engine** (6 Cylinder semi-circular arc gauges for Exhaust Gas Outlet Temp, CFW Outlet Temp, PCO Outlet Temp).
  - `carousel2`: **Auxiliary Engines** (DG1, DG2, DG3 RPM dials, 3-phase winding temperatures, FO/LO pressures).
  - `carousel3`: **Auxiliaries**.
- **Carousel Arrow Buttons (`<` and `>`)**: Navigates between Main Engine and Aux Engines.
- **Interactive Telemetry Strip Chart**:
  - Plots time series curve (150°C–600°C or 0–3000 RPM) using ECharts (`vue-echarts`).
  - Clicking any cylinder or generator updates the focused parameter in the chart.
- **Operating Data Tables (3 Columns)**:
  - 18 key operating sensors (Control Air, Scavenge Air, Start Air, JCW, PCO, TC LO, Stern Tube Bearings, Inlet/Outlet temperatures & pressures).

### E. Right-Hand Side (RHS) Alarms Drawer (`app/components/vessel/VesselAlarmsDrawer.vue`)
- Collapsible sidebar on the right edge.
- Search input for filtering alarms.
- Filter tab icons with badge counts:
  - Settings (dialog to toggle active widgets 4–8)
  - Alerts Bell (count: 0)
  - Alarms Globe (count: 14)
  - Muted Alarms (count: 0)
- Scrollable list of active alarm events.

---

## 4. State Management & Reactivity

- Composable `app/composables/useVesselDashboard.ts`:
  - `selectedVesselId`: Persisted via cookie/localStorage (defaults to 28 / `ASIA UNITY`).
  - `selectedSisterGroup`: Selected sister group filter (defaults to `'Select All'`).
  - `vesselList`: Reactive list from `/api/vessels/sister-group`.
  - `dashboardState`: Reactive data from `/api/vessels/dashboard-state`.
  - `voyageData`: Reactive data from `/api/vessels/mrv-latest`.
  - `windyMapData`: Reactive data from `/api/vessels/windy-geojson`.
  - `connectivityStatus`: Reactive data from `/api/vessels/connectivity-status`.
  - `rhsPanelFlags`: Reactive data from `/api/vessels/rhs-panel-flags`.
  - `activeEngineCarousel`: Current bottom accordion index (`0` for Main Engine, `1` for Aux Engines, `2` for Auxiliaries).
  - `selectedTelemetryParam`: Active metric plotted on the timeline chart.
- Polling / Refresh: Periodic 30-second refresh for real-time telemetry while preserving smooth UX.

---

## 5. Error Handling & Fallbacks

- Every API endpoint is guarded with graceful fallback data and error handling in case the external backend is temporarily unreachable or the vessel has no sensor stream.
- Leaflet map gracefully handles missing or partial coordinates with default ocean view bounding.
- SSR safety is guaranteed by wrapping maps and canvas gauges in `<ClientOnly>` with explicit `<Skeleton>` loading states.
