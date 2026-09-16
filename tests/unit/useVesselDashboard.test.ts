import assert from 'node:assert/strict'
import test from 'node:test'
import { filterVesselsBySisterGroup, deriveSisterGroups, runDeduplicated } from '../../app/composables/useVesselDashboard'

test('deriveSisterGroups extracts unique sister groups with Select All option', () => {
  const sampleVessels = [
    { id: 1, name: 'CHINA EXPRESS', mappingname: 'nova-china-express', sistergroup: 'CX 5.0' },
    { id: 10, name: 'MEDAN EXPRESS', mappingname: 'nova-medan-express', sistergroup: 'YZJ 4.7m' },
    { id: 11, name: 'TARAKAN EXPRESS', mappingname: 'nova-tarakan-express', sistergroup: 'YZJ 4.7m' },
  ]

  const groups = deriveSisterGroups(sampleVessels)
  assert.deepEqual(groups, ['Select All', 'CX 5.0', 'YZJ 4.7m'])
})

test('filterVesselsBySisterGroup filters correctly', () => {
  const sampleVessels = [
    { id: 1, name: 'CHINA EXPRESS', mappingname: 'nova-china-express', sistergroup: 'CX 5.0' },
    { id: 10, name: 'MEDAN EXPRESS', mappingname: 'nova-medan-express', sistergroup: 'YZJ 4.7m' },
    { id: 11, name: 'TARAKAN EXPRESS', mappingname: 'nova-tarakan-express', sistergroup: 'YZJ 4.7m' },
  ]

  const all = filterVesselsBySisterGroup(sampleVessels, 'Select All')
  assert.equal(all.length, 3)

  const yzj = filterVesselsBySisterGroup(sampleVessels, 'YZJ 4.7m')
  assert.equal(yzj.length, 2)
  assert.equal(yzj[0].id, 10)
  assert.equal(yzj[1].id, 11)
})

test('runDeduplicated deduplicates concurrent in-flight executions for the same key', async () => {
  let callCount = 0
  const slowFetcher = async () => {
    callCount++
    await new Promise((resolve) => setTimeout(resolve, 20))
    return { status: 'success', count: callCount }
  }

  // Fire 5 concurrent requests with identical key
  const [res1, res2, res3, res4, res5] = await Promise.all([
    runDeduplicated('test-key-1', slowFetcher),
    runDeduplicated('test-key-1', slowFetcher),
    runDeduplicated('test-key-1', slowFetcher),
    runDeduplicated('test-key-1', slowFetcher),
    runDeduplicated('test-key-1', slowFetcher),
  ])

  // Underlying fetcher must have only executed once
  assert.equal(callCount, 1)
  assert.deepEqual(res1, { status: 'success', count: 1 })
  assert.deepEqual(res2, { status: 'success', count: 1 })
  assert.deepEqual(res3, { status: 'success', count: 1 })
  assert.deepEqual(res4, { status: 'success', count: 1 })
  assert.deepEqual(res5, { status: 'success', count: 1 })

  // Subsequent call after resolution must run a new execution
  const resNext = await runDeduplicated('test-key-1', slowFetcher)
  assert.equal(callCount, 2)
  assert.deepEqual(resNext, { status: 'success', count: 2 })
})

test('runDeduplicated executes different keys independently', async () => {
  let countA = 0
  let countB = 0

  const [resA, resB] = await Promise.all([
    runDeduplicated('key-A', async () => {
      countA++
      return 'valA'
    }),
    runDeduplicated('key-B', async () => {
      countB++
      return 'valB'
    }),
  ])

  assert.equal(countA, 1)
  assert.equal(countB, 1)
  assert.equal(resA, 'valA')
  assert.equal(resB, 'valB')
})
