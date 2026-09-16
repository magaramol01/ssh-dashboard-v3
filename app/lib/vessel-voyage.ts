/**
 * Vessel Voyage & Positioning Domain Engine
 * Extracts and normalizes actual vessel positions, passage corridors,
 * and port markers from windy-geojson and AIS telemetry payloads.
 */

export interface ParsedVesselPosition {
  lat: number
  lng: number
  sog: number
  heading: number
  packetTs: string
  isValid: boolean
}

export interface ParsedPlannedCorridor {
  coords: [number, number][]
  startPort: string
  endPort: string
  routeName: string
}

export interface WaypointItem {
  name: string
  pos: [number, number]
  label: string
}

/**
 * Standard global maritime port coordinates (UN/LOCODE).
 */
export const KNOWN_PORT_COORDS: Record<string, [number, number]> = {
  PECLL: [-12.05, -77.15], // Callao, Peru
  CNNDE: [26.66, 119.52],  // Ningde, China
  DKSKA: [57.72, 10.59],   // Skagen, Denmark
  SNDKR: [14.69, -17.44],  // Dakar, Senegal
  LVVNT: [57.40, 21.55],   // Ventspils, Latvia
  ZARCB: [-28.80, 32.05],  // Richards Bay, South Africa
  SGSIN: [1.29, 103.85],   // Singapore
  AUBNE: [-27.47, 153.03], // Brisbane, Australia
  JPYOK: [35.44, 139.64],  // Yokohama, Japan
  CNSHG: [31.23, 121.47],  // Shanghai, China
  NLRTM: [51.92, 4.48],    // Rotterdam, Netherlands
  USLAX: [33.74, -118.27], // Los Angeles, USA
  SADMM: [26.43, 50.10],   // Dammam, Saudi Arabia
  AEJEA: [25.01, 55.06],   // Jebel Ali, UAE
}

/**
 * Resolves [lat, lng] coordinates for a given UN/LOCODE.
 */
export function resolvePortCoordinates(portCode: string, fallback: [number, number] = [0, 0]): [number, number] {
  const clean = (portCode || '').trim().toUpperCase()
  return KNOWN_PORT_COORDS[clean] || fallback
}

/**
 * Parses the vessel's actual current position, speed, and heading
 * from the live `windyMapData` payload.
 */
export function parseVesselCurrentPosition(
  windyMapData: any,
  fallbackLat = 14.68,
  fallbackLng = -17.42
): ParsedVesselPosition {
  if (!windyMapData || typeof windyMapData !== 'object') {
    return { lat: fallbackLat, lng: fallbackLng, sog: 0, heading: 0, packetTs: '', isValid: false }
  }

  // 1. Primary source: windyMapGEoJson.data[0] (ordered latest to oldest)
  const trackData = Array.isArray(windyMapData.windyMapGEoJson?.data)
    ? windyMapData.windyMapGEoJson.data
    : Array.isArray(windyMapData.windyMapGEoJson)
    ? windyMapData.windyMapGEoJson
    : []

  if (trackData.length > 0) {
    const latest = trackData[0]
    const p = latest.properties || {}
    const geom = latest.geometry || {}

    let lat = NaN
    let lng = NaN

    // Check signed decimal string/number properties
    if (p.calculatedLat !== undefined && p.calculatedLat !== null && p.calculatedLat !== '') {
      lat = parseFloat(String(p.calculatedLat))
    }
    if (p.calculatedLong !== undefined && p.calculatedLong !== null && p.calculatedLong !== '') {
      lng = parseFloat(String(p.calculatedLong))
    }

    // Check geometry coordinates [lng, lat]
    if (isNaN(lat) && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
      lat = parseFloat(String(geom.coordinates[1]))
    }
    if (isNaN(lng) && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
      lng = parseFloat(String(geom.coordinates[0]))
    }

    // Check unsigned lat/long with direction strings
    if (isNaN(lat) && p.lat) {
      lat = parseFloat(String(p.lat))
      if (String(p.latDirection).toUpperCase() === 'S') lat = -Math.abs(lat)
    }
    if (isNaN(lng) && p.long) {
      lng = parseFloat(String(p.long))
      if (String(p.longDirection).toUpperCase() === 'W') lng = -Math.abs(lng)
    }

    const sog = typeof p.sog === 'number' ? p.sog : parseFloat(String(p.sog || '0')) || 0
    const heading =
      typeof p.vesselHeading === 'number'
        ? p.vesselHeading
        : typeof p.heading === 'number'
        ? p.heading
        : parseFloat(String(p.vesselHeading ?? p.heading ?? '0')) || 0

    const packetTs = String(p.packetTs || p.createdTs || '')

    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng, sog, heading, packetTs, isValid: true }
    }
  }

  // 2. Secondary source: GeoJSON features array with Point
  if (Array.isArray(windyMapData.features)) {
    const pointFeature = windyMapData.features.find((f: any) => f.geometry?.type === 'Point')
    if (pointFeature?.geometry?.coordinates?.length >= 2) {
      const lng = parseFloat(pointFeature.geometry.coordinates[0])
      const lat = parseFloat(pointFeature.geometry.coordinates[1])
      const sog = parseFloat(pointFeature.properties?.sog || '0') || 0
      const heading = parseFloat(pointFeature.properties?.vesselHeading || pointFeature.properties?.heading || '0') || 0
      const packetTs = String(pointFeature.properties?.packetTs || '')
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng, sog, heading, packetTs, isValid: true }
      }
    }
  }

  return { lat: fallbackLat, lng: fallbackLng, sog: 0, heading: 0, packetTs: '', isValid: false }
}

/**
 * Parses the planned navigation corridor from portToPortGeo.
 * Converts coordinates from GeoJSON [lng, lat] to Leaflet [lat, lng].
 */
export function parsePlannedCorridor(windyMapData: any): ParsedPlannedCorridor {
  if (!windyMapData || typeof windyMapData !== 'object') {
    return { coords: [], startPort: '', endPort: '', routeName: '' }
  }

  const p2pArray = Array.isArray(windyMapData.portToPortGeo) ? windyMapData.portToPortGeo : []
  if (p2pArray.length > 0) {
    const p2p = p2pArray[0]
    const rawCoords = p2p.geometry?.coordinates
    const routeData = p2p.routeData || {}

    if (Array.isArray(rawCoords) && rawCoords.length >= 2) {
      const coords: [number, number][] = rawCoords
        .map((pt: any) => {
          const lng = parseFloat(String(pt[0]))
          const lat = parseFloat(String(pt[1]))
          return [lat, lng] as [number, number]
        })
        .filter((pt) => !isNaN(pt[0]) && !isNaN(pt[1]))

      return {
        coords,
        startPort: routeData.START_PORT_CODE || '',
        endPort: routeData.END_PORT_CODE || '',
        routeName: routeData.ROUTE_NAME || '',
      }
    }
  }

  // Check if root features contain a LineString
  if (Array.isArray(windyMapData.features)) {
    const lineFeature = windyMapData.features.find((f: any) => f.geometry?.type === 'LineString')
    if (lineFeature?.geometry?.coordinates?.length >= 2) {
      const coords: [number, number][] = lineFeature.geometry.coordinates
        .map((pt: any) => [parseFloat(pt[1]), parseFloat(pt[0])] as [number, number])
        .filter((pt: any) => !isNaN(pt[0]) && !isNaN(pt[1]))

      return {
        coords,
        startPort: lineFeature.properties?.startPort || '',
        endPort: lineFeature.properties?.endPort || '',
        routeName: lineFeature.properties?.routeName || '',
      }
    }
  }

  return { coords: [], startPort: '', endPort: '', routeName: '' }
}

/**
 * Extracts the historical sailed track coordinates [lat, lng] leading to current position.
 */
export function parseTravelledTrack(windyMapData: any): [number, number][] {
  if (!windyMapData || typeof windyMapData !== 'object') return []

  const trackData = Array.isArray(windyMapData.windyMapGEoJson?.data)
    ? windyMapData.windyMapGEoJson.data
    : Array.isArray(windyMapData.windyMapGEoJson)
    ? windyMapData.windyMapGEoJson
    : []

  if (!trackData.length) return []

  // Track points from API are ordered latest to oldest. Reverse to get chronological sailed path.
  const coords: [number, number][] = []
  for (let i = trackData.length - 1; i >= 0; i--) {
    const item = trackData[i]
    const p = item.properties || {}
    const geom = item.geometry || {}

    let lat = NaN
    let lng = NaN

    if (p.calculatedLat !== undefined && p.calculatedLat !== null && p.calculatedLat !== '') {
      lat = parseFloat(String(p.calculatedLat))
    }
    if (p.calculatedLong !== undefined && p.calculatedLong !== null && p.calculatedLong !== '') {
      lng = parseFloat(String(p.calculatedLong))
    }
    if (isNaN(lat) && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
      lat = parseFloat(String(geom.coordinates[1]))
      lng = parseFloat(String(geom.coordinates[0]))
    }

    if (!isNaN(lat) && !isNaN(lng)) {
      coords.push([lat, lng])
    }
  }

  return coords
}

/**
 * Dynamically derives 3 intermediate passage waypoints from planned coordinates.
 */
export function deriveWaypoints(coords: [number, number][]): WaypointItem[] {
  if (!coords || coords.length < 5) return []

  const step1 = Math.floor(coords.length * 0.25)
  const step2 = Math.floor(coords.length * 0.5)
  const step3 = Math.floor(coords.length * 0.75)

  const formatCoordLabel = (pt: [number, number]) => {
    const latStr = `${Math.abs(pt[0]).toFixed(1)}°${pt[0] >= 0 ? 'N' : 'S'}`
    const lngStr = `${Math.abs(pt[1]).toFixed(1)}°${pt[1] >= 0 ? 'E' : 'W'}`
    return `${latStr}, ${lngStr}`
  }

  return [
    { name: 'WP 01', pos: coords[step1]!, label: formatCoordLabel(coords[step1]!) },
    { name: 'WP 02', pos: coords[step2]!, label: formatCoordLabel(coords[step2]!) },
    { name: 'WP 03', pos: coords[step3]!, label: formatCoordLabel(coords[step3]!) },
  ]
}

/**
 * Parses a degrees-minutes-seconds coordinate string (e.g. "24°13'5''S")
 * into signed decimal degrees. Returns NaN for unparseable input.
 */
export function parseDmsCoordinate(dms: string): number {
  const match = /^(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D*([NSEW])$/.exec((dms || '').trim())
  if (!match) return NaN
  const [, degStr, minStr, secStr, dir] = match
  const deg = Number(degStr)
  const min = Number(minStr)
  const sec = Number(secStr)
  const decimal = deg + min / 60 + sec / 3600
  return dir === 'S' || dir === 'W' ? -decimal : decimal
}
