import assert from 'node:assert/strict'
import test from 'node:test'
import sisterGroupHandler from '../../server/api/vessels/sister-group.post'
import dashboardStateHandler from '../../server/api/vessels/dashboard-state.get'
import windyGeojsonHandler from '../../server/api/vessels/windy-geojson.get'
import mrvLatestHandler from '../../server/api/vessels/mrv-latest.get'
import connectivityStatusHandler from '../../server/api/vessels/connectivity-status.get'
import rhsPanelFlagsGetHandler from '../../server/api/vessels/rhs-panel-flags.get'
import rhsPanelFlagsPostHandler from '../../server/api/vessels/rhs-panel-flags.post'
import rechartDataHandler from '../../server/api/vessels/rechart-data.post'
import graphAvgValuesHandler from '../../server/api/vessels/graph-avg-values.get'
import alarmsHandler from '../../server/api/vessels/alarms.get'

test('Vessel API Server Proxies defines all route handlers properly', () => {
  assert.equal(typeof sisterGroupHandler, 'function')
  assert.equal(typeof dashboardStateHandler, 'function')
  assert.equal(typeof windyGeojsonHandler, 'function')
  assert.equal(typeof mrvLatestHandler, 'function')
  assert.equal(typeof connectivityStatusHandler, 'function')
  assert.equal(typeof rhsPanelFlagsGetHandler, 'function')
  assert.equal(typeof rhsPanelFlagsPostHandler, 'function')
  assert.equal(typeof rechartDataHandler, 'function')
  assert.equal(typeof graphAvgValuesHandler, 'function')
  assert.equal(typeof alarmsHandler, 'function')
})
