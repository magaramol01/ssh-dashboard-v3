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
let vesselMarker: any = null
let sourceMarker: any = null
let destMarker: any = null

const mrvInfo = computed(() => {
  return {
    vesselName: mrvData.value?.vessel || selectedVessel.value?.name || 'ASIA UNITY',
    voyageNo: mrvData.value?.voyage || '2604',
    sourcePort: mrvData.value?.scr || 'DKSKA',
    destPort: mrvData.value?.destination || 'SNDKR',
    eta: mrvData.value?.etanextport || '2026-09-05T00:00:00.000Z',
    distTR: mrvData.value?.totaldistrun || '2277',
    distDTG: mrvData.value?.disttogo || '809',
    timezone: mrvData.value?.timezone || '+0000',
  }
})

function updateTileLayer() {
  if (!mapInstance || !L) return
  if (tileLayer) {
    mapInstance.removeLayer(tileLayer)
  }
  // Dark/Light Gray base map matching screenshot
  const tileUrl = isDark.value
    ? 'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
    : 'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'

  tileLayer = L.tileLayer(tileUrl, {
    maxZoom: 16,
    attribution: '&copy; Esri, DeLorme, NAVTEQ',
  }).addTo(mapInstance)
}

function renderMapLayers() {
  if (!mapInstance || !L) return

  // Clean previous layers
  if (routePolyline) {
    mapInstance.removeLayer(routePolyline)
    routePolyline = null
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
  let currentPos: [number, number] = [14.68, -17.42]
  let heading = 0
  const latLngRoute: [number, number][] = []

  // Extract portToPort route
  if (rawData?.portToPortGeo?.[0]?.geometry?.coordinates) {
    const coords = rawData.portToPortGeo[0].geometry.coordinates
    for (const c of coords) {
      if (Array.isArray(c) && c.length >= 2) {
        latLngRoute.push([c[1], c[0]])
      }
    }
  }

  // Extract current vessel position from windyMapGEoJson or fallback
  if (rawData?.windyMapGEoJson?.data?.length) {
    const latest = rawData.windyMapGEoJson.data[0]
    if (latest?.geometry?.coordinates) {
      currentPos = [latest.geometry.coordinates[1], latest.geometry.coordinates[0]]
    }
    if (latest?.properties?.vesselHeading) {
      heading = Number(latest.properties.vesselHeading) || 0
    }
  }

  // Draw polyline (red path matching screenshot)
  if (latLngRoute.length > 0) {
    routePolyline = L.polyline(latLngRoute, {
      color: '#ef4444',
      weight: 3.5,
      opacity: 0.9,
      lineCap: 'round',
    }).addTo(mapInstance)
  }

  // Source pin
  if (rawData?.sourceLatLong?.length === 2) {
    const sLat = parseFloat(rawData.sourceLatLong[0])
    const sLng = parseFloat(rawData.sourceLatLong[1])
    if (!isNaN(sLat) && !isNaN(sLng)) {
      sourceMarker = L.circleMarker([sLat, sLng], {
        radius: 5,
        fillColor: '#3b82f6',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 1,
      }).addTo(mapInstance)
    }
  }

  // Destination pin
  if (rawData?.destLatLong?.length === 2) {
    const dLat = parseFloat(rawData.destLatLong[0])
    const dLng = parseFloat(rawData.destLatLong[1])
    if (!isNaN(dLat) && !isNaN(dLng)) {
      destMarker = L.circleMarker([dLat, dLng], {
        radius: 5,
        fillColor: '#ef4444',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 1,
      }).addTo(mapInstance)
    }
  }

  // Custom vessel pin (boat SVG rotated to heading)
  const shipIconHtml = `
    <div style="transform: rotate(${heading}deg); transform-origin: center center;" class="flex items-center justify-center">
      <div class="relative flex items-center justify-center">
        <span class="absolute -top-1 size-3 rounded-full bg-red-500 animate-ping opacity-75"></span>
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#ef4444" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="drop-shadow-md">
          <path d="M12 2L19 21L12 17L5 21L12 2Z"/>
        </svg>
      </div>
    </div>
  `

  const shipIcon = L.divIcon({
    html: shipIconHtml,
    className: 'vessel-heading-pin',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })

  vesselMarker = L.marker(currentPos, { icon: shipIcon }).addTo(mapInstance)
  vesselMarker.bindPopup(`
    <div class="text-xs font-sans">
      <p class="font-bold text-sm">${mrvInfo.value.vesselName}</p>
      <p class="text-muted-foreground">Heading: ${heading}°</p>
      <p class="text-muted-foreground">Pos: ${currentPos[0].toFixed(2)}°, ${currentPos[1].toFixed(2)}°</p>
    </div>
  `)

  // View bounds
  if (latLngRoute.length > 1) {
    mapInstance.fitBounds(latLngRoute, { padding: [40, 40], maxZoom: 8 })
  } else {
    mapInstance.setView(currentPos, 6)
  }
}

onMounted(async () => {
  L = (await import('leaflet')).default
  if (!mapContainer.value) return

  mapInstance = L.map(mapContainer.value, {
    zoomControl: true,
    attributionControl: false,
    scrollWheelZoom: false,
  }).setView([14.68, -17.42], 5)

  updateTileLayer()
  renderMapLayers()
  requestAnimationFrame(() => mapInstance?.invalidateSize())
})

watch(() => windyMapData.value, () => renderMapLayers(), { deep: true })
watch(isDark, () => updateTileLayer())

onBeforeUnmount(() => {
  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
  }
})
</script>

<template>
  <div class="relative flex h-full min-h-[360px] w-full flex-col overflow-hidden rounded-lg border border-border/40 bg-card/60 backdrop-blur-md">
    <!-- Floating Voyage Details Banner (Docked on Top of Map) -->
    <div class="absolute left-3 right-3 top-3 z-[1000] flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 rounded-md border border-border/60 bg-background/85 px-4 py-2 text-[11px] backdrop-blur-md shadow-md">
      <div class="flex flex-col">
        <span class="text-[10px] text-muted-foreground">Vsl. Name</span>
        <span class="font-bold text-foreground">{{ mrvInfo.vesselName }}</span>
      </div>
      <div class="flex flex-col">
        <span class="text-[10px] text-muted-foreground">Voy. No.</span>
        <span class="font-semibold text-foreground">{{ mrvInfo.voyageNo }}</span>
      </div>
      <div class="flex flex-col">
        <span class="text-[10px] text-muted-foreground">Source Port</span>
        <span class="font-semibold text-foreground">{{ mrvInfo.sourcePort }}</span>
      </div>
      <div class="flex flex-col">
        <span class="text-[10px] text-muted-foreground">Dest. Port</span>
        <span class="font-semibold text-foreground">{{ mrvInfo.destPort }}</span>
      </div>
      <div class="flex flex-col">
        <span class="text-[10px] text-muted-foreground">ETA</span>
        <span class="font-mono text-foreground">{{ mrvInfo.eta }}</span>
      </div>
      <div class="flex flex-col">
        <span class="text-[10px] text-muted-foreground">Dist. TR / DTG</span>
        <span class="font-mono font-semibold text-foreground">
          {{ mrvInfo.distTR }} / {{ mrvInfo.distDTG }}
        </span>
      </div>
      <div class="flex flex-col">
        <span class="text-[10px] text-muted-foreground">Vsl. TZone</span>
        <span class="font-mono text-foreground">{{ mrvInfo.timezone }}</span>
      </div>
    </div>

    <!-- Map Canvas (ClientOnly for SSR Safety) -->
    <ClientOnly>
      <div ref="mapContainer" class="h-full w-full min-h-[360px]" />
      <template #fallback>
        <div class="flex h-full w-full items-center justify-center p-6">
          <Skeleton class="h-[360px] w-full rounded-md" />
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
:deep(.leaflet-container) {
  background: var(--background);
  font-family: var(--font-sans);
}
</style>
