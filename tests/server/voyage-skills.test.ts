import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateApparentSlip,
  calculateWeatherFuelPenalty,
  classifyDegradedDay,
  solveVoyageRecovery,
} from '../../server/utils/sentinel/agents/voyage/skills.ts'

test('calculateApparentSlip calculates apparent propeller slip percentage clamped accurately', () => {
  // STW = 14 kts, SOG = 12 kts -> (14 - 12) / 14 * 100 = 14.29%
  const slip = calculateApparentSlip(12, 14)
  assert.equal(slip, 14.3)

  // Zero STW returns 0
  assert.equal(calculateApparentSlip(12, 0), 0)

  // Extreme negative clamped to -5
  assert.equal(calculateApparentSlip(20, 10), -5)

  // Extreme positive clamped to 40
  assert.equal(calculateApparentSlip(5, 20), 40)
})

test('calculateWeatherFuelPenalty computes added fuel and speed loss in adverse conditions', () => {
  // Calm conditions: wind BF 3, wave 1.0m -> zero penalty
  const calm = calculateWeatherFuelPenalty(25.0, 14.0, 3, 1.0)
  assert.equal(calm.weatherFuelPenaltyMt, 0)
  assert.equal(calm.speedLossKts, 0)

  // Heavy weather: wind BF 7, wave 4.5m
  const rough = calculateWeatherFuelPenalty(25.0, 12.0, 7, 4.5)
  assert.ok(rough.weatherFuelPenaltyMt > 0)
  assert.ok(rough.speedLossKts > 0)
  assert.ok(rough.weatherCo2PenaltyMt > 0)
})

test('classifyDegradedDay identifies heavy weather, high slip, and engine overload causes', () => {
  // Heavy weather day
  const weatherDay = classifyDegradedDay({
    rating: 'E',
    windBf: 7,
    waveHeightM: 4.2,
    slipPct: 12.0,
    sog: 10.5,
    rpm: 85,
  })
  assert.equal(weatherDay.primaryRootCause, 'heavy_weather')

  // High slip day in calm weather
  const slipDay = classifyDegradedDay({
    rating: 'D',
    windBf: 3,
    waveHeightM: 1.2,
    slipPct: 18.5,
    sog: 11.0,
    rpm: 85,
  })
  assert.equal(slipDay.primaryRootCause, 'high_slip_resistance')
})

test('solveVoyageRecovery determines speed reduction and RPM adjustment for target rating', () => {
  const result = solveVoyageRecovery({
    remainingDistanceNm: 2000,
    pastCo2Mt: 800,
    pastDistanceNm: 2500,
    dwt: 65000,
    targetRating: 'B',
    boundaries: {
      superior_boundary: 3.42,
      lower_boundary: 4.65,
      upper_boundary: 5.92,
      inferior_boundary: 7.35,
    },
    baselineSpeedKts: 14.0,
    baselineRpm: 88,
    dailyFuelBaseMt: 26.0,
  })

  assert.ok(typeof result.isFeasible === 'boolean')
  assert.ok(result.recommendedSpeedKts <= 14.0)
  assert.ok(result.recommendedRpm <= 88)
  assert.ok(result.speedReductionPercent >= 0)
  assert.ok(['A', 'B'].includes(result.projectedFinalRating))
})
