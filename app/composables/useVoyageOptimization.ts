import { ref, computed, watch, shallowRef } from 'vue'
import { useVesselDashboard } from '~/composables/useVesselDashboard'
import {
  mapCiiRecordsToDailyNoons,
  calculateRouteStrategies,
  deriveVoyageAdvisories,
  resolveVesselDeadweightMt,
  EU_ETS_CARBON_PRICE_EUR_PER_TON,
  DEFAULT_LAYCAN_BUFFER_HOURS,
  CII_LOOKBACK_DAYS,
  type DailyNoonReport,
  type RouteStrategyOption,
  type VoyageAdvisory,
  type CIIRating,
  type CiiDateRangeRecord,
} from '~/lib/voyage-optimization'
import {
  parsePlannedCorridor,
  parseVesselCurrentPosition,
  parseTravelledTrack,
} from '~/lib/vessel-voyage'
import type { MarineWeatherForecast } from '~~/server/utils/weather-adapter'

export interface VoyageOptimizationKpiSummary {
  attainedCii: number
  attainedRating: CIIRating
  requiredCii: number
  targetRating: CIIRating
  ciiMarginPct: number
  recommendedSpeedKts: number
  speedDeltaKts: number
  dailyFuelSavingsMt: number
  weatherAlertHeadline: string
  weatherAlertSubtext: string
  weatherRiskLevel: 'low' | 'moderate' | 'high'
  laycanBufferHours: number
  carbonSavingsEur: number
  projectedVoyageFuelMt: number
}

// Module-level persistent state across screen transitions
const activeStrategy = ref<'current' | 'lowest-fuel' | 'safest' | 'fastest'>('current')
const selectedDay = ref<DailyNoonReport | null>(null)
const advisoriesList = ref<VoyageAdvisory[]>([])
const weatherAlongRoute = shallowRef<MarineWeatherForecast[]>([])
const isWeatherLoading = ref(false)
const ciiRecords = shallowRef<CiiDateRangeRecord[]>([])
const isCiiLoading = ref(false)
const ciiLoadError = ref(false)

export function useVoyageOptimization() {
  const {
    selectedVesselId,
    selectedVessel,
    vesselsList,
    mrvData,
    windyMapData,
    isMapLoading,
    refreshAll,
    fetchVesselsList,
  } = useVesselDashboard()

  // 1. Parse current passage and vessel geometry
  const parsedCorridor = computed(() => parsePlannedCorridor(windyMapData.value))
  const parsedVessel = computed(() => parseVesselCurrentPosition(windyMapData.value))
  const parsedTravelled = computed(() => parseTravelledTrack(windyMapData.value))

  // Fallback corridor points if API is still loading or sparse
  // (unrelated to CII data — this drives the live map's polyline, not the KPI/log numbers)
  const effectiveCorridorCoords = computed<[number, number][]>(() => {
    if (parsedCorridor.value.coords && parsedCorridor.value.coords.length >= 2) {
      return parsedCorridor.value.coords
    }
    return [
      [-12.05, -77.15],
      [-8.2, -85.4],
      [-3.5, -95.0],
      [2.1, -110.5],
      [8.4, -130.0],
      [15.2, -150.0],
      [20.5, -170.0],
      [24.0, 170.0],
      [25.5, 145.0],
      [26.66, 119.52],
    ]
  })

  // 2. Fetch real per-day CII noon report data for the active vessel, scoped
  // to the current voyage. Real noon-report data does not reliably carry a
  // Voyage_Start_Date (observed null on live data), so the fetch window is
  // widened to CII_LOOKBACK_DAYS and the results are filtered down to
  // records matching the vessel's current voyage number (from mrvData) —
  // Day 1 ends up being the earliest real noon report of that voyage.
  async function fetchCiiDateRange() {
    isCiiLoading.value = true
    ciiLoadError.value = false
    try {
      const endDate = (mrvData.value?.rptdate || new Date().toISOString()).slice(0, 10)
      const endDt = new Date(endDate)
      const startDt = new Date(endDt.getTime() - CII_LOOKBACK_DAYS * 24 * 3600 * 1000)
      const startDate = startDt.toISOString().slice(0, 10)
      const year = endDt.getUTCFullYear()

      const res = await $fetch<{ success: boolean; records: CiiDateRangeRecord[] }>(
        '/api/vessels/cii-date-range',
        { params: { vesselId: selectedVesselId.value, startDate, endDate, year } }
      )
      const fetchedRecords = res.success ? res.records : []
      const currentVoyage = mrvData.value?.voyage
      ciiRecords.value = currentVoyage
        ? fetchedRecords.filter((r) => r.voyage === currentVoyage)
        : fetchedRecords
      ciiLoadError.value = !res.success
    } catch {
      ciiRecords.value = []
      ciiLoadError.value = true
    } finally {
      isCiiLoading.value = false
    }
  }

  // 3. Map real CII records into Daily Noon Reports — no synthetic data
  const dailyNoons = computed<DailyNoonReport[]>(() => mapCiiRecordsToDailyNoons(ciiRecords.value))

  // 4. Compute comparative route strategies from real voyage/CII aggregates
  const routeStrategies = computed<RouteStrategyOption[]>(() => {
    if (ciiRecords.value.length === 0) return []

    const coords = effectiveCorridorCoords.value
    const totalDistRaw = parseFloat(String(mrvData.value?.totaldistrun || '').replace(/,/g, ''))
    const distToGoRaw = parseFloat(String(mrvData.value?.disttogo || '').replace(/,/g, ''))
    const baseDist =
      !isNaN(totalDistRaw) && !isNaN(distToGoRaw) && totalDistRaw + distToGoRaw > 500
        ? totalDistRaw + distToGoRaw
        : 5400 // Fallback only when live voyage-distance telemetry is unavailable

    // Only real noon/position reports (not zero-distance event markers) count toward these aggregates
    const noonRecords = ciiRecords.value.filter((r) => (r.distance || 0) > 0)
    const totalCiiDist = noonRecords.reduce((sum, r) => sum + (r.distance || 0), 0)
    const totalCiiFuel = noonRecords.reduce((sum, r) => sum + (r.totalConsumption || 0), 0)
    const avgSpeed =
      totalCiiDist > 0
        ? noonRecords.reduce((sum, r) => sum + (Number(r.avgSpeed) || 0) * (r.distance || 0), 0) / totalCiiDist
        : parsedVessel.value.sog || 13.5

    // Real fuel-burn rate (MT/NM) from the fetched noon-report window, scaled to the full voyage distance
    const fuelBurnRateMtPerNm = totalCiiDist > 0 ? totalCiiFuel / totalCiiDist : 0
    const baseFuel = Math.round(fuelBurnRateMtPerNm * baseDist * 10) / 10
    const dwt = resolveVesselDeadweightMt(ciiRecords.value)

    return calculateRouteStrategies(baseDist, baseFuel, avgSpeed, dwt, coords)
  })

  const activeStrategyOption = computed<RouteStrategyOption | null>(() => {
    if (routeStrategies.value.length === 0) return null
    return routeStrategies.value.find((s) => s.id === activeStrategy.value) || routeStrategies.value[0]!
  })

  // 5. Update advisories reactively when vessel or noons change
  watch(
    [dailyNoons, activeStrategy],
    () => {
      const latestNoon = dailyNoons.value[dailyNoons.value.length - 1]
      const currentRating = latestNoon?.rating || 'C'
      const weatherAhead = {
        beaufort: latestNoon?.weather.beaufort || 4,
        waveHeightM: latestNoon?.weather.waveHeightM || 1.8,
      }
      advisoriesList.value = deriveVoyageAdvisories(currentRating, 'B', weatherAhead, 1.2)
    },
    { immediate: true }
  )

  // 6. Compute Advisory KPI Summary HUD
  const kpiSummary = computed<VoyageOptimizationKpiSummary>(() => {
    const latestNoon = dailyNoons.value[dailyNoons.value.length - 1]
    const activeOpt = activeStrategyOption.value
    const currentOpt = routeStrategies.value.find((s) => s.id === 'current')
    const isEco = activeStrategy.value === 'lowest-fuel'

    const currentCii = latestNoon?.attainedCii ?? 0
    const currentRating = latestNoon?.rating ?? 'C'
    const requiredCii = latestNoon?.requiredCii || 0
    const marginPct = requiredCii > 0 ? Math.round(((requiredCii - currentCii) / requiredCii) * 1000) / 10 : 0

    const recSpeed = Math.round((activeOpt?.avgSpeedKts || 0) * 10) / 10
    const speedDelta =
      isEco && activeOpt && currentOpt ? Math.round((currentOpt.avgSpeedKts - activeOpt.avgSpeedKts) * 10) / 10 : 0
    const fuelSavings = isEco && activeOpt ? activeOpt.fuelSavingsMt : 0

    const weatherLevel: 'low' | 'moderate' | 'high' =
      (latestNoon?.weather.beaufort || 3) >= 6 ? 'high' : (latestNoon?.weather.beaufort || 3) >= 5 ? 'moderate' : 'low'

    return {
      attainedCii: currentCii,
      attainedRating: currentRating,
      requiredCii,
      targetRating: 'B',
      ciiMarginPct: marginPct,
      recommendedSpeedKts: recSpeed,
      speedDeltaKts: speedDelta,
      dailyFuelSavingsMt: fuelSavings,
      weatherAlertHeadline:
        weatherLevel === 'high'
          ? `Adverse swell ${latestNoon?.weather.waveHeightM}m ahead`
          : weatherLevel === 'moderate'
          ? `Moderate winds BF ${latestNoon?.weather.beaufort}`
          : 'Favorable passage weather',
      weatherAlertSubtext: latestNoon?.weather.shortForecast || 'Nominal resistance',
      weatherRiskLevel: weatherLevel,
      laycanBufferHours: DEFAULT_LAYCAN_BUFFER_HOURS,
      carbonSavingsEur: activeOpt && activeOpt.carbonSavingsEur > 0 ? activeOpt.carbonSavingsEur : 0,
      projectedVoyageFuelMt: activeOpt?.totalFuelMt || 0,
    }
  })

  // 7. Fetch live meteorological forecast along passage
  async function fetchRouteWeather() {
    if (isWeatherLoading.value) return
    isWeatherLoading.value = true
    try {
      const coords = effectiveCorridorCoords.value
      const pointsToSample: [number, number][] = []
      if (coords.length > 0) pointsToSample.push(coords[0]!)
      if (parsedVessel.value.isValid) pointsToSample.push([parsedVessel.value.lat, parsedVessel.value.lng])
      if (coords.length > 3) pointsToSample.push(coords[Math.floor(coords.length * 0.65)]!)
      if (coords.length > 1) pointsToSample.push(coords[coords.length - 1]!)

      const results = await Promise.allSettled(
        pointsToSample.map((pt) =>
          $fetch<{ success: boolean; data: MarineWeatherForecast }>('/api/weather/forecast', {
            params: { lat: pt[0], lng: pt[1] },
          }).then((res) => res.data)
        )
      )

      const weatherList: MarineWeatherForecast[] = []
      for (const res of results) {
        if (res.status === 'fulfilled' && res.value) {
          weatherList.push(res.value)
        }
      }
      weatherAlongRoute.value = weatherList
    } catch {
      // Fallback already guaranteed by server endpoint
    } finally {
      isWeatherLoading.value = false
    }
  }

  function setStrategy(strategy: 'current' | 'lowest-fuel' | 'safest' | 'fastest') {
    activeStrategy.value = strategy
  }

  function selectDay(day: DailyNoonReport | null) {
    selectedDay.value = day
  }

  function applyAdvisory(id: string) {
    const found = advisoriesList.value.find((a) => a.id === id)
    if (found) {
      found.applied = true
      if (found.type === 'speed') {
        activeStrategy.value = 'lowest-fuel'
      }
    }
  }

  // Auto-fetch CII data and weather when vessel changes
  watch(
    () => selectedVesselId.value,
    () => {
      selectedDay.value = null
      fetchCiiDateRange()
      fetchRouteWeather()
    },
    { immediate: true }
  )

  // Re-fetch CII once the current voyage number becomes known, in case the
  // first fetch above raced ahead of mrvData and could not filter by voyage.
  watch(
    () => mrvData.value?.voyage,
    (voyage, prevVoyage) => {
      if (voyage && voyage !== prevVoyage) {
        fetchCiiDateRange()
      }
    }
  )

  return {
    selectedVesselId,
    selectedVessel,
    vessels: vesselsList,
    vesselsList,
    mrvData,
    windyMapData,
    isMapLoading,
    parsedCorridor,
    parsedVessel,
    parsedTravelled,
    effectiveCorridorCoords,
    dailyNoons,
    isCiiLoading,
    ciiLoadError,
    routeStrategies,
    activeStrategy,
    activeStrategyOption,
    selectedDay,
    advisories: advisoriesList,
    kpiSummary,
    weatherAlongRoute,
    isWeatherLoading,
    setStrategy,
    selectDay,
    applyAdvisory,
    fetchRouteWeather,
    fetchCiiDateRange,
    fetchVesselsList,
    refreshAll,
  }
}
