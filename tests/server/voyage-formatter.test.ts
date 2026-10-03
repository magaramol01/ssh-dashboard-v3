import assert from 'node:assert/strict'
import test from 'node:test'
import { formatSentinelResponse } from '../../server/utils/sentinel/core/formatter'
import { sentinelResponseSchema } from '../../server/utils/sentinel/core/schemas'

test('formatSentinelResponse formats voyage overview into KPI blocks safely', () => {
  const raw = {
    text: 'Voyage overview indicates 2,450 NM sailed out of 4,000 NM.',
    toolResults: [
      {
        name: 'get_voyage_overview_and_progress',
        raw: JSON.stringify({
          vesselId: 1,
          vesselName: 'ALS Ceres',
          voyageNumber: 'VOY-2026-001',
          departurePort: 'Rotterdam',
          arrivalPort: 'Singapore',
          totalDistanceNm: 4000,
          distanceSailedNm: 2450,
          distanceToGoNm: 1550,
          progressPercent: 61.3,
          fuelSummary: {
            totalFuelMt: 450.5,
            meFuelMt: 390.0,
            aeFuelMt: 45.5,
            boilerFuelMt: 15.0,
          },
          ciiSummary: {
            rating: 'B',
            attainedCii: 5.12,
            requiredCii: 5.50,
            marginPercent: -6.9,
          },
        }),
      },
    ],
    activity: [],
    references: [],
    actions: [],
  }

  const response = formatSentinelResponse(raw)
  assert.equal(response.message.content, raw.text)
  assert.ok(response.blocks.length >= 4)
  assert.equal(response.blocks[0].type, 'markdown')

  const kpis = response.blocks.filter((b) => b.type === 'kpi')
  assert.ok(kpis.some((k) => k.label === 'Passage Progress'))
  assert.ok(kpis.some((k) => k.label === 'Total Fuel Burn'))
  assert.ok(kpis.some((k) => k.label === 'Current CII Band' && k.value === 'Band B'))

  const validated = sentinelResponseSchema.safeParse(response)
  assert.equal(validated.success, true)
})

test('formatSentinelResponse formats degradation and propulsion slip into tables and charts', () => {
  const raw = {
    text: 'Identified 1 degraded day with elevated slip.',
    toolResults: [
      {
        name: 'diagnose_voyage_degradation',
        raw: JSON.stringify({
          vesselId: 1,
          totalVoyageDays: 10,
          degradedDayCount: 1,
          degradedDays: [
            {
              dayNumber: 3,
              rating: 'D',
              sog: 11.2,
              stw: 13.5,
              slipPct: 17.0,
              windBf: 6,
              seaState: 'Rough / High Seas',
              primaryRootCause: 'heavy_weather',
            },
          ],
          overallDiagnosis: 'Adverse weather caused wave-induced speed loss.',
        }),
      },
      {
        name: 'analyze_propulsion_and_slip',
        raw: JSON.stringify({
          vesselId: 1,
          averageSlipPercent: 11.5,
          slipThresholdStatus: 'elevated',
          maxSlipDay: { dayNumber: 3, slipPercent: 17.0, windBf: 6 },
          propulsionTrend: [
            { dayNumber: 1, slipPercent: 8.2 },
            { dayNumber: 2, slipPercent: 9.1 },
            { dayNumber: 3, slipPercent: 17.0 },
          ],
        }),
      },
    ],
    activity: [],
    references: [],
    actions: [],
  }

  const response = formatSentinelResponse(raw)
  const tables = response.blocks.filter((b) => b.type === 'table')
  const charts = response.blocks.filter((b) => b.type === 'line-chart')

  assert.ok(tables.some((t) => t.title === 'Degraded Passage Days'))
  assert.ok(charts.some((c) => c.title.includes('Apparent Slip Trend')))

  const validated = sentinelResponseSchema.safeParse(response)
  assert.equal(validated.success, true)
})

test('formatSentinelResponse formats noon report findings into human readable strings without [object Object]', () => {
  const raw = {
    text: 'Chief Engineer noon report validation returned 1 finding.',
    toolResults: [
      {
        name: 'validate_vessel_noon_reports',
        raw: JSON.stringify({
          vesselId: 1,
          voyageAuditStatus: 'RETURN FOR CORRECTION',
          evaluatedReportsCount: 27,
          summaryCounts: { critical: 1, error: 0, warning: 0 },
          dailyValidations: [
            {
              dayNumber: 16,
              status: 'CRITICAL',
              findings: [
                {
                  ruleId: 'T2',
                  parameter: 'steamingHours',
                  reported: 27.5,
                  expected: '24.0 h (normal noon-to-noon)',
                  severity: 'CRITICAL',
                  likelyCause: 'Reported steaming hours exceed physical noon-to-noon interval.',
                },
              ],
            },
          ],
        }),
      },
    ],
    activity: [],
    references: [],
    actions: [],
  }

  const response = formatSentinelResponse(raw)
  const tables = response.blocks.filter((b) => b.type === 'table')
  assert.equal(tables.length, 1)

  const row = tables[0].rows[0]
  assert.ok(row.findings)
  assert.ok(!String(row.findings).includes('[object Object]'), 'Findings must not contain [object Object]')
  assert.ok(String(row.findings).includes('Reported steaming hours exceed physical noon-to-noon interval.'))

  const validated = sentinelResponseSchema.safeParse(response)
  assert.equal(validated.success, true)
})

test('formatSentinelResponse generically synthesizes line-chart from any numeric payload series', () => {
  const raw = {
    text: 'Generic telemetry series retrieved.',
    toolResults: [
      {
        name: 'custom_telemetry_collector',
        raw: JSON.stringify({
          vesselId: 4,
          timeline: [
            { dayNumber: 1, fuelBurnRateMt: 18.2, shaftRpm: 72 },
            { dayNumber: 2, fuelBurnRateMt: 19.5, shaftRpm: 74 },
            { dayNumber: 3, fuelBurnRateMt: 22.1, shaftRpm: 78 },
          ],
        }),
      },
    ],
    activity: [],
    references: [],
    actions: [],
  }

  const response = formatSentinelResponse(raw)
  const charts = response.blocks.filter((b) => b.type === 'line-chart' || b.type === 'bar-chart')
  assert.ok(charts.length >= 1, 'Should synthesize at least 1 chart block from timeline')

  const lineChart = charts.find((c) => c.type === 'line-chart')
  assert.ok(lineChart, 'Should have a line-chart block')
  assert.equal(lineChart.points.length, 3)
  assert.equal(lineChart.points[0].label, 'Day 1')
  assert.equal(lineChart.points[0].value, 18.2)

  const validated = sentinelResponseSchema.safeParse(response)
  assert.equal(validated.success, true)
})

test('formatSentinelResponse suppresses flat all-zero charts and prunes redundant calm weather KPIs', () => {
  const raw = {
    text: 'Weather assessment indicates calm seas throughout.',
    toolResults: [
      {
        name: 'evaluate_weather_impact_on_fuel',
        raw: JSON.stringify({
          vesselId: 1,
          weatherFuelPenaltyMt: 0,
          weatherFuelPenaltyPercent: 0,
          averageSpeedLossKnots: 0,
          weatherCo2PenaltyMt: 0,
          baselineCalmWaterFuelMt: 320,
          heavyWeatherDaysCount: 0,
          dailyImpacts: [
            { dayNumber: 1, weatherPenaltyMt: 0, windBf: 2 },
            { dayNumber: 2, weatherPenaltyMt: 0, windBf: 2 },
            { dayNumber: 3, weatherPenaltyMt: 0, windBf: 2 },
          ],
        }),
      },
      {
        name: 'analyze_propulsion_and_slip',
        raw: JSON.stringify({
          vesselId: 1,
          averageSlipPercent: 0,
          propulsionTrend: [
            { dayNumber: 1, slipPercent: 0 },
            { dayNumber: 2, slipPercent: 0 },
            { dayNumber: 3, slipPercent: 0 },
          ],
        }),
      },
    ],
    activity: [],
    references: [],
    actions: [],
  }

  const response = formatSentinelResponse(raw)
  const charts = response.blocks.filter((b) => b.type === 'line-chart' || b.type === 'bar-chart')
  // All-zero charts MUST be suppressed
  assert.equal(charts.length, 0, 'Flat all-zero charts should be completely suppressed')

  // Redundant 0 MT penalty / 0% penalty cards should be replaced with a single calm status
  const kpis = response.blocks.filter((b) => b.type === 'kpi')
  assert.ok(kpis.some((k) => k.label === 'Passage Weather Impact' && k.value === 'Nominal (Calm)'))
  assert.ok(!kpis.some((k) => k.label === 'Passage Weather Penalty'))


  const validated = sentinelResponseSchema.safeParse(response)
  assert.equal(validated.success, true)
})

test('formatSentinelResponse formats get_vessel_daily_positions into a table without synthesizing Lat/Lng trend charts', () => {
  const raw = {
    text: 'Daily noon-report positions retrieved.',
    toolResults: [
      {
        name: 'get_vessel_daily_positions',
        raw: JSON.stringify({
          vesselId: 1,
          days: [
            { dayNumber: 1, dateIso: '2026-09-01T12:00:00Z', lat: -23.66, lng: -178.84, distanceRunNm: 280, cumulativeDistanceNm: 280 },
            { dayNumber: 2, dateIso: '2026-09-02T12:00:00Z', lat: -21.40, lng: -175.20, distanceRunNm: 285, cumulativeDistanceNm: 565 },
            { dayNumber: 3, dateIso: '2026-09-03T12:00:00Z', lat: -19.10, lng: 178.50, distanceRunNm: 290, cumulativeDistanceNm: 855 },
          ],
        }),
      },
    ],
    activity: [],
    references: [],
    actions: [],
  }

  const response = formatSentinelResponse(raw)
  const tables = response.blocks.filter((b) => b.type === 'table')
  const charts = response.blocks.filter((b) => b.type === 'line-chart' || b.type === 'bar-chart')

  assert.equal(tables.length, 1, 'Should format positions into a single data table')
  assert.equal(tables[0].title, 'Daily Noon-Report Positions')
  assert.equal(charts.length, 0, 'Must NOT synthesize Lat Trend or Lng Trend line charts from coordinates')

  const validated = sentinelResponseSchema.safeParse(response)
  assert.equal(validated.success, true)
})

