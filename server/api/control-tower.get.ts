import { createError, defineEventHandler, getQuery } from 'h3'
import { dbQuery } from '../utils/db'
import { analyzeThreshold } from '../../shared/types/marine'

const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 50

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const candidate = Number(Array.isArray(value) ? value[0] : value)
  if (!Number.isSafeInteger(candidate)) return fallback
  return Math.min(max, Math.max(min, candidate))
}

function boundedText(value: unknown, maxLength: number) {
  const text = Array.isArray(value) ? value[0] : value
  return typeof text === 'string' ? text.trim().slice(0, maxLength) : ''
}

function escapeSearch(value: string) {
  return value.replace(/[\\%_]/g, '\\$&')
}

const severityExpression = `CASE
  WHEN lower(concat_ws(' ', coalesce(a.observanttype, ''), coalesce(a.observantmessage, ''), coalesce(a.machinetype, ''))) ~ '(critical|failure|shutdown|trip|high-high|low-low)'
  THEN 'critical'
  ELSE 'warning'
END`

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const requestedPage = boundedInteger(query.page, 1, 1, Number.MAX_SAFE_INTEGER)
  const pageSize = boundedInteger(query.pageSize, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE)
  const search = boundedText(query.search, 100)
  const requestedSeverity = boundedText(query.severity, 20)
  const severity = requestedSeverity === 'critical' || requestedSeverity === 'warning' ? requestedSeverity : ''
  const alertValues: Array<string | number> = []
  const alertWhere = ['a.acknowledgestatus IS NOT TRUE']

  if (search) {
    alertValues.push(`%${escapeSearch(search)}%`)
    alertWhere.push(`concat_ws(' ', coalesce(s.name, ''), coalesce(a.observantmessage, ''), coalesce(a.machinetype, ''), coalesce(a.observanttype, '')) ILIKE $${alertValues.length} ESCAPE '\\'`)
  }
  if (severity) {
    alertValues.push(severity)
    alertWhere.push(`${severityExpression} = $${alertValues.length}`)
  }
  const alertFilterSql = alertWhere.join(' AND ')

  try {
    const [kpiResult, networkVesselsResult, alertCountResult, voyagesResult] = await Promise.all([
      dbQuery<{
        vessels: number
        active_voyages: number
        connected: number
        offline: number
        unknown: number
      }>(`
        WITH latest_heartbeat AS (
          SELECT DISTINCT ON (vesselid)
            vesselid, isconnected, updatedat
          FROM shipping_db.vsatheartbeat
          WHERE vesselid IS NOT NULL
          ORDER BY vesselid, updatedat DESC NULLS LAST, id DESC
        ), latest_enroute AS (
          SELECT DISTINCT ON (vesselid) vesselid
          FROM (
            SELECT vesselid FROM shipping_db.voyageforecast WHERE vesselid IS NOT NULL AND nextportname IS NOT NULL
            UNION
            SELECT vesselid FROM shipping_db.std_enoonreporttable WHERE vesselid IS NOT NULL AND noonreportdata->>'Next_Port' IS NOT NULL
          ) u
        )
        SELECT
          (SELECT count(*) FROM shipping_db.ship WHERE "isDeleted" IS NOT TRUE)::int AS vessels,
          (SELECT count(*) FROM latest_enroute e JOIN shipping_db.ship s ON s.id = e.vesselid WHERE s."isDeleted" IS NOT TRUE)::int AS active_voyages,
          count(*) FILTER (WHERE h.isconnected IS TRUE)::int AS connected,
          count(*) FILTER (WHERE h.isconnected IS FALSE)::int AS offline,
          count(*) FILTER (WHERE h.vesselid IS NULL OR h.isconnected IS NULL)::int AS unknown
        FROM shipping_db.ship s
        LEFT JOIN latest_heartbeat h ON h.vesselid = s.id
        WHERE s."isDeleted" IS NOT TRUE
      `),
      dbQuery<{
        vessel_id: number
        vessel_name: string | null
        connected: boolean | null
        updated_at: Date | null
      }>(`
        SELECT
          s.id AS vessel_id,
          s.name AS vessel_name,
          h.isconnected AS connected,
          h.updatedat AS updated_at
        FROM shipping_db.ship s
        LEFT JOIN LATERAL (
          SELECT isconnected, updatedat
          FROM shipping_db.vsatheartbeat
          WHERE vesselid = s.id
          ORDER BY updatedat DESC NULLS LAST, id DESC
          LIMIT 1
        ) h ON TRUE
        WHERE s."isDeleted" IS NOT TRUE
        ORDER BY
          CASE
            WHEN h.isconnected IS FALSE THEN 0
            WHEN h.isconnected IS NULL THEN 1
            ELSE 2
          END,
          s.name ASC NULLS LAST,
          s.id ASC
      `),
      dbQuery<{ count: string; critical_count: string }>(`
        WITH filtered AS (
          SELECT
            ${severityExpression} AS sev,
            row_number() OVER (
              PARTITION BY a.vesselid, coalesce(a.observanttype, 'Operational alert'), coalesce(a.machinetype, '—'), coalesce(a.observantmessage, a.data->>'message', 'Alert triggered'), coalesce(a.livevalueunit, '')
              ORDER BY a."timestamp" DESC NULLS LAST, a.id DESC
            ) AS row_num
          FROM shipping_db.std_triggeredoutcomestoday a
          LEFT JOIN shipping_db.ship s ON s.id = a.vesselid
          WHERE ${alertFilterSql}
        )
        SELECT
          count(*)::text AS count,
          count(*) FILTER (WHERE sev = 'critical')::text AS critical_count
        FROM filtered WHERE row_num = 1
      `, alertValues),
      dbQuery<{
        vessel_id: number
        vessel_name: string
        departure_port: string | null
        departure_port_code: string | null
        departure_at: Date | null
        next_port: string | null
        next_port_code: string | null
        eta: Date | null
        packet_at: Date | null
        route_name: string | null
        load_status: string | null
        distance_travelled: number | string | null
        distance_to_go: number | string | null
        total_distance: number | string | null
        progress_value: number | string | null
      }>(`
        WITH latest_noon AS (
          SELECT DISTINCT ON (vesselid)
            vesselid,
            NULLIF(TRIM(noonreportdata->>'Start_Port'), '') AS scr,
            NULLIF(TRIM(noonreportdata->>'Next_Port'), '') AS next_port,
            NULLIF(TRIM(noonreportdata->>'ETA_Next_Port'), '') AS eta_next_port,
            NULLIF(REGEXP_REPLACE(noonreportdata->>'Distance_Covered_Since_SOV', '[^0-9.]', '', 'g'), '')::numeric AS total_dist_run,
            NULLIF(REGEXP_REPLACE(noonreportdata->>'Distance_Remaining_To_EOV', '[^0-9.]', '', 'g'), '')::numeric AS dist_to_go,
            NULLIF(TRIM(noonreportdata->>'Voyage_Number'), '') AS voyage,
            report_date_time_utc
          FROM shipping_db.std_enoonreporttable
          WHERE vesselid IS NOT NULL
          ORDER BY vesselid, report_date_time_utc DESC NULLS LAST
        ), latest_voyage AS (
          SELECT DISTINCT ON (vesselid)
            vesselid, lastport, lastportunlocode, lastporttime, nextportname, nextportunlocode,
            eta, packetts, route_name, loadstatusname, distancetravelled, distancetogo, totaldistance
          FROM shipping_db.voyageforecast
          WHERE vesselid IS NOT NULL
          ORDER BY vesselid, packetts DESC NULLS LAST, id DESC
        )
        SELECT
          s.id AS vessel_id,
          s.name AS vessel_name,
          COALESCE(NULLIF(TRIM(v.lastport), ''), n.scr) AS departure_port,
          v.lastportunlocode AS departure_port_code,
          v.lastporttime AS departure_at,
          COALESCE(NULLIF(TRIM(v.nextportname), ''), n.next_port) AS next_port,
          v.nextportunlocode AS next_port_code,
          COALESCE(v.eta, n.eta_next_port::timestamptz) AS eta,
          v.packetts AS packet_at,
          COALESCE(NULLIF(TRIM(v.route_name), ''), n.voyage) AS route_name,
          v.loadstatusname AS load_status,
          COALESCE(v.distancetravelled, n.total_dist_run) AS distance_travelled,
          COALESCE(v.distancetogo, n.dist_to_go) AS distance_to_go,
          v.totaldistance AS total_distance,
          CASE
            WHEN (COALESCE(v.distancetravelled, n.total_dist_run) + COALESCE(v.distancetogo, n.dist_to_go)) > 0
            THEN ROUND((COALESCE(v.distancetravelled, n.total_dist_run) * 100.0) / (COALESCE(v.distancetravelled, n.total_dist_run) + COALESCE(v.distancetogo, n.dist_to_go)), 2)
            ELSE NULL
          END AS progress_value
        FROM shipping_db.ship s
        LEFT JOIN latest_voyage v ON v.vesselid = s.id
        LEFT JOIN latest_noon n ON n.vesselid = s.id
        WHERE s."isDeleted" IS NOT TRUE
          AND (v.vesselid IS NOT NULL OR n.vesselid IS NOT NULL)
        ORDER BY progress_value DESC NULLS LAST, v.eta ASC NULLS LAST, s.name ASC
      `),
    ])

    const totalAlerts = Number(alertCountResult.rows[0]?.count ?? 0)
    const totalPages = Math.max(1, Math.ceil(totalAlerts / pageSize))
    const page = Math.min(requestedPage, totalPages)
    const offset = (page - 1) * pageSize

    const alertsResult = await dbQuery<{
      alert_key: string
      id: number
      vessel_id: number | null
      vessel_name: string | null
      category: string | null
      system_name: string | null
      message: string | null
      live_value: string | null
      live_value_unit: string | null
      reported_at: Date | null
      started_at: Date | null
      last_fired_at: Date | null
      occurrences: number
      acknowledged: boolean | null
    }>(`
      WITH filtered AS (
        SELECT
          a.id::text || '-' || COALESCE(extract(epoch FROM a."timestamp")::text, 'unknown') AS alert_key,
          a.id,
          a.vesselid AS vessel_id,
          COALESCE(s.name, a.companyname) AS vessel_name,
          COALESCE(a.observanttype, 'Operational alert') AS category,
          COALESCE(a.machinetype, '—') AS system_name,
          COALESCE(a.observantmessage, a.data->>'message', 'Alert triggered') AS message,
          a.livevalue AS live_value,
          a.livevalueunit AS live_value_unit,
          a."timestamp" AS reported_at,
          min(a."timestamp") OVER (PARTITION BY a.vesselid, coalesce(a.observanttype, 'Operational alert'), coalesce(a.machinetype, '—'), coalesce(a.observantmessage, a.data->>'message', 'Alert triggered'), coalesce(a.livevalueunit, '')) AS started_at,
          max(a."timestamp") OVER (PARTITION BY a.vesselid, coalesce(a.observanttype, 'Operational alert'), coalesce(a.machinetype, '—'), coalesce(a.observantmessage, a.data->>'message', 'Alert triggered'), coalesce(a.livevalueunit, '')) AS last_fired_at,
          count(*) OVER (PARTITION BY a.vesselid, coalesce(a.observanttype, 'Operational alert'), coalesce(a.machinetype, '—'), coalesce(a.observantmessage, a.data->>'message', 'Alert triggered'), coalesce(a.livevalueunit, '')) AS occurrences,
          a.acknowledgestatus AS acknowledged,
          row_number() OVER (
            PARTITION BY a.vesselid, coalesce(a.observanttype, 'Operational alert'), coalesce(a.machinetype, '—'), coalesce(a.observantmessage, a.data->>'message', 'Alert triggered'), coalesce(a.livevalueunit, '')
            ORDER BY a."timestamp" DESC NULLS LAST, a.id DESC
          ) AS row_num
        FROM shipping_db.std_triggeredoutcomestoday a
        LEFT JOIN shipping_db.ship s ON s.id = a.vesselid
        WHERE ${alertFilterSql}
      )
      SELECT * FROM filtered
      WHERE row_num = 1
      ORDER BY last_fired_at DESC NULLS LAST, id DESC
      LIMIT $${alertValues.length + 1} OFFSET $${alertValues.length + 2}
    `, [...alertValues, pageSize, offset])

    const kpis = kpiResult.rows[0] ?? {
      vessels: 0,
      active_voyages: 0,
      connected: 0,
      offline: 0,
      unknown: 0,
    }

    return {
      asOf: new Date().toISOString(),
      provenance: {
        alerts: 'Operational alert stream',
        voyages: 'Voyage forecast + noon reports',
        connectivity: 'VSAT heartbeat',
      },
      kpis: {
        vessels: Number(kpis.vessels),
        activeVoyages: Number(kpis.active_voyages),
        connected: Number(kpis.connected),
        offline: Number(kpis.offline),
        unknown: Number(kpis.unknown),
        openAlerts: totalAlerts,
        criticalAlerts: Number(alertCountResult.rows[0]?.critical_count ?? 0),
      },
      alerts: alertsResult.rows.map((alert) => ({
        ...alert,
        ...analyzeThreshold(alert.message, alert.live_value),
      })),
      voyages: voyagesResult.rows,
      networkVessels: networkVesselsResult.rows,
      pagination: { page, pageSize, total: totalAlerts, totalPages },
    }
  } catch (error) {
    console.error('Control tower database query failed', error)
    throw createError({ statusCode: 503, statusMessage: 'Control tower data is unavailable' })
  }
})
