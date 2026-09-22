import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { analyzeOperationalAlert } from '../../../../marine/read-model'

export const analyzeOperationalAlertTool = (tenant?: string) =>
  tool(
    async ({ alertId }) => {
      const result = await analyzeOperationalAlert(alertId, tenant)
      return JSON.stringify(result ?? { not_found: true, alert_id: alertId })
    },
    {
      name: 'analyze_operational_alert',
      description:
        'Analyze one alert beyond the dashboard row. Use this for diagnose, why, what does this mean, impact, and recommended checks. It calculates threshold deviation and related alerts when the source data supports it.',
      schema: z.object({ alertId: z.number().int().positive() }),
    }
  )
