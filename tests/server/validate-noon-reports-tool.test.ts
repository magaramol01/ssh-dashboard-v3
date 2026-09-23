import assert from 'node:assert/strict'
import test from 'node:test'
import sampleRecords from '../fixtures/cii-date-range-sample.json'
import { validateNoonReportsTool } from '../../server/utils/sentinel/agents/voyage/tools/validate-noon-reports'

test('validateNoonReportsTool has correct name and schema', () => {
  const toolInstance = validateNoonReportsTool()
  assert.equal(toolInstance.name, 'validate_vessel_noon_reports')
  assert.ok(toolInstance.description.includes('Chief Engineer'))
})

test('validateNoonReportsTool handles empty data honestly without false positives', async () => {
  const toolInstance = validateNoonReportsTool()
  const raw = await toolInstance.invoke({ vesselId: 9999, year: 2026 })
  const result = JSON.parse(raw as string)

  assert.equal(result.vesselId, 9999)
  assert.equal(result.found, false)
  assert.ok(result.message.includes('No noon-report data available'))
})

test('validateNoonReportsTool audits real noon records and returns Chief Engineer validation summary', async () => {
  const toolInstance = validateNoonReportsTool(undefined, undefined, sampleRecords)
  const raw = await toolInstance.invoke({ vesselId: 1, year: 2026 })
  const result = JSON.parse(raw as string)

  assert.equal(result.vesselId, 1)
  assert.ok(result.evaluatedReportsCount > 0)
  assert.ok(['APPROVE', 'APPROVE WITH REMARKS', 'RETURN FOR CORRECTION'].includes(result.voyageAuditStatus))
  assert.ok(result.summaryCounts)
  assert.ok(Array.isArray(result.dailyValidations))
  assert.ok(Array.isArray(result.chiefEngineerRecommendations))
})
