import assert from 'node:assert/strict'
import test from 'node:test'
import { diagnoseDegradationTool } from '../../server/utils/sentinel/agents/voyage/tools/diagnose-degradation'

test('diagnoseDegradationTool has correct name and schema', () => {
  const toolInstance = diagnoseDegradationTool()
  assert.equal(toolInstance.name, 'diagnose_voyage_degradation')
  assert.ok(toolInstance.description.includes('Band D or E'))
})

test('diagnoseDegradationTool diagnoses degraded days with root cause analysis', async () => {
  const toolInstance = diagnoseDegradationTool()
  const raw = await toolInstance.invoke({ vesselId: 1, year: 2026 })
  const result = JSON.parse(raw as string)

  assert.equal(result.vesselId, 1)
  assert.ok(typeof result.degradedDayCount === 'number')
  assert.ok(Array.isArray(result.degradedDays))
  assert.ok(typeof result.overallDiagnosis === 'string')

  if (result.degradedDays.length > 0) {
    const firstDegraded = result.degradedDays[0]
    assert.ok(firstDegraded.dayNumber)
    assert.ok(['D', 'E'].includes(firstDegraded.rating))
    assert.ok(firstDegraded.primaryRootCause)
    assert.ok(firstDegraded.causeAnalysis)
  }
})
