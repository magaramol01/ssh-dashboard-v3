import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { queryNoonReportsSqlTool } from '../../server/utils/sentinel/agents/voyage/tools/query-noon-report-sql'

if (!process.env.PG_HOST && existsSync('.env')) {
  const envContent = readFileSync('.env', 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim()
      let val = trimmed.slice(idx + 1).trim()
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
      process.env[key] = val
    }
  }
}

test('queryNoonReportsSqlTool has correct schema and name', () => {
  const tool = queryNoonReportsSqlTool('asiaticlloyd')
  assert.equal(tool.name, 'query_noon_reports_sql')
  assert.ok(tool.description.includes('shipping_db.std_enoonreporttable'))
})

test('queryNoonReportsSqlTool blocks non-SELECT queries', async () => {
  const tool = queryNoonReportsSqlTool('asiaticlloyd')

  const res1 = await tool.invoke({ query: 'DROP TABLE shipping_db.std_enoonreporttable;' })
  const parsed1 = JSON.parse(res1)
  assert.ok(parsed1.error, 'must reject DROP')

  const res2 = await tool.invoke({ query: 'DELETE FROM shipping_db.std_enoonreporttable WHERE id = 1;' })
  const parsed2 = JSON.parse(res2)
  assert.ok(parsed2.error, 'must reject DELETE')

  const res3 = await tool.invoke({ query: 'UPDATE shipping_db.std_enoonreporttable SET voyage = 123;' })
  const parsed3 = JSON.parse(res3)
  assert.ok(parsed3.error, 'must reject UPDATE')
})

test('queryNoonReportsSqlTool executes SELECT query on shipping_db.std_enoonreporttable', async () => {
  const tool = queryNoonReportsSqlTool('asiaticlloyd')

  const res = await tool.invoke({
    query: `
      SELECT vesselid, report_date_time_utc, noonreportdata->>'SPEED_AS_PER_CP_IN_KN' as cp_speed
      FROM shipping_db.std_enoonreporttable
      WHERE noonreportdata->>'SPEED_AS_PER_CP_IN_KN' IS NOT NULL
      LIMIT 2
    `,
  })

  const parsed = JSON.parse(res)
  assert.ok(!parsed.error, `Query should succeed without error: ${parsed.error}`)
  assert.equal(parsed.rows.length, 2, 'should return 2 rows')
  assert.ok(parsed.rows[0].cp_speed, 'cp_speed should be populated')
})

test('queryNoonReportsSqlTool rewrites std_enoonreport alias to std_enoonreporttable', async () => {
  const tool = queryNoonReportsSqlTool('asiaticlloyd')

  const res = await tool.invoke({
    query: `
      SELECT id FROM shipping_db.std_enoonreport LIMIT 1
    `,
  })

  const parsed = JSON.parse(res)
  assert.ok(!parsed.error, `Rewritten alias query should succeed without error: ${parsed.error}`)
  assert.equal(parsed.rows.length, 1)

  const { closePools } = await import('../../server/utils/db')
  await closePools()
})
