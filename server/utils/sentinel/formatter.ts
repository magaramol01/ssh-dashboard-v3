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
          ...(analysis.breached === true || analysis.breached === false ? [{
            type: 'kpi' as const,
            label: 'Threshold status',
            value: analysis.breached ? 'Breached' : 'Within limit',
            detail: analysis.deviationPercent == null ? undefined : `${text(analysis.deviationPercent)}% from limit`,
            tone: analysis.breached ? 'destructive' as const : 'success' as const,
          }] : []),
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

    if (result.name === 'get_fleet_alarm_trends') {
      if (value.total_alarms !== undefined) {
        blocks.push({
          type: 'kpi',
          label: 'Total Alarms Recorded',
          value: text(value.total_alarms, '0'),
          detail: 'Fleet-wide telemetry alarms',
          tone: Number(value.total_alarms) > 0 ? 'warning' : 'success',
        })
      }

      const hourlyPoints = Array.isArray(value.hourly_trend) ? (value.hourly_trend as Array<{ label?: unknown; value?: unknown }>)
        .filter((p): p is { label: string; value: number } => Boolean(p && typeof p.label === 'string' && typeof p.value === 'number' && Number.isFinite(p.value)))
        .slice(0, 50)
        : []
      if (hourlyPoints.length) {
        blocks.push({
          type: 'line-chart',
          title: 'Fleet Alarm Frequency (Hourly Trend)',
          points: hourlyPoints,
        })
      }

      const vesselPoints = Array.isArray(value.by_vessel) ? (value.by_vessel as Array<{ label?: unknown; value?: unknown }>)
        .filter((p): p is { label: string; value: number } => Boolean(p && typeof p.label === 'string' && typeof p.value === 'number' && Number.isFinite(p.value)))
        .slice(0, 10)
        : []
      if (vesselPoints.length) {
        blocks.push({
          type: 'bar-chart',
          title: 'Alarm Distribution by Vessel',
          points: vesselPoints,
        })
      }

      const systemPoints = Array.isArray(value.by_system) ? (value.by_system as Array<{ label?: unknown; value?: unknown }>)
        .filter((p): p is { label: string; value: number } => Boolean(p && typeof p.label === 'string' && typeof p.value === 'number' && Number.isFinite(p.value)))
        .slice(0, 10)
        : []
      if (systemPoints.length) {
        blocks.push({
          type: 'bar-chart',
          title: 'Alarm Volume by Subsystem',
          points: systemPoints,
        })
      }
    }

    if (result.name === 'get_vessel_cii_telemetry') {
      if (value.attainedCii !== undefined) {
        const rating = (value.rating as string) || (value.attainedRating as string) || 'C'
        const reqCii = value.requiredCii != null ? Number(value.requiredCii).toFixed(2) : '5.25'
        const marginPct = Number(value.marginPercent || 0)
        const rank = value.rank != null ? value.rank : '—'
        const total = value.totalVessels != null ? value.totalVessels : '—'
        const avg = value.fleetAverageCii != null ? `${value.fleetAverageCii} gCO₂/tnm` : '—'

        blocks.push(
          {
            type: 'kpi',
            label: 'Attained CII',
            value: `${value.attainedCii} gCO₂/tnm`,
            detail: `Grade ${rating} · Req ${reqCii} (${marginPct > 0 ? '+' : ''}${marginPct}%)`,
            tone: marginPct <= 0 ? 'success' : 'warning',
          },
          {
            type: 'kpi',
            label: 'Total CO₂ Emitted',
            value: `${value.totalCo2Mt} MT`,
            detail: `EU ETS: €${Number(value.euEtsCostEur || 0).toLocaleString()}`,
          },
          {
            type: 'kpi',
            label: 'Fleet Ranking',
            value: rank !== '—' && total !== '—' ? `Rank #${rank} of ${total}` : 'Fleet Rank Active',
            detail: avg !== '—' ? `Fleet Avg: ${avg}` : undefined,
          },
        )
      }
    }

    if (result.name === 'simulate_vessel_speed_reduction') {
      const rec = value.recommendedScenario as Record<string, unknown> | undefined
      if (rec) {
        const speedText = rec.speedKnots != null ? ` (${rec.speedKnots} kts)` : ''
        blocks.push({
          type: 'kpi',
          label: 'Recommended Speed Cut',
          value: `-${rec.reductionPercent}%${speedText}`,
          detail: `Projects Grade ${rec.projectedRating} · ${rec.co2SavingsMt} MT CO₂ saved`,
          tone: 'success',
        })
      }
      const scenarios = Array.isArray(value.scenarios) ? value.scenarios as Array<Record<string, unknown>> : []
      if (scenarios.length) {
        blocks.push({
          type: 'table',
          title: 'Speed Reduction Hydrodynamic Scenarios',
          columns: [
            { key: 'cut', label: 'Speed Cut' },
            { key: 'speed', label: 'Speed' },
            { key: 'cii', label: 'Projected CII' },
            { key: 'rating', label: 'Rating' },
            { key: 'savings', label: 'CO₂ Saved' },
          ],
          rows: scenarios.map((s) => ({
            cut: `-${s.reductionPercent}%`,
            speed: s.speedKnots != null ? `${s.speedKnots} kts` : '—',
            cii: String(s.projectedCii),
            rating: `Grade ${s.projectedRating}`,
            savings: `${s.co2SavingsMt} MT`,
          })),
        })
      }
    }

    const points = Array.isArray(value.points) ? value.points
      .filter((point): point is { label: string; value: number } => Boolean(point && typeof point === 'object' && typeof point.label === 'string' && typeof point.value === 'number' && Number.isFinite(point.value)))
      .slice(0, 100) : []
    if (points.length) blocks.push({ type: 'line-chart', title: text(value.title, 'Telemetry trend'), points })
  }

  return blocks.slice(0, 15)
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
