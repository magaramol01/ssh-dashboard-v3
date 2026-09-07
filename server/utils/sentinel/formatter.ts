import type { SentinelBlock, SentinelChatResponse } from '../../../shared/types/sentinel'
import { sentinelResponseSchema } from './schemas'
import type { SentinelRawResponse } from './agent'

function text(value: unknown, fallback = '—') {
  return value === null || value === undefined || value === '' ? fallback : String(value).slice(0, 300)
}

function timestamp(value: unknown) {
  if (!value) return '—'
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? '—' : `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

function blocksFromToolResults(raw: SentinelRawResponse): SentinelBlock[] {
  const blocks: SentinelBlock[] = []

  for (const result of raw.toolResults) {
    let value: Record<string, unknown>
    try {
      value = JSON.parse(result.raw) as Record<string, unknown>
    } catch {
      continue
    }

    if (result.name === 'get_fleet_connectivity') {
      blocks.push(
        { type: 'kpi', label: 'Fleet vessels', value: text(value.vessels, '0') },
        { type: 'kpi', label: 'Online', value: text(value.connected, '0'), tone: 'success' },
        { type: 'kpi', label: 'Offline', value: text(value.offline, '0'), tone: 'destructive' },
        { type: 'kpi', label: 'Unknown', value: text(value.unknown, '0'), tone: 'warning' },
      )
    }

    if (result.name === 'get_vessel_operational_context') {
      const vessel = value.vessel as Record<string, unknown> | undefined
      const connectivity = value.connectivity as Record<string, unknown> | undefined
      if (vessel) blocks.push({ type: 'kpi', label: 'Vessel', value: text(vessel.name || vessel.id) })
      if (connectivity) blocks.push({
        type: 'kpi',
        label: 'Connectivity',
        value: connectivity.connected === true ? 'Online' : connectivity.connected === false ? 'Offline' : 'Unknown',
        detail: connectivity.updated_at ? `Last update ${text(connectivity.updated_at)}` : 'No heartbeat timestamp',
        tone: connectivity.connected === true ? 'success' : connectivity.connected === false ? 'destructive' : 'warning',
      })
    }

    if (result.name === 'analyze_operational_alert') {
      const alert = value.alert as Record<string, unknown> | undefined
      const analysis = value.analysis as Record<string, unknown> | undefined
      if (alert && analysis) {
        blocks.push(
          { type: 'kpi', label: 'Alert value', value: `${text(analysis.currentValue)}${alert.live_value_unit ? ` ${text(alert.live_value_unit)}` : ''}`, tone: alert.severity === 'critical' ? 'destructive' : 'warning' },
          { type: 'kpi', label: 'Configured threshold', value: analysis.thresholdValue == null ? 'Not available' : `${analysis.thresholdDirection === 'below' ? '<' : analysis.thresholdDirection === 'above' ? '>' : ''}${text(analysis.thresholdValue)}${alert.live_value_unit ? ` ${text(alert.live_value_unit)}` : ''}` },
          { type: 'kpi', label: 'Related alerts', value: text(analysis.relatedAlertCount, '0'), detail: 'Same vessel, current open-alert snapshot' },
        )
      }
    }

    if (result.name === 'search_operational_alerts' || result.name === 'get_vessel_operational_context') {
      const alerts = Array.isArray(value.alerts)
        ? value.alerts as Array<Record<string, unknown>>
        : Array.isArray((value.analysis as Record<string, unknown> | undefined)?.relatedAlerts)
          ? (value.analysis as Record<string, unknown>).relatedAlerts as Array<Record<string, unknown>>
          : []
      if (alerts.length) {
        blocks.push({
          type: 'table',
          title: 'Related operational alerts',
          columns: [
            { key: 'vessel', label: 'Vessel' },
            { key: 'severity', label: 'Severity' },
            { key: 'system', label: 'System' },
            { key: 'message', label: 'Alert' },
            { key: 'value', label: 'Value' },
            { key: 'activeWindow', label: 'Active today' },
          ],
          rows: alerts.slice(0, 10).map((alert) => ({
            vessel: text(alert.vessel_name),
            severity: text(alert.severity),
            system: text(alert.system_name),
            message: text(alert.message),
            value: alert.live_value == null ? null : `${alert.live_value}${alert.live_value_unit ? ` ${alert.live_value_unit}` : ''}`,
            activeWindow: `${timestamp(alert.started_at)} → ${timestamp(alert.last_fired_at || alert.reported_at)}${alert.occurrences ? ` · ${alert.occurrences} fires` : ''}`,
          })),
        })
      }
      if (result.name === 'search_operational_alerts') {
        blocks.push({ type: 'kpi', label: 'Matching open alerts', value: text(value.total, '0'), tone: Number(value.total) > 0 ? 'warning' : 'success' })
      }
    }

    const points = Array.isArray(value.points) ? value.points
      .filter((point): point is { label: string; value: number } => Boolean(point && typeof point === 'object' && typeof point.label === 'string' && typeof point.value === 'number' && Number.isFinite(point.value)))
      .slice(0, 100) : []
    if (points.length) blocks.push({ type: 'line-chart', title: text(value.title, 'Telemetry trend'), points })
  }

  return blocks.slice(0, 11)
}

export function formatSentinelResponse(raw: SentinelRawResponse): SentinelChatResponse {
  const candidate = {
    message: { role: 'agent' as const, content: raw.text.slice(0, 8_000) },
    blocks: [
      { type: 'markdown' as const, text: raw.text.slice(0, 8_000) || 'No evidence-backed answer is available.' },
      ...blocksFromToolResults(raw),
    ],
    activity: raw.activity,
    references: raw.references,
    actions: raw.actions,
  }
  const parsed = sentinelResponseSchema.safeParse(candidate)
  if (parsed.success) return parsed.data

  return {
    message: { role: 'agent', content: 'The live data was retrieved, but the response could not be formatted safely.' },
    blocks: [{ type: 'markdown', text: 'The live data was retrieved, but the response could not be formatted safely. Review the source records directly.' }],
    activity: raw.activity,
    references: raw.references,
    actions: raw.actions,
  }
}
