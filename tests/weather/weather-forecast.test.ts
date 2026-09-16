import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { parseNwsForecastGrid, synthesizeMarineWeather } from '../../server/utils/weather-adapter.ts'

describe('Weather Adapter & NWS Parser', () => {
  test('synthesizeMarineWeather returns robust marine data for international waters', () => {
    const weather = synthesizeMarineWeather(-12.05, -77.15)
    assert.ok(weather.windSpeedKts >= 0)
    assert.ok(weather.waveHeightM >= 0)
    assert.ok(weather.beaufort >= 0 && weather.beaufort <= 12)
    assert.equal(weather.source, 'marine-fallback')
  })

  test('parseNwsForecastGrid converts NWS grid data accurately', () => {
    const mockGrid = {
      properties: {
        waveHeight: { values: [{ validTime: '2026-09-16T12:00:00Z', value: 1.82 }] },
        primarySwellHeight: { values: [{ validTime: '2026-09-16T12:00:00Z', value: 1.5 }] },
        primarySwellDirection: { values: [{ validTime: '2026-09-16T12:00:00Z', value: 290 }] },
        windSpeed: { values: [{ validTime: '2026-09-16T12:00:00Z', value: 25.5 }] }, // km/h
        windDirection: { values: [{ validTime: '2026-09-16T12:00:00Z', value: 315 }] },
        hazards: { values: [] },
      },
    }
    const parsed = parseNwsForecastGrid(mockGrid)
    assert.equal(parsed.waveHeightM, 1.82)
    assert.equal(parsed.primarySwellHeightM, 1.5)
    assert.equal(parsed.primarySwellDirectionDeg, 290)
    assert.equal(parsed.windSpeedKts, Math.round(25.5 * 0.539957 * 10) / 10) // ~13.8 kts
    assert.equal(parsed.source, 'nws-api')
  })
})
