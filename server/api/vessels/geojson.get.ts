import { defineEventHandler, getCookie, getHeader, getQuery, createError } from 'h3'
import { getAllVesselsGeoJsonData, type VesselsGeoJsonResponse } from '../../utils/http-adapter'

export interface NormalizedVessel {
  id: string
  vesselId: number
  name: string
  sog: number
  coords: [number, number] // [lat, lng] for Leaflet
  routeCoords: [number, number][]
  originCoords: [number, number] | null
  destCoords: [number, number] | null
  distanceNm: number
  progress: number
  packetTs: string
  windSpeedBF: number
  waveDirection: string
  swellDirection: string
  currentSpeed: string
  currentDirection: string
  heading: string
  status: 'in-transit' | 'manoeuvring' | 'moored'
  tone: 'success' | 'warning' | 'info' | 'muted' | 'destructive'
}

function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065 // Nautical miles
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const tenant = (
    query.tenant ||
    getHeader(event, 'x-tenant-id') ||
    event.context.tenant ||
    getCookie(event, 'ssh_tenant') ||
    ''
  )?.toString().trim()

  const authToken =
    getCookie(event, 'auth_token') ||
    getHeader(event, 'x-auth-id') ||
    getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '')
  const refreshToken =
    getCookie(event, 'refresh_token') ||
    getHeader(event, 'x-refresh-id')

  if (!authToken) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized. Please sign in to view live vessels.',
      data: { authenticated: false },
    })
  }

  // Pass user existing auth token directly to the backend - no new token creation
  const response = await getAllVesselsGeoJsonData({
    event,
    tenant,
    authToken,
    refreshToken,
  })

  if (!response.success || !response.data) {
    throw createError({
      statusCode: response.status >= 400 ? response.status : 502,
      statusMessage: response.data?.msg || 'Failed to fetch vessel data from server',
      data: response.data,
    })
  }

  const ships = response.data.allshipDataGEoJson || []
  const routes = response.data.sourceDestinationPortToPortArray || []

  const vessels: NormalizedVessel[] = ships.map((ship) => {
    const p = ship.properties
    const vesselLat = parseFloat(p.lat)
    const vesselLng = parseFloat(p.long)
    const routeObj = routes.find((r) => r.vesselId === p.vesselId)

    let routeCoords: [number, number][] = []
    let originCoords: [number, number] | null = null
    let destCoords: [number, number] | null = null

    if (routeObj) {
      const lineFeature = routeObj.portToPortGeoJson.find((f) => f.geometry.type === 'LineString')
      const srcFeature = routeObj.portToPortGeoJson.find((f) => f.properties?.isSource)
      const dstFeature = routeObj.portToPortGeoJson.find((f) => f.properties?.isDestination)

      if (lineFeature && Array.isArray(lineFeature.geometry.coordinates)) {
        // GeoJSON uses [lng, lat]. Leaflet uses [lat, lng]
        routeCoords = (lineFeature.geometry.coordinates as [number, number][]).map(([lng, lat]) => [
          lat,
          lng,
        ])
      }
      if (srcFeature && Array.isArray(srcFeature.geometry.coordinates)) {
        const [lng, lat] = srcFeature.geometry.coordinates as [number, number]
        originCoords = [lat, lng]
      }
      if (dstFeature && Array.isArray(dstFeature.geometry.coordinates)) {
        const [lng, lat] = dstFeature.geometry.coordinates as [number, number]
        destCoords = [lat, lng]
      }
    }

    // Route distance
    let totalNm = 0
    for (let i = 1; i < routeCoords.length; i++) {
      totalNm += haversineNm(
        routeCoords[i - 1][0],
        routeCoords[i - 1][1],
        routeCoords[i][0],
        routeCoords[i][1]
      )
    }

    // Progress along route
    let progress = 0
    if (routeCoords.length > 0 && totalNm > 0) {
      let minDistance = Infinity
      let bestIndex = 0
      for (let i = 0; i < routeCoords.length; i++) {
        const d = haversineNm(vesselLat, vesselLng, routeCoords[i][0], routeCoords[i][1])
        if (d < minDistance) {
          minDistance = d
          bestIndex = i
        }
      }
      let travelledNm = 0
      for (let i = 1; i <= bestIndex; i++) {
        travelledNm += haversineNm(
          routeCoords[i - 1][0],
          routeCoords[i - 1][1],
          routeCoords[i][0],
          routeCoords[i][1]
        )
      }
      progress = Math.min(100, Math.max(1, Math.round((travelledNm / totalNm) * 100)))
    } else {
      progress = p.sog > 0.5 ? 50 : 0
    }

    const isMoving = p.sog > 0.5
    const isHighWind = p.windSpeedBF >= 7

    return {
      id: `VESSEL-${p.vesselId}`,
      vesselId: p.vesselId,
      name: p.vessleName || `Vessel #${p.vesselId}`,
      sog: p.sog,
      coords: [vesselLat, vesselLng],
      routeCoords,
      originCoords,
      destCoords,
      distanceNm: Math.round(totalNm),
      progress,
      packetTs: p.packetTs,
      windSpeedBF: p.windSpeedBF,
      waveDirection: p.waveDirection,
      swellDirection: p.swellDirection,
      currentSpeed: p.currentSpeed,
      currentDirection: p.currentDirection,
      heading: `${p.latDirection || ''}${p.longDirection || ''}`.trim() || 'N',
      status: isMoving ? 'in-transit' : p.sog > 0 ? 'manoeuvring' : 'moored',
      tone: isHighWind ? 'warning' : isMoving ? 'success' : 'muted',
    }
  })

  return {
    success: true,
    tenant,
    count: vessels.length,
    vessels,
    raw: response.data,
  }
})
