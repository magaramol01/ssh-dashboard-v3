<script setup lang="ts">
/** Live fleet map backed by Leaflet + OpenStreetMap tiles. */
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import type { ResolvedTrip } from '~/mocks/live'
import type { Tone } from '~/mocks/shipments'
import { STATUS_LABELS } from '~/mocks/shipments'
import { NETWORK } from '~/mocks/network'
type Point = [number, number] // Leaflet order: [lat, lng]

type RouteLayers = {
  base: any
  travelled: any
  remaining: any
  origin: any
  marker: any
  truck: Point
  color: string
}

const props = defineProps<{ trips: (ResolvedTrip | any)[]; selectedId: string | null }>()
const emit = defineEmits<{ (e: 'select', id: string): void }>()

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

function vesselIcon(color: string, selected: boolean) {
  const size = selected ? 38 : 32
  return icon(
    `<div class="lm-vessel-icon" style="width:${size}px;height:${size}px;border-color:${color};color:${color}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 17l2 3h16l2-3-4-2H6l-4 2zm10-15L4 13h16L12 2zm-1 4v4h2V6h-2z" /></svg></div>`,
    [size, size],
  )
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
    route.marker.setIcon(vesselIcon(route.color, isSelected))

    if (isSelected || isHovered) {
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

  for (const trip of props.trips) {
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

    const marker = L.marker(markerPos, { icon: vesselIcon(color, false), riseOnHover: true }).addTo(map)
    marker.on('click', () => {
      emit('select', id)
      marker.openTooltip()
    })
    marker.on('mouseout', () => {
      if (props.selectedId !== id && hoverId.value !== id) {
        marker.closeTooltip()
      }
    })
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
    marker.bindTooltip(tooltipHtml, {
      permanent: false,
      direction: 'top',
      offset: [0, -18],
    })
    const tooltip = marker.getTooltip()
    if (tooltip) {
      tooltip.on('click', () => emit('select', id))
    }
    routes.set(id, { base, travelled: travelledLine, remaining: remainingLine, origin, marker, truck: markerPos, color })
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

<template><div ref="el" class="size-full" /></template>

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
</style>
