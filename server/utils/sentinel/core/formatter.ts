import type { SentinelBlock, SentinelChatResponse } from '../../../shared/types/sentinel'
import { sentinelResponseSchema } from './schemas'
import type { SentinelRawResponse } from './types'

function text(value: unknown, fallback = '—') {
  return value === null || value === undefined || value === '' ? fallback : String(value).slice(0, 300)
}

function timestamp(value: unknown) {
  if (!value) return '—'
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? '—' : `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

function formatFinding(f: unknown): string {
  if (!f) return ''
  if (typeof f === 'string') return f
  if (typeof f === 'object') {
    const obj = f as Record<string, unknown>
    const id = obj.ruleId ? `[${obj.ruleId}] ` : obj.severity ? `[${obj.severity}] ` : ''
    if (obj.likelyCause) return `${id}${obj.likelyCause}`
    if (obj.parameter) return `${id}${obj.parameter}: reported ${obj.reported ?? '—'} vs expected ${obj.expected ?? '—'}`
  }
  return String(f)
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

    if (result.name === 'get_vessel_daily_positions') {
      const days = Array.isArray(value.days) ? value.days as Array<Record<string, unknown>> : []
      if (days.length) {
        blocks.push({
          type: 'table',
          title: 'Daily Noon-Report Positions',
          columns: [
            { key: 'day', label: 'Day' },
            { key: 'date', label: 'Date' },
            { key: 'position', label: 'Lat / Long' },
            { key: 'distance', label: 'Distance Run' },
            { key: 'cumulative', label: 'Cumulative' },
            { key: 'gap', label: 'Unaccounted vs Great-Circle' },
          ],
          rows: days.slice(0, 30).map((d) => ({
            day: text(d.dayNumber),
            date: timestamp(d.dateIso),
            position: d.lat == null || d.lng == null ? 'Not available' : `${text(d.lat)}°, ${text(d.lng)}°`,
            distance: `${text(d.distanceRunNm, '0')} NM`,
            cumulative: `${text(d.cumulativeDistanceNm, '0')} NM`,
            gap: d.unaccountedDistanceFromPrevDayNm == null
              ? '—'
              : Number(d.unaccountedDistanceFromPrevDayNm) > 0
                ? `+${text(d.unaccountedDistanceFromPrevDayNm)} NM (gap)`
                : `${text(d.unaccountedDistanceFromPrevDayNm)} NM`,
          })),
        })
      }
    }

    if (result.name === 'get_voyage_overview_and_progress' && value.distanceSailedNm !== undefined) {
      const fuel = value.fuelSummary as Record<string, unknown> | undefined
      const cii = value.ciiSummary as Record<string, unknown> | undefined
      const rating = text(cii?.rating, '—')
      const tone = rating === 'A' || rating === 'B' ? 'success' : rating === 'C' ? 'default' : 'destructive'

      blocks.push(
        {
          type: 'kpi',
          label: 'Passage Progress',
          value: `${text(value.distanceSailedNm)} / ${text(value.totalDistanceNm)} NM`,
          detail: `${text(value.progressPercent, '0')}% complete · ${text(value.distanceToGoNm, '0')} NM to go`,
        },
        {
          type: 'kpi',
          label: 'Total Fuel Burn',
          value: `${text(fuel?.totalFuelMt, '0')} MT`,
          detail: `ME: ${text(fuel?.meFuelMt, '0')} MT · AE: ${text(fuel?.aeFuelMt, '0')} MT · Blr: ${text(fuel?.boilerFuelMt, '0')} MT`,
        },
        {
          type: 'kpi',
          label: 'Voyage Route',
          value: `${text(value.departurePort, 'Origin')} → ${text(value.arrivalPort, 'Destination')}`,
          detail: `Voyage ${text(value.voyageNumber, 'Active')}`,
        },
        {
          type: 'kpi',
          label: 'Current CII Band',
          value: `Band ${rating}`,
          detail: cii?.attainedCii != null ? `Attained ${cii.attainedCii} gCO₂/tnm` : undefined,
          tone,
        },
      )
    }

    if (result.name === 'diagnose_voyage_degradation' && value.found !== false) {
      const degradedDays = Array.isArray(value.degradedDays) ? (value.degradedDays as Array<Record<string, unknown>>) : []
      if (degradedDays.length > 0) {
        blocks.push({
          type: 'table',
          title: 'Degraded Passage Days',
          columns: [
            { key: 'day', label: 'Day' },
            { key: 'rating', label: 'Rating' },
            { key: 'speed', label: 'SOG / STW' },
            { key: 'slip', label: 'Slip %' },
            { key: 'weather', label: 'Wind / Seas' },
            { key: 'cause', label: 'Root Cause' },
          ],
          rows: degradedDays.slice(0, 15).map((d) => ({
            day: `Day ${text(d.dayNumber)}`,
            rating: `Grade ${text(d.rating)}`,
            speed: `${text(d.sog)} / ${text(d.stw)} kts`,
            slip: `${text(d.slipPct)}%`,
            weather: `Bf ${text(d.windBf)} (${text(d.seaState || `${d.waveHeightM}m`)})`,
            cause: d.primaryRootCause === 'heavy_weather'
              ? 'Heavy Weather'
              : d.primaryRootCause === 'high_slip_resistance'
                ? 'High Slip Resistance'
                : d.primaryRootCause === 'excessive_fuel_consumption'
                  ? 'Excessive Fuel Burn'
                  : 'Degraded Performance',
          })),
        })
      }
      blocks.push({
        type: 'kpi',
        label: 'Degraded Days',
        value: `${text(value.degradedDayCount, '0')} of ${text(value.totalVoyageDays, '0')} days`,
        detail: text(value.overallDiagnosis, 'Performance assessment complete').slice(0, 200),
        tone: Number(value.degradedDayCount) > 0 ? 'warning' : 'success',
      })
    }

    if (result.name === 'analyze_propulsion_and_slip' && value.found !== false) {
      const trend = Array.isArray(value.propulsionTrend) ? (value.propulsionTrend as Array<Record<string, unknown>>) : []
      const slipPoints = trend
        .filter((p) => typeof p.dayNumber === 'number' && typeof p.slipPercent === 'number' && Number.isFinite(p.slipPercent))
        .map((p) => ({ label: `Day ${p.dayNumber}`, value: Number(p.slipPercent) }))
        .slice(0, 30)

      if (slipPoints.length > 0) {
        blocks.push({
          type: 'line-chart',
          title: 'Propulsion Apparent Slip Trend (%)',
          points: slipPoints,
        })
      }

      const status = String(value.slipThresholdStatus || 'normal')
      const maxDay = value.maxSlipDay as Record<string, unknown> | undefined
      blocks.push({
        type: 'kpi',
        label: 'Average Propeller Slip',
        value: `${text(value.averageSlipPercent, '0')}%`,
        detail: maxDay ? `Peak ${text(maxDay.slipPercent)}% on Day ${text(maxDay.dayNumber)} (Bf ${text(maxDay.windBf)})` : undefined,
        tone: status === 'critical' ? 'destructive' : status === 'elevated' ? 'warning' : 'success',
      })
    }

    if (result.name === 'evaluate_weather_impact_on_fuel' && value.found !== false && value.weatherFuelPenaltyMt !== undefined) {
      blocks.push(
        {
          type: 'kpi',
          label: 'Weather Fuel Penalty',
          value: `+${text(value.weatherFuelPenaltyMt, '0')} MT`,
          detail: `+${text(value.weatherFuelPenaltyPercent, '0')}% over calm baseline (${text(value.baselineCalmWaterFuelMt, '0')} MT)`,
          tone: Number(value.weatherFuelPenaltyMt) > 0 ? 'warning' : 'success',
        },
        {
          type: 'kpi',
          label: 'Weather Speed Loss',
          value: `-${text(value.averageSpeedLossKnots, '0')} kts`,
          detail: `${text(value.heavyWeatherDaysCount, '0')} heavy weather days (Beaufort 6+)`,
          tone: Number(value.averageSpeedLossKnots) > 1.0 ? 'warning' : 'default',
        },
        {
          type: 'kpi',
          label: 'Weather CO₂ Impact',
          value: `+${text(value.weatherCo2PenaltyMt, '0')} MT CO₂`,
          detail: 'Added emissions from wind and wave resistance',
          tone: 'warning',
        },
      )
    }

    if (result.name === 'calculate_voyage_recovery_plan' && value.found !== false) {
      const rec = value.recommendedPlan as Record<string, unknown> | undefined
      if (rec) {
        const feasible = rec.isFeasible === true
        blocks.push(
          {
            type: 'kpi',
            label: `Target Band ${text(value.targetRating, 'B')} Feasibility`,
            value: feasible ? 'Feasible' : 'Infeasible without Speed Cut',
            detail: text(rec.recommendedActionSummary, 'Operational recovery assessment').slice(0, 200),
            tone: feasible ? 'success' : 'destructive',
          },
          ...(feasible ? [
            {
              type: 'kpi' as const,
              label: 'Recommended Speed / RPM',
              value: `${text(rec.recommendedSpeedKts ?? rec.requiredAverageSpeedKts)} kts (${text(rec.recommendedRpm)} RPM)`,
              detail: `Max fuel: ${text(rec.dailyFuelLimitMt ?? rec.dailyFuelConsumptionLimitMt)} MT/day · Saves ${text(rec.fuelSavedMt)} MT`,
              tone: 'success' as const,
            },
            {
              type: 'kpi' as const,
              label: 'Projected ETA Impact',
              value: `+${text(rec.etaDelayHours ?? rec.projectedArrivalDelayHours, '0')} hrs delay`,
              detail: text(rec.etaDelayDescription, 'Arrival window update').slice(0, 200),
            },
          ] : []),
        )
      }

      const options = Array.isArray(value.alternativeOptions) ? (value.alternativeOptions as Array<Record<string, unknown>>) : []
      if (options.length > 0) {
        blocks.push({
          type: 'table',
          title: 'CII Operational Recovery Strategies',
          columns: [
            { key: 'rating', label: 'Target Band' },
            { key: 'speed', label: 'Req Speed' },
            { key: 'rpm', label: 'Req RPM' },
            { key: 'fuelLimit', label: 'Daily Fuel Limit' },
            { key: 'delay', label: 'ETA Delay' },
            { key: 'status', label: 'Feasibility' },
          ],
          rows: options.map((opt) => ({
            rating: `Band ${text(opt.projectedFinalRating ?? opt.targetRating)}`,
            speed: opt.isFeasible !== false ? `${text(opt.speedKnots ?? opt.requiredAverageSpeedKts)} kts` : '—',
            rpm: opt.isFeasible !== false ? `${text(opt.engineRpm ?? opt.recommendedRpm)} RPM` : '—',
            fuelLimit: opt.isFeasible !== false ? `${text(opt.dailyFuelMt ?? opt.dailyFuelConsumptionLimitMt)} MT/day` : '—',
            delay: opt.isFeasible !== false ? `+${text(opt.etaDelayHours ?? opt.projectedArrivalDelayHours)}h` : '—',
            status: opt.isFeasible === false ? 'Mathematically Infeasible' : 'Feasible',
          })),
        })
      }
    }

    if (result.name === 'validate_vessel_noon_reports' && value.found !== false && value.voyageAuditStatus !== undefined) {
      const status = String(value.voyageAuditStatus)
      const counts = value.summaryCounts as Record<string, number> | undefined
      blocks.push({
        type: 'kpi',
        label: 'Chief Engineer Noon Audit',
        value: status,
        detail: `${text(value.evaluatedReportsCount, '0')} reports audited: ${counts?.critical ?? 0} critical, ${counts?.warning ?? 0} warnings`,
        tone: status === 'RETURN FOR CORRECTION' ? 'destructive' : status === 'APPROVE WITH REMARKS' ? 'warning' : 'success',
      })

      const daily = Array.isArray(value.dailyValidations) ? (value.dailyValidations as Array<Record<string, unknown>>) : []
      const issues = daily.filter((d) => d.status !== 'APPROVE')
      if (issues.length > 0) {
        blocks.push({
          type: 'table',
          title: 'Noon Report Discrepancies',
          columns: [
            { key: 'day', label: 'Day' },
            { key: 'status', label: 'Audit Status' },
            { key: 'findings', label: 'Chief Engineer Findings' },
          ],
          rows: issues.slice(0, 10).map((d) => ({
            day: `Day ${text(d.dayNumber)}`,
            status: text(d.status),
            findings: Array.isArray(d.findings)
              ? d.findings.map(formatFinding).filter(Boolean).join('; ').slice(0, 300) || 'None'
              : '—',
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
    message: { role: 'agent' as const, content: raw.text.slice(0, 16_000) },
    thought: raw.thought ? raw.thought.slice(0, 16_000) : undefined,
    blocks: [
      { type: 'markdown' as const, text: raw.text.slice(0, 16_000) || 'No evidence-backed answer is available.' },
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
