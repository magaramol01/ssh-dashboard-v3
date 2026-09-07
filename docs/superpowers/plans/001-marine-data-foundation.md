# Plan 001: Establish marine data foundation and replace mock domain

> **Executor instructions**: This is the first implementation plan for converting the current shipment-template UI into a marine-operations product. Follow the source-selection and security boundaries below. Do not invent joins or expose raw telemetry to the browser. If a source table is empty or differs from the contract, stop and report instead of silently falling back to a legacy table.
>
> **Drift check**: `git diff --stat ddf4948..HEAD -- app package.json nuxt.config.ts`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: none
- **Category**: migration
- **Planned at**: commit `ddf4948`, 2026-09-07

## Why this matters

The current Nuxt application is a polished, mock-only shipment and bike-fulfilment template. The connected PostgreSQL schema is a marine operations system centered on vessels, voyages, noon reports, telemetry, parameters, alerts, and users. The safest path is to introduce a server-side read model around the database's vessel root, then migrate only the pages whose concepts match; removing the parcel vocabulary before adding live data avoids building the wrong product around the right database.

## Current state

### Repository

- `app/pages/dashboard.vue` — shipment KPIs, shipment volume, carrier performance, regional delivery, and activity feed from `app/mocks/dashboard.ts`.
- `app/pages/control-tower.vue` — shipment exception queue from `app/mocks/dashboard.ts` and `app/mocks/movements.ts`.
- `app/pages/live.vue` and `app/components/LiveMapLeaflet.vue` — hard-coded road polylines from `app/mocks/live.ts`; not vessel telemetry.
- `app/pages/fleet.vue` — hard-coded road vehicles from `app/mocks/fleet.ts`; not vessels.
- `app/pages/routes.vue` — shipment-template route surface.
- `app/pages/analytics.vue` — hard-coded shipment KPIs from `app/mocks/analytics.ts`.
- `app/pages/tracking.vue` and `app/pages/shipments/[id].vue` — consumer shipment lookup/detail and parcel timelines.
- `app/pages/containers/**`, `app/pages/inventory.vue`, `app/pages/catalog.vue`, `app/pages/customers.vue`, and `app/pages/drivers.vue` — invented bike logistics domain with no direct counterpart in the inspected marine schema.
- `app/pages/warehouses.vue` and `app/pages/distribution-centers.vue` — invented warehouse/DC hierarchy; the inspected database instead has vessels and port/voyage fields.
- `app/pages/settings/index.vue` — UI settings and mock profile; it currently does not load database users or configuration.
- `app/composables/usePersona.ts` — client-side localStorage persona switcher, not server authorization.
- `app/pages/auth/sign-in.vue` — mock authentication accepting any input; `app/components/nav/AppTopbar.vue` now routes Sign out to `/auth/sign-in` but there is still no real session.
- `package.json` — Nuxt 4/Vue 3 application with no PostgreSQL client dependency, no server API layer, no test script, and no typecheck/lint script.
- `nuxt.config.ts` — loads the application CSS and enables the Tailwind Vite plugin; no database runtime configuration exists.

The current mock source of truth is `app/mocks/movements.ts`; it models transfers and last-mile bike deliveries. It must not be treated as the marine source of truth.

### Database inspection

A read-only PostgreSQL connection succeeded using the configuration in `plan.txt`. The credential values are intentionally not repeated here. The `shipping_db` schema contains 200+ objects and a mixture of active tables, legacy `old_v1_*` tables, `std_*` tables, monthly partitions, empty tables, and views. Important observed row counts at inspection time:

| Database capability | Table(s) | Observed rows / shape | Intended product use |
|---|---|---:|---|
| Vessel master | `shipping_db.ship` | 27 | canonical vessel roster and vessel detail root |
| Vessel assets/metadata | `shipping_db.ship_metadata` | 12 | vessel documents/media metadata, not primary vessel identity |
| Fleet grouping | `shipping_db.fleet` | 5 | fleet definitions; join to vessels through the current data contract, not an assumed FK |
| Vessel-specific parameter definitions | `shipping_db.vesselparameters` | 7,335 | machinery/telemetry parameter catalog per vessel |
| Standard parameter definitions | `shipping_db.standardparameters` and `shipping_db.standard_parameters` | 7,087 and 200 | parameter dictionary candidates; source choice must be validated before implementation |
| Parameter mapping | `shipping_db.parametermapping` | 4,934 | maps vessel parameter names to standard names and unit/scaling rules |
| Standardized noon reports | `shipping_db.std_enoonreporttable` | 19,816 | reporting, voyage history, fuel, speed, position, drafts, cargo and emissions analytics |
| Legacy/new noon report variants | `mrvnoonreport`, `newmrvnoonreport`, `newmrvnoonreportdata`, `reporteddatabyship` | empty at inspection | do not make these the primary read source without evidence they are populated in the target environment |
| Voyage forecast | `shipping_db.voyageforecast` | 778 | current/forecast voyage, last and next port, ETA, distance, route and journey counter |
| Weather forecast | `shipping_db.voyageweatherforecast` | 680 | voyage weather panel; `weatherdata` is an array with `location`, `times`, and `values` members |
| Real-time telemetry | `shipping_db.std_rtdas_realtime` and partition tables | monthly range partitions | latest vessel telemetry; query server-side by vessel/time and never transfer whole partitions |
| Raw/legacy telemetry | `shipping_db.rtdasrealtimedata` and partitions | large historical archive plus partitions | fallback/comparison source only after standard source profiling |
| Connectivity | `shipping_db.vstconnectivitystatus` / `vstconnectivitystatushistory` | 6 / 189,300 | live connectivity status and history |
| Fleet KPI/trends | `shipping_db.fleetciikpi` / `fleetciitrending` | 0 / 10 | CII KPI/trending candidates; `kpivalues` is an array of `{label,min,max,tag}` objects |
| Alerts/advisories | `shipping_db.systemadvisories` / `std_triggeredoutcomestoday` / `std_triggeredoutcomeshistory` | 164 / 2,851 current rows / historical partitions | control tower alert queue, acknowledgement and closure workflow |
| Anomaly detection | `shipping_db.vessel_anomaly_detection` | empty at inspection | future health/anomaly surface; keep as optional until populated |
| Instructions | `shipping_db.operations_instructions` | 5 | vessel-specific operations instructions |
| Users and permissions | `shipping_db.std_user`, `usermapping`, `shipusers` | 114 / 105 / empty | user/session/role and screen access; never use password columns from the client |
| Audit | `shipping_db.audit_logs`, `audittrail` | 488 / 6,151 | administrative audit history |

The database has foreign keys from many active tables to `shipping_db.ship(id)`, including parameter mappings, real-time data, noon reports, forecasts, advisories, instructions, widget layout, and anomaly records. It also has substantial legacy references to `old_v1_table_user`. There are no safe grounds to infer every relationship from matching column names alone; use catalog metadata and explicit read-model joins.

The main partitioned high-volume tables are range-partitioned by packet/report timestamp. `std_rtdas_realtime` has monthly partitions, as do high-frequency telemetry, weather, and triggered-outcome history. Several future/empty partitions exist, so table existence is not evidence of data availability.

### Initial source set selected for the marine product

The first integration slice is intentionally limited to the following owner-selected tables. These are the preferred sources unless profiling in the target environment proves a source is empty or semantically different:

- **Company and fleet identity**: `companyregistration`, `ship`, `fleet`, `sistervesselgroup`, `vesseljourneycounter`.
- **Voyage and position**: `voyageforecast`, `highfrequencydata`, `vsatheartbeat`.
- **Reports and operational metrics**: `std_enoonreporttable`, `std_averagecalculationoftags`, `std_ops_dashboard_data`, `emission_reporting`.
- **Performance baselines**: `db_reference_engine_data`, `db_reference_speed_data`, `seatrial`.
- **Weather and alerts**: `std_stormglassweather`, `std_triggeredoutcomestoday`, `std_triggeredoutcomeshistory`.

Specific fit:

| Selected table | First UI use | Important implementation note |
|---|---|---|
| `companyregistration` | company identity, logo, contact and tenant header | contains company contact data; server-side access only |
| `ship`, `fleet`, `sistervesselgroup` | vessel list, fleet filters, vessel detail | `ship.id` is the root key; fleet/group fields need explicit normalization |
| `vesseljourneycounter`, `voyageforecast` | current voyage, route, last/next port, ETA | use journey counter + vessel id; do not create a separate route master yet |
| `highfrequencydata` | live telemetry and map | partitioned by `packettime`; select latest bounded rows and extract only approved packet keys |
| `vsatheartbeat` | connected/offline indicator | use latest heartbeat per vessel and show freshness, not only boolean state |
| `std_enoonreporttable` | noon report history and core analytics | indexed by vessel/report time; normalize `noonreportdata` through a field allowlist |
| `std_averagecalculationoftags`, `std_ops_dashboard_data` | fleet KPI cards and dashboard charts | JSON shapes are object/array and must be mapped to typed contracts |
| `emission_reporting` | emissions submission history/status | the inspection role could not `SELECT` this table; access must be granted explicitly or the feature remains unavailable |
| `db_reference_engine_data`, `db_reference_speed_data`, `seatrial` | performance curves and sea-trial comparison | reference tables have vessel indexes; `seatrialdata` is an array and requires a schema contract |
| `std_stormglassweather` | voyage weather and map overlays | includes weather and NMEA JSON objects plus lat/long and packet timestamp |
| `std_triggeredoutcomestoday` | current control-tower alert queue and acknowledgement state | current snapshot; use this for active counts and triage, not the historical table |
| `std_triggeredoutcomeshistory` | alert history and acknowledgement state | partitioned by timestamp; `data` keys are parameter identifiers, so resolve labels through an approved dictionary |

The inspection showed the account named `readonlyuser` has write privileges on `seatrial`, `std_averagecalculationoftags`, and `vsatheartbeat`, while `emission_reporting` is not selectable. The application must treat the connection as read-only, request a separately provisioned least-privilege role, and never use those write privileges until authentication, authorization, audit, and mutation plans exist.

### Repository conventions to preserve

- Use Nuxt 4 server routes/composables rather than database calls in Vue components.
- Keep SSR-safe state; the project uses `useState` and cookie-backed theme state rather than Pinia.
- Reuse existing `DataTable`, `KpiTile`, chart wrappers, `Card`, `Badge`, `EmptyState`, and semantic theme classes.
- Client-only maps/charts remain wrapped in `ClientOnly` with a skeleton fallback, matching `app/pages/live.vue` and the existing chart usage.
- The current project has deterministic mocks and no test framework. Add small pure adapter tests first; do not make the database a test prerequisite.

## Proposed domain-to-UI fit

| Existing surface | Marine replacement | Database read model | Decision |
|---|---|---|---|
| Dashboard | Operations overview | vessel count from `ship`; latest voyage from `voyageforecast`; latest report from `std_enoonreporttable`; alert/connectivity aggregates | keep route, replace all shipment KPIs and mock charts |
| Control tower | Alerts and operational exceptions | `systemadvisories`, `std_triggeredoutcomestoday`, `vstconnectivitystatus`, latest report health fields | keep route, rename terminology and add acknowledge/close only after write API/auth exists |
| Live tracking | Vessel position and connectivity map | latest position from `highfrequencydata`, joined to `ship`, with `vsatheartbeat` freshness | keep route/component idea, replace road polylines and truck interpolation |
| Fleet / Vehicles | Vessels | `ship`, `fleet`, `voyageforecast`, connectivity status, latest report | keep route, rename page and fields to IMO/MMSI/flag/homeport/status/ETA |
| Routes | Voyages and port calls | `voyageforecast`, `vesseljourneycounter`, port codes/names in forecast/report data | keep route only if product wants a voyage list; do not assume a populated route master |
| Analytics | Fleet performance, fuel, emissions, CII | `std_enoonreporttable.noonreportdata`, `graphdata`/`newgraphdata`, CII tables, standardized parameters | keep route, replace shipment metrics with selected vessel/date/fleet queries |
| Tracking | Vessel lookup/detail | `ship` plus current forecast, latest report, connectivity and recent advisories | keep public lookup concept only if authorization policy permits it |
| Shipment detail | Vessel detail | `ship`, metadata, voyage, latest report, parameter health, alerts, instructions | repurpose dynamic route; remove consumer/parcel timeline |
| Settings / Workspace | User, fleet, parameter and dashboard configuration | `std_user`, `usermapping`, `widgetlayout`, `screen_config`, `resource_config`, parameter tables | keep route, split profile from admin configuration |
| Containers, inventory, catalog, customers, drivers, warehouses, distribution centers, new order | No direct marine equivalent found | no populated canonical counterpart identified | hide/remove from navigation before replacing with invented marine pages |

## Target read-model contracts

Implement the server boundary around small, stable response contracts rather than returning database rows directly:

1. `VesselSummary`: `id`, `name`, `imo`, `mmsi`, `callsign`, `flag`, `homeport`, `category`, `fleet`, `registeredCompany`, `isDeleted`, `hasCameraAi`.
2. `VesselLiveState`: vessel id, report/packet timestamp, latitude, longitude, speed, course, next port, ETA, connectivity state, and source. The initial telemetry source is `highfrequencydata`; the adapter must document the approved packet keys and fallback behavior when a packet lacks position.
3. `VoyageSummary`: vessel id, journey counter, last port, next port, UN/port codes, route name, distance travelled/to-go, ETA, voyage start, and load status.
4. `NoonReportSummary`: vessel id, report timestamp/type, position, speed, distance, drafts, fuel consumed/remaining, weather/sea state, destination, and selected engine values. Dynamic JSON keys must be selected through `parametermapping`/standard parameter definitions rather than copied wholesale.
5. `OperationalAlert`: advisory/outcome id, vessel id/name, category, machinery/system, observation/description, action, reported time, acknowledgement state, and closure state.
6. `ConnectivitySummary`: current status per vessel plus latest update and a bounded history series from `vstconnectivitystatus` and its history table.

Each contract must include an explicit `source`, timestamp, and nullable fields for missing data. Dates are timezone-aware where possible; report tables contain both text and timestamp variants, so normalize once in the server adapter.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Install | `npm install` | exit 0; lockfile reflects only intentional dependencies |
| Build | `npm run build` | exit 0 |
| Static generation check | `npm run generate` | exit 0 if static generation remains supported; if live server routes make this invalid, stop and document the deployment decision |
| Type check | `npx vue-tsc --noEmit` | exit 0; this repo has no `typecheck` script yet |
| Test discovery | `find . -maxdepth 3 -type f -name '*test*' -o -name '*spec*'` | report current absence/presence before adding tests |

The application currently has no test or lint scripts in `package.json`. Do not claim test/lint success until scripts are deliberately added or an existing command is verified.

## Scope

**In scope for this plan**:

- Nuxt server-side database adapter and read-only marine contracts.
- Environment-based database configuration with no credentials committed to the repository.
- Replacing mock reads on the dashboard, control tower, live map, fleet, routes, analytics, tracking, and settings surfaces.
- Marine navigation labels and route-level authorization decisions.
- Adapter tests using fixtures for nulls, duplicate timestamps, empty partitions, malformed JSON, and vessel-not-found cases.

**Out of scope**:

- Browser-to-PostgreSQL connections.
- Reusing or displaying plaintext password fields from `std_user` or `shipusers`.
- Any write operation until a real session/role model and CSRF/auth policy exist.
- Deleting database tables, renaming database tables, migrations, or data cleanup.
- Adding a port master, route master, cargo/container system, billing, customer orders, or truck/driver tracking without a product decision and source data.
- Querying or shipping full telemetry partitions to the client.

## Steps

### Step 1: Freeze the source contract and credential boundary

Create a server-only runtime configuration contract for the database connection and document the chosen environment variable names in a non-secret example file. Keep the database password out of source control and out of client-exposed runtime config. Confirm whether production will use a separately provisioned least-privilege application role rather than the current read-only inspection account; do not proceed with writes until this is answered.

Profile the candidate canonical sources using schema metadata and bounded aggregate queries. Record for each source: primary key, vessel key, event timestamp, row availability, partitioning, and whether JSON values are object/array. Resolve the duplicate choices (`standardparameters` vs `standard_parameters`, standard vs raw telemetry, legacy vs `std_*` report tables) in a checked-in data contract document without recording sensitive row values.

**Verify**: `git grep -nE 'PG_PASSWORD|PG_HOST|PG_USER|PG_DATABASE' -- ':!plan.txt'` → no committed application source contains the database settings; `npm run build` → exit 0.

### Step 2: Add a server-side read adapter

Add one server-only module that owns parameterized queries and row-to-contract mapping. Use bounded queries with explicit columns, vessel/date filters, ordering, and limits. For latest-per-vessel queries, use a PostgreSQL query shape that preserves index/partition pruning and returns one record per vessel. Do not use `SELECT *`, concatenate request values into SQL, or return raw JSONB blobs.

Expose only read endpoints needed by the first UI slice, for example vessel list/detail, live states, voyage list, dashboard summary, analytics series, and alert list. Validate route query parameters at the boundary and return stable error responses for invalid dates, IDs, and limits. Keep database imports out of `app/pages` and client bundles.

**Verify**: `npx vue-tsc --noEmit` → exit 0; `npm run build` → exit 0; inspect the generated server bundle or dependency graph to confirm the database driver is not included in the browser bundle.

### Step 3: Replace the vessel roster and live operations surfaces first

Convert `app/pages/fleet.vue`, `app/pages/live.vue`, and `app/pages/control-tower.vue` from mocks to the read endpoints. Preserve the existing table/card/map primitives and loading/empty/error states. Use `ship` as the vessel identity, forecast/report timestamps for freshness, and connectivity/advisory data for status. For the map, render only bounded latest positions; never interpolate a vessel position from a shipment progress percentage.

For alerts, keep acknowledgement and closure controls visually unavailable or read-only until a real authenticated write endpoint exists. Do not label missing data as healthy or on-time.

**Verify**: `npm run dev -- --host 127.0.0.1` → the three routes render without console errors; `npm run build` → exit 0; a fixture with no live position shows an explicit unavailable state.

### Step 4: Replace dashboard, voyage, analytics, tracking, and settings data

Migrate `app/pages/dashboard.vue`, `app/pages/routes.vue`, `app/pages/analytics.vue`, `app/pages/tracking.vue`, `app/pages/shipments/[id].vue`, and `app/pages/settings/index.vue` to the marine contracts. Rename visible concepts from shipments/orders/customers/drivers to vessels/voyages/alerts/users where the route is retained. Replace hard-coded chart series with server-provided bounded series and label the time zone/source.

Repurpose or remove navigation entries for containers, inventory, catalog, customers, drivers, warehouses, distribution centers, and new order. Add marine entries only for surfaces backed by a validated source, such as Vessels, Live operations, Voyages, Noon reports, Alerts, Performance, Parameters, and Administration.

**Verify**: `rg -n 'shipment|bike|customer|driver|warehouse|container|last-mile|carrier' app/pages app/components app/lib/nav.ts` → no matches remain in marine-replaced surfaces except deliberately documented compatibility code; `npm run generate` → either exit 0 or produce a documented deployment STOP report if server-backed rendering is incompatible.

### Step 5: Add characterization and adapter tests before enabling writes

Add the smallest test setup already compatible with the project, focused on pure row mappers and query parameter validation. Cover: vessel with missing optional fields, newest timestamp selection, duplicate timestamps with deterministic tie-break, empty/unknown vessel, malformed JSONB shape, array weather data, null report fields, invalid date range, maximum limit, and an advisory with no acknowledgement.

Keep integration tests against PostgreSQL optional and explicitly gated by environment configuration; the normal test command must run without production database access.

**Verify**: the new test command exits 0 without database credentials; `npm run build` exits 0; `git status --short` shows only intended files.

## Done criteria

- [ ] The browser has no PostgreSQL driver, connection string, or database credential.
- [ ] Every live marine page reads a typed server contract rather than a mock or raw database row.
- [ ] `ship` is the canonical vessel identity source and every telemetry/report query includes a vessel/time bound.
- [ ] Duplicate/empty/legacy table choices are documented and no silent fallback occurs.
- [ ] Dashboard, control tower, live map, fleet, voyage, analytics, tracking, and settings surfaces use marine vocabulary and real read data.
- [ ] Non-marine shipment-template pages are hidden or explicitly marked out of scope.
- [ ] Adapter tests run without production database access and cover null/empty/malformed data paths.
- [ ] `npx vue-tsc --noEmit` and `npm run build` exit 0.
- [ ] Database credentials are supplied only through deployment secrets; the credential exposed in `plan.txt` has been rotated and the file is removed from tracked/project-shared content.
- [ ] `docs/superpowers/plans/README.md` status row is updated.

## STOP conditions

Stop and report instead of improvising if:

- The live schema does not contain the columns or row availability recorded above.
- A proposed canonical table is empty in the target environment and no owner confirms its replacement.
- The application role cannot read only the required tables or would require using a password column for browser authentication.
- A required join has no foreign key and cannot be confirmed from owner-provided data semantics.
- Latest telemetry requires scanning an unbounded partition or returning raw JSONB at UI scale.
- The chosen server route strategy breaks the documented static deployment target and no deployment decision is available.
- A page change requires inventing cargo, port, route, or alert semantics not represented by the database.
- Any source file outside the stated scope appears necessary; pause and update the plan first.

## Maintenance notes

- Keep all SQL and source-to-contract mapping in the server adapter; page components should only consume contracts.
- Recheck partition names and timestamp boundaries as new monthly partitions are created.
- Review standard parameter mappings when new vessel models introduce new telemetry names or units.
- Treat `old_v1_*`, empty report variants, and raw telemetry tables as compatibility sources, not automatic fallbacks.
- Before adding alert acknowledgement, report approval, configuration editing, or user management, create a separate security plan for sessions, server-side authorization, CSRF protection, audit logging, and least-privilege write roles.
