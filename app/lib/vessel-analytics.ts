export function getCylinderStatusColor(temp: number): string {
  if (temp > 350) return '#ef4444' // Alarm / Red
  if (temp >= 330) return '#f59e0b' // Warning / Amber
  return '#10b981' // Nominal / Green
}

export function computeCylinderStats(temps: number[]): { avg: number; max: number; min: number; spread: number } {
  if (!temps.length) return { avg: 0, max: 0, min: 0, spread: 0 }
  const sum = temps.reduce((acc, v) => acc + v, 0)
  const avg = parseFloat((sum / temps.length).toFixed(1))
  const max = Math.max(...temps)
  const min = Math.min(...temps)
  const spread = parseFloat((max - min).toFixed(1))
  return { avg, max, min, spread }
}

export function formatTelemetryValue(val: string | number | undefined, fallback = '0.00'): string {
  if (val === undefined || val === null || val === '' || val === 'NA') return fallback
  const n = parseFloat(String(val))
  return isNaN(n) ? String(val) : n.toFixed(2)
}
