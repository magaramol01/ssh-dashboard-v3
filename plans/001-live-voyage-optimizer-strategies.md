# Plan 001: Replace modeled voyage strategies with live optimizer routes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row in
> `plans/README.md`.
>
> **Drift check (run first)**: `git status --short` and
> `git diff --stat a474608..HEAD -- app/lib/voyage-optimization.ts app/composables/useVoyageOptimization.ts app/components/voyage server server tests/marine/voyage-optimization.test.ts`.
> The worktree already contains unrelated camera/live-map changes and an
> existing voyage header layout fix. Preserve them; do not reset or reformat
> unrelated files.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH — this replaces user-visible route metrics and invokes external optimization processes
- **Depends on**: none, but the service-runtime contract must be confirmed in Step 1
- **Category**: feature / correctness
- **Planned at**: commit `a474608`, 2026-09-17

## Why this matters

The reference image shows four voyage choices — Current, Lowest Fuel, Safest,
and Fastest — but the current screen only simulates three alternatives with
fixed percentages. `app/lib/voyage-optimization.ts:327-331` explicitly says the
non-current strategies are modeled estimates, and lines `348-373` hard-code
speed, distance, fuel, and route offsets. That makes the map and KPI cards look
live while not using the real route optimizers in
`/home/developer/Desktop/DAY TO DAY/vpm/voyagepm_be/services`.

After this plan, Current remains the live vessel corridor, while Lowest Fuel,
Safest, and Fastest use the real optimizer outputs for geometry, ETA, speed,
fuel, and warnings. Failed or unavailable optimizers must be visible as
unavailable; never silently recreate the old percentage estimates.

## Current state

- `app/components/voyage/VoyageOptimizationHeaderBar.vue:105-149` already renders the target segmented control with the four labels/icons. Do not rebuild it. Its `-19%` badge is currently hard-coded at line 127.
- `app/composables/useVoyageOptimization.ts:147-180` computes `routeStrategies` locally from CII totals, MRV distance, average speed, and `calculateRouteStrategies`; no optimizer endpoint is called.
- `app/lib/voyage-optimization.ts:96-113` defines the UI `RouteStrategyOption` shape. Lines `327-331` document that only Current is live. Lines `333-455` generate the modeled routes, use `Date.now()` for ETA, and create synthetic waypoint offsets for Safest.
- `app/components/voyage/VoyageOptimizationMap.vue` consumes `routeStrategies`, `activeStrategy`, and `waypoints` to draw the selected route. Preserve that contract where possible so map rendering remains a small change.
- `app/components/voyage/VoyageOptimizationKpiHud.vue` and `VoyageOptimizationDrawer.vue` consume the same strategy metrics. They should display live values and clear unavailable/error states rather than inventing replacements.
- `app/pages/voyage-optimization.vue:31-36` already loads vessel, map, and weather data on mount. The page does not need a second fetch loop; the composable should own optimizer loading and vessel-change invalidation.
- `server/utils/http-adapter.ts:24-25,44-125` is the existing authenticated external-backend adapter. It handles HTTP, but this repository currently has no route-optimizer API route.
- `package.json:6-12` provides the only verified project checks: `npm test`, `npm run build`, and related Nuxt commands.

### Reference service contract

The Python services are reference data, not files to copy:

- `.../services/ro-fastest-route-optimizer/scripts/run_stdin_route.py:2-6`
  defines a Node-spawned stdin JSON/stdout JSON process. Its request fields
  are documented at lines 8-42 and include `start`, `end`, `vessel_id`,
  `voyage_id`, `voyage_type`, `depart_at`, optional `navapi_waypoints`,
  `vessel_details`, `storms`, safety limits, and CP overrides.
- Fastest returns `path_found`, `waypoints`, `total_distance_nm`, `eta_hours`,
  `leg_speeds_kts`, `total_fuel_mt`, `fallback_rate`, `method`, and `message`
  at lines 44-58 and 169-216.
- `.../services/ro-lowest-fuel-optimizer/scripts/run_stdin_route.py:44-79`
  adds the authoritative fuel comparison fields
  `fuel_saved_vs_cp_baseline_mt`, `fuel_savings_pct`,
  `baseline_validation_passed`, and per-leg `legs`; the serialized result is
  built at lines 166-192.
- `.../services/ro-safest-route-optimizer/scripts/run_stdin_route.py:58-74`
  treats storm and danger weather limits as hard blocks. Its response shape is
  documented at lines 58-69 and emitted at lines 162-182. `path_found:false`
  is a valid no-route outcome, not a reason to draw a guessed route.
- All three reference packages use authenticated upstream vessel/storm data in
  the Node backend contract. Fastest documents this at lines 15-20 of its
  stdin script; Safest documents it at lines 25-35 and 44-56. The Nuxt server
  must either supply those fields or use an existing authenticated HTTP
  endpoint that already does so.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Unit tests | `npm test -- tests/marine/voyage-optimization.test.ts` | Existing and new voyage tests pass |
| Full tests | `npm test` | Exit 0 |
| Production build | `npm run build` | Exit 0 |
| Browser smoke test | `google-chrome --headless --disable-gpu --no-sandbox --hide-scrollbars --window-size=1440,900 --virtual-time-budget=8000 --screenshot=/tmp/voyage-optimization-live.png http://localhost:3340/aesm/voyage-optimization` | Screenshot is produced; page renders without an error overlay |

## Scope

**In scope — only these files may be modified or created:**

- `nuxt.config.ts` — private runtime configuration for Python/service paths and timeout, only if local process execution is selected.
- `server/utils/voyage-route-optimizer.ts` — new, server-only process/HTTP adapter and response normalization.
- `server/api/voyage/route-optimization.post.ts` — new validated server endpoint.
- `app/lib/voyage-optimization.ts` — replace synthetic alternate-route generation with live-result normalization; preserve CII/advisory helpers.
- `app/composables/useVoyageOptimization.ts` — fetch/cache/refresh optimizer results and expose loading/error state.
- `app/components/voyage/VoyageOptimizationHeaderBar.vue` — derive the Lowest Fuel badge and unavailable/refresh states from live data.
- `app/components/voyage/VoyageOptimizationKpiHud.vue` — show live basis/status and avoid presenting unavailable values as numbers.
- `app/components/voyage/VoyageOptimizationDrawer.vue` — show optimizer method/warnings and disable selection for no-route strategies.
- `app/components/voyage/VoyageOptimizationMap.vue` — render only validated live waypoints and handle an unavailable active strategy safely.
- `tests/marine/voyage-optimization.test.ts` — pure normalization/metric tests following the existing node:test style.
- `tests/server/voyage-route-optimizer.test.ts` — new adapter/validation tests, if the server utility is split into testable pure functions.

**Out of scope:**

- Any file under `/home/developer/Desktop/DAY TO DAY/vpm/voyagepm_be/services`; treat it as a read-only reference.
- Camera/live-map files, `app/pages/live.vue`, and the existing header overlap fix.
- Replacing the external backend, rewriting Python optimizers, adding a new map library, or adding a new npm dependency.
- A real EU ETS price feed or charter-party/laycan feed; those remain explicitly modeled placeholders at `app/lib/voyage-optimization.ts:128-132` unless separately requested.

## Steps

### Step 1: Confirm the runtime integration boundary before coding

Determine which of these supported paths is available in the deployment:

1. An authenticated HTTP endpoint that runs the three reference optimizers; or
2. The Nuxt server process can access Python and the three
   `run_stdin_route.py` scripts at runtime, plus the upstream vessel/storm
   context required by the scripts.

Prefer an existing HTTP endpoint if one exists. If using local execution,
configure absolute script paths and the Python binary through private runtime
environment variables; never accept a script path from the browser and never
use `shell: true`. The server adapter must invoke the appropriate script with
`spawn(pythonBin, [scriptPath])`, write one JSON request, enforce a timeout,
collect stderr for server logs only, and parse one JSON response.

If neither boundary is available, STOP and report the missing backend contract.
Do not ship a fake local fallback merely to make the buttons appear functional.

**Verify**: document the selected boundary and run a harmless contract check
against the real endpoint/script with a known fixture or a rejected empty
payload. Expected result: a JSON object with `path_found` or a documented
HTTP error; no secret values or raw backend tokens in logs.

### Step 2: Add a validated server adapter

Create `server/utils/voyage-route-optimizer.ts` and
`server/api/voyage/route-optimization.post.ts`.

The endpoint should accept only a normalized route request: strategy,
vessel/voyage identifiers, start/end, optional corridor waypoints, departure
time, voyage type, and the already-authorized vessel/storm/CP/safety context.
Validate numeric ranges, finite coordinates, at least two route points, a
known strategy, and bounded array sizes with the already-installed `zod`
dependency. Reject malformed input with a 400 response.

Normalize all three service responses to one internal shape:

```ts
{
  strategy: 'lowest-fuel' | 'safest' | 'fastest'
  pathFound: boolean
  waypoints: Array<{ lat: number; lng: number }>
  totalDistanceNm: number
  etaHours: number
  legSpeedsKts: number[]
  totalFuelMt: number
  fuelSavedMt?: number
  fuelSavingsPct?: number
  method?: string
  warning?: string
}
```

Reject `path_found:false`, missing/invalid waypoints, negative totals, or
length mismatches between consecutive legs and `waypoints.length - 1` as a
normalizable route. Return a structured unavailable result with the service
message for that strategy instead of throwing away the other strategies.
Never send Python tracebacks, stderr, auth headers, or environment values to
the browser.

If using local services, add private runtime configuration for the Python
binary, the three script paths, and a bounded timeout. If using HTTP, route
through `backendFetch` so tenant, request, and auth headers follow the existing
server convention.

**Verify**: add unit tests for valid fastest/lowest-fuel/safest fixtures,
`path_found:false`, invalid coordinates, malformed JSON, timeout, and leg
length mismatch. Expected result: all adapter tests pass and no process is
spawned with a browser-provided executable path.

### Step 3: Build one live strategy request and cache all three results

In `app/composables/useVoyageOptimization.ts`, add a deduplicated optimizer
load keyed by vessel ID, voyage ID, route geometry, and departure time. Build
one request from the existing state:

- `selectedVesselId.value` → `vessel_id`;
- `mrvData.value.voyage` → the voyage identifier only if the backend contract
  confirms it is numeric; otherwise resolve the required numeric voyage ID from
  the authorized backend before calling the service;
- `parsedCorridor.value.coords[0]` and the final coordinate → `start`/`end`;
- the full corridor converted from Leaflet `[lat, lng]` to service
  `{lat, lon}` objects → `navapi_waypoints`;
- `mrvData.value.rptdate` as `depart_at` only when it is a valid timestamp;
- voyage type, vessel details, storms, safety limits, and CP overrides from
  the selected integration boundary.

Fetch the three alternate strategies in parallel with `Promise.allSettled`.
Keep Current derived from the live corridor/CII data because the reference
services expose Fastest, Lowest Fuel, and Safest — they do not define a
Current optimizer. On vessel change or refresh, clear stale alternate routes
before loading new ones; guard against an older request overwriting a newer
vessel's result.

Expose `isRouteOptimizationLoading`, per-strategy errors/unavailable state,
and a retry function. A service failure must leave Current usable and must not
reinsert the removed percentage model.

**Verify**: add/adjust composable-facing pure tests or fixtures proving that a
new vessel cannot retain the previous vessel's selected geometry, all three
requests are deduplicated, and one failed strategy does not erase the other
successful results.

### Step 4: Replace synthetic strategy metrics with normalized live results

In `app/lib/voyage-optimization.ts`, preserve the existing public
`RouteStrategyOption` shape where possible so the drawer and map remain
simple. Replace the alternate branch of `calculateRouteStrategies` with a
normalizer that maps the server result to:

- `[lat, lng]` waypoints for Leaflet;
- `distanceNm`, `totalFuelMt`, and weighted average speed from route distance /
  ETA when no direct average is provided;
- `etaIso` from the request departure time plus `etaHours`, not `Date.now()`;
- `fuelSavingsMt` from the Lowest Fuel service's
  `fuel_saved_vs_cp_baseline_mt` when present, otherwise leave it undefined/
  unavailable rather than infer a percentage;
- carbon savings only for a real positive fuel-saving value using the existing
  documented conversion/price constants;
- projected CII through the existing calculation helper using route fuel,
  distance, and the vessel deadweight;
- `basis: 'live'` and the service `method`/warning metadata.

Delete or stop calling the synthetic offset/speed formulas for alternate
routes. Keep Current's real corridor and current-voyage metrics. Update the
TypeScript types to represent unavailable strategies explicitly instead of
using zero-valued fake metrics.

**Verify**: `npm test -- tests/marine/voyage-optimization.test.ts` → existing
CII tests pass; new tests prove no synthetic waypoints are generated, ETA is
deterministic from the supplied departure, Lowest Fuel savings come from the
service response, and invalid service results are unavailable.

### Step 5: Connect the existing image control to live status

In `VoyageOptimizationHeaderBar.vue`, keep the existing visual control from
lines 105-149. Replace the hard-coded `-19%` badge with the normalized Lowest
Fuel saving percentage, rounded for display. Disable or mark a strategy
unavailable while its result is loading or failed, provide an accessible
`title`/label with the failure reason, and keep Current clickable whenever
alternates fail.

Update `VoyageOptimizationKpiHud.vue` so its speed, fuel, carbon, and ETA
values come from the selected live strategy and show an explicit loading or
unavailable state instead of `0`, `Baseline`, or a fabricated metric when no
route exists. Keep the current semantic color classes and existing design
system; do not hard-code the screenshot's values.

Update `VoyageOptimizationDrawer.vue` to show the live `method`, route warning,
actual savings, and no-route state. Update `VoyageOptimizationMap.vue` so it
only draws validated waypoints and falls back to Current when the selected
alternate is unavailable; preserve the existing map controls and route color
conventions.

**Verify**: start the dev server, capture the route at the reported viewport,
and click Current, Lowest Fuel, Safest, and Fastest. Expected results: the
segmented control matches the reference image, the active route changes to the
service geometry, the savings badge reflects response data, and failed routes
are visibly disabled rather than drawn as a synthetic offset.

### Step 6: Complete regression verification

Run the full test suite and production build. Inspect the final diff for scope
and confirm the existing layout fix remains `relative` rather than reverting to
`sticky top-14`.

**Verify**:

- `npm test` → exit 0;
- `npm run build` → exit 0;
- browser screenshot at `/aesm/voyage-optimization` → no hydration/error
  overlay, no overlapping header/drawer, and map/HUD/drawer remain aligned;
- `git status --short` → only the files listed in Scope are changed by this
  plan; unrelated pre-existing worktree changes remain untouched.

## Test plan

- Extend `tests/marine/voyage-optimization.test.ts`, following its existing
  `node:test` and fixture style, for result normalization, route metrics,
  deterministic ETA, savings, unavailable states, and coordinate conversion.
- Add `tests/server/voyage-route-optimizer.test.ts` for request validation and
  adapter parsing. Test the adapter through injected runner/HTTP functions or
  fixture payloads; do not require live Python services in the default test
  suite.
- Browser smoke-test both a wide viewport and the reported short-height
  viewport. Verify keyboard focus and `aria`/title text for unavailable
  strategy buttons.

## Done criteria

- [ ] The reference four-option control remains visually intact and no longer
      displays a hard-coded `-19%`.
- [ ] Lowest Fuel, Safest, and Fastest use real optimizer responses; Current
      uses the live corridor.
- [ ] No synthetic speed percentage, offset waypoint, or `Date.now()`-based
      alternate route remains in the active path.
- [ ] Invalid, timed-out, and `path_found:false` results produce explicit
      unavailable UI without exposing backend internals.
- [ ] Requests carry the selected vessel/voyage and correct `[lat,lng]` to
      `{lat,lon}` conversion; stale requests cannot overwrite newer state.
- [ ] `npm test` exits 0.
- [ ] `npm run build` exits 0.
- [ ] Browser screenshots show no header/map/drawer overlap and strategy
      selection changes the rendered route.
- [ ] No files outside Scope are modified by this plan.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

Stop and report instead of improvising if:

- The upstream API or runtime cannot provide a numeric `voyage_id`, authenticated
  vessel details, or the storm/safety context required by the reference service.
- The optimizer scripts are not available to the server runtime and no
  authenticated HTTP endpoint exists.
- The live service response differs from the documented stdin/stdout contract
  enough that a safe normalizer cannot be written without changing the backend.
- A service returns route coordinates in an order or coordinate system different
  from the documented `{lat, lon}` contract.
- Existing in-progress work changes any scoped file after the drift check and
  the current excerpts no longer match.
- The implementation would require editing files under the reference backend
  or exposing Python tracebacks/authentication material to the browser.

## Maintenance notes

- The optimizer service response is the source of truth for alternate geometry,
  ETA, and fuel. If its schema changes, update the server normalizer and its
  fixture tests before touching map/UI code.
- The reference services intentionally share per-leg speed/fuel ordering;
  preserve the `waypoints.length - 1` invariant when adding new metrics.
- Keep the Current row separate from optimizer rows unless a future backend
  adds a documented Current strategy; do not reintroduce client-side physics
  percentages as a convenience fallback.
- The existing EUR/laycan values are still modeled placeholders. A future live
  feed must be a separate plan with its own API contract and tests.
