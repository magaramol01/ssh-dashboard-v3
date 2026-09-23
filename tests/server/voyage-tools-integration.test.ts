import assert from 'node:assert/strict'
import test from 'node:test'
import { getVoyageTools } from '../../server/utils/sentinel/agents/voyage/tools'
import { voyagePrompt } from '../../server/utils/sentinel/agents/voyage/prompt'

test('getVoyageTools bundles all 9 operational voyage tools', () => {
  const tools = getVoyageTools()
  const names = tools.map((t) => t.name)

  assert.equal(tools.length, 9, 'should contain 9 tools')
  assert.ok(names.includes('get_voyage_overview_and_progress'), 'overview tool present')
  assert.ok(names.includes('diagnose_voyage_degradation'), 'degradation diagnostic tool present')
  assert.ok(names.includes('analyze_propulsion_and_slip'), 'propulsion & slip tool present')
  assert.ok(names.includes('evaluate_weather_impact_on_fuel'), 'weather fuel penalty tool present')
  assert.ok(names.includes('calculate_voyage_recovery_plan'), 'recovery plan tool present')
  assert.ok(names.includes('validate_vessel_noon_reports'), 'noon validation tool present')
  assert.ok(names.includes('get_vessel_daily_positions'), 'daily positions tool present')
  assert.ok(names.includes('get_fleet_voyages'), 'fleet voyages tool present')
  assert.ok(names.includes('simulate_vessel_speed_reduction'), 'speed simulation tool present')
})

test('voyagePrompt includes evidence rules for all operational tools', () => {
  assert.ok(voyagePrompt.includes('get_voyage_overview_and_progress'))
  assert.ok(voyagePrompt.includes('diagnose_voyage_degradation'))
  assert.ok(voyagePrompt.includes('analyze_propulsion_and_slip'))
  assert.ok(voyagePrompt.includes('evaluate_weather_impact_on_fuel'))
  assert.ok(voyagePrompt.includes('calculate_voyage_recovery_plan'))
  assert.ok(voyagePrompt.includes('validate_vessel_noon_reports'))
  assert.ok(voyagePrompt.includes('get_vessel_daily_positions'))
  assert.ok(voyagePrompt.includes('get_fleet_voyages'))
})
