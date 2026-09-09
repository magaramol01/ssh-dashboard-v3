<script setup lang="ts">
/** Inbound ocean journey on Leaflet + OpenStreetMap tiles. */
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { containerGeo, type BikeContainer } from '~/mocks/containers'

const props = defineProps<{ container: BikeContainer }>()
const geo = computed(() => containerGeo(props.container))
const el = ref<HTMLElement | null>(null)
let L: any = null
let map: any = null
let currentTileLayer: any = null
const layers: any[] = []
const ROUTE = '#2dd4bf'

function markerIcon(html: string, size: [number, number], anchor: [number, number]) {
  return L.divIcon({ html, className: 'lm-leaflet-icon', iconSize: size, iconAnchor: anchor })
}
function facilityIcon(type: string, label: string) {
  return markerIcon(`<div class="cm-marker"><span class="cm-dot ${type === 'warehouse' ? 'cm-warehouse' : ''}">${type === 'warehouse' ? '▦' : '•'}</span><span class="cm-label">${label}</span></div>`, [150, 42], [75, 25])
}
function vesselIcon() {
  return markerIcon('<span class="cm-vessel">◆</span>', [32, 32], [16, 16])
}
function draw() {
  if (!map || !L) return
  layers.splice(0).forEach((layer) => map.removeLayer(layer))
  const line = geo.value.line.map(([lng, lat]) => [lat, lng])
  if (!line.length) return
  layers.push(L.polyline(line, { color: ROUTE, weight: 2.5, dashArray: '6 7', lineCap: 'round', opacity: 0.9 }).addTo(map))
  for (const marker of geo.value.markers) {
    layers.push(L.marker([marker.lngLat[1], marker.lngLat[0]], { icon: facilityIcon(marker.type, marker.label), interactive: false }).addTo(map))
  }
  layers.push(L.marker([geo.value.vessel[1], geo.value.vessel[0]], { icon: vesselIcon(), interactive: false, zIndexOffset: 1000 }).addTo(map))
  map.fitBounds(line, { padding: [54, 54], animate: false })
}

const { isDark } = useTheme()

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
  const vessel = geo.value.vessel
  map = L.map(el.value, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView([vessel[1], vessel[0]], 2)
  updateTileLayer()
  draw()
  requestAnimationFrame(() => map?.invalidateSize())
})

watch(geo, draw, { deep: true })
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
