import assert from 'node:assert/strict'
import test from 'node:test'
import { weatherFuelPenaltyTool } from '../../server/utils/sentinel/agents/voyage/tools/weather-fuel-penalty'

test('weatherFuelPenaltyTool has correct name and schema', () => {
  const toolInstance = weatherFuelPenaltyTool()
  assert.equal(toolInstance.name, 'evaluate_weather_impact_on_fuel')
  assert.ok(toolInstance.description.includes('added fuel consumption'))
})

test('weatherFuelPenaltyTool returns calculated weather fuel and carbon penalties', async () => {
  const toolInstance = weatherFuelPenaltyTool()
  const raw = await toolInstance.invoke({ vesselId: 1, year: 2026 })
  const result = JSON.parse(raw as string)

  assert.equal(result.vesselId, 1)
  assert.ok(typeof result.totalVoyageFuelMt === 'number')
  assert.ok(typeof result.baselineCalmWaterFuelMt === 'number')
  assert.ok(typeof result.weatherFuelPenaltyMt === 'number')
  assert.ok(typeof result.weatherCo2PenaltyMt === 'number')
  assert.ok(typeof result.heavyWeatherDaysCount === 'number')
  assert.ok(typeof result.summary === 'string')
})
