import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateRangePercentages,
  filterTelemetryParameters,
  calculateTelemetryHealth,
  calculateWindingVariance,
  DEFAULT_ME_PARAMETERS,
  DEFAULT_DG_GENERATORS,
  type TelemetryParameter
} from '../../app/lib/vessel-telemetry'

test('calculateRangePercentages computes clamp and percentages accurately', () => {
  // Range 0 to 10, nominal 6 to 8, value 7.5
  const res = calculateRangePercentages(7.5, 6, 8, 0, 10)
  assert.equal(res.safeStartPct, 60)
  assert.equal(res.safeWidthPct, 20)
  assert.equal(res.markerPct, 75)
  assert.equal(res.isOutOfRange, false)

  // Clamp above absMax
  const clampedHigh = calculateRangePercentages(12, 6, 8, 0, 10)
  assert.equal(clampedHigh.markerPct, 100)
  assert.equal(clampedHigh.isOutOfRange, true)

  // Clamp below absMin
  const clampedLow = calculateRangePercentages(-2, 6, 8, 0, 10)
  assert.equal(clampedLow.markerPct, 0)
  assert.equal(clampedLow.isOutOfRange, true)
})

test('filterTelemetryParameters handles category filtering and search query', () => {
  assert.equal(DEFAULT_ME_PARAMETERS.length, 14)

  const airOnly = filterTelemetryParameters(DEFAULT_ME_PARAMETERS, 'Air System', '')
  assert.equal(airOnly.length, 2)
  assert.ok(airOnly.every(p => p.subsystem === 'Air System'))

  const filteredQuery = filterTelemetryParameters(DEFAULT_ME_PARAMETERS, 'All', 'thrust')
  assert.equal(filteredQuery.length, 1)
  assert.equal(filteredQuery[0].id, 'me-thrust-brg-temp')
})

test('calculateTelemetryHealth returns correct counts', () => {
  const health = calculateTelemetryHealth(DEFAULT_ME_PARAMETERS)
  assert.equal(health.nominalCount, 14)
  assert.equal(health.warningCount, 0)
  assert.equal(health.criticalCount, 0)
})

test('calculateWindingVariance detects thermal imbalance', () => {
  const balanced = calculateWindingVariance(75.5, 76.0, 77.0)
  assert.equal(balanced.spread, 1.5)
  assert.equal(balanced.isBalanced, true)

  const imbalanced = calculateWindingVariance(70.0, 80.0, 72.0)
  assert.equal(imbalanced.spread, 10.0)
  assert.equal(imbalanced.isBalanced, false)
})

test('DEFAULT_DG_GENERATORS provides 3 generator units', () => {
  assert.equal(DEFAULT_DG_GENERATORS.length, 3)
  assert.equal(DEFAULT_DG_GENERATORS[0].status, 'online')
  assert.equal(DEFAULT_DG_GENERATORS[2].status, 'standby')
})
