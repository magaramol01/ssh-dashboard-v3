import { defineEventHandler, getCookie, getHeader, getQuery, createError } from 'h3'
import { getAllVesselsGeoJsonData, type VesselsGeoJsonResponse } from '../../utils/http-adapter'

export interface WeatherDetail {
  beaufort: number
  windDescription: string
  windSpeedKts: string
  waveHeightM: string
  seaState: string
  seaCondition: 'calm' | 'moderate' | 'rough' | 'gale'
  impactText: string
  waveDirection: string
  swellDirection: string
  currentSpeed: string
  currentDirection: string
}

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
  travelledNm: number
  remainingNm: number
  progress: number
  packetTs: string
  windSpeedBF: number
  waveDirection: string
  swellDirection: string
  currentSpeed: string
  currentDirection: string
  heading: string
  vesselHeading?: number
  weather: WeatherDetail
  status: 'in-transit' | 'manoeuvring' | 'moored'
  scheduleStatus: 'on-time' | 'late' | 'early' | 'moored'
  varianceHours: number
  etaHours: number
  etaIso: string
  etaFormatted: string
  tone: 'success' | 'warning' | 'info' | 'muted' | 'destructive'
}

function resolveWeatherInfo(p: any): WeatherDetail {
  const bf = typeof p.windSpeedBF === 'number' ? p.windSpeedBF : parseInt(p.windSpeedBF || '0', 10) || 0

  let windDescription = 'Calm'
  let windSpeedKts = '< 1 kts'
  let waveHeightM = '0 m (0 ft)'
  let seaState = 'Calm (Glassy)'
  let seaCondition: 'calm' | 'moderate' | 'rough' | 'gale' = 'calm'
  let impactText = 'Optimal transit conditions · Nominal resistance'

  if (bf === 1) {
    windDescription = 'Light Air'
    windSpeedKts = '1 – 3 kts'
    waveHeightM = '0.1 m (< 0.5 ft)'
    seaState = 'Rippled Sea'
    seaCondition = 'calm'
    impactText = 'Smooth surface · Favorable navigation'
  } else if (bf === 2) {
    windDescription = 'Light Breeze'
    windSpeedKts = '4 – 6 kts'
    waveHeightM = '0.2 – 0.3 m (1 ft)'
    seaState = 'Smooth Wavelets'
    seaCondition = 'calm'
    impactText = 'Gentle ripples · Nominal fuel efficiency'
  } else if (bf === 3) {
    windDescription = 'Gentle Breeze'
    windSpeedKts = '7 – 10 kts'
    waveHeightM = '0.6 – 1.0 m (2 – 3 ft)'
    seaState = 'Slight Sea'
    seaCondition = 'calm'
    impactText = 'Favorable passage · Negligible weather delay'
  } else if (bf === 4) {
    windDescription = 'Moderate Breeze'
    windSpeedKts = '11 – 16 kts'
    waveHeightM = '1.0 – 1.5 m (3.5 – 5 ft)'
    seaState = 'Moderate Sea'
    seaCondition = 'moderate'
    impactText = 'Fair conditions · Minor pitching & whitecaps'
  } else if (bf === 5) {
    windDescription = 'Fresh Breeze'
    windSpeedKts = '17 – 21 kts'
    waveHeightM = '2.0 – 2.5 m (6 – 8 ft)'
    seaState = 'Moderate to Rough'
    seaCondition = 'moderate'
    impactText = 'Moderate rolling · Minor speed loss observed'
  } else if (bf === 6) {
    windDescription = 'Strong Breeze'
    windSpeedKts = '22 – 27 kts'
    waveHeightM = '3.0 – 4.0 m (10 – 13 ft)'
    seaState = 'Rough Sea'
    seaCondition = 'rough'
    impactText = 'Adverse sea state · Leeway drift & engine load increased'
  } else if (bf === 7) {
    windDescription = 'Near Gale'
    windSpeedKts = '28 – 33 kts'
    waveHeightM = '4.0 – 5.5 m (13 – 18 ft)'
    seaState = 'Very Rough / High'
    seaCondition = 'gale'
    impactText = 'Heavy weather alert · Speed reduction & spray over deck'
  } else if (bf === 8) {
    windDescription = 'Gale'
    windSpeedKts = '34 – 40 kts'
    waveHeightM = '5.5 – 7.5 m (18 – 25 ft)'
    seaState = 'High Sea'
    seaCondition = 'gale'
    impactText = 'Gale warning · Significant transit delays anticipated'
  } else if (bf >= 9) {
    windDescription = 'Severe Gale / Storm'
    windSpeedKts = '41+ kts'
    waveHeightM = '7.5+ m (25+ ft)'
    seaState = 'Heavy to Phenomenal'
    seaCondition = 'gale'
    impactText = 'Severe storm hazard · Heading deviation advised'
  }

  const waveDirection = p.waveDirection && p.waveDirection !== 'NA' ? p.waveDirection : 'Fair'
  const swellDirection = p.swellDirection && p.swellDirection !== 'NA' ? p.swellDirection : 'Nominal'
  const currentSpeed = p.currentSpeed && p.currentSpeed !== 'NA' ? p.currentSpeed : 'Normal'
  const currentDirection = p.currentDirection && p.currentDirection !== 'NA' ? p.currentDirection : 'Normal'

  return {
    beaufort: bf,
    windDescription,
    windSpeedKts,
    waveHeightM,
    seaState,
    seaCondition,
    impactText,
    waveDirection,
    swellDirection,
    currentSpeed,
    currentDirection,
  }
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
  const PLANNED_SPEED_KTS = 13.5 // Baseline charter speed

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
    let travelledNm = 0
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

    const remainingNm = Math.max(0, totalNm - travelledNm)
    const isMoving = p.sog > 0.5
    const isHighWind = p.windSpeedBF >= 7

    // Schedule and ETA calculations
    let scheduleStatus: 'on-time' | 'late' | 'early' | 'moored' = 'on-time'
    let varianceHours = 0
    let etaHours = 0

    if (p.sog <= 0.5) {
      if (remainingNm <= 30 || progress >= 95) {
        scheduleStatus = 'moored'
      } else {
        scheduleStatus = 'late'
        varianceHours = 24
      }
    } else {
      etaHours = remainingNm / p.sog
      const plannedHours = remainingNm / PLANNED_SPEED_KTS
      varianceHours = etaHours - plannedHours

      if (varianceHours > 3) {
        scheduleStatus = 'late'
      } else if (varianceHours < -3) {
        scheduleStatus = 'early'
      } else {
        scheduleStatus = 'on-time'
      }
    }

    const etaTimestamp = Date.now() + etaHours * 3600 * 1000
    const etaDate = new Date(etaTimestamp)
    const etaFormatted =
      scheduleStatus === 'moored'
        ? 'In port'
        : etaDate.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'UTC',
          }) + ' UTC'

    // Determine visual tone
    let tone: 'success' | 'warning' | 'info' | 'muted' | 'destructive' = 'success'
    if (scheduleStatus === 'moored') {
      tone = 'muted'
    } else if (isHighWind || varianceHours > 12) {
      tone = 'destructive'
    } else if (scheduleStatus === 'late') {
      tone = 'warning'
    } else if (scheduleStatus === 'early') {
      tone = 'info'
    } else {
      tone = 'success'
    }

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
      travelledNm: Math.round(travelledNm),
      remainingNm: Math.round(remainingNm),
      progress,
      packetTs: p.packetTs,
      windSpeedBF: p.windSpeedBF,
      waveDirection: p.waveDirection,
      swellDirection: p.swellDirection,
      currentSpeed: p.currentSpeed,
      currentDirection: p.currentDirection,
      heading: `${p.latDirection || ''}${p.longDirection || ''}`.trim() || 'N',
      vesselHeading: typeof p.vesselHeading === 'number' ? p.vesselHeading : undefined,
      weather: resolveWeatherInfo(p),
      status: isMoving ? 'in-transit' : p.sog > 0 ? 'manoeuvring' : 'moored',
      scheduleStatus,
      varianceHours: Math.round(varianceHours * 10) / 10,
      etaHours: Math.round(etaHours * 10) / 10,
      etaIso: etaDate.toISOString(),
      etaFormatted,
      tone,
    }
  })

  const scheduleMetrics = {
    total: vessels.length,
    onTime: vessels.filter((v) => v.scheduleStatus === 'on-time').length,
    late: vessels.filter((v) => v.scheduleStatus === 'late').length,
    early: vessels.filter((v) => v.scheduleStatus === 'early').length,
    moored: vessels.filter((v) => v.scheduleStatus === 'moored').length,
  }

  return {
    success: true,
    tenant,
    count: vessels.length,
    scheduleMetrics,
    vessels,
    raw: response.data,
  }
})
