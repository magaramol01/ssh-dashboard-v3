import { defineEventHandler, getQuery } from 'h3'
import { dbQuery } from '../../utils/db'
import { tenantStorage } from '../../utils/tenant-context'

/**
 * Resolves the vessel's current voyage and its real start date directly
 * from shipping_db.std_enoonreporttable (the same table backing noon-report
 * history elsewhere in this app) — the authoritative source, rather than
 * guessing a lookback window against the external CII API.
 */
export default defineEventHandler(async (event) => {
  const tenant = event.context.tenant
  if (tenant) {
    tenantStorage.enterWith(tenant)
  }

  const query = getQuery(event)
  const vesselId = Number(query.vesselId)
  if (!Number.isFinite(vesselId)) {
    return { success: false, voyage: null, startDate: null, endDate: null }
  }

  try {
    const result = await dbQuery<{ voyage: string; start_date: string; end_date: string }>(
      `
      SELECT voyage, MIN(report_date_time_utc) AS start_date, MAX(report_date_time_utc) AS end_date
      FROM shipping_db.std_enoonreporttable
      WHERE vesselid = $1 AND voyage IS NOT NULL
      GROUP BY voyage
      ORDER BY end_date DESC
      LIMIT 1
      `,
      [vesselId]
    )

    const row = result.rows[0]
    if (!row) {
      return { success: false, voyage: null, startDate: null, endDate: null }
    }

    return {
      success: true,
      voyage: row.voyage,
      startDate: new Date(row.start_date).toISOString().slice(0, 10),
      endDate: new Date(row.end_date).toISOString().slice(0, 10),
    }
  } catch {
    return { success: false, voyage: null, startDate: null, endDate: null }
  }
})
