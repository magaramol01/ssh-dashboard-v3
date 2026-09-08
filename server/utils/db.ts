import { Pool, type QueryResultRow } from 'pg'
import { getCurrentTenant } from './tenant-context'

/**
 * Tenant-aware connection pool registry.
 * Each tenant connects to its own database dynamically (e.g., db name = x-tenant-id).
 */
const pools = new Map<string, Pool>()

export function getPool(tenant?: string): Pool {
  const activeTenant = (tenant || getCurrentTenant() || 'asiaticlloyd').trim().toLowerCase()
  if (!activeTenant) {
    throw new Error('Tenant database not specified')
  }

  let pool = pools.get(activeTenant)
  if (pool) return pool

  const { PG_HOST: host, PG_PORT: port, PG_USER: user, PG_PASSWORD: password } = process.env
  if (!host || !user || !password) {
    throw new Error('PostgreSQL is not configured: PG_HOST, PG_USER, and PG_PASSWORD are required')
  }

  pool = new Pool({
    host,
    port: Number(port || 5432),
    user,
    password,
    database: activeTenant, // Dynamically uses the x-tenant-id as database name
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    application_name: `marine-control-tower-${activeTenant}`,
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  })

  pools.set(activeTenant, pool)
  return pool
}

export function dbQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
  tenant?: string
) {
  return getPool(tenant).query<T>(text, values)
}

export async function closePools() {
  for (const pool of pools.values()) {
    await pool.end()
  }
  pools.clear()
}
