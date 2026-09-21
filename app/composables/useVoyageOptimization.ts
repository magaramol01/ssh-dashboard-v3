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
    effectiveVesselId,
    selectedVessel,
    vesselsList,
    mrvData,
    windyMapData,
    isMapLoading,
    refreshAll,
    fetchVesselsList,
    fetchVoyageData,
    fetchWindyMap,
  } = useVesselDashboard()

  // 1. Parse current passage and vessel geometry
  const parsedCorridor = computed(() => parsePlannedCorridor(windyMapData.value))
  const parsedVessel = computed(() => parseVesselCurrentPosition(windyMapData.value))
  const parsedTravelled = computed(() => parseTravelledTrack(windyMapData.value))

  // Live corridor points derived from vessel voyage telemetry
  const effectiveCorridorCoords = computed<[number, number][]>(() => {
    if (parsedCorridor.value.coords && parsedCorridor.value.coords.length >= 2) {
      return parsedCorridor.value.coords
    }
    return []
  })

  // 2. Fetch real per-day CII noon report data for the active vessel, scoped
  // to the current voyage. The real voyage start date and voyage identifier
  // are resolved authoritatively from Postgres (shipping_db.std_enoonreporttable
  // via /api/vessels/current-voyage — MIN(report_date_time_utc) for the
  // latest voyage), not guessed: real noon-report data does not reliably
  // carry a Voyage_Start_Date field (observed null on live data), so a
  // date-range guess against the external CII API alone can't be trusted.
  // If that DB lookup fails, falls back to a CII_LOOKBACK_DAYS window
  // filtered by mrvData's voyage number — a documented degraded path, not
  // the primary source.
  async function fetchCiiDateRange() {
    isCiiLoading.value = true
    ciiLoadError.value = false
    try {
      let startDate: string
      let endDate: string
      let currentVoyage: string | undefined

      const voyageInfo = await $fetch<{ success: boolean; voyage: string | null; startDate: string | null; endDate: string | null }>(
        '/api/vessels/current-voyage',
        { params: { vesselId: effectiveVesselId.value } }
      ).catch(() => null)

      if (voyageInfo?.success && voyageInfo.voyage && voyageInfo.startDate && voyageInfo.endDate) {
        startDate = voyageInfo.startDate
        endDate = voyageInfo.endDate
        currentVoyage = voyageInfo.voyage
      } else {
        endDate = (mrvData.value?.rptdate || new Date().toISOString()).slice(0, 10)
        const endDt = new Date(endDate)
        startDate = new Date(endDt.getTime() - CII_LOOKBACK_DAYS * 24 * 3600 * 1000).toISOString().slice(0, 10)
        currentVoyage = mrvData.value?.voyage
      }
      const year = new Date(endDate).getUTCFullYear()

      const res = await $fetch<{ success: boolean; records: CiiDateRangeRecord[] }>(
        '/api/vessels/cii-date-range',
        { params: { vesselId: effectiveVesselId.value, startDate, endDate, year } }
      )
      const fetchedRecords = res.success ? res.records : []
      const filtered = currentVoyage
        ? fetchedRecords.filter((r) => r.voyage === currentVoyage)
        : fetchedRecords
      ciiRecords.value = filtered.length > 0
        ? filtered
        : (fetchedRecords.length > 0 ? fetchedRecords.filter((r) => r.voyage === fetchedRecords[fetchedRecords.length - 1]?.voyage) : [])
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

  // Real voyage number the Daily Noon Log is scoped to (all ciiRecords share
  // the same voyage after filtering in fetchCiiDateRange)
  const currentVoyage = computed<string | null>(() => ciiRecords.value[0]?.voyage || null)

  // 4. Compute comparative route strategies from the same deduplicated daily
  // noon data dailyNoons already derived — keeps this aggregate consistent
  // with the Daily Noon Log's day count instead of re-filtering raw records
  // independently.
  const routeStrategies = computed<RouteStrategyOption[]>(() => {
    if (dailyNoons.value.length === 0) return []

    const coords = effectiveCorridorCoords.value
    const totalDistRaw = parseFloat(String(mrvData.value?.totaldistrun || '').replace(/,/g, ''))
    const distToGoRaw = parseFloat(String(mrvData.value?.disttogo || '').replace(/,/g, ''))
    const baseDist =
      !isNaN(totalDistRaw) && !isNaN(distToGoRaw) && totalDistRaw + distToGoRaw > 500
        ? totalDistRaw + distToGoRaw
        : 5400 // Fallback only when live voyage-distance telemetry is unavailable

    const totalCiiDist = dailyNoons.value.reduce((sum, d) => sum + d.distanceRunNm, 0)
    const totalCiiFuel = dailyNoons.value.reduce((sum, d) => sum + d.fuelConsumedMt.total, 0)
    const avgSpeed =
      totalCiiDist > 0
        ? dailyNoons.value.reduce((sum, d) => sum + d.sog * d.distanceRunNm, 0) / totalCiiDist
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

  // Auto-fetch voyage fixture telemetry, map geojson, CII data, and weather
  // when the selected vessel changes.
  watch(
    () => effectiveVesselId.value,
    async (vId) => {
      if (!vId) return
      selectedDay.value = null
      // 1. Fetch voyage fixture (MRV) and map corridor/position
      await Promise.allSettled([
        fetchVoyageData(vId),
        fetchWindyMap(vId),
      ])
      // 2. Fetch CII records for the voyage and route weather
      await Promise.allSettled([
        fetchCiiDateRange(),
        fetchRouteWeather(),
      ])
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
    effectiveVesselId,
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
    currentVoyage,
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
