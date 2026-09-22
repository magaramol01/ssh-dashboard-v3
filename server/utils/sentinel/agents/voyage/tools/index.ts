import type { H3Event } from 'h3'
import { fleetVoyagesTool } from './fleet-voyages'
import { simulateSpeedReductionTool } from './simulate-speed'
import { vesselDailyPositionsTool } from './daily-positions'

export function getVoyageTools(tenant?: string, event?: H3Event) {
  return [
    fleetVoyagesTool(tenant),
    simulateSpeedReductionTool(tenant),
    vesselDailyPositionsTool(tenant, event),
  ]
}
