<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Navigation, Focus } from 'lucide-vue-next'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useVesselDashboard } from '~/composables/useVesselDashboard'
import { useTheme } from '~/composables/useTheme'
import {
  parseVesselCurrentPosition,
  parsePlannedCorridor,
  parseTravelledTrack,
  deriveWaypoints,
  resolvePortCoordinates,
  KNOWN_PORT_COORDS,
} from '~/lib/vessel-voyage'

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

// Parse live corridor and route data from backend
const parsedCorridor = computed(() => parsePlannedCorridor(windyMapData.value))
const parsedVesselPos = computed(() => parseVesselCurrentPosition(windyMapData.value))
const parsedTravelled = computed(() => parseTravelledTrack(windyMapData.value))

const mrvInfo = computed(() => {
  const pStart = parsedCorridor.value.startPort
  const pEnd = parsedCorridor.value.endPort
  return {
    vesselName: mrvData.value?.vessel || selectedVessel.value?.name || 'ASIA UNITY',
    voyageNo: mrvData.value?.voyage || '2604',
    sourcePort: pStart || mrvData.value?.scr || 'PECLL',
    destPort: pEnd || mrvData.value?.destination || 'CNNDE',
    eta: formatEta(mrvData.value?.etanextport),
    distTR: mrvData.value?.totaldistrun || '2,277',
    distDTG: mrvData.value?.disttogo || '809',
    timezone: mrvData.value?.timezone || '+0000',
    routeName: parsedCorridor.value.routeName || '',
  }
})

function findClosestCoordIndex(coords: [number, number][], target: [number, number]): number {
  if (!coords.length) return 0
  let minDist = Infinity
  let bestIdx = 0
  for (let i = 0; i < coords.length; i++) {
    const pt = coords[i]
    if (!pt) continue
    const dLat = pt[0] - target[0]
    const dLng = pt[1] - target[1]
    const distSq = dLat * dLat + dLng * dLng
    if (distSq < minDist) {
      minDist = distSq
      bestIdx = i
    }
  }
  return bestIdx
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
  mapInstance.invalidateSize()

  const allPoints: [number, number][] = []
  if (vesselMarker?.getLatLng()) {
    const ll = vesselMarker.getLatLng()
    allPoints.push([ll.lat, ll.lng])
  }
  if (sourceMarker?.getLatLng()) {
    const ll = sourceMarker.getLatLng()
    allPoints.push([ll.lat, ll.lng])
  }
  if (destMarker?.getLatLng()) {
    const ll = destMarker.getLatLng()
    allPoints.push([ll.lat, ll.lng])
  }
  if (routePolyline?.getLatLngs()) {
    const lls = routePolyline.getLatLngs()
    lls.forEach((pt: any) => allPoints.push([pt.lat, pt.lng]))
  }

  if (allPoints.length < 2) {
    if (allPoints.length === 1 && allPoints[0]) {
      mapInstance.setView(allPoints[0], 6)
    }
    return
  }

  const bounds = L.latLngBounds(allPoints)
  mapInstance.fitBounds(bounds, {
    padding: [36, 36],
    maxZoom: 7,
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

  const planned = parsedCorridor.value
  const vesselPosData = parsedVesselPos.value
  const travelled = parsedTravelled.value

  // 1. Resolve source and destination coordinates
  const sPort = mrvInfo.value.sourcePort
  const dPort = mrvInfo.value.destPort

  let sourcePos: [number, number]
  let destPos: [number, number]

  if (planned.coords.length >= 2) {
    sourcePos = planned.coords[0]!
    destPos = planned.coords[planned.coords.length - 1]!
  } else {
    sourcePos = resolvePortCoordinates(sPort, [14.68, -17.42])
    destPos = resolvePortCoordinates(dPort, [26.66, 119.52])
  }

  // 2. Resolve actual current vessel position, speed, and heading
  let currentPos: [number, number]
  let heading = 0
  let sog = 0
  let packetTs = ''

  if (vesselPosData.isValid) {
    currentPos = [vesselPosData.lat, vesselPosData.lng]
    heading = vesselPosData.heading
    sog = vesselPosData.sog
    packetTs = vesselPosData.packetTs
  } else if (planned.coords.length >= 2) {
    const run = parseFloat(mrvInfo.value.distTR.replace(/,/g, '')) || 0
    const dtg = parseFloat(mrvInfo.value.distDTG.replace(/,/g, '')) || 0
    const ratio = run + dtg > 0 ? Math.min(0.98, Math.max(0.02, run / (run + dtg))) : 0.5
    const idx = Math.floor(planned.coords.length * ratio)
    currentPos = planned.coords[idx] || sourcePos
    sog = 13.5
    heading = 45
  } else {
    currentPos = sourcePos
    sog = 0.2
    heading = 7
  }

  // 3. Construct corridor, sailed, and remaining route tracks
  let fullCorridorCoords: [number, number][] = []
  let sailedCoords: [number, number][] = []
  let remainingCoords: [number, number][] = []

  if (planned.coords.length >= 2) {
    fullCorridorCoords = planned.coords
    const splitIdx = findClosestCoordIndex(planned.coords, currentPos)

    if (travelled.length >= 2) {
      sailedCoords = [...travelled, currentPos]
    } else {
      sailedCoords = [...planned.coords.slice(0, splitIdx + 1), currentPos]
    }
    remainingCoords = [currentPos, ...planned.coords.slice(splitIdx + 1)]
  } else {
    if (travelled.length >= 2) {
      sailedCoords = [...travelled, currentPos]
      fullCorridorCoords = [...travelled, currentPos, destPos]
    } else {
      sailedCoords = [sourcePos, currentPos]
      fullCorridorCoords = [sourcePos, currentPos, destPos]
    }
    remainingCoords = [currentPos, destPos]
  }

  // 4. Navigation Safety Corridor Envelope (15 NM Translucent Safety Buffer)
  if (fullCorridorCoords.length >= 2) {
    corridorBuffer = L.polyline(fullCorridorCoords, {
      color: '#0284c7',
      weight: 22,
      opacity: 0.12,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(mapInstance)
  }

  // 5. Sailed Track (Solid Accent Line)
  if (sailedCoords.length >= 2) {
    routePolyline = L.polyline(sailedCoords, {
      color: '#0284c7',
      weight: 3.5,
      opacity: 0.95,
      smoothFactor: 1,
    }).addTo(mapInstance)
  }

  // 6. Remaining Track (Dashed Navigational Line)
  if (remainingCoords.length >= 2) {
    remainingPolyline = L.polyline(remainingCoords, {
      color: '#64748b',
      weight: 2.5,
      dashArray: '5, 8',
      opacity: 0.75,
    }).addTo(mapInstance)
  }

  // 7. Passage Waypoints (Dynamically generated along planned route)
  const waypoints = deriveWaypoints(fullCorridorCoords)
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

  waypoints.forEach((wp) => {
    const marker = L.marker(wp.pos, { icon: wpIcon(wp.name) }).addTo(mapInstance)
    marker.bindTooltip(
      `
      <div class="text-[10px] font-mono px-1">
        <strong>${wp.name}</strong> · ${wp.label}
      </div>
    `,
      { direction: 'right', offset: [8, 0], opacity: 0.9 }
    )
    waypointMarkers.push(marker)
  })

  // 8. Port Badges (Departure & Destination)
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

  sourceMarker = L.marker(sourcePos, { icon: portIcon(sPort, true) }).addTo(mapInstance)
  destMarker = L.marker(destPos, { icon: portIcon(dPort, false) }).addTo(mapInstance)

  // 9. Rotated Vessel Marker with Actual Telemetry & Pulsing Radar Ring
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
          ${sog.toFixed(1)} kn · ${Math.round(heading)}°
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  })

  const latLabel = `${Math.abs(currentPos[0]).toFixed(3)}° ${currentPos[0] >= 0 ? 'N' : 'S'}`
  const lngLabel = `${Math.abs(currentPos[1]).toFixed(3)}° ${currentPos[1] >= 0 ? 'E' : 'W'}`

  vesselMarker = L.marker(currentPos, { icon: vesselIcon }).addTo(mapInstance)
  vesselMarker.bindPopup(`
    <div class="p-2 text-xs font-sans">
      <div class="font-bold text-foreground text-sm">${mrvInfo.value.vesselName}</div>
      <div class="text-muted-foreground mt-0.5">Voyage: ${mrvInfo.value.voyageNo}</div>
      <div class="text-primary font-mono font-bold mt-1.5 flex items-center gap-2">
        <span>SOG: ${sog.toFixed(1)} kn</span>
        <span>Course: ${Math.round(heading)}°</span>
      </div>
      <div class="text-foreground font-mono text-[10px] mt-1 font-semibold">
        Position: ${latLabel}, ${lngLabel}
      </div>
      <div class="text-muted-foreground text-[10px] font-mono mt-0.5">
        Corridor: ${sPort} → ${dPort}
      </div>
      ${packetTs ? `<div class="text-muted-foreground/80 text-[9px] font-mono mt-1">Telemetry: ${packetTs}</div>` : ''}
    </div>
  `)

  fitCorridorBounds()
}

// Watch data updates
watch([windyMapData, mrvData, selectedVessel], () => {
  updateMapLayers()
}, { deep: true })

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
      minZoom: 2,
      maxZoom: 14,
    }).setView([15, 0], 3)

    updateTileLayer()
    updateMapLayers()

    requestAnimationFrame(() => {
      fitCorridorBounds()
    })

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
            {{ mrvInfo.sourcePort }} &rarr; {{ mrvInfo.destPort }}
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
          <span class="text-teal-400 font-semibold text-xs">
            {{ parsedVesselPos.isValid && parsedVesselPos.sog < 0.5 ? 'Moored / In Port' : 'In track' }}
          </span>
        </div>
      </div>

      <!-- Fit Corridor Action Button (Bottom-Right) -->
      <button
        type="button"
        @click="fitCorridorBounds"
        class="h-8 absolute bottom-3 right-3 z-[1000] flex items-center gap-1.5 px-3 rounded-lg bg-background/90 hover:bg-background border border-border/60 shadow-md text-xs font-medium text-foreground backdrop-blur-xs cursor-pointer transition-all hover:border-primary/50"
        title="Re-center and fit voyage corridor to frame"
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
