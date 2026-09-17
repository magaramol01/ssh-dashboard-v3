# Plan 001: Build a custom NOAA-backed voyage optimizer

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row in
> `plans/README.md`.
>
> **Drift check (run first)**: `git status --short` and
> `git diff --stat a474608..HEAD -- app/lib/voyage-optimization.ts app/composables/useVoyageOptimization.ts app/components/voyage server tests/marine/voyage-optimization.test.ts`.
> The worktree already contains unrelated camera/live-map changes and an
> existing voyage header layout fix. Preserve them; do not reset or reformat
> unrelated files.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH — this introduces weather-data coverage gaps and route-scoring logic
- **Depends on**: none
- **Category**: feature / correctness
- **Planned at**: commit `a474608`, 2026-09-17

## Why this matters

The reference image shows the voyage strategy selector: Current, Lowest Fuel,
Safest, and Fastest. The existing implementation already renders that control,
but its alternate routes are synthetic percentage estimates rather than a real
weather-aware route calculation. The requirement is now explicit: do not use
the VPM API or the VPM Python optimizer services; build the route/weather
program in this Nuxt project and use NOAA/NWS weather data.

The NOAA API can provide point-to-grid mapping, raw grid forecasts, and alerts,
but it is not a global open-ocean routing service. The implementation must be
honest about that limitation: use NOAA grid data where it exists, report
uncovered route legs, and never fill missing ocean weather with fake values.

The Route Strategies Comparison must also include an AI weather interpretation
layer. The AI may explain and recommend among the deterministic routes using
NOAA-derived evidence, but it must never invent weather, coordinates, fuel
metrics, or route geometry. The deterministic custom scorer remains the source
of truth; AI is an evidence-backed advisor layered on top.

## NOAA capabilities to use

Source: `https://api.weather.gov/openapi.json` and
`https://www.weather.gov/documentation/services-web-api`.

### Primary route-weather endpoints

1. `GET /points/{latitude},{longitude}`
   - Round coordinates to the documented 0.0001-degree precision.
   - Send a unique `User-Agent` identifying this application and a contact
     address, plus `Accept: application/geo+json`.
   - Read `properties.type`, `forecastGridData`, `forecast`,
     `forecastHourly`, `observationStations`, `forecastZone`, and
     `timeZone` from the response. Do not construct a grid URL by guessing the
     office; follow the returned `forecastGridData` URL.
   - Cache point-to-grid mappings and periodically recheck them because the
     mapping can change.

2. `GET {properties.forecastGridData}` from `/points`
   - This is the primary forecast source for coastal marine data. The NWS
     documentation says coastal marine grid forecasts are available through
     `forecastGridData`; do not make `/forecastHourly` the marine source.
   - Normalize the available time-value layers when present:
     `windSpeed`, `windDirection`, `windGust`, `waveHeight`, `wavePeriod`,
     `waveDirection`, `primarySwellHeight`, `primarySwellDirection`,
     `secondarySwellHeight`, `secondarySwellDirection`, `wavePeriod2`,
     `windWaveHeight`, `visibility`, `pressure`, `weather`, and `hazards`.
   - Preserve each layer's `uom`, `validTime`, and values. A layer may be
     absent in an otherwise valid response.

3. `GET /alerts/active?point={lat},{lon}` and/or the alert-zone link from
   `/points`
   - Use active alerts to annotate/reject coastal route candidates when an
     alert intersects a sampled point. Preserve `event`, `severity`,
     `urgency`, `certainty`, `effective`, `expires`, `headline`, and
     `description`.
   - Do not treat every alert as a hard route block. Define the hard-block
     event/severity policy in one small function and test it.

### Optional/supporting endpoints

- `GET /gridpoints/{wfo}/{x},{y}/forecast/hourly` is useful for a human-facing
  coastal timeline where hourly text is available, but it is not the primary
  open-water route source.
- `GET /gridpoints/{wfo}/{x},{y}/forecast` is useful for a compact 12-hour
  coastal summary.
- `GET /stations/{stationId}/observations/latest` can show a nearby observed
  condition for context. It must not be used as continuous route weather.
- `/stations` and `/stations/{stationId}/observations` are not needed for the
  first route-scoring version.

### Non-capabilities and hard constraints

- NWS grid forecasts are produced by local forecast offices on roughly 2.5 km
  grids and are not documented as a global open-ocean forecast product.
- The current demo corridor PECLL → CNNDE crosses the Pacific; most of that
  route will not have NWS marine grid coverage. The program must return a
  coverage report such as `{ coveredLegs, uncoveredLegs, warnings }` and mark
  affected strategy results as `partial` or `unavailable` according to the
  configured policy.
- NWS does not provide a documented route-optimization endpoint or a reliable
  global ocean-current layer in this API. Do not claim current-aware routing.
  Fastest/Lowest Fuel must state that they use vessel speed plus available
  wind/wave penalties only.
- There is no API key requirement for ordinary use, but the documented
  `User-Agent` is required. Cache responses, respect response freshness, and
  retry transient failures conservatively; NWS rate limits are unpublished.

## Current state

- `app/components/voyage/VoyageOptimizationHeaderBar.vue:105-149` already
  renders the requested four-option control. Line 127 hard-codes `-19%` and
  must become data-driven.
- `app/composables/useVoyageOptimization.ts:51-66` currently depends on
  `useVesselDashboard`, and lines `147-180` compute all strategy data from
  VPM-backed MRV/CII/map state. The custom optimizer must not call VPM for its
  route-weather request.
- `app/lib/voyage-optimization.ts:96-113` defines the UI route-strategy
  contract. Lines `327-331` explicitly identify the alternate routes as
  modeled estimates; lines `333-455` implement fixed speed percentages and
  synthetic waypoint offsets.
- `app/components/voyage/VoyageOptimizationMap.vue` renders the selected
  strategy's `waypoints`, so the custom program should normalize to the
  existing Leaflet `[lat, lng]` shape.
- `app/components/voyage/VoyageOptimizationKpiHud.vue` and
  `VoyageOptimizationDrawer.vue` consume strategy fuel, ETA, speed, and
  warnings. They need explicit loading/partial/unavailable states.
- `server/utils/http-adapter.ts:24-25,44-125` is the existing VPM HTTP adapter.
  Do not use it in the new optimizer path.
- `package.json:6-12` provides the verified checks: `npm test` and
  `npm run build`.

## Proposed custom program

Implement the smallest server-side TypeScript pipeline using native `fetch`,
`zod` already installed in `package.json`, and deterministic math. Do not add a
Python service or new dependency.

### Input contract

Create a private server request shape containing:

```ts
{
  origin: { lat: number; lon: number }
  destination: { lat: number; lon: number }
  seedWaypoints?: Array<{ lat: number; lon: number }>
  departureAt: string
  vessel: {
    cruisingSpeedKts: number
    minSpeedKts: number
    maxSpeedKts: number
    fuelRateMtPerDay: number
    deadweightMt: number
  }
  constraints: {
    maxWindKts?: number
    maxWaveHeightM?: number
    maxSwellHeightM?: number
  }
}
```

The browser may select a local/custom vessel profile and route fixture, but it
must not select a NOAA URL, filesystem path, or arbitrary fetch target. Validate
finite coordinates, coordinate ranges, positive vessel values, valid ISO time,
and bounded route lengths.

### NOAA client

Create `server/utils/noaa-weather.ts` with three small responsibilities:

1. `resolvePointGrid(lat, lon)` calls `/points` with rounded coordinates,
   required headers, timeout, and a cache keyed by rounded coordinates.
2. `fetchGridForecast(gridUrl)` retrieves and caches the returned
   `forecastGridData` document using its URL only after validating it is an
   `https://api.weather.gov/` URL. Cache by URL and respect `ETag`/
   `Last-Modified` when available.
3. `fetchActiveAlerts(point)` retrieves active alerts with the same headers and
   returns normalized alert metadata. Deduplicate alerts by `id`.

Implement a time-series extractor that parses NOAA `validTime` intervals into
UTC samples and converts only documented units needed by the scorer. Keep
missing layers as `undefined`; never turn missing wave/current data into zero.
Use one bounded request concurrency pool and cache point/grid results so a route
with adjacent samples does not trigger a request storm.

### Route candidates and scoring

Create `server/utils/custom-route-optimizer.ts`:

1. Build a baseline great-circle route from origin to destination, or use the
   supplied seed waypoints after validating them. Split it into deterministic
   sample legs no longer than a configured distance.
2. Generate a small fixed set of candidate corridors around the baseline using
   spherical destination-point math. Do not build a general A*/mesh system in
   this first version.
3. For every candidate leg, estimate arrival time from the selected speed,
   query the NOAA time series at the leg midpoint, and record coverage.
4. Apply hard constraints only when the corresponding NOAA layer exists and is
   valid. If a required layer is absent, mark the leg `uncovered` rather than
   declaring it safe.
5. Score the same candidate set with three objectives:
   - **Fastest**: minimize estimated transit hours plus wind/wave resistance
     penalty; do not use ocean-current claims.
   - **Lowest Fuel**: minimize deterministic fuel burn using the vessel's
     cube-law speed model plus available wind/wave penalty; report the
     baseline used.
   - **Safest**: reject candidates violating configured wind/wave/swell limits,
     alert hard-block policy, or land/invalid geometry; minimize risk and then
     distance among remaining candidates.
6. Return route waypoints, leg speeds, total distance, ETA hours, fuel total,
   savings versus the Current baseline, selected objective, coverage summary,
   alerts, and warnings. Include a `dataBasis` field stating `noaa-grid`,
   `partial-noaa-grid`, or `unavailable`.

Keep formulas in named pure functions and document their limits. The output is
an operational estimate, not a navigational command.

## Scope

**In scope — only these files may be modified or created:**

- `nuxt.config.ts` — private NOAA base URL, User-Agent/contact, timeout, cache
  TTL, and scoring limits if runtime configuration is needed.
- `server/utils/noaa-weather.ts` — new NOAA client/cache/normalizer.
- `server/utils/custom-route-optimizer.ts` — new deterministic candidate and
  scoring engine.
- `server/api/voyage/optimize.post.ts` — new validated endpoint for the custom
  program.
- `app/mocks/voyage-optimization.ts` — new deterministic local/custom voyage
  and vessel profiles, if the page needs a non-VPM input source.
- `app/lib/voyage-optimization.ts` — live result types/normalization and remove
  synthetic alternate-route generation from the active path.
- `app/composables/useVoyageOptimization.ts` — call only the new custom endpoint
  for route strategies; keep existing CII rendering separate unless the user
  explicitly requests full-page VPM removal.
- `app/components/voyage/VoyageOptimizationHeaderBar.vue` — dynamic savings and
  coverage status while preserving the image control.
- `app/components/voyage/VoyageOptimizationKpiHud.vue` — live/partial/
  unavailable metric states and NOAA basis label.
- `app/components/voyage/VoyageOptimizationDrawer.vue` — route coverage,
  warnings, alerts, score details, and the AI strategy recommendation.
- `app/components/voyage/VoyageOptimizationMap.vue` — validated route geometry
  and uncovered-leg styling/legend.
- `server/utils/voyage-strategy-advisor.ts` — new AI-only explanation and
  recommendation layer using structured NOAA/scorer evidence.
- `server/api/voyage/strategy-advisor.post.ts` — new validated AI advisor
  endpoint; it must not call VPM tools or accept arbitrary prompts/URLs.
- `shared/types/voyage-optimization.ts` — new shared schemas/types if keeping
  advisor request/response types out of app/server modules is cleaner.
- `tests/marine/voyage-optimization.test.ts` — pure route normalization/scoring
  tests following the existing node:test style.
- `tests/server/noaa-weather.test.ts` — mocked NOAA response tests.
- `tests/server/custom-route-optimizer.test.ts` — deterministic scoring,
  coverage-gap, constraint, and alert-policy tests.
- `tests/server/voyage-strategy-advisor.test.ts` — mocked AI response,
  validation, prompt-evidence, and fallback tests.

**Out of scope:**

- Any file under `/home/developer/Desktop/DAY TO DAY/vpm/voyagepm_be`; use it
  only as historical/reference context and do not call its APIs or services.
- Any VPM endpoint in the new route-weather path, including
  `server/utils/http-adapter.ts`.
- Full global ocean-current data, satellite data, or a replacement for NOAA's
  missing open-ocean coverage.
- Navigation-grade routing, autopilot commands, or production voyage dispatch.
- Camera/live-map files and the existing header overlap fix.
- A real EU ETS or charter-party feed; those remain separate modeled inputs.

## Steps

### Step 1: Freeze the custom input and coverage policy

Add deterministic local/custom voyage and vessel inputs or document the existing
caller that supplies them. Decide and encode the first-version policy:

- `safest` requires complete coverage for every scored leg and returns
  unavailable when a required weather layer is missing;
- `fastest` and `lowest-fuel` may return `partial` only when uncovered legs are
  clearly labeled and excluded from weather claims;
- Current remains the supplied baseline route and must never be labeled NOAA
  optimized.

Do not pull vessel/voyage fields from `useVesselDashboard` for the new route
request. If the product still needs the existing CII panel, leave that legacy
read path isolated and call out that it is not part of the custom optimizer.

**Verify**: a unit fixture can build a complete request without any `/api/vessels`
call or `backendFetch` dependency.

### Step 2: Implement and test the NOAA client

Create the NOAA client with required headers, URL validation, timeouts,
point/grid/alert caches, bounded concurrency, unit normalization, and missing
layer handling. Add mocked fixtures for:

- marine point with `forecastGridData`;
- grid response containing wind and wave/swell layers;
- missing marine layers;
- point outside usable NWS coverage;
- active marine/coastal alert;
- transient 5xx/429 response.

Use `forecastGridData` as the route source. Keep `/forecastHourly` optional and
only for a coastal human-facing summary.

**Verify**: `npm test -- tests/server/noaa-weather.test.ts` → all fixtures pass;
no test performs live NOAA calls.

### Step 3: Implement the custom deterministic optimizer

Create the baseline/candidate generation, NOAA sample lookup, coverage
accounting, hard constraint policy, and three objective scorers. Keep all
coordinate conversions explicit: internal route output for Leaflet is
`[lat,lng]`; NOAA and service requests use `{lat,lon}`.

Add an output normalizer that produces the existing `RouteStrategyOption`
fields plus `coverage`, `warnings`, `alerts`, and `dataBasis`. Do not use
`Date.now()` inside pure scoring functions; pass `departureAt` into them.

**Verify**: `npm test -- tests/server/custom-route-optimizer.test.ts` → fixed
fixtures produce stable routes, fastest is not slower than the same candidate's
baseline, lowest-fuel does not claim savings without a baseline, and safest
rejects a candidate over its configured limit.

### Step 4: Add the Nuxt endpoint and replace synthetic strategy data

Create `server/api/voyage/optimize.post.ts` to validate input, call the custom
optimizer, and return only the normalized public response. Return structured
400/502/504 errors without upstream response bodies or internal details.

Update `useVoyageOptimization.ts` to load the three objective results from this
endpoint, deduplicate by input hash, cancel/ignore stale requests on input
change, and expose loading/errors/coverage. Remove the active use of the fixed
percentage strategy generator and synthetic safe-route offsets in
`app/lib/voyage-optimization.ts`.

**Verify**: `npm test -- tests/marine/voyage-optimization.test.ts` → existing
CII tests remain green and new tests prove route strategies use NOAA fixture
responses, not synthetic percentages.

### Step 5: Add the AI weather advisor to Route Strategies Comparison

Create a dedicated advisor endpoint after deterministic route results are
available. Do not reuse `server/api/sentinel/chat.post.ts` or
`server/utils/sentinel/agent.ts`: the existing Sentinel agent has operational
VPM-backed tools (`server/utils/sentinel/tools.ts`) and an open-ended chat
contract, which violates this feature's no-VPM requirement.

Reuse only the existing provider/configuration pattern from
`server/utils/sentinel/config.ts:3-18` and the installed
`@langchain/openrouter` dependency. The advisor request must contain only a
bounded, server-created evidence packet:

- each available strategy's ID, distance, ETA, fuel, speed, score, and basis;
- NOAA coverage status and sampled wind/wave/swell summaries with timestamps;
- normalized active alerts and severity metadata;
- configured vessel constraints and the deterministic scorer's selected
  recommendation.

Do not send raw unbounded grid payloads, secrets, user-supplied URLs, or VPM
records. Treat NOAA alert descriptions as untrusted data, not instructions.
Use a low-temperature model and a strict zod response schema such as:

```ts
{
  recommendedStrategy: 'current' | 'lowest-fuel' | 'safest' | 'fastest'
  confidence: 'low' | 'medium' | 'high'
  summary: string
  reasons: string[]
  weatherDrivers: Array<{ label: string; effect: 'supports' | 'penalizes' | 'unknown'; sourceTime: string }>
  tradeoffs: Array<{ strategy: string; text: string }>
  warnings: string[]
}
```

The server must reject output that recommends an unavailable strategy,
contains unknown strategy IDs, exceeds text/array limits, or conflicts with
hard safety constraints. If the AI call fails or returns invalid JSON, return
`advisor: null` plus the deterministic recommendation; route computation and
comparison must still work. AI must not return or modify waypoints or numeric
route metrics.

In `VoyageOptimizationDrawer.vue:249-307`, replace the text saying alternates
are modeled estimates with the NOAA basis/coverage text. Add a compact
"Weather AI recommendation" panel above the strategy cards showing the
recommendation, confidence, short evidence reasons, key NOAA drivers, and a
warning when coverage is partial. Keep the existing four cards as the factual
comparison surface; AI is an explanation layer, not the only way to select a
route.

**Verify**: `npm test -- tests/server/voyage-strategy-advisor.test.ts` → valid
advisor output parses, invalid recommendations are rejected, prompt payloads
contain only the evidence packet, and a provider failure returns `advisor:null`
without failing route results.

### Step 6: Connect the screenshot control and map states

Keep the existing Current/Lowest Fuel/Safest/Fastest control. Replace the
hard-coded `-19%` with measured custom-program savings. Disable or label an
unavailable strategy, show `partial-noaa-grid` warnings, and keep Current
available when an alternate objective fails.

Update HUD/drawer values to show ETA, speed, fuel, coverage, NOAA basis, and
alerts. Update the map legend and route styling so uncovered legs are visually
obvious; do not render missing weather as calm weather.

**Verify**: run the app and capture both a wide screenshot and the reported
short-height viewport. Click all four controls. Expected: active route changes,
NOAA coverage/warnings and the AI recommendation are visible, no fake `-19%`
appears, and the existing header/map/drawer layout does not overlap.

### Step 7: Full regression verification

Run the full suite and production build. Confirm no new route-weather code
imports `backendFetch`, `/api/vessels`, or any path under the VPM checkout.

**Verify**:

- `npm test` → exit 0;
- `npm run build` → exit 0;
- `rg -n "backendFetch|/api/vessels|voyagepm_be" server/utils/noaa-weather.ts server/utils/custom-route-optimizer.ts server/api/voyage/optimize.post.ts app/composables/useVoyageOptimization.ts` → no matches in the custom path;
- browser screenshot at `/aesm/voyage-optimization` → no hydration/error overlay,
  no layout overlap, and explicit coverage state;
- `git status --short` → only Scope files are changed by this plan; preserve
  unrelated pre-existing worktree changes.

## Test plan

- `tests/server/noaa-weather.test.ts`: point URL precision, User-Agent,
  forecastGridData selection, cache hits, TTL/revalidation, missing layers,
  alert normalization, invalid URLs, 429/5xx retry behavior, and no live network.
- `tests/server/custom-route-optimizer.test.ts`: deterministic great-circle /
  candidate generation, time interpolation, fastest/fuel/safest scoring,
  missing-coverage policy, threshold rejection, alert policy, and stable ETA.
- `tests/server/voyage-strategy-advisor.test.ts`: strict schema parsing,
  allowed-strategy enforcement, evidence-only prompt construction, hard-safety
  conflict rejection, and graceful AI-unavailable fallback.
- `tests/marine/voyage-optimization.test.ts`: UI type normalization,
  coordinate order, savings/basis labels, advisor display data, and
  unavailable/partial states.
- Browser smoke tests: wide desktop plus the short-height screenshot viewport;
  verify keyboard access for the four strategy buttons.

## Done criteria

- [ ] New route-weather code uses NOAA/NWS only and does not call VPM APIs.
- [ ] `/points`, returned `forecastGridData`, and active alerts are used with
      required `User-Agent` and caching.
- [ ] Missing/global-open-ocean coverage is explicit; no zero-weather or fake
      calm fallback is used.
- [ ] Fastest, Lowest Fuel, and Safest are produced by the custom program with
      deterministic, documented scoring; Current remains the baseline.
- [ ] The screenshot control displays real savings/status instead of hard-coded
      estimates.
- [ ] Map/HUD/drawer show coverage, warnings, alerts, and the AI weather
      recommendation with confidence/evidence.
- [ ] AI cannot alter route geometry or numeric strategy metrics, and AI failure
      does not block deterministic route comparison.
- [ ] `npm test` exits 0.
- [ ] `npm run build` exits 0.
- [ ] No files outside Scope are modified by this plan.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

Stop and report instead of improvising if:

- NOAA `/points` or `forecastGridData` does not provide usable marine layers
  for the target route and product requirements demand global open-ocean
  guarantees.
- The chosen deployment cannot make outbound HTTPS requests to
  `api.weather.gov` or cannot provide the required User-Agent contact.
- A NOAA response uses a unit or `validTime` format not covered by the
  normalizer, or a required layer is missing and the policy is undefined.
- Someone asks to fill open-ocean gaps with VPM data, invented values, or an
  undocumented third-party source.
- Someone asks the AI to generate coordinates, replace the deterministic
  scorer, or recommend a strategy that violates a hard NOAA/weather constraint.
- The only available AI path is the existing Sentinel agent with VPM-backed
  tools; add a dedicated evidence-only advisor instead of reusing it.
- Existing scoped files drift after the plan's SHA and the current behavior no
  longer matches the excerpts.
- Implementing the feature requires editing the VPM backend/services or
  exposing upstream response bodies/internal errors to the browser.

## Maintenance notes

- NOAA grid mappings and forecast layer availability can change. Keep mapping
  cache invalidation and missing-layer behavior tested.
- NWS rate limits are unpublished. Keep concurrency low, cache aggressively,
  honor freshness headers, and retry only transient failures.
- If global open-ocean routing becomes a requirement, add a separate provider
  and explicit data-fusion design; do not hide the gap inside this NOAA client.
- Keep the AI advisor grounded in the deterministic evidence packet. Reviewers
  should scrutinize prompt size, output validation, model failure behavior, and
  the distinction between AI explanation and route authority.
- The route scorer is an advisory estimate. Reviewers should scrutinize units,
  UTC time interpolation, coordinate order, and the distinction between
  uncovered and calm conditions.
