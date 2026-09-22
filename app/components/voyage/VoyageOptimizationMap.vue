<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import {
  Navigation,
  Anchor,
  Wind,
  Maximize2,
  CloudRain,
  Compass,
} from 'lucide-vue-next'
import { useVoyageOptimization } from '~/composables/useVoyageOptimization'
import { useTheme } from '~/composables/useTheme'
import { unwrapTrackForMap, unwrapPointForMap, type DailyNoonReport } from '~/lib/voyage-optimization'

const props = defineProps<{
  selectedDayId?: number | null
}>()

const emit = defineEmits<{
  (e: 'select-day', day: DailyNoonReport): void
}>()

const {
  effectiveCorridorCoords,
  parsedVessel,
  dailyNoons,
  routeStrategies,
  activeStrategy,
  selectedDay,
  weatherAlongRoute,
  selectDay,
  mrvData,
  currentVoyageInfo,
} = useVoyageOptimization()

const { isDark } = useTheme()

const mapContainer = ref<HTMLElement | null>(null)
let L: any = null
let mapInstance: any = null
let tileLayer: any = null
let resizeObserver: ResizeObserver | null = null

// Layer Groups
let routeLayersGroup: any = null
let noonMarkersGroup: any = null
let weatherMarkersGroup: any = null
let vesselMarkerInstance: any = null
let portMarkersGroup: any = null

const showWeatherLayer = ref(true)
const showAllCorridors = ref(true)

// Antimeridian-safe corridor: everything else plotted on the map is
// unwrapped relative to this track's origin longitude so it stays aligned
// with it even when the voyage crosses the date line.
const unwrappedCorridorCoords = computed<[number, number][]>(() =>
  unwrapTrackForMap(effectiveCorridorCoords.value)
)
const referenceLng = computed(() => unwrappedCorridorCoords.value[0]?.[1] ?? 0)

function ciiHexColor(rating: string): string {
  switch (rating) {
    case 'A': return '#10b981'
    case 'B': return '#14b8a6'
    case 'C': return '#f59e0b'
    case 'D': return '#f97316'
    case 'E': return '#ef4444'
    default: return '#64748b'
  }
}

function updateTileLayer() {
  if (!mapInstance || !L) return
  if (tileLayer) {
    mapInstance.removeLayer(tileLayer)
    tileLayer = null
  }
  const tileUrl = isDark.value
    ? 'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
    : 'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'

  tileLayer = L.tileLayer(tileUrl, {
    maxZoom: 16,
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
  }).addTo(mapInstance)
}

function fitCorridorBounds() {
  if (!mapInstance || !L) return
  let coords = unwrappedCorridorCoords.value
  if (coords.length < 2 && dailyNoons.value.length > 0) {
    coords = dailyNoons.value
      .filter((d) => d.lat != null && d.lng != null)
      .map((d) => [d.lat, d.lng] as [number, number])
  }
  if (coords.length === 0) return
  if (coords.length === 1) {
    mapInstance.setView(coords[0], 6)
    return
  }

  const bounds = L.latLngBounds(coords)
  mapInstance.fitBounds(bounds, {
    padding: [80, 80],
    maxZoom: 7,
    animate: true,
  })
}

function renderRouteCorridors() {
  if (!mapInstance || !L) return
  if (!routeLayersGroup) {
    routeLayersGroup = L.layerGroup().addTo(mapInstance)
  }
  routeLayersGroup.clearLayers()

  const coords = unwrappedCorridorCoords.value
  if (!coords || coords.length < 2) return

  const activeColor = '#3b82f6'

  // Outer glow / buffer
  L.polyline(coords, {
    color: activeColor,
    weight: 8,
    opacity: 0.2,
  }).addTo(routeLayersGroup)

  // Core nautical polyline
  L.polyline(coords, {
    color: activeColor,
    weight: 4,
    opacity: 0.95,
  }).addTo(routeLayersGroup)
}

function renderDailyNoonPins() {
  if (!mapInstance || !L) return
  if (!noonMarkersGroup) {
    noonMarkersGroup = L.layerGroup().addTo(mapInstance)
  }
  noonMarkersGroup.clearLayers()

  const noons = dailyNoons.value
  const unwrappedCoords = unwrapTrackForMap(noons.map((n) => n.coords), referenceLng.value)

  // Actual real-world track connecting each day's real noon-report position.
  // Segment-by-segment color-coded by IMO CII rating so superintendents
  // can visually identify geographical degradation zones on the world map!
  if (noons.length >= 2) {
    // Subtle glow underlay
    L.polyline(unwrappedCoords, { color: '#ffffff', weight: 6, opacity: 0.15 }).addTo(noonMarkersGroup)

    // Segmented polylines with IMO rating colors
    for (let i = 0; i < noons.length - 1; i++) {
      const p1 = unwrappedCoords[i]!
      const p2 = unwrappedCoords[i + 1]!
      const targetNoon = noons[i + 1]!
      const segmentColor = ciiHexColor(targetNoon.rating)

      L.polyline([p1, p2], {
        color: segmentColor,
        weight: 4,
        opacity: 0.95,
      }).addTo(noonMarkersGroup)
    }
  }

  for (const [index, noon] of noons.entries()) {
    const isSelected = selectedDay.value?.dayNumber === noon.dayNumber
    const color = ciiHexColor(noon.rating)

    const html = `
      <div class="cursor-pointer group relative transition-transform duration-200 ${isSelected ? 'scale-125 z-50' : 'hover:scale-115'}">
        <div class="flex items-center shadow-lg rounded-full overflow-hidden border ${isSelected ? 'border-white ring-4 ring-primary/40' : 'border-background'}">
          <span class="bg-background/95 text-foreground text-[10px] font-bold px-1.5 py-0.5 font-mono">
            D${noon.dayNumber}
          </span>
          <span style="background-color: ${color}; color: #ffffff;" class="text-[10px] font-extrabold px-1.5 py-0.5">
            ${noon.rating}
          </span>
        </div>
        <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rotate-45" style="background-color: ${color};"></div>
      </div>
    `

    const icon = L.divIcon({
      html,
      className: 'noon-marker-pin',
      iconSize: [52, 24],
      iconAnchor: [26, 24],
    })

    const marker = L.marker(unwrappedCoords[index]!, { icon })

    // Rich on-map telemetry popover anchored directly to the pin
    const popupHtml = `
      <div style="min-width: 210px; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 11px; padding: 4px;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 6px; margin-bottom: 6px;">
          <div style="font-weight: 700; display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${color};"></span>
            <span>Day ${noon.dayNumber} · ${noon.dateFormatted.slice(0, 10)}</span>
          </div>
          <span style="background: ${color}22; color: ${color}; border: 1px solid ${color}55; padding: 1px 6px; border-radius: 4px; font-weight: 800; font-family: monospace; font-size: 10px;">
            Band ${noon.rating}
          </span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; line-height: 1.4; opacity: 0.95;">
          <div>Attained CII: <b style="color:${color};">${noon.attainedCii}</b></div>
          <div>Req. Target: <b>${noon.requiredCii}</b></div>
          <div>Speed SOG: <b>${noon.sog} kts</b></div>
          <div>Prop Slip: <b>${noon.slipPct}%</b></div>
          <div>Weather: <b>BF ${noon.weather.beaufort} · ${noon.weather.waveHeightM}m</b></div>
          <div>24h Run: <b>${noon.distanceRunNm} NM</b></div>
        </div>
        <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: space-between; font-size: 10px; opacity: 0.85;">
          <span>Fuel: <b>${noon.fuelConsumedMt.total} MT</b></span>
          <span style="color: #38bdf8; font-weight: 600;">Click to inspect ↗</span>
        </div>
      </div>
    `

    marker.bindPopup(popupHtml, {
      className: 'noon-glass-popup',
      closeButton: false,
      offset: [0, -14],
    })

    marker.on('mouseover', () => marker.openPopup())
    marker.on('mouseout', () => marker.closePopup())

    marker.on('click', () => {
      selectDay(noon)
      emit('select-day', noon)
    })
    marker.addTo(noonMarkersGroup)
  }
}

function renderLiveVessel() {
  if (!mapInstance || !L) return
  if (vesselMarkerInstance) {
    mapInstance.removeLayer(vesselMarkerInstance)
    vesselMarkerInstance = null
  }

  const v = parsedVessel.value
  if (!v.isValid && !v.lat) return

  const heading = v.heading || 75
  const sog = v.sog ? `${v.sog} kts` : '13.4 kts'

  const html = `
    <div class="relative flex items-center justify-center">
      <!-- Radar Pulsing Ping -->
      <span class="absolute w-8 h-8 rounded-full bg-primary/30 animate-ping opacity-75"></span>
      <!-- Vessel Arrow Compass -->
      <div
        class="w-7 h-7 rounded-full bg-primary text-primary-foreground shadow-md flex items-center justify-center border-2 border-background transform transition-transform duration-500"
        style="transform: rotate(${heading}deg);"
      >
        <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
          <polygon points="12,2 20,20 12,16 4,20" />
        </svg>
      </div>
      <!-- SOG Label Pill -->
      <div class="absolute -top-5 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur-xs text-foreground text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs border border-border whitespace-nowrap font-mono">
        ${sog}
      </div>
    </div>
  `

  const icon = L.divIcon({
    html,
    className: 'vessel-live-pin',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })

  vesselMarkerInstance = L.marker(unwrapPointForMap([v.lat, v.lng], referenceLng.value), { icon, zIndexOffset: 1000 }).addTo(mapInstance)
}

function renderPortMarkers() {
  if (!mapInstance || !L) return
  if (!portMarkersGroup) {
    portMarkersGroup = L.layerGroup().addTo(mapInstance)
  }
  portMarkersGroup.clearLayers()

  const coords = unwrappedCorridorCoords.value
  if (coords.length < 2) return

  const originPt = coords[0]!
  const destPt = coords[coords.length - 1]!

  const makePortIcon = (code: string, isDest: boolean) => {
    const html = `
      <div class="flex items-center gap-1 bg-background/95 text-foreground border border-border px-2 py-0.5 rounded-md shadow-md text-[10px] font-bold">
        <span class="${isDest ? 'text-emerald-500' : 'text-blue-500'}">⚓</span>
        <span>${code}</span>
      </div>
    `
    return L.divIcon({
      html,
      className: 'port-pin',
      iconSize: [60, 20],
      iconAnchor: [30, 10],
    })
  }

  const srcCode = currentVoyageInfo.value?.startPort || mrvData.value?.scr || 'DEP'
  const dstCode = currentVoyageInfo.value?.destinationPort || mrvData.value?.destination || 'ARR'

  L.marker(originPt, { icon: makePortIcon(srcCode, false) }).addTo(portMarkersGroup)
  L.marker(destPt, { icon: makePortIcon(dstCode, true) }).addTo(portMarkersGroup)
}

function renderWeatherNodes() {
  if (!mapInstance || !L) return
  if (!weatherMarkersGroup) {
    weatherMarkersGroup = L.layerGroup().addTo(mapInstance)
  }
  weatherMarkersGroup.clearLayers()

  if (!showWeatherLayer.value) return

  for (const w of weatherAlongRoute.value) {
    const html = `
      <div class="flex items-center gap-1 bg-background/90 text-foreground border border-border/80 px-1.5 py-0.5 rounded-full shadow-xs text-[9px] backdrop-blur-xs">
        <span class="text-cyan-500 font-bold">BF ${w.beaufort}</span>
        <span class="text-muted-foreground">|</span>
        <span class="font-medium">${w.waveHeightM}m</span>
      </div>
    `

    const icon = L.divIcon({
      html,
      className: 'weather-pin',
      iconSize: [65, 18],
      iconAnchor: [32, 9],
    })

    L.marker(unwrapPointForMap([w.lat, w.lng], referenceLng.value), { icon, opacity: 0.9 }).addTo(weatherMarkersGroup)
  }
}

function refreshAllLayers() {
  renderRouteCorridors()
  renderDailyNoonPins()
  renderLiveVessel()
  renderPortMarkers()
  renderWeatherNodes()
}

onMounted(async () => {
  if (!mapContainer.value) return

  // Dynamically import Leaflet in client environment
  L = await import('leaflet')
  await import('leaflet/dist/leaflet.css')

  mapInstance = L.map(mapContainer.value, {
    zoomControl: false,
    attributionControl: false,
    worldCopyJump: true,
  }).setView([-5, -120], 3)

  L.control.zoom({ position: 'bottomright' }).addTo(mapInstance)

  updateTileLayer()
  refreshAllLayers()
  fitCorridorBounds()

  resizeObserver = new ResizeObserver(() => {
    mapInstance?.invalidateSize()
  })
  resizeObserver.observe(mapContainer.value)
})

onBeforeUnmount(() => {
  if (resizeObserver && mapContainer.value) {
    resizeObserver.unobserve(mapContainer.value)
    resizeObserver.disconnect()
  }
  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
  }
})

// Reactivity watchers
watch(isDark, () => updateTileLayer())
watch([effectiveCorridorCoords], () => {
  renderRouteCorridors()
  renderPortMarkers()
  fitCorridorBounds()
})
watch([mrvData, currentVoyageInfo], () => renderPortMarkers())
watch([dailyNoons, selectedDay], () => {
  renderDailyNoonPins()
  if (dailyNoons.value.length) {
    fitCorridorBounds()
  }
})
watch(parsedVessel, () => renderLiveVessel())
watch([weatherAlongRoute, showWeatherLayer], () => renderWeatherNodes())
</script>

<template>
  <div class="relative w-full h-full min-h-[500px] lg:min-h-[640px] flex-1 overflow-hidden bg-muted/20">
    <!-- Leaflet Map Mount Point -->
    <div ref="mapContainer" class="w-full h-full z-0" />

    <!-- Floating Map Controls (Top Left & Bottom Left) -->
    <div class="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-auto">
      <!-- Quick Action Pill Group -->
      <div class="flex items-center gap-1.5 p-1 bg-background/90 backdrop-blur-md border border-border/80 rounded-lg shadow-sm">
        <button
          type="button"
          class="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Fit Corridor Bounds"
          @click="fitCorridorBounds"
        >
          <Maximize2 class="w-4 h-4" />
        </button>

        <button
          type="button"
          class="p-1.5 rounded-md transition-colors text-xs flex items-center gap-1 font-medium"
          :class="showWeatherLayer ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400' : 'text-muted-foreground hover:text-foreground hover:bg-muted'"
          title="Toggle Weather Radar"
          @click="showWeatherLayer = !showWeatherLayer"
        >
          <CloudRain class="w-4 h-4" />
          <span class="hidden sm:inline">Weather</span>
        </button>
      </div>
    </div>

    <!-- Floating Map Legend (Bottom Left) -->
    <div class="absolute bottom-4 left-4 z-10 hidden sm:flex items-center gap-3 px-3 py-1.5 bg-background/85 backdrop-blur-md border border-border/70 rounded-lg shadow-xs text-[11px] pointer-events-auto">
      <span class="font-medium text-muted-foreground">Legend:</span>
      <div class="flex items-center gap-1">
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
        <span>A / B Compliant</span>
      </div>
      <div class="flex items-center gap-1">
        <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
        <span>C Target</span>
      </div>
      <div class="flex items-center gap-1">
        <span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
        <span>D / E Warning</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
:deep(.leaflet-pane) {
  z-index: 10;
}
:deep(.leaflet-top),
:deep(.leaflet-bottom) {
  z-index: 20;
}
</style>
