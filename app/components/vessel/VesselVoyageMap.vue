<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { Navigation, Compass, MapPin } from 'lucide-vue-next'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  const tileUrl = isDark.value
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'

  tileLayer = L.tileLayer(tileUrl, {
    maxZoom: 18,
    attribution: '&copy; CartoDB, OpenStreetMap contributors',
  }).addTo(mapInstance)
}

function updateMapLayers() {
  if (!mapInstance || !L) return

  // Clear existing layers
  if (routePolyline) mapInstance.removeLayer(routePolyline)
  if (remainingPolyline) mapInstance.removeLayer(remainingPolyline)
  if (vesselMarker) mapInstance.removeLayer(vesselMarker)
  if (sourceMarker) mapInstance.removeLayer(sourceMarker)
  if (destMarker) mapInstance.removeLayer(destMarker)

  const geojson = windyMapData.value
  let coords: [number, number][] = []

  if (geojson?.features && Array.isArray(geojson.features)) {
    const lineFeature = geojson.features.find((f: any) => f.geometry?.type === 'LineString')
    if (lineFeature?.geometry?.coordinates) {
      coords = lineFeature.geometry.coordinates.map((pt: [number, number]) => [pt[1], pt[0]])
    }
  }

  // Realistic default Pacific-Asia voyage corridor if geojson empty
  if (coords.length < 2) {
    coords = [
      [-27.4698, 153.0251], // Brisbane (AUBNE)
      [-20.0, 155.0],
      [-10.0, 152.0],
      [0.0, 145.0],
      [10.0, 135.0],
      [20.0, 128.0],
      [31.2304, 121.4737],
      [36.0671, 120.3826], // Qingdao (CNTAO)
    ]
  }

  const splitIdx = Math.max(1, Math.floor(coords.length * 0.35))
  const sailedCoords = coords.slice(0, splitIdx + 1)
  const remainingCoords = coords.slice(splitIdx)
  const currentPos = coords[splitIdx] || coords[0]

  // 1. Sailed Track (Solid Primary Accent)
  routePolyline = L.polyline(sailedCoords, {
    color: '#0284c7',
    weight: 3.5,
    opacity: 0.9,
    smoothFactor: 1,
  }).addTo(mapInstance)

  // 2. Remaining Track (Dashed Cool Slate)
  remainingPolyline = L.polyline(remainingCoords, {
    color: '#64748b',
    weight: 2.5,
    dashArray: '6, 8',
    opacity: 0.6,
  }).addTo(mapInstance)

  // 3. Port Markers
  const sourcePos = coords[0]
  const destPos = coords[coords.length - 1]

  const portIcon = (code: string) =>
    L.divIcon({
      className: 'port-pin',
      html: `
        <div class="flex items-center gap-1 bg-card/90 text-foreground border border-border px-2 py-0.5 rounded shadow text-[10px] font-bold font-mono">
          <span class="size-1.5 rounded-full bg-primary"></span>
          <span>${code}</span>
        </div>
      `,
      iconSize: [60, 20],
      iconAnchor: [30, 10],
    })

  if (sourcePos) {
    sourceMarker = L.marker(sourcePos, { icon: portIcon(mrvInfo.value.sourcePort) }).addTo(mapInstance)
  }
  if (destPos) {
    destMarker = L.marker(destPos, { icon: portIcon(mrvInfo.value.destPort) }).addTo(mapInstance)
  }

  // 4. Rotated Vessel Marker with Radar Aura
  const heading = 345
  const vesselIcon = L.divIcon({
    className: 'vessel-heading-pin',
    html: `
      <div class="relative flex items-center justify-center">
        <span class="absolute size-8 rounded-full bg-primary/20 animate-ping"></span>
        <span class="absolute size-5 rounded-full bg-primary/30"></span>
        <svg
          class="size-5 text-primary drop-shadow-md transition-transform duration-500"
          viewBox="0 0 24 24"
          style="transform: rotate(${heading}deg);"
          fill="currentColor"
        >
          <path d="M12 2L19 21L12 17L5 21L12 2Z" />
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })

  if (currentPos) {
    vesselMarker = L.marker(currentPos, { icon: vesselIcon }).addTo(mapInstance)
    vesselMarker.bindPopup(`
      <div class="p-2 text-xs font-sans">
        <div class="font-bold text-foreground">${mrvInfo.value.vesselName}</div>
        <div class="text-muted-foreground mt-0.5">Voyage: ${mrvInfo.value.voyageNo}</div>
        <div class="text-primary font-mono font-bold mt-1">SOG: 14.2 kn · Course: ${heading}°</div>
      </div>
    `)
  }

  mapInstance.fitBounds(L.latLngBounds(coords), { padding: [30, 30] })
}

watch(windyMapData, () => {
  updateMapLayers()
})

watch(isDark, () => {
  updateTileLayer()
})

onMounted(async () => {
  if (typeof window === 'undefined') return
  const leafletModule = await import('leaflet')
  L = leafletModule.default || leafletModule

  if (mapContainer.value && !mapInstance) {
    mapInstance = L.map(mapContainer.value, {
      zoomControl: true,
      attributionControl: false,
    }).setView([10, 140], 4)

    updateTileLayer()
    updateMapLayers()
  }
})

onBeforeUnmount(() => {
  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
  }
})
</script>

<template>
  <Card class="shadow-xs overflow-hidden flex flex-col h-full min-h-[420px]">
    <CardHeader class="p-4 pb-2">
      <div class="flex items-center justify-between">
        <div>
          <CardTitle class="text-sm font-semibold flex items-center gap-2">
            <Navigation class="size-4 text-primary" />
            <span>Voyage Corridor & Live AIS Track</span>
          </CardTitle>
          <CardDescription class="text-xs">
            Sailed trajectory vs planned navigational waypoint corridor
          </CardDescription>
        </div>
        <Badge variant="outline" class="text-[10px] font-mono border-primary/30 text-primary">
          Live AIS
        </Badge>
      </div>
    </CardHeader>

    <CardContent class="p-0 flex-1 relative min-h-[350px]">
      <!-- Map Canvas Container -->
      <div ref="mapContainer" class="h-full w-full min-h-[350px] z-10" />

      <!-- Skeleton loader overlay -->
      <div
        v-if="isMapLoading"
        class="absolute inset-0 z-[1001] flex items-center justify-center bg-background/70 backdrop-blur-sm"
      >
        <div class="flex items-center gap-2 text-xs text-primary animate-pulse">
          <span>Updating voyage telemetry...</span>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<style>
.vessel-heading-pin {
  background: transparent !important;
  border: none !important;
}
.port-pin {
  background: transparent !important;
  border: none !important;
}
</style>
