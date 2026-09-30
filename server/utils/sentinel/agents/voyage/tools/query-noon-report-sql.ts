import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { dbQuery } from '../../../../db'

export const queryNoonReportsSqlTool = (tenant?: string) =>
  tool(
    async ({ query }) => {
      const trimmed = query.trim()

      // Guard: strictly read-only SELECT or WITH statements
      const normalized = trimmed.replace(/\s+/g, ' ').toLowerCase()
      if (!normalized.startsWith('select ') && !normalized.startsWith('with ')) {
        return JSON.stringify({
          error: 'Only SELECT statements are allowed for database queries.',
        })
      }

      // Block any mutation keywords
      const forbiddenKeywords = [
        'insert',
        'update',
        'delete',
        'drop',
        'alter',
        'truncate',
        'grant',
        'revoke',
        'create',
        'replace',
      ]
      for (const kw of forbiddenKeywords) {
        const regex = new RegExp(`\\b${kw}\\b`, 'i')
        if (regex.test(trimmed)) {
          return JSON.stringify({
            error: `Forbidden operation: ${kw.toUpperCase()} is not allowed. Only read-only SELECT queries are permitted.`,
          })
        }
      }

      // Auto-correct common table name variations: std_enoonreport -> std_enoonreporttable
      let finalQuery = trimmed.replace(/\b(shipping_db\.)?std_enoonreport\b(?!table)/gi, 'shipping_db.std_enoonreporttable')

      // Ensure table name is schema qualified if user omitted schema
      finalQuery = finalQuery.replace(/\bFROM\s+std_enoonreporttable\b/gi, 'FROM shipping_db.std_enoonreporttable')
      finalQuery = finalQuery.replace(/\bJOIN\s+std_enoonreporttable\b/gi, 'JOIN shipping_db.std_enoonreporttable')

      // Enforce a maximum LIMIT of 100 if none is specified or if limit > 100
      if (!/\blimit\s+\d+/i.test(finalQuery)) {
        finalQuery = `${finalQuery.replace(/;+\s*$/, '')} LIMIT 50`
      }

      try {
        const res = await dbQuery(finalQuery, [], tenant)
        return JSON.stringify({
          rowCount: res.rowCount,
          rows: res.rows,
        })
      } catch (err: any) {
        return JSON.stringify({
          error: err.message || 'Database query execution failed',
        })
      }
    },
    {
      name: 'query_noon_reports_sql',
      description:
        'Executes a read-only SQL query on the PostgreSQL noon reports table (shipping_db.std_enoonreporttable) and ship table (shipping_db.ship). Useful for inspecting raw noon telemetry, CP speed (noonreportdata->>\'SPEED_AS_PER_CP_IN_KN\'), charter orders (noonreportdata->>\'Charterers_Speed_Order\'), fuel consumption, speed over ground, propeller slip, weather, and historical voyages. Only SELECT statements are permitted.',
      schema: z.object({
        query: z.string().describe('The SQL SELECT query to execute on shipping_db.std_enoonreporttable.'),
      }),
    }
  )
