import assert from 'node:assert/strict'
import test from 'node:test'
import { validateNoonReportsTool } from '../../server/utils/sentinel/agents/voyage/tools/validate-noon-reports'

test('validateNoonReportsTool has correct name and schema', () => {
  const toolInstance = validateNoonReportsTool()
  assert.equal(toolInstance.name, 'validate_vessel_noon_reports')
  assert.ok(toolInstance.description.includes('Chief Engineer'))
})

test('validateNoonReportsTool audits noon reports and returns Chief Engineer validation summary', async () => {
  const toolInstance = validateNoonReportsTool()
  const raw = await toolInstance.invoke({ vesselId: 1, year: 2026 })
  const result = JSON.parse(raw as string)

  assert.equal(result.vesselId, 1)
  assert.ok(typeof result.evaluatedReportsCount === 'number')
  assert.ok(['APPROVE', 'APPROVE WITH REMARKS', 'RETURN FOR CORRECTION'].includes(result.voyageAuditStatus))
  assert.ok(result.summaryCounts)
  assert.ok(Array.isArray(result.dailyValidations))
  assert.ok(Array.isArray(result.chiefEngineerRecommendations))
})
