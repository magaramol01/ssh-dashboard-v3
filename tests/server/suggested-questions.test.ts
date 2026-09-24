import test from 'node:test'
import assert from 'node:assert/strict'
import {
  extractJsonArray,
  sanitizeSuggestedQuestions,
  buildSuggestedQuestionsPrompt,
  generateHeuristicQuestions,
  generateAiSuggestedQuestions,
  type SuggestedQuestionsPayload,
} from '../../server/utils/sentinel/voyage/suggested-questions'

test('extractJsonArray parses markdown json codeblocks and raw json arrays', () => {
  const markdownInput = '```json\n[\n  {"label": "Weather penalty", "query": "Evaluate weather on fuel."}\n]\n```'
  const parsed = extractJsonArray<any>(markdownInput)
  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].label, 'Weather penalty')

  const rawInput = '[{"label": "Slip spike", "query": "Why did slip reach 14%?"}]'
  const parsedRaw = extractJsonArray<any>(rawInput)
  assert.equal(parsedRaw.length, 1)
  assert.equal(parsedRaw[0].label, 'Slip spike')

  const invalidInput = 'I cannot process this request.'
  const parsedInvalid = extractJsonArray(invalidInput)
  assert.deepEqual(parsedInvalid, [])
})

test('sanitizeSuggestedQuestions filters invalid items and enforces character bounds', () => {
  const dirty = [
    null,
    { label: '', query: 'empty label' },
    { label: 'Valid Title That Is Relatively Long But Needs To Be Clamped Within Forty Five Characters Maximum', query: 'What is the speed loss?', category: 'slip' },
    { label: 'Weather Impact', query: '   Analyze weather penalty.   ', category: 'unknown_cat' },
  ]
  const clean = sanitizeSuggestedQuestions(dirty)
  assert.equal(clean.length, 2)
  assert.ok(clean[0]!.label.length <= 45)
  assert.equal(clean[0]!.category, 'slip')
  assert.equal(clean[1]!.category, 'general')
  assert.equal(clean[1]!.query, 'Analyze weather penalty.')
})

test('buildSuggestedQuestionsPrompt formats selected day and telemetry anomalies', () => {
  const payload: SuggestedQuestionsPayload = {
    vesselName: 'FUJIAN EXPRESS',
    voyage: 'VOY-2024-04',
    selectedDay: {
      dayNumber: 16,
      rating: 'E',
      attainedCii: 7.82,
      requiredCii: 4.85,
      sog: 11.2,
      slipPct: 14.2,
      weather: { beaufort: 7, waveHeightM: 3.2 },
    },
    degradedDays: [{ dayNumber: 16, rating: 'E', attainedCii: 7.82, requiredCii: 4.85 }],
    heavyWeatherDays: [{ dayNumber: 16, beaufort: 7, waveHeightM: 3.2 }],
    highSlipDays: [{ dayNumber: 16, slipPct: 14.2 }],
  }

  const prompt = buildSuggestedQuestionsPrompt(payload)
  assert.ok(prompt.includes('FUJIAN EXPRESS'))
  assert.ok(prompt.includes('VOY-2024-04'))
  assert.ok(prompt.includes('Day 16'))
  assert.ok(prompt.includes('BF 7'))
  assert.ok(prompt.includes('14.2%'))
})

test('generateHeuristicQuestions returns 4 contextual questions matching detected anomalies', () => {
  const payload: SuggestedQuestionsPayload = {
    vesselName: 'FUJIAN EXPRESS',
    voyage: 'VOY-2024-04',
    selectedDay: {
      dayNumber: 16,
      rating: 'E',
      attainedCii: 7.82,
      requiredCii: 4.85,
      sog: 11.2,
      slipPct: 14.2,
      weather: { beaufort: 7 },
    },
    degradedDays: [{ dayNumber: 16, rating: 'E', attainedCii: 7.82, requiredCii: 4.85 }],
    heavyWeatherDays: [{ dayNumber: 16, beaufort: 7 }],
    highSlipDays: [{ dayNumber: 16, slipPct: 14.2 }],
  }

  const questions = generateHeuristicQuestions(payload)
  assert.equal(questions.length, 4)
  assert.ok(questions.some((q) => q.label.includes('Day 16')))
  assert.ok(questions.some((q) => q.category === 'weather'))
  assert.ok(questions.some((q) => q.category === 'slip'))
  assert.ok(questions.some((q) => q.category === 'recovery'))
})

test('generateHeuristicQuestions matches on-screen HUD and active map telemetry for Canada Express', () => {
  const payload: SuggestedQuestionsPayload = {
    vesselName: 'CANADA EXPRESS',
    voyage: 'V2603L2',
    originPort: 'BRSTM',
    destinationPort: 'CNCAN',
    hud: {
      attainedCii: 4.06,
      requiredCii: 4.10,
      rating: 'C',
      ciiMarginPct: 1,
      speedKts: 10.5,
      weatherAlertHeadline: 'Adverse swell 1.5m ahead',
      weatherAlertSubtext: '26kt wind, 1.5m seas, 130° swell',
      weatherRiskLevel: 'high',
      laycanBufferHours: 8.5,
    },
    degradedDays: [{ dayNumber: 4, rating: 'D', attainedCii: 5.12, requiredCii: 4.10 }],
    heavyWeatherDays: [{ dayNumber: 5, beaufort: 6, waveHeightM: 1.5 }],
  }

  const questions = generateHeuristicQuestions(payload)
  assert.equal(questions.length, 4)
  // Must match Day 4 Grade D, NOT a non-existent Day 8 Grade E
  assert.ok(questions.some((q) => q.label.includes('Day 4')))
  assert.ok(!questions.some((q) => q.label.includes('Day 8')))
  // Must match Weather Ahead from HUD, NOT BF 180
  assert.ok(questions.some((q) => q.label.includes('Weather Ahead') || q.label.includes('BF 6')))
  assert.ok(!questions.some((q) => q.label.includes('180')))
  // Must match Speed 10.5 kts vs Laycan +8.5h
  assert.ok(questions.some((q) => q.label.includes('10.5') && q.label.includes('8.5')))
})

test('generateAiSuggestedQuestions returns fallback heuristic questions when offline or empty', async () => {
  const res = await generateAiSuggestedQuestions({
    vesselName: 'PACIFIC CARRIER',
    voyage: 'VOY-2024-01',
  })
  assert.ok(Array.isArray(res.questions))
  assert.ok(res.questions.length >= 2)
  assert.ok(['ai', 'heuristic'].includes(res.source))
})
