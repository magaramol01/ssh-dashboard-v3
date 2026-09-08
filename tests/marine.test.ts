import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeThreshold } from '../shared/types/marine'
import { scoreVesselHealth } from '../shared/types/marine-health'

test('calculates an upper threshold breach', () => {
  assert.deepEqual(analyzeThreshold('Main engine temperature above 90', '99 °C'), {
    currentValue: 99,
    thresholdValue: 90,
    thresholdDirection: 'above',
    deviation: 9,
    deviationPercent: 10,
    breached: true,
  })
})

test('calculates a lower threshold breach without losing direction', () => {
  const result = analyzeThreshold('Scavenge pressure below 2.8 bar', '2.7 bar')
  assert.equal(result.thresholdDirection, 'below')
  assert.equal(result.breached, true)
  assert.ok(Math.abs((result.deviation ?? 0) + 0.1) < 1e-12)
  assert.ok(Math.abs((result.deviationPercent ?? 0) - 3.571428571428571) < 1e-12)
})

test('returns current value but no breach for non-threshold alerts', () => {
  assert.deepEqual(analyzeThreshold('Generator communication lost', '12'), {
    currentValue: 12,
    thresholdValue: null,
    thresholdDirection: null,
    deviation: null,
    deviationPercent: null,
    breached: null,
  })
})

test('scores a vessel against its own baseline and exposes missing data', () => {
  const result = scoreVesselHealth([
    {
      id: 'power', label: 'Power', unit: 'kW', weight: 1,
      packets: 100, nonnull: 100, valid: 100, latestPackets: 20, latestValid: 20,
      baselineMedian: 100, baselineP05: 90, baselineP95: 110, latestMedian: 100,
    },
    {
      id: 'rpm', label: 'RPM', unit: 'rpm', weight: 1,
      packets: 100, nonnull: 0, valid: 0, latestPackets: 20, latestValid: 0,
      baselineMedian: null, baselineP05: null, baselineP95: null, latestMedian: null,
    },
  ])

  assert.equal(result.status, 'ready')
  assert.equal(result.healthIndex, 100)
  assert.equal(result.components[1]?.state, 'insufficient_data')
})
