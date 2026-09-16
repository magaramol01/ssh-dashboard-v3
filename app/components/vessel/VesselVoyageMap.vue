<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Navigation, Compass, MapPin, Focus, Anchor, Crosshair } from 'lucide-vue-next'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useVesselDashboard } from '~/composables/useVesselDashboard'
import { useTheme } from '~/composables/useTheme'

const { mrvData, windyMapData, selectedVessel, isMapLoading } = useVesselDashboard()
const { isDark } = useTheme()

const mapContainer = ref<HTMLElement | null>(null)
let L: any = null
let mapInstance: any = null
let tileLayer: any = null
let corridorBuffer: any = null
let routePolyline: any = null
let remainingPolyline: any = null
let waypointMarkers: any[] = []
let vesselMarker: any = null
let sourceMarker: any = null
let destMarker: any = null
let resizeObserver: ResizeObserver | null = null

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
    vesselName: mrvData.value?.vessel || selectedVessel.value?.name || 'Avery Point',
    voyageNo: mrvData.value?.voyage || '635N',
    sourcePort: mrvData.value?.scr || 'AUBNE',
    destPort: mrvData.value?.destination || 'JPYOK',
    eta: formatEta(mrvData.value?.etanextport),
    distTR: mrvData.value?.totaldistrun || '1,620',
    distDTG: mrvData.value?.disttogo || '2,560',
    timezone: mrvData.value?.timezone || '+0000',
  }
})

// Western Pacific / Asia-Australia Navigation Corridor (AUBNE → JPYOK)
const DEFAULT_CORRIDOR_COORDS: [number, number][] = [
  [-27.4698, 153.0251], // Brisbane (AUBNE) - Departure
  [-24.2, 153.6],       // Offshore Break
  [-18.5, 152.8],       // Coral Sea Waypoint
  [-11.2, 154.2],       // Louisiade Archipelago
  [-4.1, 153.5],        // Solomon Sea Corridor
  [3.5, 150.6],         // Caroline Islands Transit
  [12.8, 146.2],        // Marianas Basin Waypoint
  [21.2, 143.0],        // Ogasawara Ridge
  [28.6, 140.5],        // Izu Islands Transit
  [34.1, 139.8],        // Sagami Bay / Tokyo Bay Approach
  [35.4437, 139.6380],  // Yokohama (JPYOK) - Destination
]

const WAYPOINTS: { name: string; pos: [number, number]; label: string }[] = [
  { name: 'WP 01', pos: [-18.5, 152.8], label: 'Coral Sea' },
  { name: 'WP 02', pos: [-4.1, 153.5], label: 'Solomon Passage' },
  { name: 'WP 03', pos: [12.8, 146.2], label: 'Marianas Basin' },
  { name: 'WP 04', pos: [28.6, 140.5], label: 'Izu Ridge' },
]

const activeCoords = computed<[number, number][]>(() => {
  const geojson = windyMapData.value
  if (geojson?.features && Array.isArray(geojson.features)) {
    const lineFeature = geojson.features.find((f: any) => f.geometry?.type === 'LineString')
    if (lineFeature?.geometry?.coordinates && lineFeature.geometry.coordinates.length >= 2) {
      return lineFeature.geometry.coordinates.map((pt: [number, number]) => [pt[1], pt[0]])
    }
  }
  return DEFAULT_CORRIDOR_COORDS
})

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
  mapInstance.invalidateSize()
  const coords = activeCoords.value
  if (coords.length < 2) return

  const bounds = L.latLngBounds(coords)
  mapInstance.fitBounds(bounds, {
    padding: [32, 32],
    maxZoom: 6,
    animate: false,
  })
}

function updateMapLayers() {
  if (!mapInstance || !L) return

  // Clear existing layers
  if (corridorBuffer) mapInstance.removeLayer(corridorBuffer)
  if (routePolyline) mapInstance.removeLayer(routePolyline)
  if (remainingPolyline) mapInstance.removeLayer(remainingPolyline)
  if (vesselMarker) mapInstance.removeLayer(vesselMarker)
  if (sourceMarker) mapInstance.removeLayer(sourceMarker)
  if (destMarker) mapInstance.removeLayer(destMarker)
  waypointMarkers.forEach((m) => mapInstance.removeLayer(m))
  waypointMarkers = []

  const coords = activeCoords.value
  const splitIdx = Math.max(1, Math.floor(coords.length * 0.38))
  const sailedCoords = coords.slice(0, splitIdx + 1)
  const remainingCoords = coords.slice(splitIdx)
  const currentPos = coords[splitIdx] || coords[0]

  // 1. Navigation Safety Corridor Envelope (15 NM Translucent Safety Buffer)
  corridorBuffer = L.polyline(coords, {
    color: '#0284c7',
    weight: 22,
    opacity: 0.12,
    lineCap: 'round',
    lineJoin: 'round',
  }).addTo(mapInstance)

  // 2. Sailed Track (Solid Vivid Accent)
  routePolyline = L.polyline(sailedCoords, {
    color: '#0284c7',
    weight: 3.5,
    opacity: 0.95,
    smoothFactor: 1,
  }).addTo(mapInstance)

  // 3. Remaining Track (Dashed Navigational Line)
  remainingPolyline = L.polyline(remainingCoords, {
    color: '#64748b',
    weight: 2.5,
    dashArray: '5, 8',
    opacity: 0.75,
  }).addTo(mapInstance)

  // 4. Passage Waypoint Markers (Nautical Diamond Pins)
  const wpIcon = (wpName: string) =>
    L.divIcon({
      className: 'wp-pin',
      html: `
        <div class="flex items-center justify-center">
          <div class="size-2 rotate-45 bg-sky-500 border border-card shadow-xs"></div>
        </div>
      `,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    })

  WAYPOINTS.forEach((wp) => {
    const marker = L.marker(wp.pos, { icon: wpIcon(wp.name) }).addTo(mapInstance)
    marker.bindTooltip(`
      <div class="text-[10px] font-mono px-1">
        <strong>${wp.name}</strong> · ${wp.label}
      </div>
    `, { direction: 'right', offset: [8, 0], opacity: 0.9 })
    waypointMarkers.push(marker)
  })

  // 5. Port Badges (Departure & Destination)
  const sourcePos = coords[0]
  const destPos = coords[coords.length - 1]

  const portIcon = (code: string, isSource: boolean) =>
    L.divIcon({
      className: 'port-pin',
      html: `
        <div class="flex items-center gap-1.5 bg-card/95 text-foreground border border-border/80 px-2 py-0.5 rounded-md shadow-md text-xs font-bold font-mono backdrop-blur-xs">
          <span class="size-2 rounded-full shrink-0 ${isSource ? 'bg-teal-500' : 'bg-primary'}"></span>
          <span>${code}</span>
        </div>
      `,
      iconSize: [70, 24],
      iconAnchor: [35, 12],
    })

  if (sourcePos) {
    sourceMarker = L.marker(sourcePos, { icon: portIcon(mrvInfo.value.sourcePort, true) }).addTo(mapInstance)
  }
  if (destPos) {
    destMarker = L.marker(destPos, { icon: portIcon(mrvInfo.value.destPort, false) }).addTo(mapInstance)
  }

  // 6. Rotated Vessel Marker with Live Telemetry Tag & Pulsing Radar Ring
  const heading = 345
  const vesselIcon = L.divIcon({
    className: 'vessel-heading-pin',
    html: `
      <div class="relative flex items-center justify-center">
        <span class="absolute size-9 rounded-full bg-primary/25 animate-ping"></span>
        <span class="absolute size-6 rounded-full bg-primary/30 border border-primary/40"></span>
        <svg
          class="size-5 text-primary drop-shadow-md transition-transform duration-500"
          viewBox="0 0 24 24"
          style="transform: rotate(${heading}deg);"
          fill="currentColor"
        >
          <path d="M12 2L19 21L12 17L5 21L12 2Z" />
        </svg>
        <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-background/90 text-primary border border-primary/30 px-1 py-0.2 rounded text-[9px] font-mono font-bold shadow-xs">
          14.2 kn · ${heading}°
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  })

  if (currentPos) {
    vesselMarker = L.marker(currentPos, { icon: vesselIcon }).addTo(mapInstance)
    vesselMarker.bindPopup(`
      <div class="p-2 text-xs font-sans">
        <div class="font-bold text-foreground text-sm">${mrvInfo.value.vesselName}</div>
        <div class="text-muted-foreground mt-0.5">Voyage: ${mrvInfo.value.voyageNo}</div>
        <div class="text-primary font-mono font-bold mt-1.5 flex items-center gap-2">
          <span>SOG: 14.2 kn</span>
          <span>Course: ${heading}°</span>
        </div>
        <div class="text-muted-foreground text-[10px] font-mono mt-1">
          Corridor: ${mrvInfo.value.sourcePort} → ${mrvInfo.value.destPort}
        </div>
      </div>
    `)
  }

  fitCorridorBounds()
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

  await nextTick()

  if (mapContainer.value && !mapInstance) {
    mapInstance = L.map(mapContainer.value, {
      zoomControl: true,
      attributionControl: false,
      minZoom: 3,
      maxZoom: 14,
    }).setView([5, 146], 4)

    updateTileLayer()
    updateMapLayers()

    requestAnimationFrame(() => {
      fitCorridorBounds()
    })

    // ResizeObserver ensures map automatically re-frames corridor when Alarms sidebar toggles
    if (typeof ResizeObserver !== 'undefined' && mapContainer.value) {
      resizeObserver = new ResizeObserver(() => {
        if (mapInstance) {
          fitCorridorBounds()
        }
      })
      resizeObserver.observe(mapContainer.value)
    }
  }
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
  }
})
</script>

<template>
  <Card class="border border-border/50 bg-card shadow-xs overflow-hidden flex flex-col h-full min-h-[450px]">
    <CardHeader class="p-4 pb-2">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <CardTitle class="text-sm font-semibold flex items-center gap-2">
            <Navigation class="size-4 text-primary" />
            <span>Voyage Corridor</span>
          </CardTitle>
          <Badge variant="outline" class="text-[11px] font-mono font-medium px-2 py-0.5 border-border text-muted-foreground">
            {{ mrvData?.scr || 'PECLL' }} &rarr; {{ mrvData?.destination || 'CNNDE' }}
          </Badge>
        </div>

        <div class="flex items-center gap-2">
          <Badge variant="outline" class="text-xs font-semibold border-sky-500/30 text-sky-400 bg-sky-500/10 px-2 py-0.5">
            Live AIS
          </Badge>
        </div>
      </div>
    </CardHeader>

    <CardContent class="p-0 flex-1 relative min-h-[380px]">
      <!-- Map Canvas Container -->
      <div ref="mapContainer" class="h-full w-full min-h-[380px] z-10" />

      <!-- Floating Corridor Telemetry HUD (Top-Left) -->
      <div class="absolute top-3 left-3 z-[1000] flex flex-col gap-1.5 p-3 rounded-xl bg-background/90 backdrop-blur-md border border-border/60 shadow-lg max-w-[290px] pointer-events-none">
        <div class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Corridor Bounds</div>
        <div class="flex items-center justify-between gap-3 text-xs font-semibold">
          <span class="text-primary flex items-center gap-1.5 font-mono">
            <span class="size-1.5 rounded-full bg-primary" />
            {{ mrvInfo.sourcePort }} &rarr; {{ mrvInfo.destPort }}
          </span>
          <span class="text-muted-foreground font-normal text-xs">15 NM buffer</span>
        </div>
        <div class="text-xs text-muted-foreground flex items-center justify-between gap-2 pt-1 border-t border-border/40 font-normal">
          <span>Sailed: <span class="font-mono font-semibold text-foreground">{{ mrvInfo.distTR }} NM</span></span>
          <span>DTG: <span class="font-mono font-semibold text-foreground">{{ mrvInfo.distDTG }} NM</span></span>
          <span class="text-teal-400 font-semibold text-xs">In track</span>
        </div>
      </div>

      <!-- Fit Corridor Action Button (Bottom-Right) -->
      <button
        type="button"
        @click="fitCorridorBounds"
        class="h-8 absolute bottom-3 right-3 z-[1000] flex items-center gap-1.5 px-3 rounded-lg bg-background/90 hover:bg-background border border-border/60 shadow-md text-xs font-medium text-foreground backdrop-blur-xs cursor-pointer transition-all hover:border-primary/50"
        title="Re-center and fit Pacific corridor to frame"
      >
        <Focus class="size-3.5 text-primary" />
        <span>Fit Corridor</span>
      </button>

      <!-- Skeleton loader overlay -->
      <div
        v-if="isMapLoading"
        class="absolute inset-0 z-[1001] flex items-center justify-center bg-background/70 backdrop-blur-sm"
      >
        <div class="flex items-center gap-2 text-xs text-primary animate-pulse">
          <span>Updating voyage corridor...</span>
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
.wp-pin {
  background: transparent !important;
  border: none !important;
}
</style>
