/**
 * Mirrors app/lib/vessel-voyage.ts's parseDmsCoordinate — kept local since
 * server/ code doesn't import from app/. Real noon-report position fields
 * arrive as either a DMS string ("24°13'5''S") or plain decimal degrees.
 */
export function parseDmsCoordinate(dms: string): number {
  const match = /^(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D*([NSEW])$/.exec((dms || '').trim())
  if (!match) return NaN
  const [, degStr, minStr, secStr, dir] = match
  const decimal = Number(degStr) + Number(minStr) / 60 + Number(secStr) / 3600
  return dir === 'S' || dir === 'W' ? -decimal : decimal
}

export function resolveCoordinate(value: unknown): number {
  if (typeof value === 'number') return value
  if (value === null || value === undefined || value === '') return NaN
  const trimmed = String(value).trim()
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  return parseDmsCoordinate(trimmed)
}

/** Great-circle distance between two lat/lng points, in nautical miles. */
export function greatCircleNm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadiusNm = 3440.065
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return earthRadiusNm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
