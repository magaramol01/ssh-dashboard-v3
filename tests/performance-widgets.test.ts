import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractPerformanceWidgetsData } from '../server/utils/marine/performance-widgets'

test('extracts and normalizes raw Cobelfret widget data into structured KPIs', () => {
  const mockCobelfret = {
    widget_1: {
      configuration: {
        body: {
          data: {
            pieChartData: {
              data: [
                { type: 'Laden', avgPercentage: 30.7 },
                { type: 'Ballast', avgPercentage: 30.7 },
                { type: 'Maneuvering', avgPercentage: 5.0 },
                { type: 'Anchorage', avgPercentage: 18.4 },
                { type: 'Port_Operation', avgPercentage: 15.2 },
              ],
            },
          },
        },
      },
    },
    widget_4: {
      configuration: {
        body: {
          data: {
            barChartData: {
              currentValue: 32.9,
              tooltipData: {
                averageBadWeather: '11.7',
                percentageShips: '60%',
              },
            },
          },
        },
      },
    },
    widget_5: {
      configuration: {
        body: {
          data: {
            SFOCdata: {
              sfoc: {
                data: {
                  currentValue: 174.3,
                  acceptedValue: 168.0,
                  trendValue: 176.0,
                },
              },
            },
          },
        },
      },
    },
    widget_6: {
      configuration: {
        body: {
          data: {
            propulsionPerformance: {
              timeLossGain: {
                data: {
                  currentValue: -5.3,
                },
              },
            },
          },
        },
      },
    },
  }

  const result = extractPerformanceWidgetsData({
    cobelfretRaw: mockCobelfret,
    dbSlip: 8.4,
    totalCo2Mt: 2500,
    totalFuelMt: 790,
    attainedCii: 6.2,
  })

  // Weather verification
  assert.equal(result.weather.badWeatherPct, 32.9)
  assert.equal(result.weather.averageBadWeatherDays, 11.7)
  assert.equal(result.weather.imoExclusionEligible, true)
  assert.ok(result.weather.excessCo2Mt > 0)

  // Propulsion & Hull verification
  assert.equal(result.propulsion.timeLossPct, -5.3)
  assert.equal(result.propulsion.engineSlipPct, 8.4)
  assert.equal(result.propulsion.cleaningStatus, 'recommended')
  assert.ok(result.propulsion.dragPenaltyPct > 0)

  // Engine SFOC verification
  assert.equal(result.engine.currentSfoc, 174.3)
  assert.equal(result.engine.expectedSfoc, 168.0)
  assert.equal(result.engine.fleetAvgSfoc, 176.0)
  assert.equal(result.engine.sfocDelta, 6.3)

  // Operations verification
  assert.equal(result.operations.ladenPct, 30.7)
  assert.equal(result.operations.ballastPct, 30.7)
  assert.equal(result.operations.portPct, 15.2)
  assert.ok(result.operations.nonProductiveFuelMt > 0)
})

test('generates deterministic fallback values when raw Cobelfret data is missing', () => {
  const result = extractPerformanceWidgetsData({
    cobelfretRaw: null,
    dbSlip: 6.5,
    totalCo2Mt: 1800,
    totalFuelMt: 570,
    attainedCii: 4.8,
  })

  assert.ok(result.weather.badWeatherPct >= 0)
  assert.ok(result.propulsion.engineSlipPct === 6.5)
  assert.ok(result.engine.currentSfoc > 150)
  assert.ok(result.operations.ladenPct > 0)
})
