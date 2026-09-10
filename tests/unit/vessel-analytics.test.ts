import test from 'node:test'
import assert from 'node:assert/strict'
import { getCylinderStatusColor, computeCylinderStats, formatTelemetryValue } from '../../app/lib/vessel-analytics'

test('getCylinderStatusColor categorizes temperatures properly', () => {
  assert.equal(getCylinderStatusColor(318.5), '#10b981')
  assert.equal(getCylinderStatusColor(330.0), '#f59e0b')
  assert.equal(getCylinderStatusColor(345.2), '#f59e0b')
  assert.equal(getCylinderStatusColor(352.0), '#ef4444')
})

test('computeCylinderStats computes average and spread correctly', () => {
  const stats = computeCylinderStats([320.5, 318.2, 325.0, 322.8, 319.4, 321.1])
  assert.equal(stats.avg, 321.2)
  assert.equal(stats.max, 325.0)
  assert.equal(stats.min, 318.2)
  assert.equal(stats.spread, 6.8)
})

test('computeCylinderStats handles empty arrays safely', () => {
  const stats = computeCylinderStats([])
  assert.equal(stats.avg, 0)
  assert.equal(stats.spread, 0)
})

test('formatTelemetryValue formats correctly', () => {
  assert.equal(formatTelemetryValue('14.2'), '14.20')
  assert.equal(formatTelemetryValue(undefined, '0.00'), '0.00')
  assert.equal(formatTelemetryValue('NA', '—'), '—')
})
