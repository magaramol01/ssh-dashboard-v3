import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { getFleetVoyages } from '../../../../marine/read-model'

export const fleetVoyagesTool = (tenant?: string) =>
  tool(
    async ({ limit }) => {
      const voyages = await getFleetVoyages(limit ?? 25, tenant)
      return JSON.stringify({ count: voyages.length, voyages })
    },
    {
      name: 'get_fleet_voyages',
      description:
        'Get active voyages and passages across the fleet, including departure ports, next ports, ETAs, route names, distance travelled/to go, and progress percentage. Use this for fleet passage audits and ETA risk queries.',
      schema: z.object({
        limit: z.number().int().min(1).max(50).optional(),
      }),
    }
  )
