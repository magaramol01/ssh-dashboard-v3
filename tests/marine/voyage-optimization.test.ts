import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  mapCiiRecordsToDailyNoons,
  resolveVesselDeadweightMt,
  calculateRouteStrategies,
  deriveVoyageAdvisories,
  type CiiDateRangeRecord,
} from '../../app/lib/voyage-optimization.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturePath = join(__dirname, '../fixtures/cii-date-range-sample.json')
const sampleRecords: CiiDateRangeRecord[] = JSON.parse(readFileSync(fixturePath, 'utf-8'))

describe('Voyage Optimization Domain Engine', () => {
  test('mapCiiRecordsToDailyNoons maps real CII API records into ordered daily noon reports', () => {
    const noons = mapCiiRecordsToDailyNoons(sampleRecords)
    assert.equal(noons.length, 2)

    const day1 = noons[0]!
    assert.equal(day1.dayNumber, 1)
    assert.equal(day1.rating, 'A')
    assert.equal(day1.attainedCii, 3.390250870505968)
    assert.equal(day1.distanceRunNm, 320)
    assert.equal(day1.fuelConsumedMt.total, 24.3)
    assert.equal(day1.fuelConsumedMt.byType.hfo!.value, 24.21)
    assert.equal(day1.fuelConsumedMt.byType.hfo!.label, 'Heavy Fuel Oil')
    assert.ok(Math.abs(day1.coords[0] - -24.218056) < 0.001, 'parses southern latitude correctly')
    assert.ok(Math.abs(day1.coords[1] - 50.516667) < 0.001, 'parses eastern longitude correctly')

    const day2 = noons[1]!
    assert.equal(day2.dayNumber, 2)
    assert.equal(day2.cumulativeDistanceNm, 623)
  })

  test('resolveVesselDeadweightMt reads real deadweight from a CII record', () => {
    assert.equal(resolveVesselDeadweightMt(sampleRecords), 69787)
  })

  test('calculateRouteStrategies returns 4 standard comparative strategies with basis labels', () => {
    const strategies = calculateRouteStrategies(5400, 480, 13.5, 75000)
    assert.equal(strategies.length, 4)

    const ids = strategies.map((s) => s.id)
    assert.ok(ids.includes('current'))
    assert.ok(ids.includes('lowest-fuel'))
    assert.ok(ids.includes('safest'))
    assert.ok(ids.includes('fastest'))

    const current = strategies.find((s) => s.id === 'current')!
    assert.equal(current.basis, 'live')

    const lowestFuel = strategies.find((s) => s.id === 'lowest-fuel')!
    const fastest = strategies.find((s) => s.id === 'fastest')!
    assert.equal(lowestFuel.basis, 'modeled-estimate')
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
