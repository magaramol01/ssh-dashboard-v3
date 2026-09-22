import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { getFleetAlarmTrends } from '../../../../marine/read-model'

export const fleetAlarmTrendsTool = (tenant?: string) =>
  tool(
    async ({ vesselId, days }) => {
      const trends = await getFleetAlarmTrends({ vesselId, days }, tenant)
      return JSON.stringify(trends)
    },
    {
      name: 'get_fleet_alarm_trends',
      description:
        'Get structured hourly alarm trends, alarm distribution by vessel, and alarm breakdown by equipment/subsystem (ME, DG, NAVIGATION). The interface automatically renders live interactive line and bar charts from this data. Use this whenever the operator asks for alarm trends, graphs, charts, or fleet alarm distributions.',
      schema: z.object({
        vesselId: z.number().int().positive().optional(),
        days: z.number().int().min(1).max(7).optional(),
      }),
    }
  )
