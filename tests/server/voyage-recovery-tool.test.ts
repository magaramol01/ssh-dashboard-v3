import assert from 'node:assert/strict'
import test from 'node:test'
import sampleRecords from '../fixtures/cii-date-range-sample.json'
import { voyageRecoveryTool } from '../../server/utils/sentinel/agents/voyage/tools/voyage-recovery'

test('voyageRecoveryTool has correct name and schema', () => {
  const toolInstance = voyageRecoveryTool()
  assert.equal(toolInstance.name, 'calculate_voyage_recovery_plan')
  assert.ok(toolInstance.description.includes('recovery options'))
})

test('voyageRecoveryTool handles empty data honestly', async () => {
  const toolInstance = voyageRecoveryTool()
  const raw = await toolInstance.invoke({ vesselId: 9999, year: 2026 })
  const result = JSON.parse(raw as string)

  assert.equal(result.vesselId, 9999)
  assert.equal(result.found, false)
  assert.ok(result.message.includes('No noon-report data available'))
})

test('voyageRecoveryTool computes actionable recovery scenario for Band B with real records', async () => {
  const toolInstance = voyageRecoveryTool(undefined, undefined, sampleRecords)
  const raw = await toolInstance.invoke({ vesselId: 1, targetRating: 'B', year: 2026 })
  const result = JSON.parse(raw as string)

  assert.equal(result.vesselId, 1)
  assert.equal(result.targetRating, 'B')
  assert.ok(result.recommendedPlan)
  assert.ok(typeof result.recommendedPlan.recommendedSpeedKts === 'number')
  assert.ok(typeof result.recommendedPlan.recommendedRpm === 'number')
  assert.ok(typeof result.recommendedPlan.speedReductionPercent === 'number')
  assert.ok(typeof result.recommendedPlan.projectedFinalCii === 'number')
  assert.ok(Array.isArray(result.alternativeOptions))
})
