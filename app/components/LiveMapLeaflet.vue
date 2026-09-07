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

const props = defineProps<{ trips: ResolvedTrip[]; selectedId: string | null }>()
const emit = defineEmits<{ (e: 'select', id: string): void }>()

const { theme } = useTheme()
const el = ref<HTMLElement | null>(null)
let L: any = null
let map: any = null
const routes = new Map<string, RouteLayers>()
const networkMarkers: any[] = []
const itineraryMarkers: any[] = []
const hoverId = ref<string | null>(null)

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

function truckIcon(color: string, selected: boolean) {
  const size = selected ? 38 : 32
  return icon(
    `<div class="lm-truck-icon" style="width:${size}px;height:${size}px;border-color:${color};color:${color}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14M7 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4M17 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4" /></svg></div>`,
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
    return icon(`<div class="lm-marker lm-marker-pin"><span class="lm-label">Destination · ${label}</span><svg class="lm-pin" viewBox="0 0 24 30" width="22" height="30" style="color:${color}"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="currentColor" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="9" r="2.3" fill="#fff"/></svg></div>`, [130, 38], [65, 38])
  }
  const dot = kind === 'origin' ? 'lm-node' : 'lm-stop'
  const labelText = kind === 'origin' ? `Origin · ${label}` : label
  return icon(`<div class="lm-marker"><span class="lm-label ${kind === 'stop' ? 'lm-label-sm' : ''}">${labelText}</span><span class="${dot}" style="border-color:${color}">${kind === 'origin' ? `<span class="lm-node-dot" style="background:${color}"></span>` : ''}</span></div>`, [130, 28], [65, 14])
}

function clearItinerary() {
  for (const marker of itineraryMarkers) map?.removeLayer(marker)
  itineraryMarkers.length = 0
}

function drawItinerary() {
  clearItinerary()
  const trip = props.trips.find((t) => t.shipment.id === props.selectedId)
  if (!trip || !map) return
  const color = toneColor(trip.tone)
  const first = trip.coords[0]!
  const last = trip.coords[trip.coords.length - 1]!
  const via = (trip.shipment.lastLocation || '').split('—')[0]!.trim()
  itineraryMarkers.push(L.marker(first, { icon: pointIcon('origin', color, trip.shipment.origin), interactive: false }).addTo(map))
  for (const [i, stop] of (trip.stops ?? []).entries()) {
    itineraryMarkers.push(L.marker(stop, { icon: pointIcon('stop', color, via || `Stop ${i + 1}`), interactive: false }).addTo(map))
  }
  itineraryMarkers.push(L.marker(last, { icon: pointIcon('destination', color, trip.shipment.destination), interactive: false }).addTo(map))
}

function applyFocus() {
  if (!map) return
  const focus = props.selectedId ?? hoverId.value
  routes.forEach((route, id) => {
    const focused = id === focus
    const dim = focus !== null && !focused
    const opacity = dim ? 0.2 : 1
    route.base.setStyle({ opacity: opacity * 0.5 })
    route.travelled.setStyle({ opacity })
    route.remaining.setStyle({ opacity: dim ? 0.08 : 0.7 })
    route.origin.setStyle({ opacity, fillOpacity: opacity })
    route.marker.setOpacity(dim ? 0.35 : 1)
    route.marker.setZIndexOffset(focused ? 1000 : 0)
    route.marker.setIcon(truckIcon(route.color, props.selectedId === id))
  })
}

function drawRoutes() {
  if (!map || !L) return
  routes.forEach((route) => [route.base, route.travelled, route.remaining, route.origin, route.marker].forEach((layer) => map.removeLayer(layer)))
  routes.clear()
  const allPoints: Point[] = []
  for (const trip of props.trips) {
    const color = toneColor(trip.tone)
    const { truck, travelled, remaining } = splitByProgress(trip.coords, trip.shipment.progress)
    allPoints.push(...trip.coords)
    const base = L.polyline(trip.coords, { color: cssVar('--muted-foreground'), weight: 2, opacity: 0.4 }).addTo(map)
    const remainingLine = L.polyline(remaining, { color: cssVar('--muted-foreground'), weight: 3, opacity: 0.7, dashArray: '2 8', lineCap: 'round' }).addTo(map)
    const travelledLine = L.polyline(travelled, { color, weight: 4, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(map)
    const origin = L.circleMarker(trip.coords[0], { radius: 4, color, weight: 2, fillColor: cssVar('--card'), fillOpacity: 1 }).addTo(map)
    const marker = L.marker(truck, { icon: truckIcon(color, false), riseOnHover: true }).addTo(map)
    marker.on('click', () => emit('select', trip.shipment.id))
    marker.bindTooltip(`${trip.shipment.id} · ${STATUS_LABELS[trip.shipment.status]}`, { direction: 'top', offset: [0, -18] })
    routes.set(trip.shipment.id, { base, travelled: travelledLine, remaining: remainingLine, origin, marker, truck, color })
  }
  if (allPoints.length) map.fitBounds(allPoints, { padding: [70, 70], maxZoom: 6 })
  drawItinerary()
  applyFocus()
}

function addNetworkMarkers() {
  for (const location of NETWORK) {
    const marker = L.marker(location.coords, { icon: facilityIcon(location.type, location.name, location.code), interactive: false }).addTo(map)
    networkMarkers.push(marker)
  }
}

function fitSelected() {
  const trip = props.trips.find((t) => t.shipment.id === props.selectedId)
  if (trip && map) map.fitBounds(trip.coords, { paddingTopLeft: [72, 72], paddingBottomRight: [380, 72], maxZoom: 11, animate: true, duration: 0.7 })
}

function hover(id: string | null) {
  hoverId.value = id
  applyFocus()
}
defineExpose({ hover })

onMounted(async () => {
  L = (await import('leaflet')).default
  if (!el.value) return
  map = L.map(el.value, { zoomControl: false, minZoom: 2, maxZoom: 19, attributionControl: true }).setView([39.5, -98.35], 4)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map)
  L.control.zoom({ position: 'bottomright' }).addTo(map)
  addNetworkMarkers()
  drawRoutes()
  requestAnimationFrame(() => map?.invalidateSize())
})

watch(() => props.selectedId, () => { drawItinerary(); applyFocus(); fitSelected() })
watch(() => props.trips, drawRoutes, { deep: true })
watch(theme, () => { if (map) drawRoutes() })

onBeforeUnmount(() => {
  clearItinerary()
  networkMarkers.length = 0
  routes.clear()
  if (map) { map.remove(); map = null }
})
</script>

<template><div ref="el" class="size-full" /></template>

<style scoped>
:deep(.leaflet-container) { background: var(--muted); font-family: var(--font-sans); }
:deep(.leaflet-pane), :deep(.leaflet-top), :deep(.leaflet-bottom) { z-index: 1; }
</style>
