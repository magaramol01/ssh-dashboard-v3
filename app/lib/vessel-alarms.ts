/**
 * Vessel Alarms & Events Domain Engine
 * Normalizes live machine alarms, alerts, and advisories from backend getAllTodayHistory payload.
 */
import type { VesselAlarmItem } from '~/composables/useVesselDashboard'

const MACHINE_NAMES_MAP: Record<string, string> = {
  ME: 'Main Engine',
  AUX: 'Auxiliary Machinery',
  DG: 'Diesel Generator',
  DG1: 'Diesel Generator 1',
  DG2: 'Diesel Generator 2',
  DG3: 'Diesel Generator 3',
  BLR: 'Boiler System',
  CARGO: 'Cargo Systems',
  NAVIGATION: 'Bridge Navigation',
}

function parseMachineName(raw?: string): string {
  if (!raw) return 'Machinery Subsystem'
  const clean = raw.trim().toUpperCase()
  return MACHINE_NAMES_MAP[clean] || raw.trim()
}

function formatAlarmTime(rawIso?: string): string {
  if (!rawIso) return ''
  try {
    const d = new Date(rawIso)
    if (isNaN(d.getTime())) return rawIso
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  } catch {
    return rawIso
  }
}

function inferAlarmLevel(message: string, category: 'alarm' | 'alert' | 'advisory'): 'critical' | 'warning' | 'info' {
  const lower = message.toLowerCase()
  if (
    lower.includes('pressure low') ||
    lower.includes('disconnected') ||
    lower.includes('shutdown') ||
    lower.includes('loss') ||
    lower.includes('critical') ||
    lower.includes('overflow')
  ) {
    return 'critical'
  }
  if (category === 'alarm' || lower.includes('high') || lower.includes('exceeds') || lower.includes('low')) {
    return 'warning'
  }
  return 'info'
}

export function normalizeVesselAlarms(rawResponse: any): VesselAlarmItem[] {
  if (!rawResponse || typeof rawResponse !== 'object') return []

  const list: VesselAlarmItem[] = []

  // 1. Process Machinery Alarms
  const rawAlarms = Array.isArray(rawResponse.alarmAllData?.tableData)
    ? rawResponse.alarmAllData.tableData
    : []

  rawAlarms.forEach((item: any) => {
    const msg = String(item.Message || '').trim()
    const parts = msg.split('|').map((s) => s.trim())

    const title = parts[0] || `Machinery Alert (${item.MachineName || 'Engine'})`
    const limit = parts[1] || ''
    const reading = item.liveValue ? String(item.liveValue) : parts[2]?.replace(/^Received value\s*:\s*/i, '') || ''

    const level = inferAlarmLevel(msg, 'alarm')
    const time = formatAlarmTime(item.startDate)

    const comment = item.Comment ? String(item.Comment).trim() : ''
    const defaultAdvisory = `Inspect ${parseMachineName(item.MachineName)} sensor loop and check operating parameters.`

    list.push({
      id: String(item.id),
      code: item.rulekey ? `R-${item.rulekey}` : `ALM-${item.id}`,
      title,
      category: 'alarm',
      level,
      system: parseMachineName(item.MachineName),
      time: time || '00:00:00',
      reading: reading || undefined,
      limit: limit || undefined,
      advisory: comment || defaultAdvisory,
      acknowledged: Boolean(item.acknowledgeStatus),
    })
  })

  // 2. Process Operational Alerts
  const rawAlerts = Array.isArray(rawResponse.alertAllData?.tableData)
    ? rawResponse.alertAllData.tableData
    : []

  rawAlerts.forEach((item: any) => {
    const msg = String(item.Message || '').trim()
    const parts = msg.split('|').map((s) => s.trim())
    const title = parts[0] || `Operational Alert`
    const limit = parts[1] || ''
    const reading = item.liveValue ? String(item.liveValue) : parts[2]?.replace(/^Received value\s*:\s*/i, '') || ''
    const time = formatAlarmTime(item.startDate)

    list.push({
      id: String(item.id),
      code: item.rulekey ? `ALT-${item.rulekey}` : `ALT-${item.id}`,
      title,
      category: 'alert',
      level: inferAlarmLevel(msg, 'alert'),
      system: parseMachineName(item.MachineName),
      time: time || '00:00:00',
      reading: reading || undefined,
      limit: limit || undefined,
      advisory: item.Comment?.trim() || 'Monitor operational parameters.',
      acknowledged: Boolean(item.acknowledgeStatus),
    })
  })

  // 3. Process Navigation Corridor Alerts
  const rawNavAlerts = Array.isArray(rawResponse.navigationAlertData?.tableData)
    ? rawResponse.navigationAlertData.tableData
    : []

  rawNavAlerts.forEach((item: any) => {
    const msg = String(item.Message || '').trim()
    const time = formatAlarmTime(item.startDate)

    list.push({
      id: String(item.id),
      code: `NAV-${item.id}`,
      title: msg || 'Navigational Corridor Deviation',
      category: 'alert',
      level: 'warning',
      system: 'Bridge Navigation',
      time: time || '00:00:00',
      advisory: 'Verify cross-track error and restore chartered voyage corridor.',
      acknowledged: Boolean(item.acknowledgeStatus),
    })
  })

  // 4. Process Charter Party Deviations
  const rawCharter = Array.isArray(rawResponse.charterPartyData?.tableData)
    ? rawResponse.charterPartyData.tableData
    : []

  rawCharter.forEach((item: any) => {
    const msg = String(item.Message || '').trim()
    const time = formatAlarmTime(item.startDate)

    list.push({
      id: String(item.id),
      code: `CP-${item.id}`,
      title: msg || 'Charter Party Consumption / Speed Variance',
      category: 'advisory',
      level: 'info',
      system: 'Commercial Charter',
      time: time || '00:00:00',
      advisory: 'Review CP speed & consumption curves against weather routing report.',
      acknowledged: Boolean(item.acknowledgeStatus),
    })
  })

  return list
}
