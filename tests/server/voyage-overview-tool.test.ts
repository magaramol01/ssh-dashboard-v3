import assert from 'node:assert/strict'
import test from 'node:test'
import { voyageOverviewTool } from '../../server/utils/sentinel/agents/voyage/tools/voyage-overview'

test('voyageOverviewTool has correct name and schema', () => {
  const toolInstance = voyageOverviewTool()
  assert.equal(toolInstance.name, 'get_voyage_overview_and_progress')
  assert.ok(toolInstance.description.includes('operational summary'))
})

test('voyageOverviewTool executes and returns structured voyage overview', async () => {
  const toolInstance = voyageOverviewTool()
  const raw = await toolInstance.invoke({ vesselId: 1, year: 2026 })
  const result = JSON.parse(raw as string)

  assert.equal(result.vesselId, 1)
  assert.ok(result.vesselName)
  assert.ok(typeof result.totalDistanceNm === 'number')
  assert.ok(typeof result.distanceSailedNm === 'number')
  assert.ok(typeof result.distanceToGoNm === 'number')
  assert.ok(typeof result.progressPercent === 'number')
  assert.ok(result.fuelSummary)
  assert.ok(typeof result.fuelSummary.totalFuelMt === 'number')
  assert.ok(result.ciiSummary)
  assert.ok(['A', 'B', 'C', 'D', 'E'].includes(result.ciiSummary.rating))
})
