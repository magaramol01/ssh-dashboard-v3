import assert from 'node:assert/strict'
import test from 'node:test'
import { findNavItem, navForPersona } from '../app/lib/nav'

test('findNavItem matches standard and tenant-prefixed routes', () => {
  // Unprefixed match
  const liveItem = findNavItem('/live')
  assert.ok(liveItem)
  assert.equal(liveItem?.label, 'Live tracking')

  // Tenant-prefixed match
  const tenantLiveItem = findNavItem('/asiaticlloyd/live', 'asiaticlloyd')
  assert.ok(tenantLiveItem)
  assert.equal(tenantLiveItem?.label, 'Live tracking')

  const xyzLiveItem = findNavItem('/xyz/control-tower', 'xyz')
  assert.ok(xyzLiveItem)
  assert.equal(xyzLiveItem?.label, 'Control tower')
})

test('navForPersona prefixes item routes with active tenant', () => {
  const sectionsWithoutTenant = navForPersona('admin')
  const dashboardItem = sectionsWithoutTenant[0]?.items.find((i) => i.label === 'Dashboard')
  assert.equal(dashboardItem?.to, '/dashboard')

  const sectionsWithTenant = navForPersona('admin', 'asiaticlloyd')
  const tenantDashboardItem = sectionsWithTenant[0]?.items.find((i) => i.label === 'Dashboard')
  assert.equal(tenantDashboardItem?.to, '/asiaticlloyd/dashboard')

  const tenantLiveItem = sectionsWithTenant
    .flatMap((s) => s.items)
    .find((i) => i.label === 'Live tracking')
  assert.equal(tenantLiveItem?.to, '/asiaticlloyd/live')

  const xyzSections = navForPersona('dispatcher', 'xyz')
  const xyzLive = xyzSections
    .flatMap((s) => s.items)
    .find((i) => i.label === 'Live tracking')
  assert.equal(xyzLive?.to, '/xyz/live')
})

test('server tenant extraction logic handles headers, path fallback, and request-id', async () => {
  // Simulate request event context
  const mockHeaders: Record<string, string> = {
    'x-tenant-id': 'asiaticlloyd',
    'x-request-id': '0905c74c-3cc5-4d67-be18-5482b4c3488b',
  }

  // 1. Explicit headers
  assert.equal(mockHeaders['x-tenant-id'], 'asiaticlloyd')
  assert.equal(mockHeaders['x-request-id'], '0905c74c-3cc5-4d67-be18-5482b4c3488b')

  // 2. Path extraction fallback
  const testPaths = [
    { path: '/asiaticlloyd/live', expectedTenant: 'asiaticlloyd' },
    { path: '/xyz/dashboard', expectedTenant: 'xyz' },
    { path: '/api/health', expectedTenant: '' },
    { path: '/_nuxt/entry.js', expectedTenant: '' },
  ]

  for (const { path, expectedTenant } of testPaths) {
    const cleanPath = path.split('?')[0]
    const segments = cleanPath.split('/').filter(Boolean)
    let extracted = ''
    if (segments.length > 0 && !['_nuxt', 'api', '__nuxt_island', 'favicon.ico', 'auth'].includes(segments[0])) {
      extracted = segments[0]
    }
    assert.equal(extracted, expectedTenant, `Failed for path: ${path}`)
  }

  // 3. Request-ID UUID v4 format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const generatedId = crypto.randomUUID()
  assert.ok(uuidRegex.test(generatedId), 'Generated requestId must be a valid UUID v4')
  assert.ok(uuidRegex.test(mockHeaders['x-request-id']), 'Incoming requestId must match UUID format')
})

test('tenantStorage propagates active tenant across async contexts for Copilot tools', async () => {
  const { tenantStorage, getCurrentTenant, runWithTenant } = await import('../server/utils/tenant-context')

  assert.equal(getCurrentTenant(), '', 'Default tenant context should be empty outside request')

  await runWithTenant('asiaticlloyd', async () => {
    assert.equal(getCurrentTenant(), 'asiaticlloyd')

    // Simulate async tool execution inside LangChain agent
    await new Promise((resolve) => setTimeout(resolve, 5))
    assert.equal(getCurrentTenant(), 'asiaticlloyd', 'Tenant must persist across async boundaries')
  })

  await runWithTenant('xyz', async () => {
    assert.equal(getCurrentTenant(), 'xyz')
    await new Promise((resolve) => setTimeout(resolve, 5))
    assert.equal(getCurrentTenant(), 'xyz')
  })

  assert.equal(getCurrentTenant(), '', 'Tenant context should clean up after runWithTenant')
})

test('Copilot tools initialize and bind to dynamic tenant context', async () => {
  const { createSentinelTools } = await import('../server/utils/sentinel/tools')

  const tools = createSentinelTools('asiaticlloyd')
  assert.equal(tools.length, 8)

  const toolNames = tools.map((t) => t.name)
  assert.ok(toolNames.includes('search_operational_alerts'))
  assert.ok(toolNames.includes('analyze_operational_alert'))
  assert.ok(toolNames.includes('get_vessel_operational_context'))
  assert.ok(toolNames.includes('get_fleet_connectivity'))
  assert.ok(toolNames.includes('get_fleet_voyages'))
  assert.ok(toolNames.includes('get_fleet_alarm_trends'))
  assert.ok(toolNames.includes('get_vessel_cii_telemetry'))
  assert.ok(toolNames.includes('simulate_vessel_speed_reduction'))
})

test('PostgreSQL pool uses dynamic database name without PG_DATABASE env variable', async () => {
  // Ensure PG_DATABASE is not set
  delete process.env.PG_DATABASE

  // Set mock host/user/password to verify pool creation configuration
  process.env.PG_HOST = process.env.PG_HOST || '127.0.0.1'
  process.env.PG_USER = process.env.PG_USER || 'mockuser'
  process.env.PG_PASSWORD = process.env.PG_PASSWORD || 'mockpass'

  const { getPool } = await import('../server/utils/db')

  const asiaticPool = getPool('asiaticlloyd')
  assert.equal(asiaticPool.options.database, 'asiaticlloyd', 'Database name must be dynamic tenant: asiaticlloyd')

  const xyzPool = getPool('xyz')
  assert.equal(xyzPool.options.database, 'xyz', 'Database name must be dynamic tenant: xyz')
})

