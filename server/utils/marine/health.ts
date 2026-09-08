import { dbQuery } from '../db'
import {
  scoreVesselHealth,
  type HealthComponentInput,
  type VesselHealth,
} from '../../../shared/types/marine-health'

const NUMERIC_JSON = "^[-+]?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)$"
const PROFILE_DAYS = 180
const LATEST_DAYS = 7

const HEALTH_SPECS = [
  { id: 'power', packetKey: 'AM267', label: 'ME shaft power', unit: 'kW', weight: 3 },
  { id: 'load', packetKey: 'AM251', label: 'ME estimated load', unit: '%', weight: 2 },
  { id: 'rpm', packetKey: 'AM265', label: 'ME shaft RPM', unit: 'rpm', weight: 1 },
  { id: 'measured_sfoc', packetKey: 'AM873', label: 'ME measured SFOC', unit: 'mg/kWh', weight: 3 },
  { id: 'iso_sfoc', packetKey: 'AM874', label: 'ME ISO SFOC', unit: 'mg/kWh', weight: 2 },
  { id: 'fuel', packetKey: 'AF1', label: 'ME fuel supply rate', unit: 'kg/hr', weight: 1 },
] as const

type HealthStatsRow = {
  component: string
  packets: number
  nonnull: number
  valid: number
  latest_packets: number
  latest_valid: number
  baseline_median: number | string | null
  baseline_p05: number | string | null
  baseline_p95: number | string | null
  latest_median: number | string | null
}

type MappingRow = {
  standardparameter: string
  vesselparameter: string
  unit: string | null
}

function numberOrNull(value: number | string | null) {
  if (value == null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function toIso(value: Date | string | null) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export type VesselHealthResponse = VesselHealth & {
  vessel: { id: number; name: string | null; imo: string | null }
  latestPacket: string | null
  profileDays: number
  latestDays: number
  mappings: Array<{ vesselParameter: string; standardParameter: string; unit: string | null }>
  provenance: {
    telemetry: string
    metadata: string
    method: string
  }
}

export async function getVesselHealth(vesselId: number): Promise<VesselHealthResponse | null> {
  const [vesselResult, mappingResult, latestResult] = await Promise.all([
    dbQuery<{ id: number; name: string | null; imo: string | null }>(`
      SELECT id, name, imo::text AS imo
      FROM shipping_db.ship
      WHERE id = $1 AND "isDeleted" IS NOT TRUE
      LIMIT 1
    `, [vesselId]),
    dbQuery<MappingRow>(`
      SELECT DISTINCT ON (pm.standardparameter)
        pm.standardparameter,
        pm.vesselparameter,
        COALESCE(NULLIF(pm.altunit, ''), sp.unit) AS unit
      FROM shipping_db.parametermapping pm
      LEFT JOIN shipping_db.standardparameters sp ON sp.name = pm.standardparameter
      WHERE pm.vesselid = $1
        AND pm.status = 'Active'
        AND pm.standardparameter = ANY($2::text[])
      ORDER BY pm.standardparameter, pm.updatedat DESC NULLS LAST, pm.id DESC
    `, [vesselId, [...HEALTH_SPECS.map((spec) => spec.packetKey), 'AIVDO_Speed']]),
    dbQuery<{ latest_packet: Date | string | null }>(`
      SELECT max(packettime) AS latest_packet
      FROM shipping_db.highfrequencydata
      WHERE vesselid = $1
    `, [vesselId]),
  ])

  const vessel = vesselResult.rows[0]
  if (!vessel) return null

  const latest = latestResult.rows[0]?.latest_packet
  const latestDate = latest ? new Date(latest) : null
  if (!latestDate || Number.isNaN(latestDate.getTime())) {
    const empty = scoreVesselHealth([])
    return {
      ...empty,
      vessel,
      latestPacket: null,
      profileDays: PROFILE_DAYS,
      latestDays: LATEST_DAYS,
      mappings: mappingResult.rows.map((row) => ({ vesselParameter: row.vesselparameter, standardParameter: row.standardparameter, unit: row.unit })),
      provenance: {
        telemetry: 'shipping_db.highfrequencydata',
        metadata: 'shipping_db.parametermapping + shipping_db.standardparameters',
        method: 'No telemetry packet is available for this vessel.',
      },
    }
  }

  const mapping = new Map(mappingResult.rows.map((row) => [row.standardparameter, row]))
  const packetKeys = HEALTH_SPECS.map((spec) => mapping.get(spec.packetKey)?.standardparameter ?? '')
  const profileStart = new Date(latestDate.getTime() - PROFILE_DAYS * 24 * 60 * 60 * 1000)
  // ponytail: vessel-baseline score is the smallest useful pilot; add reference/weather residuals after domain validation.
  const stats = await dbQuery<HealthStatsRow>(`
    WITH raw AS (
      SELECT
        h.packettime,
        CASE WHEN h.packetdata ->> $4 ~ '${NUMERIC_JSON}' THEN (h.packetdata ->> $4)::numeric END AS power,
        CASE WHEN h.packetdata ->> $5 ~ '${NUMERIC_JSON}' THEN (h.packetdata ->> $5)::numeric END AS load,
        CASE WHEN h.packetdata ->> $6 ~ '${NUMERIC_JSON}' THEN (h.packetdata ->> $6)::numeric END AS rpm,
        CASE WHEN h.packetdata ->> $7 ~ '${NUMERIC_JSON}' THEN (h.packetdata ->> $7)::numeric END AS measured_sfoc,
        CASE WHEN h.packetdata ->> $8 ~ '${NUMERIC_JSON}' THEN (h.packetdata ->> $8)::numeric END AS iso_sfoc,
        CASE WHEN h.packetdata ->> $9 ~ '${NUMERIC_JSON}' THEN (h.packetdata ->> $9)::numeric END AS fuel,
        CASE WHEN h.packetdata ->> $10 ~ '${NUMERIC_JSON}' THEN (h.packetdata ->> $10)::numeric END AS sog
      FROM shipping_db.highfrequencydata h
      WHERE h.vesselid = $1
        AND h.packettime >= $2::timestamptz
        AND h.packettime <= $3::timestamptz
    ), measurements AS (
      SELECT packettime, 'power' AS component, power AS value,
        CASE WHEN sog BETWEEN 5 AND 30 AND power > 0 AND power <= 11000 THEN power END AS valid_value FROM raw
      UNION ALL SELECT packettime, 'load', load, CASE WHEN sog BETWEEN 5 AND 30 AND load BETWEEN 0 AND 100 THEN load END FROM raw
      UNION ALL SELECT packettime, 'rpm', rpm, CASE WHEN sog BETWEEN 5 AND 30 AND rpm > 0 AND rpm <= 100 THEN rpm END FROM raw
      UNION ALL SELECT packettime, 'measured_sfoc', measured_sfoc, CASE WHEN sog BETWEEN 5 AND 30 AND power > 0 AND measured_sfoc BETWEEN 100 AND 500 THEN measured_sfoc END FROM raw
      UNION ALL SELECT packettime, 'iso_sfoc', iso_sfoc, CASE WHEN sog BETWEEN 5 AND 30 AND power > 0 AND iso_sfoc BETWEEN 100 AND 500 THEN iso_sfoc END FROM raw
      UNION ALL SELECT packettime, 'fuel', fuel, CASE WHEN sog BETWEEN 5 AND 30 AND power > 0 AND fuel > 0 AND fuel <= 1000 THEN fuel END FROM raw
    )
    SELECT
      component,
      count(*)::int AS packets,
      count(value)::int AS nonnull,
      count(valid_value)::int AS valid,
      count(*) FILTER (WHERE packettime >= $3::timestamptz - interval '7 days')::int AS latest_packets,
      count(valid_value) FILTER (WHERE packettime >= $3::timestamptz - interval '7 days')::int AS latest_valid,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY valid_value) FILTER (WHERE packettime < $3::timestamptz - interval '7 days') AS baseline_median,
      percentile_cont(0.05) WITHIN GROUP (ORDER BY valid_value) FILTER (WHERE packettime < $3::timestamptz - interval '7 days') AS baseline_p05,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY valid_value) FILTER (WHERE packettime < $3::timestamptz - interval '7 days') AS baseline_p95,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY valid_value) FILTER (WHERE packettime >= $3::timestamptz - interval '7 days') AS latest_median
    FROM measurements
    GROUP BY component
    ORDER BY component
  `, [vesselId, profileStart.toISOString(), latestDate.toISOString(), ...packetKeys, mapping.get('AIVDO_Speed')?.standardparameter ?? ''])

  const statsById = new Map(stats.rows.map((row) => [row.component, row]))
  const inputs: HealthComponentInput[] = HEALTH_SPECS.map((spec) => {
    const row = statsById.get(spec.id)
    return {
      id: spec.id,
      label: spec.label,
      unit: mapping.get(spec.packetKey)?.unit ?? spec.unit,
      weight: spec.weight,
      packets: Number(row?.packets ?? 0),
      nonnull: Number(row?.nonnull ?? 0),
      valid: Number(row?.valid ?? 0),
      latestPackets: Number(row?.latest_packets ?? 0),
      latestValid: Number(row?.latest_valid ?? 0),
      baselineMedian: numberOrNull(row?.baseline_median ?? null),
      baselineP05: numberOrNull(row?.baseline_p05 ?? null),
      baselineP95: numberOrNull(row?.baseline_p95 ?? null),
      latestMedian: numberOrNull(row?.latest_median ?? null),
    }
  })

  return {
    ...scoreVesselHealth(inputs),
    vessel,
    latestPacket: toIso(latest),
    profileDays: PROFILE_DAYS,
    latestDays: LATEST_DAYS,
    mappings: mappingResult.rows.map((row) => ({ vesselParameter: row.vesselparameter, standardParameter: row.standardparameter, unit: row.unit })),
    provenance: {
      telemetry: 'shipping_db.highfrequencydata',
      metadata: 'shipping_db.parametermapping + shipping_db.standardparameters',
      method: 'Vessel-specific rolling baseline: valid underway-window median versus the preceding 180-day 5th–95th percentile envelope. This is an anomaly/health indicator, not RUL.',
    },
  }
}
