---
name: noon-report-validation
description: Validate vessel noon reports (at-sea, port, anchorage, departure, arrival) the way an experienced Chief Engineer would, checking internal consistency, physical plausibility, ROB balances, engine performance relations, weather logic, and emissions figures. Use this skill whenever the user asks to validate, review, audit, sanity-check, QA or approve a noon report, daily report, voyage report, HF-derived noon report, or asks to write/design validation rules for noon report parameters, even if they do not say "Chief Engineer" or "validation" explicitly. Also use it when defining rule tolerances, rule severity, or cross-checks between manually reported values and sensor (HF/LF) data.
---

# Noon Report Validation (Chief Engineer Perspective)

## 1. Purpose

A noon report is only useful if its numbers agree with each other and with physics. A Chief Engineer does not check each field in isolation; the core of validation is checking **relationships between parameters**. This skill defines the order of checks, the relations to test, the formulas to use, default tolerances, and the output format.

All tolerances in this document are **industry-typical defaults, not vessel-specific facts**. They must be tuned per vessel from sea-trial data, shop test data, engine-maker guidance and the vessel's own historical performance. Always state which tolerance was used and whether it is a default or vessel-configured.

## 2. Scope

Applies to these report types: Noon (at sea), Departure / COSP, Arrival / EOSP, In Port, At Anchor, Drifting, Bunkering, Canal/Manoeuvring. Many rules depend on report type, so determine the type first (Section 4.1).

## 3. Inputs Required

Before validating, confirm availability of:

1. **Current report** (all fields).
2. **Previous report** of the same voyage (needed for every delta and ROB balance rule). If absent, mark all delta rules as `SKIPPED – previous report unavailable`; never assume values.
3. **Vessel static data**: propeller pitch, MCR (kW and RPM), NCR, shop-test SFOC curve, number of DGs and their rated power, tank capacities, design draft/displacement, fuel types onboard.
4. **Bunker events** between the two reports (BDN quantity, grade, density, sulphur, LCV).
5. **Optional**: HF (sensor) data for the same period, speed-power baseline curve, historical averages.

If a required input is missing, list it under "Data Gaps" in the output rather than inventing a value.

## 4. Validation Workflow (execute in this order)

Run layers in order. A failure in an early layer (e.g., wrong timestamps) invalidates later calculations, so flag dependencies instead of producing misleading results.

### 4.1 Layer 1 — Completeness & Format
- Mandatory fields present for the report type (e.g., at-sea report must have position, distance, ME RPM, ME hours, fuel consumption per consumer, ROBs, weather).
- Units correct and consistent (MT vs m³, kW vs HP, nm vs km, °C, bar).
- Values within absolute physical limits (no negative ROB, RPM ≤ ~110% MCR RPM, latitude −90..90, longitude −180..180, Beaufort 0–12).
- Parameter names map to the **standard parameter tags** in the system; an unmapped parameter cannot be validated and must be reported.

### 4.2 Layer 2 — Time & Status Logic
| Rule | Relation | Default tolerance |
|---|---|---|
| T1 | Report interval = UTC(current) − UTC(previous) | Noon-to-noon normally 23–25 h (clock ±1 h for zone change); flag outside 22–26 h unless ship's-time change is recorded |
| T2 | Steaming hours ≤ report interval | Hard limit |
| T3 | ME running hours ≤ report interval | Hard limit |
| T4 | Each DG running hours ≤ report interval | Hard limit |
| T5 | Steaming + drifting + anchorage + port hours = interval | ±0.1 h |
| T6 | Status consistency: "At sea" ⇒ ME hours > 0 (unless drifting); "In port/anchor" ⇒ ME hours ≈ 0 and distance ≈ 0 | Error if violated |
| T7 | Report timestamp strictly after previous report | Hard limit |

### 4.3 Layer 3 — Navigation & Distance
| Rule | Relation | Default tolerance |
|---|---|---|
| N1 | Great-circle distance between previous and current position (haversine) ≤ reported observed distance | Observed distance may exceed GC distance due to routing; flag if observed < GC − 2 nm, warn if observed > GC × 1.10 |
| N2 | Average speed (SOG) = observed distance ÷ steaming hours | Must match reported average speed within ±0.2 kn |
| N3 | Engine distance = RPM × pitch(m) × 60 × ME hours ÷ 1852 | Calculated, used in N4 |
| N4 | Slip % = (engine distance − observed distance) ÷ engine distance × 100 | Typical −5% to +15%; warn outside, error outside −15% to +30%. Negative slip is possible with a following current, so check current data before rejecting |
| N5 | Distance to go (current) ≈ distance to go (previous) − observed distance | ±2% or ±5 nm (routing changes allowed if remarked) |
| N6 | ETA consistency: remaining distance ÷ planned speed ≈ time to ETA | Warn if deviation > 6 h |
| N7 | Position reported vs AIS/GPS track (if available) | Warn > 5 nm |
| N8 | Mean draft = (fwd + aft) ÷ 2; trim = aft − fwd; drafts ≤ summer draft | Drafts at sea should not change between reports except for consumption/ballast; warn if change > 0.3 m without ballast/cargo remark |

### 4.4 Layer 4 — Main Engine Performance
| Rule | Relation | Default tolerance |
|---|---|---|
| E1 | Load % = ME power ÷ MCR × 100 | Must agree with reported load within ±3% |
| E2 | Propeller law: P₂ ÷ P₁ ≈ (N₂ ÷ N₁)³ when comparing to baseline/previous report at similar draft and weather | Deviation > 10% ⇒ warning (hull fouling, weather, or power/RPM error) |
| E3 | ME fuel = power (kW) × ME hours × SFOC (g/kWh) ÷ 10⁶ (MT) | Reported ME consumption within ±5% of calculated; SFOC must be corrected for LCV (ISO reference 42,700 kJ/kg) |
| E4 | Implied SFOC = ME fuel × 10⁶ ÷ (power × hours) | Typical 2-stroke 160–195 g/kWh; outside range ⇒ error. Compare against shop-test curve at same load: warn > +5%, error > +10% |
| E5 | Fuel pump index / governor index rises with load | Index up while load/RPM unchanged ⇒ warning (fuel quality, injection issue) |
| E6 | Scavenge air pressure and TC RPM increase with load | Out of trend vs load ⇒ warning |
| E7 | Exhaust gas temperature per cylinder: deviation from mean | Warn > ±30 °C, error > ±50 °C (or engine-maker limit) |
| E8 | Exhaust temp after TC, TC inlet temp within maker limits | Per maker data |
| E9 | Admiralty coefficient C = Δ^(2/3) × V³ ÷ P, trend vs previous good-weather reports | Drop > 10% ⇒ performance deterioration warning |
| E10 | Speed vs power against baseline curve (good weather only, BF ≤ 4, see W5) | Speed loss > 10% ⇒ warning |

### 4.5 Layer 5 — Auxiliary Engines, Boiler & Other Consumers
| Rule | Relation | Default tolerance |
|---|---|---|
| A1 | DG fuel = DG energy (kWh) × SFOC ÷ 10⁶ | Implied DG SFOC typical 195–240 g/kWh |
| A2 | Total DG running hours ≥ interval when ship is live (at least one DG or shaft generator online) | Error if total generation hours < interval without shaft generator remark |
| A3 | Average electrical load ≤ rated power × running DGs | Hard limit |
| A4 | Boiler consumption at sea with exhaust gas economiser should be low; high boiler consumption at sea needs remark (cargo heating, low load) | Warn if at-sea boiler consumption > port average without remark |
| A5 | Boiler consumption in port/anchor > 0 for vessels requiring steam (heating HFO) | Warn if zero while HFO ROB > 0 |
| A6 | Inert gas / incinerator / cargo heating consumption present only when related operation remarked | Warn otherwise |

### 4.6 Layer 6 — ROB Balances (most important for audits)
For **each fuel grade separately** (HFO, VLSFO, ULSFO, MGO/MDO, LNG):

```
Expected ROB = Previous ROB + Bunkered − Total Consumed − Debunkered ± Transfers − Sludge/Drains ± Corrections
Deviation   = Reported ROB − Expected ROB
```

| Rule | Relation | Default tolerance |
|---|---|---|
| R1 | Fuel ROB balance per grade | Warn > ±0.5% of ROB or ±1 MT; error > ±2% or ±5 MT |
| R2 | Total consumed = ME + DG + Boiler + others | Exact (±0.01 MT rounding) |
| R3 | Consumer fuel grade matches grade in use (e.g., cannot consume a grade with ROB = 0 at previous and no bunkering) | Hard limit |
| R4 | ROB ≤ total tank capacity for that grade | Hard limit |
| R5 | Bunkered quantity matches BDN (mass basis, density corrected at 15 °C) | ±0.5% |
| R6 | Cylinder oil ROB balance; feed rate = cyl oil (kg) × 1000 ÷ (power kW × hours) g/kWh | Typical 0.6–1.2 g/kWh or maker's ACC setting; warn outside |
| R7 | ME system oil consumption rate | Warn on sudden increase > 50% vs 7-report average |
| R8 | DG lube oil ROB balance | Same tolerance logic as R1 |
| R9 | Fresh water: previous ROB + produced + received − consumed = current ROB; FW generator production only when ME running and at sea | Warn > ±5 MT |
| R10 | Sludge generation rate reasonable vs HFO consumption (typical 0.5–2% of HFO consumed) | Warn outside |

### 4.7 Layer 7 — Weather & Sea State Consistency
| Rule | Relation | Default |
|---|---|---|
| W1 | Wind speed (kn) vs Beaufort number | BF 0 <1, 1: 1–3, 2: 4–6, 3: 7–10, 4: 11–16, 5: 17–21, 6: 22–27, 7: 28–33, 8: 34–40, 9: 41–47, 10: 48–55, 11: 56–63, 12: ≥64. Mismatch > 1 BF ⇒ warning |
| W2 | Douglas sea state broadly follows Beaufort (sea state rarely far below BF in open sea without shelter) | Mismatch > 2 levels ⇒ warning |
| W3 | Wind/swell direction in 0–360° and consistent with relative/true convention used | Format error if outside |
| W4 | Large speed loss should correlate with adverse weather | Speed loss > 10% in BF ≤ 4 ⇒ performance warning, not weather |
| W5 | Good-weather flag = BF ≤ 4 and sea state ≤ 3 (or charter-party definition) | Used for CP and performance rules |
| W6 | Reported weather vs external weather hindcast (if available) | Warn > 2 BF difference |

### 4.8 Layer 8 — Emissions & Regulatory
| Rule | Relation | Default |
|---|---|---|
| C1 | CO₂ (MT) = Σ fuel consumed per grade × Cf | IMO Cf: HFO 3.114, LFO 3.151, MDO/MGO 3.206, LNG 2.750 (confirm current IMO/EU values in system config) |
| C2 | Sulphur compliance: in ECA/SECA only fuels ≤ 0.10% S (unless scrubber in operation); globally ≤ 0.50% S without scrubber | Error if violated |
| C3 | ECA entry/exit fuel changeover time and position remarked | Warn if position is inside ECA with HFO consumption and no scrubber remark |
| C4 | Distance and fuel feed IMO DCS / EU MRV / CII: CII period totals must equal the sum of report values | Exact |

These are data-consistency checks only. Regulatory interpretation must be reviewed by the compliance/technical superintendent.

### 4.9 Layer 9 — Trend & Anomaly Checks (vs history)
- Compare each key parameter (ME daily consumption, SFOC, slip, cylinder oil feed rate, DG consumption, FW consumption) to the rolling average of the last 7–10 comparable reports (same status, similar load and draft).
- Warn when deviation > 2 standard deviations or > 15%, whichever is tighter.
- Flag "frozen" values: identical figures repeated over ≥ 3 reports for parameters that should vary (exhaust temps, ROB, positions) — often indicates copy-paste.
- Flag rounded or suspicious values (e.g., consumption always exactly 30.00 MT).

### 4.10 Layer 10 — Cross-check with HF (Sensor) Data
When high-frequency sensor data exists for the period:
- Aggregate HF data over the exact report interval (UTC start → UTC end), not the calendar day.
- Compare manual vs HF-derived values: ME RPM (avg), shaft power (avg), ME/DG fuel flow (sum, mass basis), SOG (avg), distance (sum), running hours.
- Default tolerances: RPM ±1%, power ±3%, fuel ±3%, distance ±1%, running hours ±0.2 h.
- Report the data-coverage percentage of HF data. If coverage < 80%, downgrade HF-based rule failures to warnings and state low coverage.
- A rule cannot run if its reference standard parameter is not configured for the vessel; report this as `NOT CONFIGURED`, not as a pass.

## 5. Severity Levels
| Severity | Meaning | Action |
|---|---|---|
| CRITICAL | Physically impossible or breaks a hard limit (hours > interval, negative ROB, ROB balance error beyond error limit, sulphur non-compliance) | Report must not be approved; return to vessel |
| ERROR | Strong inconsistency likely caused by wrong entry | Correction or explanation required before approval |
| WARNING | Plausible but unusual; possible operational cause | Approve only with remark from vessel/superintendent |
| INFO | Observation / trend note | No action required |
| SKIPPED / NOT CONFIGURED | Rule could not run (missing data or parameter mapping) | Listed in Data Gaps |

A remark in the report (e.g., "heavy weather", "cargo heating", "fuel changeover") can downgrade a WARNING to INFO for the related rule, but never downgrade a CRITICAL.

## 6. Output Format

Always produce the validation result in this structure:

```
## Noon Report Validation Summary
Vessel: <name/IMO> | Report type: <type> | Report UTC: <timestamp> | Previous report UTC: <timestamp>
Overall status: APPROVE / APPROVE WITH REMARKS / RETURN FOR CORRECTION
Counts: Critical <n> | Error <n> | Warning <n> | Info <n> | Skipped <n>

## Findings
| Rule ID | Parameter(s) | Reported | Expected / Calculated | Deviation | Tolerance (default/vessel) | Severity | Likely cause / Remark |

## Calculations
Show each derived value with formula and inputs (engine distance, slip, SFOC, ROB balance, CO₂).

## Data Gaps
Missing inputs, unmapped parameters, rules skipped.

## Recommended Actions
Bullet list: what the vessel must correct or explain, owner (Vessel / Superintendent / Shore analyst).
```

Overall status logic: any CRITICAL or ERROR ⇒ RETURN FOR CORRECTION; only WARNINGs ⇒ APPROVE WITH REMARKS; only INFO ⇒ APPROVE.

## 7. Chief Engineer Judgement Notes
- **Start with time, then ROB.** Wrong hours distort every rate; wrong ROB is the most costly error commercially (bunker disputes, charter-party claims).
- **One wrong input shows up in several rules.** Group related failures and point to the root cause (e.g., wrong ME hours ⇒ fails T3, N4 slip, E4 SFOC) instead of listing them as independent errors.
- **Check fuel on a mass basis.** Volume figures must be converted with density corrected to 15 °C and temperature correction; many ROB deviations are unit/density mistakes.
- **Good-weather only for performance claims.** Do not judge hull/engine performance or charter-party speed/consumption on bad-weather days.
- **Negative slip is not automatically wrong** — check current. Consistently negative slip across many reports suggests a wrong pitch value or wrong RPM/distance.
- **Low-load operation** (slow steaming < 25–30% MCR) raises SFOC and cylinder oil feed rate settings; adjust expectations accordingly.
- **Do not invent missing values.** If a parameter is missing, mark the dependent rules as skipped.

## 8. Items Requiring Professional Review
- Final tolerances per vessel (Technical Superintendent / engine maker data).
- Charter-party performance clauses and good-weather definitions (Commercial / Legal).
- Regulatory values (CO₂ factors, ECA limits, CII) must be confirmed against the current IMO and EU regulations by the compliance team.