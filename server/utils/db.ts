import { Pool, type QueryResultRow } from 'pg'

let pool: Pool | undefined

function getPool() {
  if (pool) return pool

  const { PG_HOST: host, PG_PORT: port, PG_USER: user, PG_PASSWORD: password, PG_DATABASE: database } = process.env
  if (!host || !user || !password || !database) {
    throw new Error('PostgreSQL is not configured')
  }

  pool = new Pool({
    host,
    port: Number(port || 5432),
    user,
    password,
    database,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    application_name: 'marine-control-tower',
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  })

  return pool
}

export function dbQuery<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
  return getPool().query<T>(text, values)
}
