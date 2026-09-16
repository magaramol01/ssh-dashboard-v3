import { ref, computed, watch, shallowRef } from 'vue'
import { useVesselDashboard } from '~/composables/useVesselDashboard'
import {
  computeDailyNoonProgression,
  calculateRouteStrategies,
  deriveVoyageAdvisories,
  haversineNm,
  type DailyNoonReport,
  type RouteStrategyOption,
  type VoyageAdvisory,
  type CIIRating,
} from '~/lib/voyage-optimization'
import {
  parsePlannedCorridor,
  parseVesselCurrentPosition,
  parseTravelledTrack,
  resolvePortCoordinates,
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

export function useVoyageOptimization() {
  const {
    selectedVesselId,
    selectedVessel,
    vesselsList,
    mrvData,
    windyMapData,
    isMapLoading,
    refreshAll,
  } = useVesselDashboard()

  // 1. Parse current passage and vessel geometry
  const parsedCorridor = computed(() => parsePlannedCorridor(windyMapData.value))
  const parsedVessel = computed(() => parseVesselCurrentPosition(windyMapData.value))
  const parsedTravelled = computed(() => parseTravelledTrack(windyMapData.value))

  // Fallback corridor points if API is still loading or sparse
  const effectiveCorridorCoords = computed<[number, number][]>(() => {
    if (parsedCorridor.value.coords && parsedCorridor.value.coords.length >= 2) {
      return parsedCorridor.value.coords
    }
    // High-fidelity fallback corridor (Pacific crossing: Callao -> Ningde)
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

  // 2. Compute 24-hour Daily Noon Reports along traveled track
  const dailyNoons = computed<DailyNoonReport[]>(() => {
    const coords = effectiveCorridorCoords.value
    const depTime = mrvData.value?.rptdate || '2026-09-10T12:00:00Z'
    const dwt = 75000 // Standard Panamax / Ultramax bulk deadweight
    const speed = parsedVessel.value.sog > 5 ? parsedVessel.value.sog : 13.5
    return computeDailyNoonProgression(coords, dwt, depTime, speed)
  })

  // 3. Compute comparative route strategies (Current, Lowest-Fuel, Safest, Fastest)
  const routeStrategies = computed<RouteStrategyOption[]>(() => {
    const coords = effectiveCorridorCoords.value
    const totalDistRaw = parseFloat(String(mrvData.value?.totaldistrun || '').replace(/,/g, ''))
    const distToGoRaw = parseFloat(String(mrvData.value?.disttogo || '').replace(/,/g, ''))
    const baseDist = !isNaN(totalDistRaw) && !isNaN(distToGoRaw) && totalDistRaw + distToGoRaw > 500
      ? totalDistRaw + distToGoRaw
      : 5400

    const speed = parsedVessel.value.sog > 5 ? parsedVessel.value.sog : 13.5
    const baseFuel = Math.round((baseDist / (speed * 24)) * 26.5) // ~26.5 MT/day baseline
    const dwt = 75000

    return calculateRouteStrategies(baseDist, baseFuel, speed, dwt, coords)
  })

  const activeStrategyOption = computed<RouteStrategyOption>(() => {
    return (
      routeStrategies.value.find((s) => s.id === activeStrategy.value) ||
      routeStrategies.value[0]!
    )
  })

  // 4. Update advisories reactively when vessel or noons change
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

  // 5. Compute Advisory KPI Summary HUD
  const kpiSummary = computed<VoyageOptimizationKpiSummary>(() => {
    const latestNoon = dailyNoons.value[dailyNoons.value.length - 1]
    const currentCii = latestNoon?.attainedCii || 4.28
    const currentRating = latestNoon?.rating || 'C'
    const requiredCii = 3.92 // IMO Required boundary for Band B
    const marginPct = Math.round(((requiredCii - currentCii) / requiredCii) * 1000) / 10

    const activeOpt = activeStrategyOption.value
    const isEco = activeStrategy.value === 'lowest-fuel'
    const speedDelta = isEco ? 1.2 : 0
    const recSpeed = Math.round((activeOpt.avgSpeedKts) * 10) / 10
    const fuelSavings = isEco ? 4.8 : 0

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
      laycanBufferHours: 8.5,
      carbonSavingsEur: activeOpt.carbonSavingsEur > 0 ? activeOpt.carbonSavingsEur : 0,
      projectedVoyageFuelMt: activeOpt.totalFuelMt,
    }
  })

  // 6. Fetch live meteorological forecast along passage
  async function fetchRouteWeather() {
    if (isWeatherLoading.value) return
    isWeatherLoading.value = true
    try {
      const coords = effectiveCorridorCoords.value
      // Sample 3 strategic points: origin/past, current vessel, ahead waypoint
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

  // Auto-fetch weather when vessel or corridor changes
  watch(
    () => selectedVesselId.value,
    () => {
      selectedDay.value = null
      fetchRouteWeather()
    },
    { immediate: true }
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
    refreshAll,
  }
}
