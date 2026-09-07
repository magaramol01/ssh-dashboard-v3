import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import {
  analyzeOperationalAlert,
  getFleetSnapshot,
  getVesselOperationalContext,
  searchOperationalAlerts,
  type AlertSeverity,
} from '../marine/read-model'

const severitySchema = z.enum(['critical', 'warning', 'all']).optional()

function json(value: unknown) {
  return JSON.stringify(value)
}

export function createSentinelTools() {
  const searchAlerts = tool(async ({ search, severity, page }) => {
    const result = await searchOperationalAlerts({
      search,
      severity: severity === 'all' ? undefined : severity as AlertSeverity | undefined,
      page,
      pageSize: 10,
    })
    return json(result)
  }, {
    name: 'search_operational_alerts',
    description: 'Search the current open marine operational alerts. Use this for alert triage, severity counts, and shift briefs. Results are paginated and limited to ten summaries.',
    schema: z.object({
      search: z.string().trim().max(100).optional(),
      severity: severitySchema,
      page: z.number().int().min(1).max(100).optional(),
    }),
  })

  const analyzeAlert = tool(async ({ alertId }) => {
    const result = await analyzeOperationalAlert(alertId)
    return json(result ?? { not_found: true, alert_id: alertId })
  }, {
    name: 'analyze_operational_alert',
    description: 'Analyze one alert beyond the dashboard row. Use this for diagnose, why, what does this mean, impact, and recommended checks. It calculates threshold deviation and related alerts when the source data supports it.',
    schema: z.object({ alertId: z.number().int().positive() }),
  })

  const vesselContext = tool(async ({ vesselId }) => {
    const result = await getVesselOperationalContext(vesselId)
    return json(result ?? { not_found: true, vessel_id: vesselId })
  }, {
    name: 'get_vessel_operational_context',
    description: 'Get one vessel identity, latest VSAT connectivity, latest voyage forecast, and recent open alerts. Use this before making vessel-specific claims.',
    schema: z.object({ vesselId: z.number().int().positive() }),
  })

  const fleetConnectivity = tool(async () => json(await getFleetSnapshot()), {
    name: 'get_fleet_connectivity',
    description: 'Get the current fleet vessel count and latest VSAT online/offline/unknown status. Use this for network and fleet availability questions.',
    schema: z.object({}),
  })

  return [searchAlerts, analyzeAlert, vesselContext, fleetConnectivity]
}
