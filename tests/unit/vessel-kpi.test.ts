import test from 'node:test'
import assert from 'node:assert/strict'

export function computeVoyageProgress(distTR: string | number, distToGo: string | number): number {
  const tr = parseFloat(String(distTR)) || 0
  const dtg = parseFloat(String(distToGo)) || 0
  const total = tr + dtg
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((tr / total) * 100)))
}

export function formatKnots(speed: string | number | undefined): string {
  if (speed === undefined || speed === null || speed === '' || speed === 'NA') return '0.0 kn'
  const n = parseFloat(String(speed))
  return isNaN(n) ? '0.0 kn' : `${n.toFixed(1)} kn`
}

test('computeVoyageProgress calculates correct percentage', () => {
  assert.equal(computeVoyageProgress(403, 3660), 10)
  assert.equal(computeVoyageProgress(1000, 1000), 50)
  assert.equal(computeVoyageProgress(0, 500), 0)
  assert.equal(computeVoyageProgress(0, 0), 0)
})

test('formatKnots formats numerical speeds properly', () => {
  assert.equal(formatKnots(14.2), '14.2 kn')
  assert.equal(formatKnots('0'), '0.0 kn')
  assert.equal(formatKnots(undefined), '0.0 kn')
  assert.equal(formatKnots('NA'), '0.0 kn')
})
