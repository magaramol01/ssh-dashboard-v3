import assert from 'node:assert/strict'
import test from 'node:test'
import { filterVesselsBySisterGroup, deriveSisterGroups } from '../../app/composables/useVesselDashboard'

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
