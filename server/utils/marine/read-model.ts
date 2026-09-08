import { dbQuery } from '../db'
import { analyzeThreshold } from '../../../shared/types/marine'

export type AlertSeverity = 'critical' | 'warning'

export type OperationalAlert = {
  alert_key: string
  id: number
  vessel_id: number | null
  vessel_name: string | null
  category: string | null
  system_name: string | null
  message: string | null
  live_value: string | null
  live_value_unit: string | null
  reported_at: string | null
  started_at: string | null
  last_fired_at: string | null
  occurrences: number
  acknowledged: boolean | null
  severity: AlertSeverity
}

export type FleetSnapshot = {
  vessels: number
  connected: number
  offline: number
  unknown: number
  networkVessels: Array<{
    vessel_id: number
    vessel_name: string | null
    connected: boolean | null
    updated_at: string | null
  }>
}

export type VesselOperationalContext = {
  vessel: { id: number; name: string | null }
  connectivity: { connected: boolean | null; updated_at: string | null } | null
  voyage: {
    next_port: string | null
    next_port_code: string | null
    eta: string | null
    packet_at: string | null
    route_name: string | null
    load_status: string | null
  } | null
  alerts: OperationalAlert[]
}

type DbDate = Date | string | null

function toIso(value: DbDate) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function escapeSearch(value: string) {
  return value.replace(/[\\%_]/g, '\\$&')
}

const severityExpression = `CASE
  WHEN lower(concat_ws(' ', coalesce(a.observanttype, ''), coalesce(a.observantmessage, ''), coalesce(a.machinetype, ''))) ~ '(critical|failure|shutdown|trip|high-high|low-low)'
  THEN 'critical'
  ELSE 'warning'
END`

function alertFilters(search?: string, severity?: AlertSeverity, vesselId?: number) {
  const values: Array<string | number> = []
  const where = ['a.acknowledgestatus IS NOT TRUE']

  if (search?.trim()) {
    values.push(`%${escapeSearch(search.trim().slice(0, 100))}%`)
    where.push(`concat_ws(' ', coalesce(s.name, ''), coalesce(a.observantmessage, ''), coalesce(a.machinetype, ''), coalesce(a.observanttype, '')) ILIKE $${values.length} ESCAPE '\\'`)
  }

  if (severity) {
    values.push(severity)
    where.push(`${severityExpression} = $${values.length}`)
  }

  if (vesselId) {
    values.push(vesselId)
    where.push(`a.vesselid = $${values.length}`)
  }

  return { where: where.join(' AND '), values }
}

function mapAlert(row: {
  alert_key: string
  id: number
  vessel_id: number | null
  vessel_name: string | null
  category: string | null
  system_name: string | null
  message: string | null
  live_value: string | null
  live_value_unit: string | null
  reported_at: DbDate
  started_at: DbDate
  last_fired_at: DbDate
  occurrences: number
  acknowledged: boolean | null
  severity: AlertSeverity
}): OperationalAlert {
  return { ...row, reported_at: toIso(row.reported_at), started_at: toIso(row.started_at), last_fired_at: toIso(row.last_fired_at) }
}

export async function searchOperationalAlerts(options: {
  search?: string
  severity?: AlertSeverity
  vesselId?: number
  page?: number
  pageSize?: number
} = {}) {
  const pageSize = Math.min(10, Math.max(1, options.pageSize ?? 10))
  const requestedPage = Math.max(1, options.page ?? 1)
  const filters = alertFilters(options.search, options.severity, options.vesselId)
  const count = await dbQuery<{ count: string }>(`
    WITH filtered AS (
      SELECT row_number() OVER (
        PARTITION BY a.vesselid, coalesce(a.observanttype, 'Operational alert'), coalesce(a.machinetype, '—'), coalesce(a.observantmessage, a.data->>'message', 'Alert triggered'), coalesce(a.livevalueunit, '')
        ORDER BY a."timestamp" DESC NULLS LAST, a.id DESC
      ) AS row_num
      FROM shipping_db.std_triggeredoutcomestoday a
      LEFT JOIN shipping_db.ship s ON s.id = a.vesselid
      WHERE ${filters.where}
    )
    SELECT count(*)::text AS count FROM filtered WHERE row_num = 1
  `, filters.values)

  const total = Number(count.rows[0]?.count ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const offset = (page - 1) * pageSize
  const result = await dbQuery<{
    alert_key: string
    id: number
    vessel_id: number | null
    vessel_name: string | null
    category: string | null
    system_name: string | null
    message: string | null
    live_value: string | null
    live_value_unit: string | null
    reported_at: DbDate
    started_at: DbDate
    last_fired_at: DbDate
    occurrences: number
    acknowledged: boolean | null
    severity: AlertSeverity
  }>(`
    WITH filtered AS (
      SELECT
        a.id::text || '-' || coalesce(extract(epoch FROM a."timestamp")::text, 'unknown') AS alert_key,
        a.id,
        a.vesselid AS vessel_id,
        coalesce(s.name, a.companyname) AS vessel_name,
        coalesce(a.observanttype, 'Operational alert') AS category,
        coalesce(a.machinetype, '—') AS system_name,
        coalesce(a.observantmessage, a.data->>'message', 'Alert triggered') AS message,
        a.livevalue AS live_value,
        a.livevalueunit AS live_value_unit,
        a."timestamp" AS reported_at,
        min(a."timestamp") OVER (PARTITION BY a.vesselid, coalesce(a.observanttype, 'Operational alert'), coalesce(a.machinetype, '—'), coalesce(a.observantmessage, a.data->>'message', 'Alert triggered'), coalesce(a.livevalueunit, '')) AS started_at,
        max(a."timestamp") OVER (PARTITION BY a.vesselid, coalesce(a.observanttype, 'Operational alert'), coalesce(a.machinetype, '—'), coalesce(a.observantmessage, a.data->>'message', 'Alert triggered'), coalesce(a.livevalueunit, '')) AS last_fired_at,
        count(*) OVER (PARTITION BY a.vesselid, coalesce(a.observanttype, 'Operational alert'), coalesce(a.machinetype, '—'), coalesce(a.observantmessage, a.data->>'message', 'Alert triggered'), coalesce(a.livevalueunit, '')) AS occurrences,
        a.acknowledgestatus AS acknowledged,
        ${severityExpression} AS severity,
        row_number() OVER (
          PARTITION BY a.vesselid, coalesce(a.observanttype, 'Operational alert'), coalesce(a.machinetype, '—'), coalesce(a.observantmessage, a.data->>'message', 'Alert triggered'), coalesce(a.livevalueunit, '')
          ORDER BY a."timestamp" DESC NULLS LAST, a.id DESC
        ) AS row_num
      FROM shipping_db.std_triggeredoutcomestoday a
      LEFT JOIN shipping_db.ship s ON s.id = a.vesselid
      WHERE ${filters.where}
    )
    SELECT * FROM filtered
    WHERE row_num = 1
    ORDER BY last_fired_at DESC NULLS LAST, id DESC
    LIMIT $${filters.values.length + 1} OFFSET $${filters.values.length + 2}
  `, [...filters.values, pageSize, offset])

  return { alerts: result.rows.map(mapAlert), page, pageSize, total, totalPages }
}

export async function analyzeOperationalAlert(alertId: number) {
  const alertResult = await dbQuery<{
    alert_key: string
    id: number
    vessel_id: number | null
    vessel_name: string | null
    category: string | null
    system_name: string | null
    message: string | null
    live_value: string | null
    live_value_unit: string | null
    reported_at: DbDate
    started_at: DbDate
    last_fired_at: DbDate
    occurrences: number
    severity: AlertSeverity
    acknowledged: boolean | null
  }>(`
    SELECT
      a.id::text || '-' || coalesce(extract(epoch FROM a."timestamp")::text, 'unknown') AS alert_key,
      a.id,
      a.vesselid AS vessel_id,
      coalesce(s.name, a.companyname) AS vessel_name,
      coalesce(a.observanttype, 'Operational alert') AS category,
      coalesce(a.machinetype, '—') AS system_name,
      coalesce(a.observantmessage, a.data->>'message', 'Alert triggered') AS message,
      a.livevalue AS live_value,
      a.livevalueunit AS live_value_unit,
      a."timestamp" AS reported_at,
      a."timestamp" AS started_at,
      a."timestamp" AS last_fired_at,
      1 AS occurrences,
      ${severityExpression} AS severity,
      a.acknowledgestatus AS acknowledged
    FROM shipping_db.std_triggeredoutcomestoday a
    LEFT JOIN shipping_db.ship s ON s.id = a.vesselid
    WHERE a.id = $1
    LIMIT 1
  `, [alertId])

  const alert = alertResult.rows[0]
  if (!alert) return null

  const related = alert.vessel_id
    ? await searchOperationalAlerts({ vesselId: alert.vessel_id, page: 1, pageSize: 10 })
    : { alerts: [], total: 0 }
  const groupedAlert = related.alerts.find((item) => item.system_name === alert.system_name && item.message === alert.message && item.live_value_unit === alert.live_value_unit)
  const mappedAlert = mapAlert(alert)
  const threshold = analyzeThreshold(alert.message, alert.live_value)

  return {
    alert: groupedAlert ? { ...mappedAlert, started_at: groupedAlert.started_at, last_fired_at: groupedAlert.last_fired_at, occurrences: groupedAlert.occurrences } : mappedAlert,
    analysis: {
      ...threshold,
      relatedAlertCount: related.total,
      relatedAlerts: related.alerts.slice(0, 10).map((item) => ({
        id: item.id,
        vessel_name: item.vessel_name,
        system_name: item.system_name,
        severity: item.severity,
        message: item.message,
        live_value: item.live_value,
        live_value_unit: item.live_value_unit,
        started_at: item.started_at,
        last_fired_at: item.last_fired_at,
        occurrences: item.occurrences,
      })),
    },
  }
}

export async function getFleetSnapshot(): Promise<FleetSnapshot> {
  const [kpis, vessels] = await Promise.all([
    dbQuery<{ vessels: number; connected: number; offline: number; unknown: number }>(`
      WITH latest_heartbeat AS (
        SELECT DISTINCT ON (vesselid) vesselid, isconnected, updatedat
        FROM shipping_db.vsatheartbeat
        WHERE vesselid IS NOT NULL
        ORDER BY vesselid, updatedat DESC NULLS LAST, id DESC
      )
      SELECT
        count(*)::int AS vessels,
        count(*) FILTER (WHERE h.isconnected IS TRUE)::int AS connected,
        count(*) FILTER (WHERE h.isconnected IS FALSE)::int AS offline,
        count(*) FILTER (WHERE h.vesselid IS NULL OR h.isconnected IS NULL)::int AS unknown
      FROM shipping_db.ship s
      LEFT JOIN latest_heartbeat h ON h.vesselid = s.id
      WHERE s."isDeleted" IS NOT TRUE
    `),
    dbQuery<{ vessel_id: number; vessel_name: string | null; connected: boolean | null; updated_at: DbDate }>(`
      SELECT s.id AS vessel_id, s.name AS vessel_name, h.isconnected AS connected, h.updatedat AS updated_at
      FROM shipping_db.ship s
      LEFT JOIN LATERAL (
        SELECT isconnected, updatedat
        FROM shipping_db.vsatheartbeat
        WHERE vesselid = s.id
        ORDER BY updatedat DESC NULLS LAST, id DESC
        LIMIT 1
      ) h ON TRUE
      WHERE s."isDeleted" IS NOT TRUE
      ORDER BY CASE WHEN h.isconnected IS FALSE THEN 0 WHEN h.isconnected IS NULL THEN 1 ELSE 2 END, s.name ASC NULLS LAST, s.id ASC
      LIMIT 50
    `),
  ])

  const row = kpis.rows[0] ?? { vessels: 0, connected: 0, offline: 0, unknown: 0 }
  return {
    vessels: Number(row.vessels),
    connected: Number(row.connected),
    offline: Number(row.offline),
    unknown: Number(row.unknown),
    networkVessels: vessels.rows.map((vessel) => ({ ...vessel, updated_at: toIso(vessel.updated_at) })),
  }
}

export async function getVesselOperationalContext(vesselId: number): Promise<VesselOperationalContext | null> {
  const [vesselResult, heartbeatResult, voyageResult, alertsResult] = await Promise.all([
    dbQuery<{ id: number; name: string | null }>(`
      SELECT id, name FROM shipping_db.ship WHERE id = $1 AND "isDeleted" IS NOT TRUE LIMIT 1
    `, [vesselId]),
    dbQuery<{ connected: boolean | null; updated_at: DbDate }>(`
      SELECT isconnected AS connected, updatedat AS updated_at
      FROM shipping_db.vsatheartbeat WHERE vesselid = $1
      ORDER BY updatedat DESC NULLS LAST, id DESC LIMIT 1
    `, [vesselId]),
    dbQuery<{
      next_port: string | null
      next_port_code: string | null
      departure_port: string | null
      departure_port_code: string | null
      eta: DbDate
      packet_at: DbDate
      route_name: string | null
      load_status: string | null
      distance_travelled: number | string | null
      distance_to_go: number | string | null
    }>(`
      WITH latest_noon AS (
        SELECT
          NULLIF(TRIM(noonreportdata->>'Start_Port'), '') as scr,
          NULLIF(TRIM(noonreportdata->>'Next_Port'), '') as next_port,
          NULLIF(TRIM(noonreportdata->>'ETA_Next_Port'), '') as eta_next_port,
          NULLIF(REGEXP_REPLACE(noonreportdata->>'Distance_Covered_Since_SOV', '[^0-9.]', '', 'g'), '')::numeric as total_dist_run,
          NULLIF(REGEXP_REPLACE(noonreportdata->>'Distance_Remaining_To_EOV', '[^0-9.]', '', 'g'), '')::numeric as dist_to_go
        FROM shipping_db.std_enoonreporttable
        WHERE vesselid = $1
        ORDER BY report_date_time_utc DESC NULLS LAST
        LIMIT 1
      ),
      latest_vf AS (
        SELECT
          lastport,
          lastportunlocode,
          nextportname,
          nextportunlocode,
          eta,
          packetts,
          route_name,
          loadstatusname,
          distancetravelled,
          distancetogo
        FROM shipping_db.voyageforecast
        WHERE vesselid = $1
        ORDER BY packetts DESC NULLS LAST, id DESC
        LIMIT 1
      )
      SELECT
        COALESCE(NULLIF(TRIM(vf.nextportname), ''), n.next_port) as next_port,
        vf.nextportunlocode as next_port_code,
        COALESCE(NULLIF(TRIM(vf.lastport), ''), n.scr) as departure_port,
        vf.lastportunlocode as departure_port_code,
        COALESCE(vf.eta, n.eta_next_port::timestamptz) as eta,
        vf.packetts as packet_at,
        vf.route_name,
        vf.loadstatusname as load_status,
        COALESCE(vf.distancetravelled, n.total_dist_run) as distance_travelled,
        COALESCE(vf.distancetogo, n.dist_to_go) as distance_to_go
      FROM (SELECT 1) _
      LEFT JOIN latest_vf vf ON TRUE
      LEFT JOIN latest_noon n ON TRUE
      WHERE vf.nextportname IS NOT NULL OR n.next_port IS NOT NULL
      LIMIT 1
    `, [vesselId]),
    searchOperationalAlerts({ page: 1, pageSize: 5, vesselId }),
  ])

  const vessel = vesselResult.rows[0]
  if (!vessel) return null

  const rawVoyage = voyageResult.rows[0]
  const distRun = rawVoyage?.distance_travelled != null ? Number(rawVoyage.distance_travelled) : null
  const distToGo = rawVoyage?.distance_to_go != null ? Number(rawVoyage.distance_to_go) : null
  const progressPercent = distRun != null && distToGo != null && (distRun + distToGo) > 0
    ? Math.round((distRun * 1000) / (distRun + distToGo)) / 10
    : null

  return {
    vessel,
    connectivity: heartbeatResult.rows[0] ? {
      connected: heartbeatResult.rows[0].connected,
      updated_at: toIso(heartbeatResult.rows[0].updated_at),
    } : null,
    voyage: rawVoyage ? {
      ...rawVoyage,
      distance_travelled: distRun,
      distance_to_go: distToGo,
      progress_percent: progressPercent,
      eta: toIso(rawVoyage.eta),
      packet_at: toIso(rawVoyage.packet_at),
    } : null,
    alerts: alertsResult.alerts.filter((alert) => alert.vessel_id === vesselId),
  }
}

export async function getFleetVoyages(limit = 30) {
  const result = await dbQuery<{
    vessel_id: number
    vessel_name: string
    departure_port: string | null
    departure_port_code: string | null
    next_port: string | null
    next_port_code: string | null
    eta: DbDate
    route_name: string | null
    load_status: string | null
    distance_travelled: number | string | null
    distance_to_go: number | string | null
    progress_percent: number | null
  }>(`
    WITH latest_noon AS (
      SELECT DISTINCT ON (vesselid)
        vesselid,
        NULLIF(TRIM(noonreportdata->>'Start_Port'), '') as scr,
        NULLIF(TRIM(noonreportdata->>'Next_Port'), '') as next_port,
        NULLIF(TRIM(noonreportdata->>'ETA_Next_Port'), '') as eta_next_port,
        NULLIF(REGEXP_REPLACE(noonreportdata->>'Distance_Covered_Since_SOV', '[^0-9.]', '', 'g'), '')::numeric as total_dist_run,
        NULLIF(REGEXP_REPLACE(noonreportdata->>'Distance_Remaining_To_EOV', '[^0-9.]', '', 'g'), '')::numeric as dist_to_go
      FROM shipping_db.std_enoonreporttable
      WHERE vesselid IS NOT NULL
      ORDER BY vesselid, report_date_time_utc DESC NULLS LAST
    ),
    latest_vf AS (
      SELECT DISTINCT ON (vesselid)
        vesselid,
        lastport,
        lastportunlocode,
        nextportname,
        nextportunlocode,
        eta,
        route_name,
        loadstatusname,
        distancetravelled,
        distancetogo
      FROM shipping_db.voyageforecast
      WHERE vesselid IS NOT NULL
      ORDER BY vesselid, packetts DESC NULLS LAST, id DESC
    )
    SELECT
      s.id AS vessel_id,
      s.name AS vessel_name,
      COALESCE(NULLIF(TRIM(vf.lastport), ''), n.scr) AS departure_port,
      vf.lastportunlocode AS departure_port_code,
      COALESCE(NULLIF(TRIM(vf.nextportname), ''), n.next_port) AS next_port,
      vf.nextportunlocode AS next_port_code,
      COALESCE(vf.eta, n.eta_next_port::timestamptz) AS eta,
      COALESCE(NULLIF(TRIM(vf.route_name), ''), CASE WHEN n.scr IS NOT NULL AND n.next_port IS NOT NULL THEN n.scr || ' to ' || n.next_port END) AS route_name,
      vf.loadstatusname AS load_status,
      COALESCE(vf.distancetravelled, n.total_dist_run)::numeric AS distance_travelled,
      COALESCE(vf.distancetogo, n.dist_to_go)::numeric AS distance_to_go,
      CASE
        WHEN COALESCE(vf.distancetravelled, n.total_dist_run)::numeric > 0 AND COALESCE(vf.distancetogo, n.dist_to_go)::numeric IS NOT NULL THEN
          ROUND(
            (COALESCE(vf.distancetravelled, n.total_dist_run)::numeric * 100.0) /
            NULLIF(COALESCE(vf.distancetravelled, n.total_dist_run)::numeric + COALESCE(vf.distancetogo, n.dist_to_go)::numeric, 0)
          , 1)
        ELSE NULL
      END AS progress_percent
    FROM shipping_db.ship s
    LEFT JOIN latest_vf vf ON vf.vesselid = s.id
    LEFT JOIN latest_noon n ON n.vesselid = s.id
    WHERE s."isDeleted" IS NOT TRUE
      AND (vf.nextportname IS NOT NULL OR n.next_port IS NOT NULL)
    ORDER BY eta ASC NULLS LAST, s.name ASC
    LIMIT $1
  `, [limit])

  return result.rows.map((row) => ({
    ...row,
    eta: toIso(row.eta),
    distance_travelled: row.distance_travelled != null ? Number(row.distance_travelled) : null,
    distance_to_go: row.distance_to_go != null ? Number(row.distance_to_go) : null,
    progress_percent: row.progress_percent != null ? Number(row.progress_percent) : null,
  }))
}

export async function getFleetAlarmTrends(options: { vesselId?: number; days?: number } = {}) {
  const days = Math.min(7, Math.max(1, options.days ?? 1))
  const intervalStr = `${days * 24} hours`
  const vesselFilter = options.vesselId ? `AND vesselid = ${Number(options.vesselId)}` : ''

  const [hourlyResult, vesselResult, systemResult] = await Promise.all([
    dbQuery<{ hour_bin: string; count: number }>(`
      SELECT
        to_char(date_trunc('hour', "timestamp"), 'HH24:MI') AS hour_bin,
        count(*)::int AS count
      FROM shipping_db.std_triggeredoutcomestoday
      WHERE "timestamp" >= NOW() - interval '${intervalStr}'
        ${vesselFilter}
      GROUP BY 1
      ORDER BY min("timestamp") ASC
    `),
    dbQuery<{ vessel_name: string; count: number }>(`
      SELECT
        coalesce(s.name, a.companyname, 'Vessel ' || a.vesselid) AS vessel_name,
        count(*)::int AS count
      FROM shipping_db.std_triggeredoutcomestoday a
      LEFT JOIN shipping_db.ship s ON s.id = a.vesselid
      WHERE a."timestamp" >= NOW() - interval '${intervalStr}'
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 10
    `),
    dbQuery<{ system_name: string; count: number }>(`
      SELECT
        coalesce(machinetype, 'OTHER') AS system_name,
        count(*)::int AS count
      FROM shipping_db.std_triggeredoutcomestoday
      WHERE "timestamp" >= NOW() - interval '${intervalStr}'
        ${vesselFilter}
      GROUP BY 1
      ORDER BY 2 DESC
    `),
  ])

  return {
    total_alarms: hourlyResult.rows.reduce((sum, r) => sum + Number(r.count), 0),
    hourly_trend: hourlyResult.rows.map((r) => ({ label: r.hour_bin, value: Number(r.count) })),
    by_vessel: vesselResult.rows.map((r) => ({ label: r.vessel_name, value: Number(r.count) })),
    by_system: systemResult.rows.map((r) => ({ label: r.system_name, value: Number(r.count) })),
  }
}
