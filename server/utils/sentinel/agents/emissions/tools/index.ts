import { vesselCiiTool } from './vessel-cii'

export function getEmissionsTools(tenant?: string) {
  return [vesselCiiTool(tenant)]
}
