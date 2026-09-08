import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * AsyncLocalStorage container for tenant context.
 *
 * Propagates the active tenant (from x-tenant-id / URL) across all asynchronous
 * operations on the server without needing to pass tenant arguments through every layer.
 * Particularly important for Sentinel Copilot tools and agent graph executions.
 */
export const tenantStorage = new AsyncLocalStorage<string>()

export function getCurrentTenant(): string {
  return tenantStorage.getStore() || ''
}

export function runWithTenant<T>(tenant: string, fn: () => T): T {
  return tenantStorage.run(tenant, fn)
}
