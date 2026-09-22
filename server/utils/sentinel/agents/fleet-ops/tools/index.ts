import { searchOperationalAlertsTool } from './search-alerts'
import { analyzeOperationalAlertTool } from './analyze-alert'
import { fleetConnectivityTool } from './fleet-connectivity'
import { fleetAlarmTrendsTool } from './alarm-trends'
import { vesselOperationalContextTool } from './vessel-context'

export function getFleetOpsTools(tenant?: string) {
  return [
    searchOperationalAlertsTool(tenant),
    analyzeOperationalAlertTool(tenant),
    vesselOperationalContextTool(tenant),
    fleetConnectivityTool(tenant),
    fleetAlarmTrendsTool(tenant),
  ]
}
