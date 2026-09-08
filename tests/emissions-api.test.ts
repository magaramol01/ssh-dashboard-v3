import assert from 'node:assert/strict'
import test from 'node:test'
import { processCiiRecords } from '../server/api/emissions/cii.get'

test('processCiiRecords produces valid EmissionsCiiResponse structure from telemetry logs', () => {
  const mockRecords = [
    {
      reportDateTime: '2026-03-15T12:00:00Z',
      reportType: 'NOON_SEA',
      distance: 350,
      transportWork: 17500000,
      massOfCo2: 80.5,
      deadweight: 50000,
      runningHoursAtSea: 24,
      runningHoursAtPort: 0,
      draftFwd: 11.2,
      draftAft: 12.0,
      CIIBoundaries: {
        superior_boundary: 3.2,
        lower_boundary: 4.5,
        upper_boundary: 5.8,
        inferior_boundary: 7.2,
        requiredCII: 5.2,
      },
      consumptionData: {
        vlsfo: { value: 22.0 },
        mgo: { value: 3.5 },
      },
    },
    {
      reportDateTime: '2026-03-20T12:00:00Z',
      reportType: 'NOON_PORT',
      distance: 0,
      transportWork: 0,
      massOfCo2: 12.6,
      deadweight: 50000,
      runningHoursAtSea: 0,
      runningHoursAtPort: 24,
      draftFwd: 11.4,
      draftAft: 12.2,
      CIIBoundaries: {
        superior_boundary: 3.2,
        lower_boundary: 4.5,
        upper_boundary: 5.8,
        inferior_boundary: 7.2,
        requiredCII: 5.2,
      },
      consumptionData: {
        vlsfo: { value: 4.0 },
      },
    },
  ]

  const res = processCiiRecords({
    vesselId: 1,
    vesselName: 'Atlantic Pioneer',
    year: 2026,
    records: mockRecords,
    availableVoyages: [
      {
        voyageNumber: 'VOY-2026-01',
        startPort: 'Rotterdam',
        destinationPort: 'Singapore',
        departureTime: '2026-03-01T08:00:00Z',
        arrivalTime: '2026-03-25T18:00:00Z',
      },
    ],
  })

  assert.equal(res.vessel.vesselId, 1)
  assert.equal(res.vessel.vesselName, 'Atlantic Pioneer')
  assert.equal(res.summary.totalDistanceNm, 350)
  assert.equal(res.summary.runningHoursAtSea, 24)
  assert.equal(res.summary.runningHoursAtPort, 24)
  assert.ok(res.summary.totalCo2Mt > 0)
  assert.ok(res.summary.attainedCii > 0)
  assert.ok(['A', 'B', 'C', 'D', 'E'].includes(res.summary.attainedRating))
  assert.equal(res.speedReductionAdvisory.length, 5)
  assert.ok(res.fuelBreakdown.length >= 1)
  assert.equal(res.availableVoyages.length, 1)
  assert.equal(res.monthlyTrend.length, 12)
})

test('peer benchmarking preserves attained CII and maintains stable fleet average when switching vessels', () => {
  const fleetPeers = [
    { vesselId: 10, vesselName: 'ALS Ceres', deadweight: 54000 },
    { vesselId: 25, vesselName: 'ALS Vesta', deadweight: 34376 },
  ]

  // Simulate evaluation of ALS Vesta: High emissions relative to transport work -> Attained CII ~ 11.72
  const vestaRecords = [
    {
      reportDateTime: '2026-03-15T12:00:00Z',
      distance: 7185,
      transportWork: 234300000,
      massOfCo2: 2746.42,
      deadweight: 34376,
      CIIBoundaries: {
        superior_boundary: 3.17,
        lower_boundary: 4.31,
        upper_boundary: 5.49,
        inferior_boundary: 6.83,
        requiredCII: 4.88,
      },
    },
  ]

  const vestaRes = processCiiRecords({
    vesselId: 25,
    vesselName: 'ALS Vesta',
    year: 2026,
    records: vestaRecords,
    fleetPeers,
  })

  assert.equal(vestaRes.summary.attainedCii, 11.72)
  const vestaInVestaBench = vestaRes.benchmark.peers.find((p) => p.vesselId === 25)
  assert.equal(vestaInVestaBench?.attainedCii, 11.72)
  const initialFleetAvg = vestaRes.benchmark.fleetAverageCii

  // Now simulate switching active vessel to ALS Ceres:
  // ALS Vesta is no longer current, but its cached attained CII of 11.72 MUST be preserved!
  const ceresRecords = [
    {
      reportDateTime: '2026-03-15T12:00:00Z',
      distance: 8500,
      transportWork: 459000000,
      massOfCo2: 1973.7,
      deadweight: 54000,
      CIIBoundaries: {
        superior_boundary: 3.42,
        lower_boundary: 4.65,
        upper_boundary: 5.92,
        inferior_boundary: 7.35,
        requiredCII: 5.25,
      },
    },
  ]

  const ceresRes = processCiiRecords({
    vesselId: 10,
    vesselName: 'ALS Ceres',
    year: 2026,
    records: ceresRecords,
    fleetPeers,
  })

  const vestaInCeresBench = ceresRes.benchmark.peers.find((p) => p.vesselId === 25)
  // CRITICAL CHECK: ALS Vesta must NOT drop to a dummy 4.3 fallback formula! It must remain 11.72!
  assert.equal(vestaInCeresBench?.attainedCii, 11.72)
  assert.equal(vestaInCeresBench?.rating, 'E')

  // Fleet average in ceresRes must be calculated using ALS Vesta's actual 11.72
  const expectedAvg = Number(((ceresRes.summary.attainedCii + 11.72) / 2).toFixed(2))
  assert.equal(ceresRes.benchmark.fleetAverageCii, expectedAvg)
})

