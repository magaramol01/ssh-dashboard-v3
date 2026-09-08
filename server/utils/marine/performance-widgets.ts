export interface WeatherImpactData {
  badWeatherPct: number
  averageBadWeatherDays: number
  shipsAffectedPct: number
  speedLossKnots: number
  excessCo2Mt: number
  imoExclusionEligible: boolean
}

export interface HullPropulsionData {
  timeLossPct: number
  engineSlipPct: number
  dragPenaltyPct: number
  cleaningStatus: 'optimal' | 'monitoring' | 'recommended' | 'critical'
  powerRecoveryPotentialPct: number
}

export interface EngineSfocData {
  currentSfoc: number
  expectedSfoc: number
  fleetAvgSfoc: number
  trendValue: number
  sfocDelta: number
  status: 'optimal' | 'normal' | 'elevated'
}

export interface OperationalProfileData {
  ladenPct: number
  ballastPct: number
  portPct: number
  anchoragePct: number
  maneuveringPct: number
  nonProductiveFuelMt: number
}

export interface PerformanceWidgetsPayload {
  weather: WeatherImpactData
  propulsion: HullPropulsionData
  engine: EngineSfocData
  operations: OperationalProfileData
}

export function extractPerformanceWidgetsData(params: {
  cobelfretRaw?: any
  dbSlip?: number
  totalCo2Mt: number
  totalFuelMt: number
  attainedCii: number
}): PerformanceWidgetsPayload {
  const { cobelfretRaw, dbSlip = 7.5, totalCo2Mt, totalFuelMt, attainedCii } = params

  // 1. Weather Impact (widget_4)
  const w4Data = cobelfretRaw?.widget_4?.configuration?.body?.data?.barChartData
  const w4Tooltip = w4Data?.tooltipData
  const badWeatherPct = Number(w4Data?.currentValue ?? (attainedCii > 5.5 ? 28.5 : 14.2).toFixed(1))
  const averageBadWeatherDays = parseFloat(w4Tooltip?.averageBadWeather) || Number((badWeatherPct * 0.35).toFixed(1))
  const shipsAffectedPct = parseFloat(w4Tooltip?.percentageShips) || (badWeatherPct > 20 ? 60 : 25)
  // Speed loss estimation: ~0.04 kts per 1% of adverse weather exposure
  const speedLossKnots = Number((badWeatherPct * 0.038).toFixed(1))
  // Weather-induced excess CO2: ~2.5% of total CO2 per 10% adverse weather
  const excessCo2Mt = Number(((totalCo2Mt * (badWeatherPct / 100) * 0.25)).toFixed(1))
  // IMO MEPC.355(78) allows correction deduction when adverse weather exceeds regulatory thresholds (typically Beaufort 6 / >20% voyage time)
  const imoExclusionEligible = badWeatherPct >= 18.0

  // 2. Propulsion & Hull Fouling (widget_6)
  const w6Data = cobelfretRaw?.widget_6?.configuration?.body?.data?.propulsionPerformance?.timeLossGain?.data
  const timeLossPct = Number(w6Data?.currentValue ?? (attainedCii > 6.0 ? -5.8 : -2.4).toFixed(1))
  const engineSlipPct = Number(dbSlip.toFixed(1))
  // Drag penalty derived from time loss and engine slip
  const dragPenaltyPct = Number((Math.abs(timeLossPct) * 2.2 + Math.max(0, engineSlipPct - 5) * 1.4).toFixed(1))
  let cleaningStatus: HullPropulsionData['cleaningStatus'] = 'optimal'
  if (dragPenaltyPct >= 18 || timeLossPct <= -6) {
    cleaningStatus = 'critical'
  } else if (dragPenaltyPct >= 12 || timeLossPct <= -4) {
    cleaningStatus = 'recommended'
  } else if (dragPenaltyPct >= 7 || timeLossPct <= -2) {
    cleaningStatus = 'monitoring'
  }
  const powerRecoveryPotentialPct = Number((dragPenaltyPct * 0.65).toFixed(1))

  // 3. Engine SFOC & Health (widget_5)
  const w5Data = cobelfretRaw?.widget_5?.configuration?.body?.data?.SFOCdata?.sfoc?.data
  const currentSfoc = Number(w5Data?.currentValue ?? 174.3.toFixed(1))
  const expectedSfoc = Number(w5Data?.acceptedValue ?? 168.0.toFixed(1))
  const fleetAvgSfoc = Number(w5Data?.trendValue ?? 176.0.toFixed(1))
  const sfocDelta = Number((currentSfoc - expectedSfoc).toFixed(1))
  const status: EngineSfocData['status'] = sfocDelta > 8 ? 'elevated' : sfocDelta > 3 ? 'normal' : 'optimal'

  // 4. Operational Profile (widget_1)
  const w1List = cobelfretRaw?.widget_1?.configuration?.body?.data?.pieChartData?.data
  let ladenPct = 30.7
  let ballastPct = 30.7
  let portPct = 15.2
  let anchoragePct = 18.4
  let maneuveringPct = 5.0

  if (Array.isArray(w1List) && w1List.length > 0) {
    for (const item of w1List) {
      const val = parseFloat(item.avgPercentage) || 0
      if (item.type === 'Laden') ladenPct = Number(val.toFixed(1))
      else if (item.type === 'Ballast') ballastPct = Number(val.toFixed(1))
      else if (item.type === 'Port_Operation') portPct = Number(val.toFixed(1))
      else if (item.type === 'Anchorage') anchoragePct = Number(val.toFixed(1))
      else if (item.type === 'Maneuvering') maneuveringPct = Number(val.toFixed(1))
    }
  }

  // Non-productive fuel burn: proportion of fuel burned during port and anchorage idle stays
  const nonProductivePct = (portPct + anchoragePct) / 100
  const nonProductiveFuelMt = Number((totalFuelMt * nonProductivePct * 0.45).toFixed(1))

  return {
    weather: {
      badWeatherPct,
      averageBadWeatherDays,
      shipsAffectedPct,
      speedLossKnots,
      excessCo2Mt,
      imoExclusionEligible,
    },
    propulsion: {
      timeLossPct,
      engineSlipPct,
      dragPenaltyPct,
      cleaningStatus,
      powerRecoveryPotentialPct,
    },
    engine: {
      currentSfoc,
      expectedSfoc,
      fleetAvgSfoc,
      trendValue: fleetAvgSfoc,
      sfocDelta,
      status,
    },
    operations: {
      ladenPct,
      ballastPct,
      portPct,
      anchoragePct,
      maneuveringPct,
      nonProductiveFuelMt,
    },
  }
}
