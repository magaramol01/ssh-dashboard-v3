import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { getVesselOperationalContext } from '../../../../marine/read-model'

export const vesselOperationalContextTool = (tenant?: string) =>
  tool(
    async ({ vesselId }) => {
      const result = await getVesselOperationalContext(vesselId, tenant)
      return JSON.stringify(result ?? { not_found: true, vessel_id: vesselId })
    },
    {
      name: 'get_vessel_operational_context',
      description:
        'Get one vessel identity, latest VSAT connectivity, latest voyage forecast, and recent open alerts. Use this before making vessel-specific claims.',
      schema: z.object({ vesselId: z.number().int().positive() }),
    }
  )
