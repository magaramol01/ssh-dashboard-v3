import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeDailyNoonProgression,
  calculateRouteStrategies,
  deriveVoyageAdvisories,
} from '../../app/lib/voyage-optimization.ts'

describe('Voyage Optimization Domain Engine', () => {
  const dummyCoords: [number, number][] = [
    [-12.05, -77.15],
    [-8.2, -85.4],
    [-3.5, -95.0],
    [2.1, -110.5],
    [8.4, -130.0],
    [15.2, -150.0],
    [20.5, -170.0],
    [24.0, 170.0],
    [25.5, 145.0],
    [26.66, 119.52],
  ]

  test('computeDailyNoonProgression computes deterministic daily noon reports with valid CII', () => {
    const noons = computeDailyNoonProgression(dummyCoords, 75000, '2026-09-10T12:00:00Z', 13.5)
    assert.ok(noons.length >= 3, 'Should generate at least 3 daily noon points')

    const day1 = noons[0]
    assert.equal(day1.dayNumber, 1)
    assert.ok(day1.distanceRunNm > 0)
    assert.ok(day1.cumulativeDistanceNm >= day1.distanceRunNm)
    assert.ok(day1.cumulativeFuelMt > 0)
    assert.ok(day1.transportWork > 0)
    assert.ok(['A', 'B', 'C', 'D', 'E'].includes(day1.rating))
    assert.ok(day1.weather.windSpeedKts > 0)
  })

  test('calculateRouteStrategies returns 4 standard comparative strategies', () => {
    const strategies = calculateRouteStrategies(5400, 480, 13.5, 75000)
    assert.equal(strategies.length, 4)

    const ids = strategies.map((s) => s.id)
    assert.ok(ids.includes('current'))
    assert.ok(ids.includes('lowest-fuel'))
    assert.ok(ids.includes('safest'))
    assert.ok(ids.includes('fastest'))

    const lowestFuel = strategies.find((s) => s.id === 'lowest-fuel')!
    const fastest = strategies.find((s) => s.id === 'fastest')!
    assert.ok(lowestFuel.totalFuelMt < fastest.totalFuelMt, 'Lowest fuel must consume less than fastest')
    assert.ok(lowestFuel.fuelSavingsMt > 0, 'Lowest fuel must show positive fuel savings')
  })

  test('deriveVoyageAdvisories provides actionable speed and weather advisories', () => {
    const advisories = deriveVoyageAdvisories('C', 'B', { beaufort: 6, waveHeightM: 3.4 }, 1.5)
    assert.ok(advisories.length >= 2)
    const speedAdv = advisories.find((a) => a.type === 'speed')
    assert.ok(speedAdv)
    assert.equal(speedAdv.applied, false)
  })
})
