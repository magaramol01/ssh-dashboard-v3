import assert from 'node:assert/strict'
import test from 'node:test'
import { voyageRecoveryTool } from '../../server/utils/sentinel/agents/voyage/tools/voyage-recovery'

test('voyageRecoveryTool has correct name and schema', () => {
  const toolInstance = voyageRecoveryTool()
  assert.equal(toolInstance.name, 'calculate_voyage_recovery_plan')
  assert.ok(toolInstance.description.includes('recovery options'))
})

test('voyageRecoveryTool computes actionable recovery scenario for Band B', async () => {
  const toolInstance = voyageRecoveryTool()
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
