<script setup lang="ts">
/** Live fleet map backed by Leaflet + OpenStreetMap tiles. */
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import type { ResolvedTrip } from '~/mocks/live'
import type { Tone } from '~/mocks/shipments'
import { STATUS_LABELS } from '~/mocks/shipments'
import { NETWORK } from '~/mocks/network'
import { useCameraStream } from '~/composables/useCameraStream'
type Point = [number, number] // Leaflet order: [lat, lng]

type RouteLayers = {
  base: any
  travelled: any
  remaining: any
  origin: any
  marker: any
  truck: Point
  color: string
  trip?: any
}

const props = withDefaults(
  defineProps<{
    trips: (ResolvedTrip | any)[]
    selectedId: string | null
    showGodsEyeCctv?: boolean
  }>(),
  {
    showGodsEyeCctv: false,
  }
)
const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'open-camera', vessel: any): void
}>()
const { hasCameras, getVesselCameras } = useCameraStream()

const { theme, isDark } = useTheme()
const el = ref<HTMLElement | null>(null)
let L: any = null
let map: any = null
let currentTileLayer: any = null
let themeMutationObserver: MutationObserver | null = null
const routes = new Map<string, RouteLayers>()
const networkMarkers: any[] = []
const itineraryMarkers: any[] = []
const hoverId = ref<string | null>(null)

function getTripId(t: any): string {
  return t.id || t.shipment?.id || ''
}
function getTripName(t: any): string {
  return t.name || t.shipment?.driver || t.shipment?.id || ''
}
function getTripTone(t: any): Tone {
  return t.tone || 'info'
}
function getTripProgress(t: any): number {
  return typeof t.progress === 'number' ? t.progress : (t.shipment?.progress ?? 50)
}
function getTripCoords(t: any): Point[] {
  if (Array.isArray(t.routeCoords) && t.routeCoords.length > 0) return t.routeCoords
  if (Array.isArray(t.coords) && Array.isArray(t.coords[0])) return t.coords
  return []
}
function getTripMarkerPos(t: any): Point {
  if (Array.isArray(t.coords) && typeof t.coords[0] === 'number') {
    return t.coords as Point
  }
  const route = getTripCoords(t)
  if (route.length > 0) {
    const { truck } = splitByProgress(route, getTripProgress(t))
    return truck
  }
  return [0, 0]
}

function splitByProgress(coords: Point[], progress: number) {
  const segments: { a: Point; b: Point; distance: number }[] = []
  let total = 0
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1]!, b = coords[i]!
    const distance = Math.hypot(b[0] - a[0], b[1] - a[1])
    segments.push({ a, b, distance })
    total += distance
  }
  const target = total * Math.min(1, Math.max(0, progress / 100))
  let travelled = 0
  let truck = coords[coords.length - 1]!
  let cut = segments.length - 1
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!
    if (travelled + segment.distance >= target) {
      const ratio = segment.distance ? (target - travelled) / segment.distance : 0
      truck = [segment.a[0] + (segment.b[0] - segment.a[0]) * ratio, segment.a[1] + (segment.b[1] - segment.a[1]) * ratio]
      cut = i
      break
    }
    travelled += segment.distance
  }
  return { truck, travelled: [...coords.slice(0, cut + 1), truck], remaining: [truck, ...coords.slice(cut + 1)] }
}

const TONE_VAR: Record<Tone, string> = {
  success: '--success', info: '--info', warning: '--warning', destructive: '--destructive', muted: '--muted-foreground',
}
function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#0e6e69'
}
const toneColor = (tone: Tone) => cssVar(TONE_VAR[tone])

function icon(html: string, size: [number, number], anchor: [number, number] = [size[0] / 2, size[1] / 2]) {
  return L.divIcon({ html, className: 'lm-leaflet-icon', iconSize: size, iconAnchor: anchor })
}

function vesselIcon(color: string, selected: boolean, hasCctv = false) {
  const size = selected ? 38 : 32
  const cctvBadge = hasCctv
    ? `<span class="lm-cam-badge" title="Live CCTV Available"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2"/></svg><span class="lm-cam-dot"></span></span>`
    : ''
  return icon(
    `<div class="lm-vessel-icon ${hasCctv ? 'has-cctv' : ''}" style="width:${size}px;height:${size}px;border-color:${color};color:${color}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 17l2 3h16l2-3-4-2H6l-4 2zm10-15L4 13h16L12 2zm-1 4v4h2V6h-2z" /></svg>${cctvBadge}</div>`,
    [size, size],
  )
}

function godsEyeCameraIcon(trip: any, color: string, selected: boolean, index = 0) {
  const tripId = getTripId(trip)
  const name = getTripName(trip)
  const cams = getVesselCameras(trip)
  const cam = cams[index % (cams.length || 1)] || cams[0] || { id: '1', name: 'Bridge Forward' }
  const camName = cam.name || 'Bridge Forward'
  const camId = cam.id || '1'
  const sog = trip.sog !== undefined ? trip.sog : 0
  const hdg = trip.heading || 'N'
  const coords = getTripMarkerPos(trip)
  const latStr = coords[0] ? `${Math.abs(coords[0]).toFixed(2)}°${coords[0] >= 0 ? 'N' : 'S'}` : '14.2°N'
  const lngStr = coords[1] ? `${Math.abs(coords[1]).toFixed(2)}°${coords[1] >= 0 ? 'E' : 'W'}` : '121.0°E'

  const sched = trip.scheduleStatus
  const schedBadge =
    sched === 'on-time'
      ? '<span style="color:#10b981;font-weight:600">On time</span>'
      : sched === 'late'
      ? `<span style="color:#f59e0b;font-weight:600">+${trip.varianceHours}h</span>`
      : sched === 'early'
      ? `<span style="color:#38bdf8;font-weight:600">${trip.varianceHours}h</span>`
      : ''

  const width = 148
  const height = 132
  const anchor: [number, number] = [74, 132]

  const html = `
    <div class="lm-gods-eye-anchor ${selected ? 'is-selected' : ''}" data-trip-id="${tripId}">
      <div class="lm-gods-eye-card">
        <div class="lm-gods-eye-header">
          <span class="lm-gods-eye-badge">
            <span class="lm-gods-eye-rec-dot"></span>
            LIVE
          </span>
          <span class="lm-gods-eye-cam-tag" title="${camName}">CAM ${camId} · ${camName}</span>
          <span class="lm-gods-eye-fps">24 FPS</span>
        </div>
        <div class="lm-gods-eye-viewport">
          <div class="lm-gods-eye-hud">
            <div class="lm-gods-eye-radar-sweep"></div>
            <div class="lm-gods-eye-reticle">
              <span class="lm-gods-eye-crosshair ch-x"></span>
              <span class="lm-gods-eye-crosshair ch-y"></span>
              <span class="lm-gods-eye-ring r1"></span>
              <span class="lm-gods-eye-ring r2"></span>
              <span class="lm-gods-eye-blip"></span>
            </div>
            <div class="lm-gods-eye-overlay-stats">
              <span class="lm-gods-eye-stat-line">${latStr} ${lngStr}</span>
              <span class="lm-gods-eye-stat-line">${hdg} · ${sog} kts</span>
            </div>
            <div class="lm-gods-eye-stream-badge">
              <span class="lm-gods-eye-feed-state">LIVE FEED</span>
            </div>
          </div>
          <div class="lm-gods-eye-scanlines"></div>
          <div class="lm-gods-eye-corner tl"></div>
          <div class="lm-gods-eye-corner tr"></div>
          <div class="lm-gods-eye-corner bl"></div>
          <div class="lm-gods-eye-corner br"></div>
        </div>
        <div class="lm-gods-eye-footer">
          <span class="lm-gods-eye-vessel-title" title="${name}">${name}</span>
          <span class="lm-gods-eye-sog">${sog} kts${schedBadge ? ` · ${schedBadge}` : ''}</span>
        </div>
      </div>
      <div class="lm-gods-eye-stem"></div>
      <div class="lm-gods-eye-pin" style="border-color:${color};color:${color}">
        <span class="lm-gods-eye-ripple" style="border-color:${color}"></span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 17l2 3h16l2-3-4-2H6l-4 2zm10-15L4 13h16L12 2zm-1 4v4h2V6h-2z" /></svg>
      </div>
    </div>
  `
  return icon(html, [width, height], anchor)
}

function facilityIcon(type: 'warehouse' | 'dc', label: string, code: string) {
  const marker = type === 'warehouse'
    ? `<span class="lm-hub"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 21V8.5L12 3l9 5.5V21M3 21h18M8.5 21v-6h7v6"/></svg></span><span class="lm-label">${label}</span>`
    : `<span class="lm-dc"></span><span class="lm-label lm-label-sm">${code}</span>`
  return icon(`<div class="lm-marker">${marker}</div>`, type === 'warehouse' ? [120, 42] : [60, 28], type === 'warehouse' ? [60, 34] : [30, 7])
}

function pointIcon(kind: 'origin' | 'stop' | 'destination', color: string, label: string) {
  if (kind === 'destination') {
    const text = label && label !== 'Destination Port' && label !== 'Destination' ? label : 'Destination'
    return icon(`<div class="lm-marker lm-marker-pin"><span class="lm-label">${text}</span><svg class="lm-pin" viewBox="0 0 24 30" width="22" height="30" style="color:${color}"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="currentColor" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="9" r="2.3" fill="#fff"/></svg></div>`, [130, 38], [65, 38])
  }
  const dot = kind === 'origin' ? 'lm-node' : 'lm-stop'
  const text = label && label !== 'Origin Port' && label !== 'Origin' ? label : (kind === 'origin' ? 'Origin' : label)
  return icon(`<div class="lm-marker"><span class="lm-label ${kind === 'stop' ? 'lm-label-sm' : ''}">${text}</span><span class="${dot}" style="border-color:${color}">${kind === 'origin' ? `<span class="lm-node-dot" style="background:${color}"></span>` : ''}</span></div>`, [130, 28], [65, 14])
}

function clearItinerary() {
  for (const marker of itineraryMarkers) map?.removeLayer(marker)
  itineraryMarkers.length = 0
}

function drawItinerary() {
  clearItinerary()
  const trip = props.trips.find((t: any) => getTripId(t) === props.selectedId) as any
  if (!trip || !map) return
  const color = toneColor(getTripTone(trip))
  const route = getTripCoords(trip)
  if (route.length > 0) {
    const first = trip.originCoords || route[0]
    const last = trip.destCoords || route[route.length - 1]
    const originLabel = trip.origin || (trip.vesselId ? 'Origin' : trip.shipment?.origin) || 'Origin'
    const destLabel = trip.destination || (trip.vesselId ? 'Destination' : trip.shipment?.destination) || 'Destination'
    if (first) {
      itineraryMarkers.push(L.marker(first, { icon: pointIcon('origin', color, originLabel), interactive: false }).addTo(map))
    }
    for (const [i, stop] of (trip.stops ?? []).entries()) {
      itineraryMarkers.push(L.marker(stop, { icon: pointIcon('stop', color, `Stop ${i + 1}`), interactive: false }).addTo(map))
    }
    if (last) {
      itineraryMarkers.push(L.marker(last, { icon: pointIcon('destination', color, destLabel), interactive: false }).addTo(map))
    }
  }
}

function applyFocus() {
  if (!map) return
  const focus = props.selectedId ?? hoverId.value
  routes.forEach((route, id) => {
    const isSelected = props.selectedId === id
    const isHovered = hoverId.value === id
    const focused = id === focus
    const dim = focus !== null && !focused
    const opacity = dim ? 0.2 : 1
    if (route.base) route.base.setStyle({ opacity: opacity * 0.4 })
    if (route.travelled) route.travelled.setStyle({ opacity })
    if (route.remaining) route.remaining.setStyle({ opacity: dim ? 0.08 : 0.7 })
    if (route.origin) route.origin.setStyle({ opacity, fillOpacity: opacity })
    route.marker.setOpacity(dim ? 0.35 : 1)
    route.marker.setZIndexOffset(focused ? 1000 : 0)
    const hasCctv = hasCameras(route.trip) || hasCameras(id) || (route.trip?.vesselId ? hasCameras(route.trip.vesselId) : false) || (route.trip?.name ? hasCameras(route.trip.name) : false)
    const isGodsEye = props.showGodsEyeCctv && hasCctv
    if (isGodsEye) {
      route.marker.setIcon(godsEyeCameraIcon(route.trip, route.color, isSelected, route.index ?? 0))
      route.marker.unbindTooltip()
    } else {
      route.marker.setIcon(vesselIcon(route.color, isSelected, hasCctv))
    }

    if (!isGodsEye && (isSelected || isHovered)) {
      route.marker.openTooltip()
    } else {
      route.marker.closeTooltip()
    }

    const tooltip = route.marker.getTooltip()
    const tooltipEl = tooltip?.getElement()
    if (tooltipEl) {
      tooltipEl.style.opacity = dim ? '0.35' : '1'
      tooltipEl.style.zIndex = focused ? '1000' : 'auto'
      if (focused) {
        tooltipEl.style.borderColor = 'var(--primary, #0e6e69)'
        tooltipEl.style.boxShadow = '0 0 0 2px var(--primary, #0e6e69), 0 4px 12px rgba(0,0,0,0.25)'
      } else {
        tooltipEl.style.borderColor = 'var(--border)'
        tooltipEl.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.25)'
      }
    }
  })
}

function drawRoutes() {
  if (!map || !L) return
  routes.forEach((route) => [route.base, route.travelled, route.remaining, route.origin, route.marker].forEach((layer) => layer && map.removeLayer(layer)))
  routes.clear()
  const allPoints: Point[] = []

  for (const [tripIdx, trip] of props.trips.entries()) {
    const id = getTripId(trip)
    const name = getTripName(trip)
    const color = toneColor(getTripTone(trip))
    const route = getTripCoords(trip)
    const markerPos = getTripMarkerPos(trip)
    allPoints.push(markerPos)

    let base: any = null
    let travelledLine: any = null
    let remainingLine: any = null
    let origin: any = null

    if (route.length > 1) {
      allPoints.push(...route)
      const progress = getTripProgress(trip)
      const { travelled, remaining } = splitByProgress(route, progress)
      base = L.polyline(route, { color: cssVar('--muted-foreground'), weight: 2, opacity: 0.35 }).addTo(map)
      remainingLine = L.polyline(remaining, { color: cssVar('--muted-foreground'), weight: 3, opacity: 0.6, dashArray: '2 8', lineCap: 'round' }).addTo(map)
      travelledLine = L.polyline(travelled, { color, weight: 3.5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(map)
      origin = L.circleMarker(route[0], { radius: 4, color, weight: 2, fillColor: cssVar('--card'), fillOpacity: 1 }).addTo(map)
    }

    const hasCctv = hasCameras(trip) || hasCameras(id) || ((trip as any).vesselId ? hasCameras((trip as any).vesselId) : false) || ((trip as any).name ? hasCameras((trip as any).name) : false)
    const isGodsEye = props.showGodsEyeCctv && hasCctv
    const isSelected = props.selectedId === id
    const markerIcon =
      isGodsEye
        ? godsEyeCameraIcon(trip, color, isSelected, tripIdx)
        : vesselIcon(color, isSelected, hasCctv)
    const marker = L.marker(markerPos, { icon: markerIcon, riseOnHover: true }).addTo(map)
    marker.on('click', () => {
      emit('select', id)
      if (hasCctv) {
        emit('open-camera', trip)
      }
      if (!isGodsEye) {
        marker.openTooltip()
      }
    })
    marker.on('mouseover', () => {
      marker.setZIndexOffset(1000)
    })
    marker.on('mouseout', () => {
      if (props.selectedId !== id && hoverId.value !== id) {
        marker.setZIndexOffset(0)
        marker.closeTooltip()
      }
    })

    if (!isGodsEye) {
      let tooltipHtml = `<b>${name}</b>`
      if ((trip as any).sog !== undefined) {
        const sched = (trip as any).scheduleStatus
        const schedLabel =
          sched === 'on-time'
            ? '<span style="color:#10b981;font-weight:600">On time</span>'
            : sched === 'late'
            ? `<span style="color:#f59e0b;font-weight:600">+${(trip as any).varianceHours}h Late</span>`
            : sched === 'early'
            ? `<span style="color:#38bdf8;font-weight:600">${(trip as any).varianceHours}h Early</span>`
            : '<span style="color:#94a3b8">In port</span>'
        tooltipHtml += `<br/><span style="font-size:11px">${(trip as any).sog} kts · ${schedLabel}</span>`
      }
      if (hasCctv) {
        tooltipHtml += `<br/><span style="display:inline-flex;align-items:center;gap:4px;color:#10b981;font-weight:600;font-size:11px;margin-top:2px;">📹 CCTV Live Available</span>`
      }
      marker.bindTooltip(tooltipHtml, {
        permanent: false,
        direction: 'top',
        offset: [0, -18],
      })
      const tooltip = marker.getTooltip()
      if (tooltip) {
        tooltip.on('click', () => {
          emit('select', id)
          if (hasCctv) {
            emit('open-camera', trip)
          }
        })
      }
    }
    routes.set(id, { base, travelled: travelledLine, remaining: remainingLine, origin, marker, truck: markerPos, color, trip, index: tripIdx })
  }

  if (allPoints.length) {
    map.fitBounds(allPoints, { padding: [50, 50], maxZoom: 6 })
  }
  drawItinerary()
  applyFocus()
}

function fitSelected() {
  const trip = props.trips.find((t: any) => getTripId(t) === props.selectedId) as any
  if (trip && map) {
    const route = getTripCoords(trip)
    const points = route.length > 0 ? route : [getTripMarkerPos(trip)]
    if (points.length > 1) {
      map.fitBounds(points, { paddingTopLeft: [72, 72], paddingBottomRight: [380, 72], maxZoom: 9, animate: true, duration: 0.7 })
    } else if (points.length === 1) {
      map.setView(points[0], 7, { animate: true, duration: 0.7 })
    }
  }
}

function hover(id: string | null) {
  hoverId.value = id
  applyFocus()
}
function invalidateSize() {
  map?.invalidateSize()
}
defineExpose({ hover, invalidateSize })

let resizeObserver: ResizeObserver | null = null

function updateTileLayer() {
  if (!map || !L) return
  if (currentTileLayer) {
    map.removeLayer(currentTileLayer)
    currentTileLayer = null
  }
  const tileUrl = isDark.value
    ? 'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
    : 'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'

  currentTileLayer = L.tileLayer(tileUrl, {
    maxZoom: 16,
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
  }).addTo(map)
}

onMounted(async () => {
  L = (await import('leaflet')).default
  if (!el.value) return
  map = L.map(el.value, { zoomControl: false, minZoom: 2, maxZoom: 19, attributionControl: true }).setView([15, 75], 3)
  updateTileLayer()
  L.control.zoom({ position: 'bottomright' }).addTo(map)
  drawRoutes()
  requestAnimationFrame(() => map?.invalidateSize())

  if (typeof ResizeObserver !== 'undefined' && el.value) {
    resizeObserver = new ResizeObserver(() => {
      map?.invalidateSize()
    })
    resizeObserver.observe(el.value)
  }

  if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
    themeMutationObserver = new MutationObserver(async () => {
      if (!map) return
      updateTileLayer()
      await nextTick()
      drawRoutes()
    })
    themeMutationObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
  }
})

watch(() => props.selectedId, () => { drawItinerary(); applyFocus(); fitSelected() })
watch(() => props.trips, drawRoutes, { deep: true })
watch(() => props.showGodsEyeCctv, drawRoutes)
watch([isDark, theme], async () => {
  if (map) {
    updateTileLayer()
    await nextTick()
    drawRoutes()
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  themeMutationObserver?.disconnect()
  themeMutationObserver = null
  clearItinerary()
  networkMarkers.length = 0
  routes.clear()
  if (currentTileLayer && map) {
    map.removeLayer(currentTileLayer)
    currentTileLayer = null
  }
  if (map) { map.remove(); map = null }
})
</script>

<template>
  <div class="relative size-full overflow-hidden">
    <div ref="el" class="size-full" />

    <!-- God's Eye CCTV Radar Tactical Overlay -->
    <div
      v-if="showGodsEyeCctv && trips.some((t: any) => hasCameras(t))"
      class="absolute top-3 left-3 z-[999] pointer-events-none flex flex-col gap-1.5 select-none"
    >
      <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card/90 backdrop-blur-md border border-primary/40 shadow-xl text-xs font-mono">
        <span class="size-2 rounded-full bg-destructive animate-ping" />
        <span class="font-bold text-destructive tracking-widest uppercase">GOD'S EYE VIEW</span>
        <span class="text-muted-foreground/60">|</span>
        <span class="text-primary font-semibold">FLEET CCTV RADAR HUD</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
:deep(.leaflet-container) {
  background: var(--background);
  font-family: var(--font-sans);
}
:deep(.leaflet-pane),
:deep(.leaflet-top),
:deep(.leaflet-bottom) {
  z-index: 1;
}
:deep(.leaflet-control-zoom) {
  border: 1px solid var(--border) !important;
  border-radius: 8px !important;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25) !important;
}
:deep(.leaflet-control-zoom a) {
  color: var(--foreground) !important;
  background: var(--card) !important;
  border-bottom: 1px solid var(--border) !important;
  transition: background-color 0.15s, color 0.15s;
}
:deep(.leaflet-control-zoom a:last-child) {
  border-bottom: none !important;
}
:deep(.leaflet-control-zoom a:hover) {
  background: var(--accent) !important;
  color: var(--accent-foreground) !important;
}
:deep(.leaflet-control-attribution) {
  background: var(--background) !important;
  color: var(--muted-foreground) !important;
  opacity: 0.85;
  font-size: 10px;
}
:deep(.leaflet-control-attribution a) {
  color: var(--primary) !important;
}
:deep(.leaflet-tooltip) {
  background: var(--popover) !important;
  color: var(--popover-foreground) !important;
  border: 1px solid var(--border) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25) !important;
  border-radius: 6px !important;
  padding: 6px 10px !important;
  pointer-events: auto !important;
  cursor: pointer !important;
  user-select: none !important;
}
:deep(.leaflet-tooltip-top:before) {
  border-top-color: var(--border) !important;
}
:deep(.leaflet-tooltip-bottom:before) {
  border-bottom-color: var(--border) !important;
}
:deep(.leaflet-tooltip-left:before) {
  border-left-color: var(--border) !important;
}
:deep(.leaflet-tooltip-right:before) {
  border-right-color: var(--border) !important;
}

/* God's Eye View Floating CCTV Radar Card Styles */
:deep(.lm-gods-eye-anchor) {
  position: relative;
  width: 148px;
  height: 132px;
  pointer-events: auto;
  cursor: pointer;
}
:deep(.lm-gods-eye-card) {
  position: absolute;
  top: 0;
  left: 0;
  width: 148px;
  background: rgba(15, 23, 42, 0.94);
  border: 1px solid rgba(56, 189, 248, 0.5);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 0 14px rgba(56, 189, 248, 0.25);
  overflow: hidden;
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}
:deep(.lm-gods-eye-anchor:hover .lm-gods-eye-card),
:deep(.lm-gods-eye-anchor.is-selected .lm-gods-eye-card) {
  transform: scale(1.04);
  border-color: #10b981;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.7), 0 0 18px rgba(16, 185, 129, 0.45);
}
:deep(.lm-gods-eye-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 6px;
  background: rgba(30, 41, 59, 0.85);
  border-bottom: 1px solid rgba(56, 189, 248, 0.25);
  font-size: 8px;
  color: #94a3b8;
  font-weight: 600;
}
:deep(.lm-gods-eye-badge) {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: #ef4444;
  font-weight: 700;
  letter-spacing: 0.5px;
}
:deep(.lm-gods-eye-rec-dot) {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #ef4444;
  animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
}
:deep(.lm-gods-eye-cam-tag) {
  max-width: 68px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #e2e8f0;
  font-weight: 600;
}
:deep(.lm-gods-eye-fps) {
  color: #10b981;
  font-weight: 600;
  font-size: 7.5px;
}
:deep(.lm-gods-eye-viewport) {
  position: relative;
  width: 100%;
  height: 62px;
  background: #030712;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
:deep(.lm-gods-eye-hud) {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}
:deep(.lm-gods-eye-radar-sweep) {
  position: absolute;
  inset: -60%;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent 0deg, rgba(16, 185, 129, 0.25) 60deg, transparent 60.1deg);
  animation: lm-radar 3s linear infinite;
}
:deep(.lm-gods-eye-reticle) {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
:deep(.lm-gods-eye-crosshair.ch-x) {
  position: absolute;
  width: 100%;
  height: 1px;
  background: rgba(56, 189, 248, 0.2);
}
:deep(.lm-gods-eye-crosshair.ch-y) {
  position: absolute;
  height: 100%;
  width: 1px;
  background: rgba(56, 189, 248, 0.2);
}
:deep(.lm-gods-eye-ring) {
  position: absolute;
  border: 1px dashed rgba(56, 189, 248, 0.35);
  border-radius: 50%;
}
:deep(.lm-gods-eye-ring.r1) {
  width: 26px;
  height: 26px;
}
:deep(.lm-gods-eye-ring.r2) {
  width: 48px;
  height: 48px;
}
:deep(.lm-gods-eye-blip) {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 6px #10b981;
  top: 38%;
  left: 56%;
}
:deep(.lm-gods-eye-overlay-stats) {
  position: absolute;
  top: 4px;
  left: 6px;
  font-size: 7.5px;
  color: rgba(148, 163, 184, 0.95);
  display: flex;
  flex-direction: column;
  gap: 1.5px;
  line-height: 1;
  text-shadow: 0 1px 2px #000;
}
:deep(.lm-gods-eye-stream-badge) {
  position: absolute;
  bottom: 4px;
  right: 5px;
  background: rgba(16, 185, 129, 0.2);
  border: 1px solid rgba(16, 185, 129, 0.5);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 7px;
  color: #34d399;
  font-weight: 700;
  letter-spacing: 0.5px;
}
:deep(.lm-gods-eye-scanlines) {
  position: absolute;
  inset: 0;
  background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.35) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 255, 0, 0.03));
  background-size: 100% 2px, 3px 100%;
  pointer-events: none;
  z-index: 3;
}
:deep(.lm-gods-eye-corner) {
  position: absolute;
  width: 6px;
  height: 6px;
  border-color: #38bdf8;
  z-index: 4;
}
:deep(.lm-gods-eye-corner.tl) {
  top: 3px;
  left: 3px;
  border-top: 1.5px solid;
  border-left: 1.5px solid;
}
:deep(.lm-gods-eye-corner.tr) {
  top: 3px;
  right: 3px;
  border-top: 1.5px solid;
  border-right: 1.5px solid;
}
:deep(.lm-gods-eye-corner.bl) {
  bottom: 3px;
  left: 3px;
  border-bottom: 1.5px solid;
  border-left: 1.5px solid;
}
:deep(.lm-gods-eye-corner.br) {
  bottom: 3px;
  right: 3px;
  border-bottom: 1.5px solid;
  border-right: 1.5px solid;
}
:deep(.lm-gods-eye-footer) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3.5px 6px;
  background: rgba(15, 23, 42, 0.95);
  font-size: 8.5px;
  color: #f8fafc;
  font-weight: 600;
  border-top: 1px solid rgba(56, 189, 248, 0.2);
}
:deep(.lm-gods-eye-vessel-title) {
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
}
:deep(.lm-gods-eye-sog) {
  color: #38bdf8;
  font-weight: 600;
}
:deep(.lm-gods-eye-stem) {
  position: absolute;
  bottom: 22px;
  left: 50%;
  transform: translateX(-50%);
  width: 1.5px;
  height: 16px;
  background: #38bdf8;
}
:deep(.lm-gods-eye-pin) {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #0f172a;
  border: 2px solid #38bdf8;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 8px rgba(56, 189, 248, 0.5);
}
:deep(.lm-gods-eye-pin svg) {
  width: 12px;
  height: 12px;
  fill: currentColor;
}
:deep(.lm-gods-eye-ripple) {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 1.5px solid currentColor;
  animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
}

@keyframes lm-radar {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
