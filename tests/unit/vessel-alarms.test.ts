import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeVesselAlarms } from '../../app/lib/vessel-alarms'

test('normalizeVesselAlarms maps raw backend alarm data correctly', () => {
  const sampleRawBackendResponse = {
    alarmAllData: {
      totalItemsCount: 2,
      tableData: [
        {
          id: 12798150,
          Advisorykey: 12071,
          startDate: '2026-09-10T11:02:04.000Z',
          endDate: '2026-09-11T09:55:33.000Z',
          acknowledgeStatus: false,
          Comment: 'Inspect fuel oil heating steam valve',
          Message: 'F.O.TKPTEMP. exeeds 50 °C |  Upper Limit  Value is > 50 | Received value : 50.05',
          MachineName: 'AUX',
          vesselId: 1,
          rulekey: 11408,
          liveValue: '50.05',
        },
        {
          id: 12737809,
          Advisorykey: 12223,
          startDate: '2026-09-05T00:53:18.000Z',
          endDate: '2026-09-05T00:53:18.000Z',
          acknowledgeStatus: true,
          Comment: '',
          Message: 'No.1 DG Lube oil Inlet Pressure Low Less than 0.5 Mpa |  Lower Limit  Value is  between>= 0.4 and <= 0.5 | Received value : 0.49',
          MachineName: 'DG',
          vesselId: 1,
          rulekey: 11560,
          liveValue: '0.49',
        },
      ],
    },
    alertAllData: {
      tableData: [],
    },
    navigationAlertData: {
      tableData: [],
    },
  }

  const result = normalizeVesselAlarms(sampleRawBackendResponse)
  assert.equal(result.length, 2)

  const first = result[0]!
  assert.equal(first.id, '12798150')
  assert.equal(first.code, 'R-11408')
  assert.equal(first.system, 'Auxiliary Machinery')
  assert.equal(first.reading, '50.05')
  assert.equal(first.acknowledged, false)
  assert.equal(first.category, 'alarm')
  assert.ok(first.title.includes('F.O.TKPTEMP'))
  assert.equal(first.advisory, 'Inspect fuel oil heating steam valve')

  const second = result[1]!
  assert.equal(second.id, '12737809')
  assert.equal(second.code, 'R-11560')
  assert.equal(second.system, 'Diesel Generator')
  assert.equal(second.reading, '0.49')
  assert.equal(second.acknowledged, true)
  assert.equal(second.category, 'alarm')
  assert.equal(second.level, 'critical') // Pressure low is critical
})

test('normalizeVesselAlarms handles empty or fallback gracefully', () => {
  const empty = normalizeVesselAlarms({})
  assert.equal(empty.length, 0)
})
