import assert from 'node:assert/strict'
import test from 'node:test'
import { createSentinelTools } from '../server/utils/sentinel/tools'

test('createSentinelTools provides get_vessel_cii_telemetry and simulate_vessel_speed_reduction', () => {
  const tools = createSentinelTools()
  const ciiTool = tools.find((t) => t.name === 'get_vessel_cii_telemetry')
  const speedTool = tools.find((t) => t.name === 'simulate_vessel_speed_reduction')

  assert.ok(ciiTool, 'get_vessel_cii_telemetry tool should exist')
  assert.ok(speedTool, 'simulate_vessel_speed_reduction tool should exist')
})

test('get_vessel_cii_telemetry returns structured emissions and rating data', async () => {
  const tools = createSentinelTools()
  const ciiTool = tools.find((t) => t.name === 'get_vessel_cii_telemetry')
  assert.ok(ciiTool)

  const rawResult = await ciiTool.invoke({ vesselId: 1, year: 2026 })
  const result = JSON.parse(rawResult as string)

  assert.ok(result.vesselId === 1)
  assert.ok(typeof result.attainedCii === 'number')
  assert.ok(['A', 'B', 'C', 'D', 'E'].includes(result.attainedRating))
  assert.ok(typeof result.requiredCii === 'number')
  assert.ok(result.boundaries)
  assert.ok(typeof result.totalCo2Mt === 'number')
})

test('simulate_vessel_speed_reduction returns advisory scenarios and recommended scenario', async () => {
  const tools = createSentinelTools()
  const speedTool = tools.find((t) => t.name === 'simulate_vessel_speed_reduction')
  assert.ok(speedTool)

  const rawResult = await speedTool.invoke({ vesselId: 1, targetRating: 'C' })
  const result = JSON.parse(rawResult as string)

  assert.ok(Array.isArray(result.scenarios))
  assert.equal(result.scenarios.length, 5)
  assert.ok(result.recommendedScenario)
  assert.ok(typeof result.recommendedScenario.reductionPercent === 'number')
})
