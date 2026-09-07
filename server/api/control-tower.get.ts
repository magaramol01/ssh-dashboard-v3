import { createError, defineEventHandler, getQuery } from 'h3'
import { dbQuery } from '../utils/db'

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
        ), latest_voyage AS (
          SELECT DISTINCT ON (vesselid) vesselid
          FROM shipping_db.voyageforecast
          WHERE vesselid IS NOT NULL
          ORDER BY vesselid, packetts DESC NULLS LAST, id DESC
        )
        SELECT
          (SELECT count(*) FROM shipping_db.ship WHERE "isDeleted" IS NOT TRUE)::int AS vessels,
          (SELECT count(*) FROM latest_voyage)::int AS active_voyages,
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
      dbQuery<{ count: string }>(`
        WITH filtered AS (
          SELECT row_number() OVER (
            PARTITION BY a.vesselid, coalesce(a.observanttype, 'Operational alert'), coalesce(a.machinetype, '—'), coalesce(a.observantmessage, a.data->>'message', 'Alert triggered'), coalesce(a.livevalueunit, '')
            ORDER BY a."timestamp" DESC NULLS LAST, a.id DESC
          ) AS row_num
          FROM shipping_db.std_triggeredoutcomestoday a
          LEFT JOIN shipping_db.ship s ON s.id = a.vesselid
          WHERE ${alertFilterSql}
        )
        SELECT count(*)::text AS count FROM filtered WHERE row_num = 1
      `, alertValues),
      dbQuery<{
        vessel_id: number
        vessel_name: string
        next_port: string | null
        next_port_code: string | null
        eta: Date | null
        packet_at: Date | null
        route_name: string | null
        load_status: string | null
      }>(`
        WITH latest_voyage AS (
          SELECT DISTINCT ON (vesselid)
            vesselid, nextportname, nextportunlocode, eta, packetts, route_name, loadstatusname
          FROM shipping_db.voyageforecast
          WHERE vesselid IS NOT NULL
          ORDER BY vesselid, packetts DESC NULLS LAST, id DESC
        )
        SELECT
          v.vesselid AS vessel_id,
          s.name AS vessel_name,
          v.nextportname AS next_port,
          v.nextportunlocode AS next_port_code,
          v.eta,
          v.packetts AS packet_at,
          v.route_name,
          v.loadstatusname AS load_status
        FROM latest_voyage v
        JOIN shipping_db.ship s ON s.id = v.vesselid
        WHERE s."isDeleted" IS NOT TRUE
        ORDER BY v.eta ASC NULLS LAST, s.name ASC
        LIMIT 12
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
      kpis: {
        vessels: Number(kpis.vessels),
        activeVoyages: Number(kpis.active_voyages),
        connected: Number(kpis.connected),
        offline: Number(kpis.offline),
        unknown: Number(kpis.unknown),
        openAlerts: totalAlerts,
      },
      alerts: alertsResult.rows,
      voyages: voyagesResult.rows,
      networkVessels: networkVesselsResult.rows,
      pagination: { page, pageSize, total: totalAlerts, totalPages },
    }
  } catch (error) {
    console.error('Control tower database query failed', error)
    throw createError({ statusCode: 503, statusMessage: 'Control tower data is unavailable' })
  }
})
