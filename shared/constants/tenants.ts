/**
 * Reserved routes that must not be interpreted as tenant identifiers.
 * Unprefixed requests to these paths (e.g. /live) should yield 404 rather than
 * treating the path segment as a tenant name.
 */
export const RESERVED_TENANT_NAMES = new Set([
  '_nuxt',
  'api',
  '__nuxt_island',
  'favicon.ico',
  'auth',
  'live',
  'dashboard',
  'control-tower',
  'containers',
  'inventory',
  'catalog',
  'shipments',
  'tracking',
  'warehouses',
  'distribution-centers',
  'routes',
  'fleet',
  'drivers',
  'customers',
  'analytics',
  'settings',
  '403',
])

export function isReservedTenant(name: string): boolean {
  if (!name) return true
  return RESERVED_TENANT_NAMES.has(name.toLowerCase())
}
