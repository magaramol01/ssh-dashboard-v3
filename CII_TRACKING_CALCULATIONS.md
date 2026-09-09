# CII Tracking — Widget Calculation Reference

This document lists the calculations and decision logic used by the CII Tracking page (`/emissions`). Values are calculated server-side unless marked **UI-only**.

## Data flow

1. `app/pages/emissions.vue` sends the selected vessel, year, voyage, voyage type, and fleet vessel list to `/api/emissions/cii`.
2. `server/api/emissions/cii.get.ts` loads upstream CII/voyage data. If upstream data is empty, deterministic mock records are generated.
3. The API aggregates records with `server/utils/marine/cii-calculator.ts`.
4. It builds the improvement plan with `server/utils/marine/cii-improvement.ts`.
5. It builds the technical telemetry payload with `server/utils/marine/performance-widgets.ts`.
6. The page and `TechnicalTelemetryCard.vue` format the response and build chart-only values.

---

## 1. Header, filters, and context strip

### Filter behavior

| Control | Logic |
|---|---|
| Vessel | Uses `/api/vessels/geojson`; falls back to six deterministic vessels. Selected vessel defaults to ID `1`. |
| Year | Options are current year down to `2020`. |
| Voyage | `all` requests the full selected-year data; another value requests the voyage endpoint. |
| Voyage type | Sent as `voyageType`; defaults to `all`. |
| Refresh | Re-runs the same API request. |
| API cache key | `cii-${vesselId}-${year}-${voyage}-${voyageType}`. |

When a single voyage is selected, the API first requests voyage data. If records contain more than one voyage-sized chunk, it slices the record array using:

```text
voyageIndex = max(0, indexOf(selectedVoyage))
chunkSize   = max(10, floor(recordCount / max(1, availableVoyageCount)))
start       = voyageIndex * chunkSize
end         = min(recordCount, start + chunkSize)
selectedRecords = records.slice(start, end)
```

### Fleet context strip

- **Fleet position:** displays `vesselRank` of `fleetTotalVessels`.
- **Delta vs fleet:** displays `abs(deltaVsFleetPercent)`.
  - `deltaVsFleetPercent <= 0` → `better`.
  - Otherwise → `higher intensity`.
- **Fleet average:** displays `fleetAverageCii` rounded to two decimals.

---

## 2. Hero CII compliance widget

Source: `app/pages/emissions.vue`, backed by `server/api/emissions/cii.get.ts` and `server/utils/marine/cii-calculator.ts`.

### Record aggregation

For each CII record:

```text
distance = parseFloat(record.distance) || 0
totalDistanceNm += distance
```

Transport work uses the record value when it is positive; otherwise it falls back to distance multiplied by vessel deadweight:

```text
transportWork = parseFloat(record.transportWork)
if transportWork > 0:
    totalTransportWork += transportWork
else if distance > 0 and deadweight > 0:
    totalTransportWork += distance * deadweight
```

If the final transport-work total is zero while distance is positive, the same calculation is re-applied through `calculateTransportWork(distance, deadweight)`.

CO₂ is summed from positive `record.massOfCo2` values. If no record contains CO₂, the API uses the sum of fuel-derived CO₂ from the Fuel Mix widget.

Before the final CII calculation:

```text
totalCO2Mt       = round(totalCO2Mt, 2)
totalDistanceNm  = round(totalDistanceNm, 1)
totalTransportWork = round(totalTransportWork, 0)
```

### Attained CII

```text
Attained CII = (total CO₂ in MT × 1,000,000) / total transport work in MT·NM
```

Returns `0` when CO₂ or transport work is zero/non-positive. Result is rounded to two decimals.

### Required CII and rating

Required CII is selected in this order:

```text
first record.requiredCII
→ first record.CIIBoundaries.requiredCII
→ 5.25
```

Default boundaries when the first record has none:

| Grade | Condition |
|---|---|
| A | `attainedCii <= 3.42` |
| B | `attainedCii <= 4.65` |
| C | `attainedCii <= 5.92` |
| D | `attainedCii <= 7.35` |
| E | greater than `7.35` |

A missing/invalid boundary object or non-positive CII returns grade `C` from the calculator fallback.

### Compliance margin

```text
marginPercent = ((attainedCii - requiredCii) / requiredCii) × 100
```

Rounded to one decimal. Negative means the vessel is below the required intensity and is displayed as **better**. Positive means it is above the target and is displayed as **above**.

### Rating-band gauge — UI-only

The marker position is calculated from the CII value and the four boundaries:

```text
min       = max(1.0, superior_boundary × 0.6)
max       = inferior_boundary × 1.3
clamped   = min(max(attainedCii, min), max)
position% = round(((clamped - min) / (max - min)) × 100)
```

The visual track itself is split into five equal-width segments; the segments are not proportional to the numeric boundary ranges.

---

## 3. Six operational KPI tiles

All six values come from `summary` unless noted otherwise.

| Tile | Calculation |
|---|---|
| Total CO₂ Emitted | `summary.totalCo2Mt`; displayed to one decimal. |
| CO₂ rate | `summary.co2PerDistanceNm = totalCO2Mt / totalDistanceNm`; rounded to three decimals, or `0` if distance is zero. |
| Transport Work | UI displays `round(totalTransportWork / 1,000,000)` as `M MT·NM`. |
| DWT capacity | `vessel.deadweight`; display formatting only. |
| Distance Sailed | `summary.totalDistanceNm`; display formatting only. |
| Sea/Port time | `calculateOperationalHours()` sums `runningHoursAtSea` and `runningHoursAtPort` independently; each result is rounded to one decimal. |
| Loaded Drafts | `calculateDraftAverages()` averages positive forward and aft draft readings independently; each average is rounded to two decimals. Missing averages display `--`. |
| EU ETS Cost | `round(totalCO2Mt × 0.5 × 65)` euros. The implementation assumes 50% liable voyage scope and a €65/MT EUA price. |
| EEOI Index | `(totalCO2Mt × 1,000,000) / (totalTransportWork × 0.70)`; rounded to two decimals, or `0` when transport work is zero. The `0.70` is a fixed 70% laden-utilization baseline. |
| Projected year-end rating | Currently equal to `attainedRating`; no separate run-rate projection is performed. |

---

## 4. Vessel performance benchmarking widget

Source: `server/api/emissions/cii.get.ts`; comparison formatting is in `app/pages/emissions.vue`.

### Peer values

Peer values are resolved in this order:

1. Current vessel: uses the CII calculated for the active request.
2. Existing server cache: uses cached attained CII/rating for the same year and vessel.
3. Client-provided peer attained CII: caches and uses it.
4. Deterministic fallback:

```text
fallbackDwt = peerDwt || (45,000 + ((vesselId × 3,100) % 25,000))
fallbackCii = round(4.1 + ((vesselId × 7) % 25) × 0.1, 2)
```

If no fleet list is supplied, the default fleet contains six vessels with fixed base CII values. The active vessel replaces the matching default entry; an unknown active vessel is appended.

### Peer margin and rank

For every peer:

```text
peerMargin = ((peerAttainedCii - peerRequiredCii) / peerRequiredCii) × 100
```

Rounded to one decimal. Peers are sorted ascending by attained CII, so the rank is:

```text
vesselRank = indexOf(active vessel after sort) + 1
fleetTotalVessels = peer count
```

The displayed rank is never below `1`.

### Fleet average and active-vessel delta

```text
fleetAverageCii = round(sum(peer.attainedCii) / peerCount, 2)
deltaVsFleetPercent = ((activeAttainedCii - fleetAverageCii) / fleetAverageCii) × 100
```

The delta is rounded to one decimal, or `0` when the average is zero. Negative/zero is cleaner; positive is higher intensity.

### Top percentile badge — UI-only

```text
vesselPercentile = round(((fleetTotalVessels - vesselRank + 1) / fleetTotalVessels) × 100)
```

Returns `0` when no benchmark exists or the fleet total is zero.

### Head-to-head comparison — UI-only

For the Fleet Average or selected peer:

```text
diffCii = activeAttainedCii - comparisonAttainedCii
diffPct = (diffCii / comparisonAttainedCii) × 100
```

`diffCii` is rounded to two decimals and `diffPct` to one decimal. If the comparison CII is zero, `diffPct` is `0`. `diffCii <= 0` is treated as more fuel-efficient/cleaner.

### Peer chart tooltip — UI-only

For each peer, the chart compares peer to the active vessel:

```text
peerDeltaCii = peerAttainedCii - activeAttainedCii
peerDeltaPct = (peerDeltaCii / activeAttainedCii) × 100
```

Both are formatted to one/two decimals in the tooltip. Fleet-average and IMO-limit lines are reference lines only; they do not change peer values.

The matrix table uses the same raw delta:

```text
peer.attainedCii - activeAttainedCii
```

---

## 5. Sentinel decarbonization triage strip

This is a conditional display block, not an independent calculation service.

- Grade `D` or `E` → **Advisory Active**.
- Grades `A`, `B`, or `C` → **Compliant Run-Rate**.

For D/E vessels, the text estimates avoided CO₂ using a fixed 27% factor:

```text
estimatedSavings = round(totalCO2Mt × 0.27)
```

It always describes a 10% speed reduction and Grade C target, regardless of the currently selected scenario.

For compliant vessels, it displays `abs(marginPercent)` and the API EU ETS estimate.

---

## 6. CII Improvement Plan and Root-Cause Diagnosis widget

Source: `server/utils/marine/cii-improvement.ts`; rendered by `app/components/emissions/CiiImprovementPlanCard.vue`.

### Degradation detection

Only months with a positive attained CII are considered:

```text
validMonths = monthlyTrend.filter(month.attainedCii != null && month.attainedCii > 0)
```

Current compliance is true only when both conditions hold:

```text
attainedRating is A, B, or C
and attainedCii <= requiredCii
```

The onset is the first valid month where either:

```text
monthlyAttainedCii > requiredCii
or monthly rating is D/E
```

If no onset is found but the current vessel is non-compliant, the last valid month is used. Then:

```text
hasDegraded = !isCurrentlyCompliant && onsetIndex >= 0
```

### Onset change

If the onset is not the first valid month, the prior month is used as the initial state. Otherwise the onset month itself is used.

```text
ciiIncrease = max(0, attainedCii - initialCii)
```

Rounded to two decimals. The onset voyage uses the same index into `availableVoyages`, clamped to the available range. If none exists, it falls back to `V0${min(onsetIndex + 1, 4)}`.

### Root-cause radar driver percentages

Default raw driver weights:

```text
speed = 38
hull = 32
auxiliary = 18
payload = 12
```

When Cobelfret telemetry is present:

```text
if badWeatherPct > 15:
    speed = max(20, round(badWeatherPct × 0.8))

if propulsionTimeLossPct < -2:
    hull = min(45, max(25, round(abs(propulsionTimeLossPct) × 6)))

if portPct is truthy:
    auxiliary = round(portPct × 0.6)

if ballastPct is truthy:
    payload = round(ballastPct × 0.5)
```

The four raw weights are normalized:

```text
rawSum = speed + hull + auxiliary + payload
speed% = round(speed / rawSum × 100)
hull% = round(hull / rawSum × 100)
auxiliary% = round(auxiliary / rawSum × 100)
payload% = max(0, 100 - speed% - hull% - auxiliary%)
```

The final payload is forced to total 100%. Weather is folded into the speed driver; it is not emitted as a fifth radar driver.

### Selected speed scenario and recovery target

The backend uses `activeScenarioIndex: 1` by default, which is the 10% scenario. The UI can select another scenario locally.

Scenario selection order:

```text
speedScenarios[activeScenarioIndex]
→ speedScenarios[0]
→ hard-coded 10% fallback
```

The fallback projected CII is `round(attainedCii × 0.88, 2)`.

```text
targetRating = selectedScenario.projectedRating || (attainedRating === 'E' ? 'D' : 'C')
targetCii    = selectedScenario.projectedCii || round(requiredCii × 0.98, 2)
projectedDays = reduction >= 15% ? 30 : reduction >= 10% ? 45 : 60
```

For the first action item, estimated power-load reduction is:

```text
powerReductionPercent = round((1 - (scenario.multiplier ?? 0.729)) × 100)
```

### Improvement-plan UI-only calculations

- Radar values use the four driver percentages. A zero percentage is treated as missing because the chart uses `value || fallback`.
- Speed curve points are `[speedKnots, projectedCii]`.
- If a scenario has no speed, chart speed is estimated as:

```text
14 - (reductionPercent × 0.14)
```

- Active power-load display:

```text
(scenario.multiplier ?? 0.729) × 100
```

rounded to a whole percent.
- Action list numbering is `index + 1`.
- Displayed impact text removes everything after the first `(`.

---

## 7. Fuel Mix & Operational Consumption widget

Source: `calculateFuelTotals()` in `server/utils/marine/cii-calculator.ts`, with page totals in `app/pages/emissions.vue`.

### Fuel classification

A record is classified as **Port** when any condition is true:

```text
reportType is NOON_PORT, PORT, or ARRIVAL
or runningHoursAtPort > runningHoursAtSea
```

Every other record is classified as **Sea**.

Each `consumptionData` entry accepts either a number/string or `{ value }`. Non-positive values are ignored. Fuel keys are lowercased and trimmed.

### Per-fuel totals and CO₂

For each fuel type:

```text
seaMt   = round(sum(sea consumption), 2)
portMt  = round(sum(port consumption), 2)
totalMt = round(seaMt + portMt, 2)
co2Mt   = round(totalMt × carbonCoefficient, 2)
```

Known default carbon coefficients (MT CO₂ per MT fuel):

| Fuel | CF |
|---|---:|
| HFO | 3.114 |
| VLSFO | 3.150 |
| ULSGO/VLSGO/MGO/LSMGO | 3.206 |
| LFO | 3.115 |
| LNG | 2.750 |

Unknown fuel types use `3.15`. Results are sorted by descending `totalMt`.

### Fuel totals and percentages — UI-only

```text
totalFuelBunkered = sum(fuel.totalMt)
totalSeaFuel      = sum(fuel.seaMt)
totalPortFuel     = sum(fuel.portMt)
seaFuelPercent    = round(totalSeaFuel / totalFuelBunkered × 100, 1)
portFuelPercent   = round(100 - seaFuelPercent, 1)
```

Percentages return `0` when there is no fuel. Each donut slice percentage is:

```text
round(fuel.totalMt / max(1, totalFuelBunkered) × 100, 1)
```

The page total CO₂ row uses `summary.totalCo2Mt`, which may be record-reported CO₂ rather than the sum of fuel-derived CO₂ when both are present.

---

## 8. Technical Performance & Diagnostic Telemetry widget

Source: `server/utils/marine/performance-widgets.ts`, rendered by `app/components/emissions/TechnicalTelemetryCard.vue`.

The tabbed widget contains Weather, Hull & Propulsion, Engine SFOC, and Voyage Profile views.

### 8.1 Weather & Sea-State tab

#### Server-side values

A deterministic vessel seed is used only when raw widget data is unavailable:

```text
vSeed = abs(vesselId × 7.31)
fallbackWeatherPct = 12.5 + (vSeed % 14.5) + (attainedCii > 5.5 ? 4 : 0)
```

Values:

```text
badWeatherPct = round(raw currentValue || fallbackWeatherPct, 1)
averageBadWeatherDays = round(raw averageBadWeather || badWeatherPct × 0.36, 1)
shipsAffectedPct = round(raw percentageShips || (badWeatherPct > 20 ? 60 : 25), 1)
speedLossKnots = round(badWeatherPct × 0.038 + 0.1, 1)
excessCo2Mt = round(totalCo2Mt × (badWeatherPct / 100) × 0.25, 1)
imoExclusionEligible = badWeatherPct >= 18.0
```

`shipsAffectedPct` is calculated in the payload but is not currently shown in the page card.

#### UI-only chart values

```text
moderatePct = round(20 + (abs(vesselId × 3) % 8), 1)
calmPct     = max(8, round(100 - badWeatherPct - moderatePct, 1))
roughPct    = round(badWeatherPct × 0.65, 1)
galePct     = max(0, round(badWeatherPct - roughPct, 1))
```

The speed-deficit chart line is:

```text
[0, -round(speedLoss × 0.25, 1), -round(speedLoss, 1), -round(speedLoss × 1.5, 1)]
```

The card labels `badWeatherPct >= 25` as Adverse, `15 <= badWeatherPct < 25` as Moderate, and below `15` as Calm. The regulatory badge uses the server threshold of `18`.

### 8.2 Hull & Propulsion tab

#### Server-side values

```text
fallbackTimeLoss = attainedCii > 6.0
    ? -5.8
    : -(2.2 + ((vSeed × 1.7) % 3.6))

timeLossPct = round(raw time loss || fallbackTimeLoss, 1)
fuelLossPct = round(raw fuel loss, 1) || -35.1
lrmPct = 2.3
engineSlipPct = round(dbSlip || 7.5, 1)
```

Drag penalty combines time loss and excess engine slip:

```text
dragPenaltyPct = round(
  abs(timeLossPct) × 2.2 + max(0, engineSlipPct - 4.5) × 1.3,
  1
)
```

Cleaning status:

```text
if dragPenaltyPct >= 18 or timeLossPct <= -6: critical
else if dragPenaltyPct >= 12 or timeLossPct <= -4: recommended
else if dragPenaltyPct >= 7 or timeLossPct <= -2: monitoring
else: optimal
```

Power recovery potential:

```text
powerRecoveryPotentialPct = round(dragPenaltyPct × 0.65, 1)
```

#### UI-only chart values

The propulsion chart uses six speeds: `10, 11, 12, 13, 14, 15` knots.

```text
penaltyFactor = 1 + (dragPenaltyPct / 100)
cruisingPower = round(deadweight × 0.135)
baselinePower(speed) = round(cruisingPower × (speed / 13)^3)
currentPower = round(baselinePower × penaltyFactor)
```

The point at chart index `3` (13 knots) is marked as the cruising-speed point. Tooltip percentage:

```text
round((currentPower - baselinePower) / baselinePower × 100)
```

### 8.3 Engine SFOC tab

#### Server-side values

```text
currentSfoc     = round(raw currentValue || 174.3, 1)
expectedSfoc    = round(raw acceptedValue || 176.0, 1)
expectedSfocMax = 187.0
fleetAvgSfoc    = round(raw trendValue || 174.28, 1)
sfocDelta       = round(currentSfoc - expectedSfoc, 1)
```

Status:

```text
sfocDelta > 8 → elevated
sfocDelta > 3 → normal
otherwise     → optimal
```

#### UI-only chart curves

The chart uses the shop expected SFOC and fleet average as curve bases:

```text
shopCurve  = [shop × 1.12, shop × 1.04, shop, shop × 1.01, shop × 1.08]
fleetCurve = [fleet × 1.13, fleet × 1.05, fleet, fleet × 1.02, fleet × 1.09]
```

Each point is rounded to a whole g/kWh.

Axis bounds:

```text
yMin = max(140, floor(min(attained, shop, fleet) × 0.9 / 10) × 10)
yMax = ceil(max(attained, shop × 1.12, fleet × 1.13) × 1.08 / 10) × 10
```

The operating-point marker is placed at the 75% MCR index (`2`) using the attained SFOC. Its color is amber when `attained > shop + 5`, otherwise green.

The card’s visible status bands are separate UI thresholds:

- `<175` → Optimal
- `175–185` → Normal
- `>185` → Elevated

The sidebar insight uses `currentSfoc <= 176` for “In Band”, while the server status uses `sfocDelta`; these are intentionally different checks in the current implementation.

### 8.4 Voyage Profile tab

#### Server-side profile values

Initial fallback profile:

```text
ladenPct = 35.6
ballastPct = 35.6
portPct = 15.2
anchoragePct = 10.6
maneuveringPct = 3.0
seaDays = 159.0
portDays = 64.4
```

If raw Cobelfret profile data exists:

```text
Sea item:
  ladenPct   = round(value × 0.50, 1)
  ballastPct = round(value × 0.50, 1)

Port item:
  portPct      = round(value × 0.60, 1)
  anchoragePct = round(value × 0.40, 1)

Laden/Ballast/Port_Operation/Anchorage/Maneuvering items:
  corresponding value = round(avgPercentage, 1)
```

When raw data has no explicit Sea or Port item, days are normalized over a fixed `223.4`-day operating year:

```text
totalSeaPct  = ladenPct + ballastPct
totalPortPct = portPct + anchoragePct + maneuveringPct
sumPct       = max(1, totalSeaPct + totalPortPct)
seaDays      = round(totalSeaPct / sumPct × 223.4, 1)
portDays     = round(totalPortPct / sumPct × 223.4, 1)
```

When raw profile data is absent, sea/port hours drive the profile:

```text
seaH   = runningHoursAtSea || 5100
portH  = runningHoursAtPort || 2070
totalH = max(1, seaH + portH)
seaRatio  = seaH / totalH
portRatio = portH / totalH

ladenRatio = 0.50 + (((vSeed × 1.3) % 8) - 4) / 100
ladenPct   = round(seaRatio × 100 × ladenRatio, 1)
ballastPct = round(seaRatio × 100 × (1 - ladenRatio), 1)

anchorageRatio = 0.42 + (((vSeed × 1.1) % 8) - 4) / 100
anchoragePct   = round(portRatio × 100 × anchorageRatio, 1)
maneuveringPct = round(3.0 + (vSeed % 1.5), 1)
portPct        = round(max(5, portRatio × 100 × (1 - anchorageRatio) - maneuveringPct), 1)

seaDays  = round(seaRatio × 223.4, 1)
portDays = round(portRatio × 223.4, 1)
```

Non-productive fuel is estimated as:

```text
nonProductivePct    = (portPct + anchoragePct) / 100
nonProductiveFuelMt = round(totalFuelMt × nonProductivePct × 0.45, 1)
```

#### UI-only sea/port chart values

The sidebar recomputes sea utilization from days when both are positive:

```text
seaPercent = round(seaDays / (seaDays + portDays) × 100, 1)
```

If days are unavailable, it uses `ladenPct + ballastPct` when that sum is at least 40; otherwise it uses `71.2`. Then:

```text
portPercent = round(100 - seaPercent, 1)
```

For the donut chart, laden and ballast are normalized to the sea percentage:

```text
ladenRaw   = ladenPct || (seaPercent × 0.5)
ballastRaw = ballastPct || (seaPercent × 0.5)
rawSeaSum  = max(1, ladenRaw + ballastRaw)
ladenValue = round(ladenRaw / rawSeaSum × seaPercent, 1)
ballastValue = round(seaPercent - ladenValue, 1)
```

Port slices are normalized similarly:

```text
portRaw = portPct || (portPercent × 0.55)
anchRaw = anchoragePct || (portPercent × 0.35)
manRaw  = maneuveringPct || (portPercent × 0.10)
rawPortSum = max(1, portRaw + anchRaw + manRaw)
portValue = round(portRaw / rawPortSum × portPercent, 1)
anchValue = round(anchRaw / rawPortSum × portPercent, 1)
manValue  = round(max(0, portPercent - portValue - anchValue), 1)
```

Donut tooltip day estimates:

```text
Sea slice days  = round(seaDays × slicePercent / max(1, seaPercent))
Port slice days = round(portDays × slicePercent / max(1, portPercent))
```

---

## 9. Monthly Rolling CII Performance widget

### Server-side monthly aggregation

Records are placed into twelve calendar buckets using `new Date(reportDateTime).getMonth()`.

For each month:

```text
month.distance += parseFloat(record.distance) || 0
month.co2      += parseFloat(record.massOfCo2) || 0
month.tw       += parseFloat(record.transportWork) || (distance × deadweight)
```

Monthly CII is calculated only when both monthly transport work and CO₂ are positive:

```text
monthlyAttainedCii = (month.co2 × 1,000,000) / month.tw
```

It is rounded to two decimals and classified against the same A–E boundaries. Monthly CO₂ is rounded to one decimal and monthly distance to a whole number. Months with no valid CII return `null` and no rating.

### Chart framing — UI-only

Boundary values use the API values, with safe defaults:

```text
superior = boundary.superior_boundary || 3.42
lower    = boundary.lower_boundary || 4.65
upper    = boundary.upper_boundary || 5.92
inferior = boundary.inferior_boundary || 7.35
required = summary.requiredCii || boundary.requiredCII || 5.25
```

The y-axis maximum is:

```text
maxAttained = max(valid monthly CII values), or inferior when none exist
yAxisMax = round(max(inferior × 1.25, maxAttained × 1.15), 1)
```

Each plotted point is rounded to two decimals and carries its month, rating, CO₂, and distance for the tooltip.

Tooltip compliance delta:

```text
diff    = round(monthlyCii - required, 2)
diffPct = round((monthlyCii - required) / required × 100, 1)
```

`diff <= 0` is shown as compliant; a positive value is shown as over the cap. Rating zones are visual mark areas and the required CII is a visual mark line.

---

## 10. CSV export logic

The Export CSV action is UI-only. It writes:

- vessel and evaluation metadata;
- attained CII, rating, required CII, margin;
- EU ETS cost, EEOI, CO₂, transport work, and distance;
- fleet rank and average;
- fuel breakdown rows;
- monthly trend rows.

The file name is:

```text
${vesselName with spaces replaced by underscores}_CII_Report_${year}.csv
```

No additional calculations are performed during export; values are copied from the API response or existing page computed values.

---

## 11. Fallback/mock calculation behavior

If the upstream CII endpoint returns no records, the API creates deterministic records for twelve months:

```text
seed         = (vesselId × 13) % 7
baseSeaSpeed = 12.5 + seed × 0.4
baseDwt      = 48,000 + seed × 3,000
```

Every third day is generated. A record is port when:

```text
(day + monthIndex) % 5 === 0
```

For sea records:

```text
distance = round(baseSeaSpeed × 24 × (0.95 + (day % 4) × 0.03))
vlsfo    = 24.5 + (monthIndex % 3) × 1.5
mgo      = 2.8
```

For port records:

```text
distance = 0
vlsfo    = 3.2
mgo      = 1.5
```

For every mock record:

```text
transportWork = distance × baseDwt
CO₂ = round(vlsfo × 3.15 + mgo × 3.206, 2)
draftFwd = round(10.8 + (day % 3) × 0.2, 2)
draftAft = round(11.6 + (day % 3) × 0.2, 2)
```

These values are demo fallbacks, not live measurements.

---

## 12. Components present but not mounted by `/emissions`

The following files contain display logic but are not currently imported or rendered by the CII Tracking page:

- `app/components/emissions/widgets/WeatherImpactCard.vue`
- `app/components/emissions/widgets/HullPropulsionCard.vue`
- `app/components/emissions/widgets/EngineSfocCard.vue`
- `app/components/emissions/widgets/OperationalProfileCard.vue`

The active page uses the equivalent tabbed views inside `app/components/emissions/TechnicalTelemetryCard.vue`.
