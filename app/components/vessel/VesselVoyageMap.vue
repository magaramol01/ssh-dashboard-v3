<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { Skeleton } from '@/components/ui/skeleton'
import { useVesselDashboard } from '~/composables/useVesselDashboard'
import { useTheme } from '~/composables/useTheme'

const { mrvData, windyMapData, selectedVessel, isMapLoading } = useVesselDashboard()
const { isDark } = useTheme()

const mapContainer = ref<HTMLElement | null>(null)
let L: any = null
let mapInstance: any = null
let tileLayer: any = null
let routePolyline: any = null
let remainingPolyline: any = null
let vesselMarker: any = null
let sourceMarker: any = null
let destMarker: any = null

function formatEta(rawEta?: string) {
  if (!rawEta) return '2026-09-18 11:00'
  try {
    const d = new Date(rawEta)
    if (isNaN(d.getTime())) return rawEta
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return rawEta
  }
}

const mrvInfo = computed(() => {
  return {
    vesselName: mrvData.value?.vessel || selectedVessel.value?.name || 'ALS Kronos',
    voyageNo: mrvData.value?.voyage || '635N',
    sourcePort: mrvData.value?.scr || 'AUBNE',
    destPort: mrvData.value?.destination || 'CNTAO',
    eta: formatEta(mrvData.value?.etanextport),
    distTR: mrvData.value?.totaldistrun || '403',
    distDTG: mrvData.value?.disttogo || '4063',
    timezone: mrvData.value?.timezone || '+0000',
  }
})

function updateTileLayer() {
  if (!mapInstance || !L) return
  if (tileLayer) {
    mapInstance.removeLayer(tileLayer)
  }
  // High contrast voyager tiles or dark matter
  const tileUrl = isDark.value
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'

  tileLayer = L.tileLayer(tileUrl, {
    maxZoom: 18,
    attribution: '&copy; CartoDB, OpenStreetMap contributors',
  }).addTo(mapInstance)
}

function renderMapLayers() {
  if (!mapInstance || !L) return

  // Clean previous layers
  if (routePolyline) {
    mapInstance.removeLayer(routePolyline)
    routePolyline = null
  }
  if (remainingPolyline) {
    mapInstance.removeLayer(remainingPolyline)
    remainingPolyline = null
  }
  if (vesselMarker) {
    mapInstance.removeLayer(vesselMarker)
    vesselMarker = null
  }
  if (sourceMarker) {
    mapInstance.removeLayer(sourceMarker)
    sourceMarker = null
  }
  if (destMarker) {
    mapInstance.removeLayer(destMarker)
    destMarker = null
  }

  const rawData = windyMapData.value
  let currentPos: [number, number] = [-27.47, 153.02] // Default Brisbane or live
  let heading = 135
  const sailedRoute: [number, number][] = []

  // Extract sailed route coordinates
  if (rawData?.portToPortGeo?.[0]?.geometry?.coordinates) {
    const coords = rawData.portToPortGeo[0].geometry.coordinates
    for (const c of coords) {
      if (Array.isArray(c) && c.length >= 2) {
        sailedRoute.push([c[1], c[0]])
      }
    }
  }

  // Extract current vessel position from windyMapGEoJson
  if (rawData?.windyMapGEoJson?.data?.length) {
    const latest = rawData.windyMapGEoJson.data[0]
    if (latest?.geometry?.coordinates) {
      currentPos = [latest.geometry.coordinates[1], latest.geometry.coordinates[0]]
    }
    if (latest?.properties?.vesselHeading) {
      heading = Number(latest.properties.vesselHeading) || 135
    }
  } else if (sailedRoute.length > 0) {
    currentPos = sailedRoute[sailedRoute.length - 1]
  }

  // Draw vibrant sailed path (crimson/red line)
  if (sailedRoute.length > 0) {
    routePolyline = L.polyline(sailedRoute, {
      color: '#e53935',
      weight: 3.5,
      opacity: 0.95,
      lineCap: 'round',
    }).addTo(mapInstance)
  }

  // Source pin (Origin)
  let sPos: [number, number] | null = null
  if (rawData?.sourceLatLong?.length === 2) {
    const sLat = parseFloat(rawData.sourceLatLong[0])
    const sLng = parseFloat(rawData.sourceLatLong[1])
    if (!isNaN(sLat) && !isNaN(sLng)) {
      sPos = [sLat, sLng]
    }
  } else if (sailedRoute.length > 0) {
    sPos = sailedRoute[0]
  }

  if (sPos) {
    sourceMarker = L.circleMarker(sPos, {
      radius: 6,
      fillColor: '#10b981',
      color: '#ffffff',
      weight: 2,
      fillOpacity: 1,
    }).addTo(mapInstance).bindTooltip(mrvInfo.value.sourcePort, { permanent: true, direction: 'left', className: 'port-tooltip' })
  }

  // Destination pin (Target Port)
  let dPos: [number, number] | null = null
  if (rawData?.destLatLong?.length === 2) {
    const dLat = parseFloat(rawData.destLatLong[0])
    const dLng = parseFloat(rawData.destLatLong[1])
    if (!isNaN(dLat) && !isNaN(dLng)) {
      dPos = [dLat, dLng]
    }
  }

  if (dPos) {
    destMarker = L.circleMarker(dPos, {
      radius: 6,
      fillColor: '#ef4444',
      color: '#ffffff',
      weight: 2,
      fillOpacity: 1,
    }).addTo(mapInstance).bindTooltip(mrvInfo.value.destPort, { permanent: true, direction: 'right', className: 'port-tooltip' })

    // Draw planned remaining route (dashed cyan line)
    remainingPolyline = L.polyline([currentPos, dPos], {
      color: '#0284c7',
      weight: 2,
      dashArray: '6, 6',
      opacity: 0.8,
    }).addTo(mapInstance)
  }

  // Ship marker with directional arrow/boat icon
  const shipIconHtml = `
    <div style="transform: rotate(${heading}deg); transform-origin: center center;" class="flex items-center justify-center">
      <div class="relative flex items-center justify-center">
        <span class="absolute -top-1 size-3 rounded-full bg-red-500 animate-ping opacity-75"></span>
        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="#e53935" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="drop-shadow-lg">
          <path d="M12 2L19 21L12 17L5 21L12 2Z"/>
        </svg>
      </div>
    </div>
  `

  const shipIcon = L.divIcon({
    html: shipIconHtml,
    className: 'vessel-heading-pin',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })

  vesselMarker = L.marker(currentPos, { icon: shipIcon }).addTo(mapInstance)

  // Fit bounds to show route or vessel
  if (sailedRoute.length > 1) {
    const bounds = L.latLngBounds(sailedRoute)
    if (dPos) bounds.extend(dPos)
    mapInstance.fitBounds(bounds, { padding: [60, 50], maxZoom: 8 })
  } else {
    mapInstance.setView(currentPos, 5)
  }
}

async function initLeafletMap() {
  if (typeof window === 'undefined' || !mapContainer.value) return

  if (!L) {
    const leafletModule = await import('leaflet')
    await import('leaflet/dist/leaflet.css')
    L = leafletModule.default || leafletModule
  }

  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
  }

  mapInstance = L.map(mapContainer.value, {
    center: [-27.47, 153.02],
    zoom: 5,
    zoomControl: true,
    attributionControl: false,
  })

  updateTileLayer()
  renderMapLayers()
}

watch(() => isDark.value, () => {
  updateTileLayer()
})

watch(() => windyMapData.value, () => {
  renderMapLayers()
}, { deep: true })

onMounted(() => {
  initLeafletMap()
})

onBeforeUnmount(() => {
  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
  }
})
</script>

<template>
  <div class="relative h-full min-h-[390px] w-full overflow-hidden rounded bg-[#1e1f23] border border-[#2a2b2f] shadow-md">
    <!-- Floating Voyage Banner Header -->
    <div class="absolute top-2.5 left-2.5 right-2.5 z-[1000] rounded border border-[#383a42] bg-[#1e1f23]/92 px-4 py-2 backdrop-blur-md shadow-xl">
      <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-center">
        <!-- Vsl. Name -->
        <div class="flex flex-col items-center">
          <span class="text-[9px] font-semibold uppercase tracking-wider text-[#8e8e8e]">Vsl. Name</span>
          <span class="truncate text-xs font-bold text-white font-mono" :title="mrvInfo.vesselName">
            {{ mrvInfo.vesselName }}
          </span>
        </div>

        <!-- Voy. No. -->
        <div class="flex flex-col items-center">
          <span class="text-[9px] font-semibold uppercase tracking-wider text-[#8e8e8e]">Voy. No.</span>
          <span class="text-xs font-bold text-white font-mono">{{ mrvInfo.voyageNo }}</span>
        </div>

        <!-- Source Port -->
        <div class="flex flex-col items-center">
          <span class="text-[9px] font-semibold uppercase tracking-wider text-[#8e8e8e]">Source Port</span>
          <span class="text-xs font-bold text-[#10b981] font-mono">{{ mrvInfo.sourcePort }}</span>
        </div>

        <!-- Dest. Port -->
        <div class="flex flex-col items-center">
          <span class="text-[9px] font-semibold uppercase tracking-wider text-[#8e8e8e]">Dest. Port</span>
          <span class="text-xs font-bold text-[#ef4444] font-mono">{{ mrvInfo.destPort }}</span>
        </div>

        <!-- ETA -->
        <div class="flex flex-col items-center">
          <span class="text-[9px] font-semibold uppercase tracking-wider text-[#8e8e8e]">ETA</span>
          <span class="truncate text-xs font-bold text-white font-mono" :title="mrvInfo.eta">
            {{ mrvInfo.eta }}
          </span>
        </div>

        <!-- Dist. TR / DTG -->
        <div class="flex flex-col items-center">
          <span class="text-[9px] font-semibold uppercase tracking-wider text-[#8e8e8e]">Dist. TR / DTG</span>
          <span class="text-xs font-bold text-white font-mono">
            {{ mrvInfo.distTR }} <span class="text-[#8e8e8e]">/</span> {{ mrvInfo.distDTG }}
          </span>
        </div>

        <!-- Vsl. TZone -->
        <div class="flex flex-col items-center">
          <span class="text-[9px] font-semibold uppercase tracking-wider text-[#8e8e8e]">Vsl. TZone</span>
          <span class="text-xs font-bold text-white font-mono">{{ mrvInfo.timezone }}</span>
        </div>
      </div>
    </div>

    <!-- Map Canvas Container -->
    <div ref="mapContainer" class="h-full w-full min-h-[390px] z-10" />

    <!-- Skeleton loader overlay -->
    <div
      v-if="isMapLoading"
      class="absolute inset-0 z-[1001] flex items-center justify-center bg-[#1e1f23]/70 backdrop-blur-sm"
    >
      <div class="flex items-center gap-2 text-xs text-[#33b5e5] animate-pulse">
        <span>Loading map telemetry...</span>
      </div>
    </div>
  </div>
</template>

<style>
.vessel-heading-pin {
  background: transparent !important;
  border: none !important;
}
.port-tooltip {
  background-color: #1e1f23 !important;
  color: #ffffff !important;
  border: 1px solid #383a42 !important;
  font-size: 10px !important;
  font-weight: bold !important;
  padding: 2px 6px !important;
  border-radius: 3px !important;
}
</style>
