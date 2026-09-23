import assert from 'node:assert/strict'
import test from 'node:test'
import sampleRecords from '../fixtures/cii-date-range-sample.json'
import { propulsionSlipTool } from '../../server/utils/sentinel/agents/voyage/tools/propulsion-slip'

test('propulsionSlipTool has correct name and schema', () => {
  const toolInstance = propulsionSlipTool()
  assert.equal(toolInstance.name, 'analyze_propulsion_and_slip')
  assert.ok(toolInstance.description.includes('propeller slip'))
})

test('propulsionSlipTool handles empty data honestly', async () => {
  const toolInstance = propulsionSlipTool()
  const raw = await toolInstance.invoke({ vesselId: 9999, year: 2026 })
  const result = JSON.parse(raw as string)

  assert.equal(result.vesselId, 9999)
  assert.equal(result.found, false)
  assert.ok(result.message.includes('No noon-report propulsion data available'))
})

test('propulsionSlipTool returns propulsion metrics and slip analysis with real records', async () => {
  const toolInstance = propulsionSlipTool(undefined, undefined, sampleRecords)
  const raw = await toolInstance.invoke({ vesselId: 1, year: 2026 })
  const result = JSON.parse(raw as string)

  assert.equal(result.vesselId, 1)
  assert.ok(typeof result.averageRpm === 'number')
  assert.ok(typeof result.averageSog === 'number')
  assert.ok(typeof result.averageSlipPercent === 'number')
  assert.ok(['normal', 'elevated', 'critical'].includes(result.slipThresholdStatus))
  assert.ok(Array.isArray(result.propulsionTrend))
  assert.ok(result.findings)
})
