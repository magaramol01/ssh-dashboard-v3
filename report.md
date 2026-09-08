# Lobivia predictive-maintenance data audit

**Vessel:** Lobivia  
**Vessel ID:** `23`  
**IMO:** `9228564`  
**Telemetry source:** `shipping_db.highfrequencydata` only  
**Profile basis:** bounded PostgreSQL profiling of vessel 23, with parameter resolution through `shipping_db.parametermapping` and `shipping_db.standardparameters`.

## Executive answer

A useful **condition-monitoring and anomaly/health pilot** can be built from the current data. A defensible **RUL model cannot yet be built or honestly accuracy-rated**.

The selected vessel is materially better than the initially examined vessel for engine analysis: it has nearly continuous power and load values, substantial SFOC coverage, engine reference curves, sea-trial data, and weather data. The main limitations are:

- the telemetry contains operating-state data, not verified component-failure or maintenance outcomes;
- several values are zero or physically questionable and require regime filtering;
- shaft RPM is present for only about 60% of packets;
- measured and ISO SFOC contain extreme values;
- configured alerts are operational rules, not confirmed failures;
- packet keys must be resolved through the mapping table because the vessel-specific `A*` names do not consistently contain the actual packet values.

**Recommendation:** implement a provenance-aware health/anomaly index first. Do not present a numeric RUL in the product until maintenance/failure events and an action threshold have been supplied and validated.

## 1. Available data

### 1.1 Telemetry coverage

| Check | Result |
|---|---:|
| `highfrequencydata` packets | 115,541 |
| First packet | 2025-06-01 00:00:49 UTC |
| Last packet | 2026-09-08 05:52:25 UTC |
| Distinct calendar days | 425 |
| Median packet interval | 300.005 seconds |
| 5-minute interval band (240–360 s) | 109,749 / 115,540 intervals |
| 5th–95th percentile interval | 300–309.15 seconds |

The data is therefore suitable for regular time-window features. It is not literally complete: missing packets, duplicate/late packets, and periods of zero operation must be handled explicitly.

### 1.2 Resolved parameter mappings

`parametermapping` has 183 vessel mappings for Lobivia, 182 marked active, and all 183 currently join to `standardparameters` metadata. The important mappings are:

| Vessel parameter key | Standard packet key | Standard metadata | Unit | Meaning |
|---|---|---|---|---|
| `A000057` | `AM251` | parameter 37 | `%` | ME estimated engine load |
| `A000101` | `AM267` | parameter 40 | `kW` | ME shaft power |
| `A000026` | `AM265` | parameter 38 | `rpm` | ME shaft RPM |
| `A000002` | `AM873` | parameter 944 | `mg/kWh` | ME measured SFOC |
| `A000127` | `AM874` | parameter 945 | `mg/kWh` | ME ISO SFOC |
| `A000115` | `AF1` | parameter 1 | `kg/hr` | ME fuel supply rate |
| `AIVDO_Speed` | `AIVDO_Speed` | parameter 65 | `knot` | AIS speed over ground |

All inspected mappings use scaling `1`; the active mappings above have no active unit conversion except the metadata-level unit declarations. Extraction must use the **standard packet key** (`AM267`, `AM265`, etc.), not blindly use the vessel parameter key (`A000101`, `A000026`, etc.). The observed packets contain the usable `AM*`/`AF1` fields, while the corresponding `A*` keys are generally absent or null.

### 1.3 Field profile

The following results are packet-level presence and raw-value summaries. They are not quality-approved engineering measurements.

| Packet key | Non-null | Coverage | Distinct values | Median | Maximum | Zero values |
|---|---:|---:|---:|---:|---:|---:|
| `AM267` shaft power | 114,688 | 99.26% | 13,898 | 0 kW | 12,583.2 kW | 61,923 |
| `AM251` engine load | 114,688 | 99.26% | 14,774 | 0% | 125.83% | 61,923 |
| `AM265` shaft RPM | 69,572 | 60.21% | 1,943 | 0 rpm | 82.49 rpm | 35,033 |
| `AM873` measured SFOC | 113,962 | 98.63% | 14,889 | 0 mg/kWh | 1,203.34 mg/kWh | 61,055 |
| `AM874` ISO SFOC | 113,952 | 98.62% | 14,867 | 0 mg/kWh | 927.88 mg/kWh | 61,234 |
| `AF1` fuel supply rate | 114,688 | 99.26% | 30,110 | 5.17 kg/hr | 7.37 kg/hr | 7,536 |
| `AIVDO_Speed` AIS SOG | 114,911 | 99.45% | 203 | 3.7 kn | 90.2 kn | 30,887 |

Important quality flags:

- 2,682 load values exceed 100%.
- 604 power values exceed 11,000 kW.
- 4 measured-SFOC values exceed 500 mg/kWh.
- 5 ISO-SFOC values exceed 500 mg/kWh.
- AIS contains `-1` and implausible high values; it needs validity filtering.
- Zero power/load/SFOC values may represent stopped operation or bad data. They must not be treated as healthy observations.
- RPM has the weakest coverage and should not be the sole basis of a health score.

After a simple operating filter of `AIVDO_Speed >= 5 kn` and `AM267 > 0`, 50,678 packets remain. Restricting SFOC to 100–500 mg/kWh leaves 50,565 packets, with:

- measured SFOC mean/median: **200.15 / 198.96 mg/kWh**;
- ISO SFOC mean/median: **191.68 / 191.17 mg/kWh**.

These are useful baseline statistics only; they are not a validated vessel performance rating.

### 1.4 Weather and operating-condition data

`shipping_db.std_stormglassweather` contains 26,605 Lobivia records from 2025-01-01 through 2026-09-08 across 505 calendar days. Its JSON weather payload includes wind speed, wave height, swell height, swell period, current speed, and directions, with latitude/longitude stored separately.

Weather should be joined by vessel and bounded timestamp/position. The existing vessel rules provide useful starting flags—wind above 20 kn, wave/swell above 3 m, and current above 3 kn—but these are alert thresholds, not universal definitions of a valid good-weather observation. The final filter needs owner/domain approval.

### 1.5 Reference and sea-trial data

| Source | Rows for vessel 23 | Useful fields |
|---|---:|---|
| `db_reference_speed_data` | 175,500 | draft, power, expected speed |
| `db_reference_engine_data` | 38,000 | draft, speed, expected power, expected SFOC, expected fuel |
| `seatrial` for IMO `9228564` | present | sea-trial power/speed/admiralty-coefficient array |

The reference data makes condition-normalized performance residuals feasible. It does not, by itself, define a failure threshold or remaining life.

## 2. Alerts, failures, and labels

This is the decisive RUL limitation.

### 2.1 Configured rules

Lobivia has 22 active `std_ruleconfigs` rows, paired into 11 advisory concepts and 22 active rule blocks. Relevant examples include:

- ME overload on `AM267`, using the configured expression `AM267 > 1.1 * 0.0198 * AM265^2.9987`;
- ME shutdown when `AM265 == 0`;
- ME slowdown for `1 <= AM265 <= 50` rpm;
- CP slowdown based on AIS speed;
- high wind, wave, swell, and current;
- shallow depth;
- CII rating warning.

These rules are valuable for operational monitoring and weak labels. They are not proof that a component failed. In particular, an RPM-zero event can simply mean the main engine was stopped.

### 2.2 Triggered outcomes

The triggered-outcome tables contain actual rule firings, but not maintenance outcomes:

- current `std_triggeredoutcomestoday` rows for vessel 23: **71**;
- history rows for vessel 23: **29,718**, from 2026-03-16 through 2026-09-08;
- history contains **9 distinct rules**;
- no history rows were acknowledged in the inspected result;
- the current 71 rows were all ME Shut Down (`rulekey 2497`).

The most frequent historical rule keys were ME Shut Down, CP Slow Down, ME Overload, Vessel Stopped, and ME Slow Down. These are useful event markers, but alert repetition, rule configuration, and operating state can create many rows for one operational episode.

### 2.3 Failure-advisory and anomaly tables

- `std_failureadvisories`: 1,583 rows globally; Lobivia has 11 active advisory definitions.
- All 11 Lobivia definitions are alarms (`isalarm = true`) and none are marked failure advisories (`isfailureadvisory = false`).
- `std_failureadvisoriesreferencescauses` and `std_causesreferencesruleconfig` contain active rule/cause relationships, but no observed failure occurrence or resolution timestamp.
- `shipping_db.vessel_anomaly_detection`: **0 rows**.
- `shipping_db.systemadvisories`: **0 rows** in the inspected database.

Therefore the database currently supplies rule definitions and triggered alerts, not a clean target such as `failure_time`, `maintenance_time`, `component_replaced`, or `degraded/healthy` adjudication.

## 3. What can be calculated reliably

| Output | Feasibility now | Honest interpretation |
|---|---|---|
| Data freshness/completeness | High | Directly measurable from packet timestamps and field coverage |
| Operating-state classification | Medium–high | Good after validating AIS, power, RPM, and stop/sea-going semantics |
| Rule-based alerts | High | Reproduce configured operational rules; not a failure probability |
| Condition-normalized power/SFOC residual | Medium | Feasible using reference curves after draft/speed/weather joins and outlier policy |
| Unsupervised anomaly score | Medium | Useful for ranking unusual windows; requires clean baseline and drift monitoring |
| Interpretable health index | Medium | Suitable as a pilot if it includes confidence and “insufficient data” states |
| Failure probability | Low | No confirmed failure labels or outcome link |
| Numeric RUL | Not supportable yet | No verified failure/replacement endpoint or validated degradation threshold |

No model accuracy percentage should be claimed from this snapshot. Accuracy, precision/recall, false-alarm rate, lead time, and RUL error require a time-held-out evaluation set with adjudicated outcomes.

## 4. Recommended health/anomaly calculation

### 4.1 Preprocessing

1. Resolve each requested parameter through `parametermapping` to `standardparameters`.
2. Query only bounded vessel/time windows and extract an allowlisted set of JSON keys.
3. Deduplicate by vessel and packet time; retain a deterministic record on ties.
4. Validate numeric values and mark, rather than silently repair, impossible values.
5. Classify operation, for example:
   - stopped: valid power/load/RPM near zero;
   - maneuvering/low-load;
   - underway: valid AIS speed and positive power;
   - uncertain: conflicting or insufficient fields.
6. Join weather and draft/position context with a maximum time/space tolerance.
7. Exclude or separately score bad weather, maneuvering, stopped, missing-RPM, and invalid-SFOC windows.

### 4.2 Performance residuals

For a valid operating window, let `f_ref` be an interpolation or nearest-neighbour lookup over the approved reference data:

```text
expected_power = f_ref(speed, draft, displacement, condition)
expected_sfoc  = g_ref(speed, draft, displacement, condition)

power_residual = measured_power - expected_power
sfoc_residual  = measured_sfoc - expected_sfoc
```

Use the sea-trial curve as a separate baseline, not an unverified replacement for the reference tables. Standardize residuals using a clean baseline by operating regime, preferably with median and MAD rather than mean and standard deviation:

```text
robust_z(x) = (x - rolling_median(x)) / (1.4826 * rolling_MAD(x) + epsilon)
```

The model must retain the raw value, baseline version, draft/speed regime, weather context, and exclusion reason for every score.

### 4.3 Pilot health score

A minimal interpretable score can combine bounded component penalties:

```text
anomaly_penalty = clip(
    w1 * |z(power_residual)| +
    w2 * |z(sfoc_residual)| +
    w3 * load_or_rpm_inconsistency +
    w4 * persistent_rule_penalty,
    0, 1
)

health_index = 100 * (1 - anomaly_penalty)
```

Weights and limits must be calibrated on Lobivia's clean baseline and reviewed by an engineer. Add a separate confidence score based on field coverage, regime match, metadata validity, weather completeness, and reference proximity. If confidence is below the approved minimum, return `insufficient_data`, not a reassuring health value.

A later unsupervised model can use rolling features such as level, slope, variance, missingness, power/SFOC residuals, RPM-load consistency, weather, and alert persistence. Isolation Forest is appropriate as a ranking model for unusual points, but its output is an anomaly score, not a probability of failure. It must be trained on a clean historical baseline and evaluated chronologically.

## 5. Why RUL is not yet reliable

A supervised RUL target requires a known endpoint. For component `c` and failure/replacement time `T_f`:

```text
RUL(t) = max(0, T_f - t)
```

The current database does not provide `T_f` for Lobivia. Rule firings cannot substitute for it because they are repeated, state-dependent, and not confirmed failures. A degradation slope extrapolation such as:

```text
estimated_time_to_threshold = (threshold - current_health) / health_slope
```

is only a provisional trend indicator. It becomes a production RUL estimate only after the threshold is tied to a real maintenance action and the trend is shown to generalize across multiple events.

Do not train a deep LSTM/Transformer or fit a survival model to the current data and call the result RUL. It would learn operating states and sensor artifacts without a defensible life target. Published RUL work also depends on labeled degradation/end-of-life targets; benchmark results from simulated or unrelated equipment do not transfer automatically to this vessel.

## 6. Recommended implementation sequence

### Phase 1 — data contract and profiling

- Freeze the vessel-23 parameter dictionary using the standard packet keys.
- Add bounded profile queries by month and operating regime.
- Record null rate, interval gaps, duplicate timestamps, valid ranges, and unit/version provenance.
- Validate packet semantics and ranges with the vessel/engine-data owner.

### Phase 2 — baseline monitoring

- Implement stopped/underway/uncertain operating classification.
- Reproduce configured rules as event records with rule ID and source provenance.
- Build condition-normalized power and SFOC residuals using draft, speed, weather, reference curves, and sea trials.
- Add rolling robust baselines and persistence/debouncing.
- Expose health, confidence, data-quality flags, and “insufficient data”.

### Phase 3 — anomaly pilot

- Train Isolation Forest or a similarly simple model only on validated normal windows.
- Use chronological train/test splits; never randomly mix future packets into training.
- Measure alert rate, false alarms against engineer review, detection lead time before known operational events, and stability under distribution drift.

### Phase 4 — labeled prognostics

Obtain and link:

- maintenance/work-order history;
- component and subsystem identifiers;
- failure, replacement, inspection, and repair timestamps;
- engine running hours and operating-hour counters;
- alarm acknowledgement and resolution;
- action thresholds and acceptable lead times;
- engineer adjudication of historical alerts.

Only then create event-specific RUL targets, compare a simple degradation/survival baseline against tree/sequence models, and report time-based holdout metrics with uncertainty intervals.

## 7. Data provenance contract

Every health or anomaly result should carry:

- vessel ID, vessel name, and IMO;
- packet time and calculation window;
- source table (`highfrequencydata`, `standardparameters`, `parametermapping`, `std_stormglassweather`, reference source);
- standard packet key and mapped vessel key;
- unit and metadata version/date;
- operating regime and weather filter;
- baseline/reference version;
- missingness and exclusion flags;
- health/anomaly value plus confidence;
- model/rule version and calculation timestamp.

The browser should receive the derived contract, not raw JSONB telemetry or database credentials.

## References

- ISO 19030, *Measurement of changes in hull and propeller performance*: https://www.iso.org/standard/63774.html
- scikit-learn, Isolation Forest: https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.IsolationForest.html
- scikit-learn, TimeSeriesSplit: https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html
- IMO, EEXI/CII FAQ and operational carbon-intensity context: https://www.imo.org/en/mediacentre/hottopics/pages/eexi-cii-faq.aspx
- Li et al., time-series RUL methodology discussion and limitations: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9778194/

## Final decision

Proceed with **Lobivia health/anomaly monitoring and normalized performance analytics** as a pilot. Mark the result as a condition indicator with confidence, not as a failure probability or RUL. Keep RUL behind a data-readiness gate until verified maintenance/failure events and action thresholds are available.
