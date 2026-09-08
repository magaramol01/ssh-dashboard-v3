import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateTransportWork,
  calculateAttainedCII,
  getCIIRating,
  calculateSpeedReductionScenarios,
  calculateFuelTotals,
  calculateOperationalHours,
  calculateDraftAverages,
  DEFAULT_FUEL_COEFFICIENTS,
  DEFAULT_FUEL_LABELS,
  type CIIBoundaries,
} from '../server/utils/marine/cii-calculator'

const sampleBoundaries: CIIBoundaries = {
  superior_boundary: 3.5,
  lower_boundary: 4.8,
  upper_boundary: 6.2,
  inferior_boundary: 7.5,
  requiredCII: 5.5,
}

test('calculateTransportWork correctly computes DWT * Distance', () => {
  const result = calculateTransportWork(1000, 50000)
  assert.equal(result, 50000000)
})

test('calculateAttainedCII computes (CO2 * 10^6) / transportWork', () => {
  // 250 MT CO2, 50,000,000 transport work -> (250 * 1e6) / 50e6 = 5.0
  const attained = calculateAttainedCII(250, 50000000)
  assert.equal(attained, 5.0)

  // Zero transport work returns 0
  assert.equal(calculateAttainedCII(100, 0), 0)
})

test('getCIIRating classifies A through E against IMO boundaries', () => {
  assert.equal(getCIIRating(3.2, sampleBoundaries), 'A')
  assert.equal(getCIIRating(3.5, sampleBoundaries), 'A')
  assert.equal(getCIIRating(4.0, sampleBoundaries), 'B')
  assert.equal(getCIIRating(4.8, sampleBoundaries), 'B')
  assert.equal(getCIIRating(5.5, sampleBoundaries), 'C')
  assert.equal(getCIIRating(6.2, sampleBoundaries), 'C')
  assert.equal(getCIIRating(7.0, sampleBoundaries), 'D')
  assert.equal(getCIIRating(7.5, sampleBoundaries), 'D')
  assert.equal(getCIIRating(8.2, sampleBoundaries), 'E')
})

test('calculateSpeedReductionScenarios computes projected CII and rating improvements', () => {
  // 350 MT CO2, 50,000,000 transport work -> Base CII = 7.0 (Rating D)
  const scenarios = calculateSpeedReductionScenarios(350, 50000000, sampleBoundaries)
  assert.equal(scenarios.length, 5)

  // -5% speed reduction: factor 0.857662686383333 -> Projected CII = (350 * 0.85766 * 1e6) / 50e6 = ~6.00 (Rating C!)
  const p5 = scenarios.find((s) => s.reductionPercent === 5)
  assert.ok(p5)
  assert.equal(p5.projectedRating, 'C')
  assert.ok(p5.co2SavingsMt > 0)
})

test('calculateFuelTotals calculates sea/port split and CO2 emissions using standard coefficients', () => {
  const records = [
    {
      reportType: 'NOON_SEA',
      consumptionData: {
        vlsfo: { value: 10 },
        mgo: { value: 2 },
      },
    },
    {
      reportType: 'NOON_PORT',
      consumptionData: {
        vlsfo: { value: 3 },
        mgo: { value: 1 },
      },
    },
  ]

  const totals = calculateFuelTotals(records, DEFAULT_FUEL_COEFFICIENTS, DEFAULT_FUEL_LABELS)
  assert.equal(totals.length, 2)

  const vlsfo = totals.find((t) => t.fuelType === 'vlsfo')
  assert.ok(vlsfo)
  assert.equal(vlsfo.seaMt, 10)
  assert.equal(vlsfo.portMt, 3)
  assert.equal(vlsfo.totalMt, 13)
  assert.equal(vlsfo.coefficient, 3.15)
  assert.equal(vlsfo.co2Mt, Number((13 * 3.15).toFixed(2)))
})

test('calculateOperationalHours and draft averages handle empty and populated records', () => {
  const records = [
    { runningHoursAtSea: 24, runningHoursAtPort: 0, draftFwd: 11.2, draftAft: 12.0 },
    { runningHoursAtSea: 12, runningHoursAtPort: 12, draftFwd: 11.4, draftAft: 12.2 },
  ]

  const hours = calculateOperationalHours(records)
  assert.equal(hours.seaHours, 36)
  assert.equal(hours.portHours, 12)

  const drafts = calculateDraftAverages(records)
  assert.equal(drafts.draftFwd, 11.3)
  assert.equal(drafts.draftAft, 12.1)
})
