import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { searchOperationalAlerts, type AlertSeverity } from '../../../../marine/read-model'

export const searchOperationalAlertsTool = (tenant?: string) =>
  tool(
    async ({ search, severity, page }) => {
      const result = await searchOperationalAlerts(
        {
          search,
          severity: severity === 'all' ? undefined : (severity as AlertSeverity | undefined),
          page,
          pageSize: 10,
        },
        tenant
      )
      return JSON.stringify(result)
    },
    {
      name: 'search_operational_alerts',
      description:
        'Search the current open marine operational alerts. Use this for alert triage, severity counts, and shift briefs. Results are paginated and limited to ten summaries.',
      schema: z.object({
        search: z.string().trim().max(100).optional(),
        severity: z.enum(['critical', 'warning', 'all']).optional(),
        page: z.number().int().min(1).max(100).optional(),
      }),
    }
  )
