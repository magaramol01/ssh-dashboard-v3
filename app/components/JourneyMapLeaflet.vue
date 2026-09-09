<script setup lang="ts">
/** A shipment route on Leaflet + OpenStreetMap tiles. */
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import type { GeoPoint } from '~/mocks/live'

const props = withDefaults(defineProps<{
  coords: GeoPoint[]
  stops?: GeoPoint[]
  progress: number
  originLabel: string
  destinationLabel: string
  delivered?: boolean
}>(), { stops: () => [], delivered: false })

const el = ref<HTMLElement | null>(null)
let L: any = null
let map: any = null
let currentTileLayer: any = null
const layers: any[] = []
const ROUTE = '#2dd4bf'

const vehicle = computed<GeoPoint>(() => {
  if (props.coords.length < 2) return props.coords[0] ?? [0, 0]
  const distance = (a: GeoPoint, b: GeoPoint) => Math.hypot(b[0] - a[0], b[1] - a[1])
  const total = props.coords.slice(1).reduce((sum, point, i) => sum + distance(props.coords[i]!, point), 0)
  let target = Math.min(1, Math.max(0, props.progress / 100)) * total
  for (let i = 1; i < props.coords.length; i++) {
    const a = props.coords[i - 1]!, b = props.coords[i]!, length = distance(a, b)
    if (target <= length || i === props.coords.length - 1) {
      const ratio = length ? target / length : 0
      return [a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio]
    }
    target -= length
  }
  return props.coords[props.coords.length - 1]!
})

function markerIcon(html: string, size: [number, number], anchor: [number, number]) {
  return L.divIcon({ html, className: 'lm-leaflet-icon', iconSize: size, iconAnchor: anchor })
}
function pin(color: string, glyph: string) {
  return markerIcon(`<span class="jm-leaflet-pin" style="background:${color}">${glyph}</span>`, [30, 30], [15, 15])
}
function draw() {
  if (!map || !L) return
  layers.splice(0).forEach((layer) => map.removeLayer(layer))
  if (!props.coords.length) return
  layers.push(L.polyline(props.coords, { color: ROUTE, weight: 3, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }).addTo(map))
  layers.push(L.marker(props.coords[0], { icon: pin('#0ea5b7', '•'), interactive: false }).addTo(map))
  props.stops.forEach((stop) => layers.push(L.circleMarker(stop, { radius: 5, color: '#fff', weight: 2, fillColor: ROUTE, fillOpacity: 1, interactive: false }).addTo(map)))
  layers.push(L.marker(props.coords[props.coords.length - 1], { icon: pin(ROUTE, '•'), interactive: false }).addTo(map))
  const vehicleGlyph = props.delivered ? '✓' : '◆'
  layers.push(L.marker(vehicle.value, { icon: pin(ROUTE, vehicleGlyph), interactive: false, zIndexOffset: 1000 }).addTo(map))
  map.fitBounds(props.coords, { padding: [46, 46], maxZoom: 11, animate: false })
}

const { isDark } = useTheme()

function updateTileLayer() {
  if (!map || !L) return
  if (currentTileLayer) {
    map.removeLayer(currentTileLayer)
    currentTileLayer = null
  }
  const tileUrl = isDark.value
    ? 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_nolabels/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/light_nolabels/{z}/{x}/{y}{r}.png'

  currentTileLayer = L.tileLayer(tileUrl, {
    maxZoom: 19,
    subdomains: 'abcd',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map)
}

onMounted(async () => {
  L = (await import('leaflet')).default
  if (!el.value) return
  map = L.map(el.value, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView(vehicle.value, 6)
  updateTileLayer()
  draw()
  requestAnimationFrame(() => map?.invalidateSize())
})

watch(() => [props.coords, props.stops, props.progress, props.delivered], draw, { deep: true })
watch(isDark, () => updateTileLayer())

onBeforeUnmount(() => {
  layers.splice(0)
  if (currentTileLayer && map) {
    map.removeLayer(currentTileLayer)
    currentTileLayer = null
  }
  if (map) { map.remove(); map = null }
})
</script>

<template><div ref="el" class="size-full" /></template>

<style scoped>
:deep(.leaflet-container) { background: var(--background); font-family: var(--font-sans); }
:deep(.leaflet-control-zoom) { border: 1px solid var(--border) !important; border-radius: 8px !important; overflow: hidden; }
:deep(.leaflet-control-zoom a) { color: var(--foreground) !important; background: var(--card) !important; border-color: var(--border) !important; }
:deep(.leaflet-control-attribution) { background: var(--background) !important; color: var(--muted-foreground) !important; font-size: 10px; }
</style>
