import { dbQuery } from '../db'

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
  acknowledged: boolean | null
  severity: AlertSeverity
}): OperationalAlert {
  return { ...row, reported_at: toIso(row.reported_at) }
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
    SELECT count(*)::text AS count
    FROM shipping_db.std_triggeredoutcomestoday a
    LEFT JOIN shipping_db.ship s ON s.id = a.vesselid
    WHERE ${filters.where}
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
    acknowledged: boolean | null
    severity: AlertSeverity
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
      a.acknowledgestatus AS acknowledged,
      ${severityExpression} AS severity
    FROM shipping_db.std_triggeredoutcomestoday a
    LEFT JOIN shipping_db.ship s ON s.id = a.vesselid
    WHERE ${filters.where}
    ORDER BY a."timestamp" DESC NULLS LAST, a.id DESC
    LIMIT $${filters.values.length + 1} OFFSET $${filters.values.length + 2}
  `, [...filters.values, pageSize, offset])

  return { alerts: result.rows.map(mapAlert), page, pageSize, total, totalPages }
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
    dbQuery<{ next_port: string | null; next_port_code: string | null; eta: DbDate; packet_at: DbDate; route_name: string | null; load_status: string | null }>(`
      SELECT nextportname AS next_port, nextportunlocode AS next_port_code, eta, packetts AS packet_at, route_name, loadstatusname AS load_status
      FROM shipping_db.voyageforecast WHERE vesselid = $1
      ORDER BY packetts DESC NULLS LAST, id DESC LIMIT 1
    `, [vesselId]),
    searchOperationalAlerts({ page: 1, pageSize: 5, vesselId }),
  ])

  const vessel = vesselResult.rows[0]
  if (!vessel) return null

  return {
    vessel,
    connectivity: heartbeatResult.rows[0] ? {
      connected: heartbeatResult.rows[0].connected,
      updated_at: toIso(heartbeatResult.rows[0].updated_at),
    } : null,
    voyage: voyageResult.rows[0] ? {
      ...voyageResult.rows[0],
      eta: toIso(voyageResult.rows[0].eta),
      packet_at: toIso(voyageResult.rows[0].packet_at),
    } : null,
    alerts: alertsResult.alerts.filter((alert) => alert.vessel_id === vesselId),
  }
}
