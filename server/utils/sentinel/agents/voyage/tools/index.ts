import type { H3Event } from 'h3'
import { fleetVoyagesTool } from './fleet-voyages'
import { simulateSpeedReductionTool } from './simulate-speed'
import { vesselDailyPositionsTool } from './daily-positions'
import { voyageOverviewTool } from './voyage-overview'
import { diagnoseDegradationTool } from './diagnose-degradation'
import { propulsionSlipTool } from './propulsion-slip'
import { weatherFuelPenaltyTool } from './weather-fuel-penalty'
import { voyageRecoveryTool } from './voyage-recovery'
import { validateNoonReportsTool } from './validate-noon-reports'

export function getVoyageTools(tenant?: string, event?: H3Event) {
  return [
    fleetVoyagesTool(tenant),
    simulateSpeedReductionTool(tenant),
    vesselDailyPositionsTool(tenant, event),
    voyageOverviewTool(tenant, event),
    diagnoseDegradationTool(tenant, event),
    propulsionSlipTool(tenant, event),
    weatherFuelPenaltyTool(tenant, event),
    voyageRecoveryTool(tenant, event),
    validateNoonReportsTool(tenant, event),
  ]
}

export {
  fleetVoyagesTool,
  simulateSpeedReductionTool,
  vesselDailyPositionsTool,
  voyageOverviewTool,
  diagnoseDegradationTool,
  propulsionSlipTool,
  weatherFuelPenaltyTool,
  voyageRecoveryTool,
  validateNoonReportsTool,
}
