import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { getFleetSnapshot } from '../../../../marine/read-model'

export const fleetConnectivityTool = (tenant?: string) =>
  tool(
    async () => JSON.stringify(await getFleetSnapshot(tenant)),
    {
      name: 'get_fleet_connectivity',
      description:
        'Get the current fleet vessel count and latest VSAT online/offline/unknown status. Use this for network and fleet availability questions.',
      schema: z.object({}),
    }
  )
