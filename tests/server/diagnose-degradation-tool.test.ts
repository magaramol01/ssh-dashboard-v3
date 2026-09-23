import assert from 'node:assert/strict'
import test from 'node:test'
import sampleRecords from '../fixtures/cii-date-range-sample.json'
import { diagnoseDegradationTool } from '../../server/utils/sentinel/agents/voyage/tools/diagnose-degradation'

test('diagnoseDegradationTool has correct name and schema', () => {
  const toolInstance = diagnoseDegradationTool()
  assert.equal(toolInstance.name, 'diagnose_voyage_degradation')
  assert.ok(toolInstance.description.includes('Band D or E'))
})

test('diagnoseDegradationTool handles empty data honestly', async () => {
  const toolInstance = diagnoseDegradationTool()
  const raw = await toolInstance.invoke({ vesselId: 9999, year: 2026 })
  const result = JSON.parse(raw as string)

  assert.equal(result.vesselId, 9999)
  assert.equal(result.found, false)
  assert.ok(result.message.includes('No noon-report data available'))
})

test('diagnoseDegradationTool diagnoses degraded days with real records', async () => {
  const toolInstance = diagnoseDegradationTool(undefined, undefined, sampleRecords)
  const raw = await toolInstance.invoke({ vesselId: 1, year: 2026 })
  const result = JSON.parse(raw as string)

  assert.equal(result.vesselId, 1)
  assert.ok(typeof result.degradedDayCount === 'number')
  assert.ok(Array.isArray(result.degradedDays))
  assert.ok(typeof result.overallDiagnosis === 'string')
})
