import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  mapCiiRecordsToDailyNoons,
  resolveVesselDeadweightMt,
  isNoonReportRecord,
  calculateRouteStrategies,
  deriveVoyageAdvisories,
  type CiiDateRangeRecord,
} from '../../app/lib/voyage-optimization.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturePath = join(__dirname, '../fixtures/cii-date-range-sample.json')
const sampleRecords: CiiDateRangeRecord[] = JSON.parse(readFileSync(fixturePath, 'utf-8'))

// Real data from a different vessel/reporting-app version: numeric (not DMS
// string) lat/lng, string avgSpeed, and a zero-distance event-marker record
// interleaved with the real noon reports (captured live, 2026-09-16).
const numericCoordsFixturePath = join(__dirname, '../fixtures/cii-date-range-sample-numeric-coords.json')
const numericCoordsRecords: CiiDateRangeRecord[] = JSON.parse(readFileSync(numericCoordsFixturePath, 'utf-8'))

describe('Voyage Optimization Domain Engine', () => {
  test('mapCiiRecordsToDailyNoons maps real CII API records into ordered daily noon reports', () => {
    const noons = mapCiiRecordsToDailyNoons(sampleRecords)
    assert.equal(noons.length, 2)

    const day1 = noons[0]!
    assert.equal(day1.dayNumber, 1)
    assert.equal(day1.rating, 'A')
    assert.equal(day1.attainedCii, 3.39, 'attainedCii is rounded to 2 decimals for display')
    assert.equal(day1.distanceRunNm, 320)
    assert.equal(day1.fuelConsumedMt.total, 24.3)
    assert.equal(day1.fuelConsumedMt.byType.hfo!.value, 24.21)
    assert.equal(day1.fuelConsumedMt.byType.hfo!.label, 'Heavy Fuel Oil')
    assert.ok(Math.abs(day1.coords[0] - -24.218056) < 0.001, 'parses southern latitude correctly')
    assert.ok(Math.abs(day1.coords[1] - 50.516667) < 0.001, 'parses eastern longitude correctly')
    assert.equal(
      day1.weather.shortForecast,
      '12kt wind, 3.4m seas, 135° swell',
      'weather summary is built from structured fields, not the free-text Remarks field'
    )

    const day2 = noons[1]!
    assert.equal(day2.dayNumber, 2)
    assert.equal(day2.cumulativeDistanceNm, 623)
  })

  test('resolveVesselDeadweightMt reads real deadweight from a CII record', () => {
    assert.equal(resolveVesselDeadweightMt(sampleRecords), 69787)
  })

  test('mapCiiRecordsToDailyNoons handles numeric lat/lng, string avgSpeed, and filters zero-distance event markers', () => {
    // Fixture has 3 raw records: two real noon reports (distance > 0) and
    // one zero-distance "event_sea_passage_end" marker sharing the same
    // reportDateTime as the second real report.
    const noons = mapCiiRecordsToDailyNoons(numericCoordsRecords)
    assert.equal(noons.length, 2, 'the zero-distance event marker must be filtered out')

    const day1 = noons[0]!
    assert.equal(day1.distanceRunNm, 288)
    assert.equal(day1.sog, 12, 'string avgSpeed "12.00" must be coerced to a number')
    assert.ok(Math.abs(day1.coords[0] - 7.255) < 0.0001, 'numeric latitude passes through unchanged')
    assert.ok(Math.abs(day1.coords[1] - -82.576833) < 0.0001, 'numeric longitude passes through unchanged')

    const day2 = noons[1]!
    assert.equal(day2.dayNumber, 2)
    assert.equal(day2.cumulativeDistanceNm, 512)
  })

  test('isNoonReportRecord excludes small-distance in-port events like arrival reports', () => {
    // Modeled on a real observed record: a port-arrival report with a small
    // nonzero distance (0.5 NM shift), which a distance-only filter missed
    // and produced a nonsensical CII value (near-zero transport work).
    const arrivalReport: CiiDateRangeRecord = {
      ...sampleRecords[0]!,
      distance: 0.5,
      reportType: 'report_arrival',
      utilizationType: {
        seaReportTypes: ['report_position'],
        portReportTypes: ['report_arrival', 'report_position_in_port'],
      },
    }
    assert.equal(isNoonReportRecord(arrivalReport), false)

    const genuineNoonReport: CiiDateRangeRecord = {
      ...sampleRecords[0]!,
      utilizationType: {
        seaReportTypes: ['Noon Report'],
        portReportTypes: ['Arrival Report'],
      },
    }
    assert.equal(isNoonReportRecord(genuineNoonReport), true)
  })

  test('mapCiiRecordsToDailyNoons excludes a small-distance arrival report even though distance > 0', () => {
    const arrivalReport: CiiDateRangeRecord = {
      ...sampleRecords[0]!,
      reportDateTime: '2026-09-03T00:00:00.000Z',
      distance: 0.5,
      attainedCII: 48.7,
      reportType: 'report_arrival',
      utilizationType: {
        seaReportTypes: ['report_position'],
        portReportTypes: ['report_arrival'],
      },
    }
    const noons = mapCiiRecordsToDailyNoons([arrivalReport, ...sampleRecords])
    assert.equal(noons.length, 2, 'the arrival report must not become a Daily Noon Log entry')
    assert.ok(noons.every((n) => n.attainedCii !== 48.7))
  })

  test('mapCiiRecordsToDailyNoons collapses same-day duplicates to the largest-distance record, regardless of reportType', () => {
    // Generic safeguard: two "sea"-classified records land on the same
    // calendar date (a reporting-app quirk not covered by any specific
    // portReportTypes allowlist — the whole point is this works without
    // needing to know that vessel's exact taxonomy). Only the real,
    // higher-distance noon report for that day should survive.
    const duplicateSameDayRecord: CiiDateRangeRecord = {
      ...sampleRecords[0]!,
      reportDateTime: '2026-09-01T18:00:00.000Z', // same calendar date as sampleRecords[0]
      distance: 4,
      attainedCII: 999,
    }
    const noons = mapCiiRecordsToDailyNoons([duplicateSameDayRecord, ...sampleRecords])
    assert.equal(noons.length, 2, 'only one entry per calendar day survives')
    assert.equal(noons[0]!.distanceRunNm, 320, 'the higher-distance record for that day wins')
    assert.ok(noons.every((n) => n.attainedCii !== 999))
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
