import { createError, defineEventHandler, getQuery } from 'h3'
import { analyzeThreshold } from '../../shared/types/marine'
import {
  getFleetAlarmTrends,
  getFleetSnapshot,
  getFleetVoyages,
  searchOperationalAlerts,
} from '../utils/marine/read-model'

function boundedDays(value: unknown) {
  const candidate = Number(Array.isArray(value) ? value[0] : value)
  return Number.isInteger(candidate) ? Math.min(7, Math.max(1, candidate)) : 1
}

export default defineEventHandler(async (event) => {
  const days = boundedDays(getQuery(event).days)

  try {
    const [trends, snapshot, openAlerts, criticalAlerts, voyages] = await Promise.all([
      getFleetAlarmTrends({ days }),
      getFleetSnapshot(),
      searchOperationalAlerts({ page: 1, pageSize: 1 }),
      searchOperationalAlerts({ severity: 'critical', page: 1, pageSize: 1 }),
      getFleetVoyages(50),
    ])

    const riskAlerts = openAlerts.alerts.map((alert) => ({
      ...alert,
      ...analyzeThreshold(alert.message, alert.live_value),
    })).sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1
      if (Number(a.breached === true) !== Number(b.breached === true)) return Number(b.breached === true) - Number(a.breached === true)
      if (a.occurrences !== b.occurrences) return b.occurrences - a.occurrences
      return new Date(b.last_fired_at || 0).getTime() - new Date(a.last_fired_at || 0).getTime()
    })

    return {
      asOf: new Date().toISOString(),
      days,
      provenance: {
        alarms: 'Triggered outcomes history',
        connectivity: 'VSAT heartbeat',
        voyages: 'Voyage forecast + noon reports',
      },
      vesselOptions: snapshot.networkVessels,
      kpis: {
        alarms: trends.total_alarms,
        openAlerts: openAlerts.total,
        criticalAlerts: criticalAlerts.total,
        vessels: snapshot.vessels,
        connected: snapshot.connected,
        offline: snapshot.offline,
        activeVoyages: voyages.length,
      },
      trends,
      alerts: riskAlerts,
    }
  } catch (error) {
    console.error('Marine analytics query failed', error)
    throw createError({ statusCode: 503, statusMessage: 'Marine analytics are unavailable' })
  }
})
