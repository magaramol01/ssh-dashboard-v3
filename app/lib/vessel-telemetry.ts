export type SubsystemCategory = 'All' | 'Air System' | 'Cooling & LO' | 'Fuel Oil' | 'Turbocharger' | 'Bearings'

export type TelemetryStatus = 'nominal' | 'warning' | 'critical'
export type TelemetryTrend = 'up' | 'down' | 'stable'

export interface TelemetryParameter {
  id: string
  subsystem: Exclude<SubsystemCategory, 'All'>
  label: string
  shortLabel?: string
  value: number
  unit: string
  nominalMin: number
  nominalMax: number
  absMin: number
  absMax: number
  trend: TelemetryTrend
  status: TelemetryStatus
}

export interface DGGenerator {
  id: string
  name: string
  role: 'Base Load' | 'Synchronized' | 'Standby'
  status: 'online' | 'standby' | 'tripped'
  electrical: {
    activePowerKw: number
    maxPowerKw: number
    loadPercentage: number
    voltage: number
    frequency: number
    powerFactor: number
  }
  mechanical: {
    rpm: number
    htFwPress: number
    htFwTemp: number
    loPress: number
    loTemp: number
    foTemp: number
  }
  windings: {
    u: number
    v: number
    w: number
  }
}

export const DEFAULT_ME_PARAMETERS: TelemetryParameter[] = [
  {
    id: 'me-ctrl-air-press',
    subsystem: 'Air System',
    label: 'ME Control Air In Press',
    value: 7.44,
    unit: 'bar',
    nominalMin: 6.8,
    nominalMax: 8.0,
    absMin: 0,
    absMax: 10,
    trend: 'stable',
    status: 'nominal',
  },
  {
    id: 'me-start-air-press',
    subsystem: 'Air System',
    label: 'ME Start Air In Press',
    value: 27.5,
    unit: 'bar',
    nominalMin: 20.0,
    nominalMax: 30.0,
    absMin: 0,
    absMax: 35,
    trend: 'stable',
    status: 'nominal',
  },
  {
    id: 'me-jcw-press',
    subsystem: 'Cooling & LO',
    label: 'ME JCW In Press',
    value: 2.85,
    unit: 'bar',
    nominalMin: 2.2,
    nominalMax: 3.5,
    absMin: 0,
    absMax: 5,
    trend: 'stable',
    status: 'nominal',
  },
  {
    id: 'me-lo-inlet-press',
    subsystem: 'Cooling & LO',
    label: 'ME LO Inlet Press',
    value: 2.4,
    unit: 'bar',
    nominalMin: 2.0,
    nominalMax: 3.0,
    absMin: 0,
    absMax: 5,
    trend: 'stable',
    status: 'nominal',
  },
  {
    id: 'me-lo-inlet-temp',
    subsystem: 'Cooling & LO',
    label: 'ME LO In Temp',
    value: 43.5,
    unit: '°C',
    nominalMin: 38.0,
    nominalMax: 48.0,
    absMin: 20,
    absMax: 70,
    trend: 'up',
    status: 'nominal',
  },
  {
    id: 'me-pco-press',
    subsystem: 'Cooling & LO',
    label: 'ME PCO In Press',
    value: 1.86,
    unit: 'bar',
    nominalMin: 1.5,
    nominalMax: 2.5,
    absMin: 0,
    absMax: 4,
    trend: 'stable',
    status: 'nominal',
  },
  {
    id: 'me-fo-press',
    subsystem: 'Fuel Oil',
    label: 'ME FO In Press',
    value: 7.66,
    unit: 'bar',
    nominalMin: 7.0,
    nominalMax: 8.5,
    absMin: 0,
    absMax: 12,
    trend: 'stable',
    status: 'nominal',
  },
  {
    id: 'me-fo-temp',
    subsystem: 'Fuel Oil',
    label: 'ME FO In Temp',
    value: 132.0,
    unit: '°C',
    nominalMin: 125.0,
    nominalMax: 140.0,
    absMin: 80,
    absMax: 160,
    trend: 'down',
    status: 'nominal',
  },
  {
    id: 'me-scav-air-press',
    subsystem: 'Turbocharger',
    label: 'Scav. Air Receiver Press',
    value: 1.85,
    unit: 'bar',
    nominalMin: 1.4,
    nominalMax: 2.2,
    absMin: 0,
    absMax: 3,
    trend: 'up',
    status: 'nominal',
  },
  {
    id: 'me-tc-lo-press',
    subsystem: 'Turbocharger',
    label: 'ME TC LO In Press',
    value: 1.45,
    unit: 'bar',
    nominalMin: 1.2,
    nominalMax: 2.0,
    absMin: 0,
    absMax: 3,
    trend: 'stable',
    status: 'nominal',
  },
  {
    id: 'me-tc-exh-gas-in-temp',
    subsystem: 'Turbocharger',
    label: 'ME TC Exh Gas In Temp',
    value: 385.0,
    unit: '°C',
    nominalMin: 340.0,
    nominalMax: 420.0,
    absMin: 200,
    absMax: 500,
    trend: 'up',
    status: 'nominal',
  },
  {
    id: 'me-tc-exh-gas-out-temp',
    subsystem: 'Turbocharger',
    label: 'ME TC Exh Gas Out Temp',
    value: 275.0,
    unit: '°C',
    nominalMin: 230.0,
    nominalMax: 310.0,
    absMin: 150,
    absMax: 400,
    trend: 'stable',
    status: 'nominal',
  },
  {
    id: 'me-thrust-brg-temp',
    subsystem: 'Bearings',
    label: 'ME Thrust Brg Temp',
    value: 48.5,
    unit: '°C',
    nominalMin: 40.0,
    nominalMax: 65.0,
    absMin: 20,
    absMax: 85,
    trend: 'stable',
    status: 'nominal',
  },
  {
    id: 'me-stern-tube-brg-temp',
    subsystem: 'Bearings',
    label: 'Stern Tube Aft Brg Temp',
    value: 42.0,
    unit: '°C',
    nominalMin: 35.0,
    nominalMax: 60.0,
    absMin: 20,
    absMax: 80,
    trend: 'stable',
    status: 'nominal',
  },
]

export const DEFAULT_DG_GENERATORS: DGGenerator[] = [
  {
    id: 'dg1',
    name: 'DG 1',
    role: 'Base Load',
    status: 'online',
    electrical: {
      activePowerKw: 840,
      maxPowerKw: 1050,
      loadPercentage: 80.0,
      voltage: 440,
      frequency: 60.0,
      powerFactor: 0.88,
    },
    mechanical: {
      rpm: 1009,
      htFwPress: 3.41,
      htFwTemp: 78.4,
      loPress: 4.44,
      loTemp: 65.9,
      foTemp: 124.0,
    },
    windings: {
      u: 75.7,
      v: 78.2,
      w: 76.6,
    },
  },
  {
    id: 'dg2',
    name: 'DG 2',
    role: 'Synchronized',
    status: 'online',
    electrical: {
      activePowerKw: 630,
      maxPowerKw: 1050,
      loadPercentage: 60.0,
      voltage: 440,
      frequency: 60.1,
      powerFactor: 0.87,
    },
    mechanical: {
      rpm: 1009,
      htFwPress: 3.47,
      htFwTemp: 71.6,
      loPress: 4.67,
      loTemp: 81.3,
      foTemp: 110.3,
    },
    windings: {
      u: 71.8,
      v: 74.1,
      w: 70.6,
    },
  },
  {
    id: 'dg3',
    name: 'DG 3',
    role: 'Standby',
    status: 'standby',
    electrical: {
      activePowerKw: 0,
      maxPowerKw: 1050,
      loadPercentage: 0,
      voltage: 0,
      frequency: 0.0,
      powerFactor: 0.0,
    },
    mechanical: {
      rpm: 0,
      htFwPress: 0.91,
      htFwTemp: 68.6,
      loPress: 0.52,
      loTemp: 55.0,
      foTemp: 68.2,
    },
    windings: {
      u: 63.7,
      v: 64.3,
      w: 64.3,
    },
  },
]

export function calculateRangePercentages(
  value: number,
  nominalMin: number,
  nominalMax: number,
  absMin: number,
  absMax: number
): { safeStartPct: number; safeWidthPct: number; markerPct: number; isOutOfRange: boolean } {
  const span = absMax - absMin
  if (span <= 0) {
    return { safeStartPct: 0, safeWidthPct: 100, markerPct: 50, isOutOfRange: false }
  }

  const safeStart = Math.max(0, Math.min(100, ((nominalMin - absMin) / span) * 100))
  const safeEnd = Math.max(0, Math.min(100, ((nominalMax - absMin) / span) * 100))
  const safeWidth = Math.max(0, safeEnd - safeStart)

  const clampedVal = Math.max(absMin, Math.min(absMax, value))
  const marker = Math.max(0, Math.min(100, ((clampedVal - absMin) / span) * 100))
  const isOutOfRange = value < nominalMin || value > nominalMax

  return {
    safeStartPct: Math.round(safeStart * 10) / 10,
    safeWidthPct: Math.round(safeWidth * 10) / 10,
    markerPct: Math.round(marker * 10) / 10,
    isOutOfRange,
  }
}

export function filterTelemetryParameters(
  params: TelemetryParameter[],
  category: SubsystemCategory,
  query: string
): TelemetryParameter[] {
  const q = (query || '').trim().toLowerCase()
  return params.filter((p) => {
    const matchesCategory = category === 'All' || p.subsystem === category
    if (!matchesCategory) return false
    if (!q) return true
    return (
      p.label.toLowerCase().includes(q) ||
      p.subsystem.toLowerCase().includes(q) ||
      p.unit.toLowerCase().includes(q)
    )
  })
}

export function calculateTelemetryHealth(params: TelemetryParameter[]): {
  nominalCount: number
  warningCount: number
  criticalCount: number
} {
  let nominalCount = 0
  let warningCount = 0
  let criticalCount = 0

  for (const p of params) {
    if (p.status === 'nominal') nominalCount++
    else if (p.status === 'warning') warningCount++
    else if (p.status === 'critical') criticalCount++
  }

  return { nominalCount, warningCount, criticalCount }
}

export function calculateWindingVariance(
  u: number,
  v: number,
  w: number
): { spread: number; isBalanced: boolean } {
  const min = Math.min(u, v, w)
  const max = Math.max(u, v, w)
  const spread = Math.round((max - min) * 10) / 10
  return {
    spread,
    isBalanced: spread <= 5.0,
  }
}
