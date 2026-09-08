import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateCiiImprovementPlan } from '../server/utils/marine/cii-improvement'

test('detects degradation onset when monthly CII crosses required threshold', () => {
  const monthlyTrend = [
    { month: 'Jan', attainedCii: 4.8, rating: 'B', co2Mt: 200, distanceNm: 1500 },
    { month: 'Feb', attainedCii: 5.1, rating: 'C', co2Mt: 210, distanceNm: 1450 },
    { month: 'Mar', attainedCii: 6.2, rating: 'D', co2Mt: 270, distanceNm: 1400 },
    { month: 'Apr', attainedCii: 6.5, rating: 'D', co2Mt: 280, distanceNm: 1350 },
  ]
  const availableVoyages = [
    { voyageNumber: 'ROT-SIN-01', startPort: 'Rotterdam', destinationPort: 'Singapore' },
    { voyageNumber: 'SIN-SHA-02', startPort: 'Singapore', destinationPort: 'Shanghai' },
    { voyageNumber: 'SHA-LAX-03', startPort: 'Shanghai', destinationPort: 'Los Angeles' },
  ]

  const plan = generateCiiImprovementPlan({
    attainedCii: 6.5,
    requiredCii: 5.25,
    attainedRating: 'D',
    monthlyTrend,
    availableVoyages,
    fuelBreakdown: [{ fuelType: 'vlsfo', totalMt: 800, co2Mt: 2520 }],
    speedReductionScenarios: [
      { reductionPercent: 10, speedKnots: 12.6, projectedCii: 5.2, projectedRating: 'C', co2SavingsMt: 320, multiplier: 0.729 },
    ],
  })

  assert.equal(plan.hasDegraded, true)
  assert.equal(plan.onset.month, 'Mar')
  assert.ok(plan.onset.ciiIncrease > 0)
  assert.equal(plan.drivers.length, 4)
  const totalPct = plan.drivers.reduce((acc, d) => acc + d.percentage, 0)
  assert.equal(totalPct, 100)
  assert.ok(plan.actionItems.length >= 3)
})

test('gracefully handles compliant vessel with Grade A/B', () => {
  const monthlyTrend = [
    { month: 'Jan', attainedCii: 3.8, rating: 'A', co2Mt: 160, distanceNm: 1500 },
    { month: 'Feb', attainedCii: 3.9, rating: 'A', co2Mt: 165, distanceNm: 1450 },
  ]
  const plan = generateCiiImprovementPlan({
    attainedCii: 3.9,
    requiredCii: 5.25,
    attainedRating: 'A',
    monthlyTrend,
    availableVoyages: [{ voyageNumber: 'ROT-SIN-01', startPort: 'Rotterdam', destinationPort: 'Singapore' }],
    fuelBreakdown: [{ fuelType: 'vlsfo', totalMt: 500, co2Mt: 1575 }],
    speedReductionScenarios: [],
  })

  assert.equal(plan.hasDegraded, false)
  assert.equal(plan.onset.initialRating, 'A')
})

test('incorporates Cobelfret widget telemetry (weather, SFOC, propulsion time loss) into drivers', () => {
  const monthlyTrend = [
    { month: 'Jan', attainedCii: 5.0, rating: 'C', co2Mt: 200, distanceNm: 1500 },
    { month: 'Feb', attainedCii: 6.4, rating: 'D', co2Mt: 270, distanceNm: 1400 },
  ]
  const plan = generateCiiImprovementPlan({
    attainedCii: 6.4,
    requiredCii: 5.25,
    attainedRating: 'D',
    monthlyTrend,
    availableVoyages: [{ voyageNumber: 'V01', startPort: 'A', destinationPort: 'B' }],
    fuelBreakdown: [{ fuelType: 'vlsfo', totalMt: 800, co2Mt: 2520 }],
    speedReductionScenarios: [
      { reductionPercent: 10, speedKnots: 12.6, projectedCii: 5.15, projectedRating: 'C', co2SavingsMt: 280, multiplier: 0.729 },
    ],
    cobelfretTelemetry: {
      badWeatherPct: 32.9,
      sfocCurrent: 174.3,
      sfocExpected: 168.0,
      propulsionTimeLossPct: -5.3,
      operationalProfile: { ladenPct: 40, ballastPct: 30, portPct: 30 },
    },
  })

  assert.equal(plan.hasDegraded, true)
  assert.ok(plan.drivers.some(d => d.key === 'hull' && d.percentage > 0))
  assert.ok(plan.drivers.some(d => d.key === 'weather' || d.key === 'speed'))
  const totalPct = plan.drivers.reduce((acc, d) => acc + d.percentage, 0)
  assert.equal(totalPct, 100)
})
