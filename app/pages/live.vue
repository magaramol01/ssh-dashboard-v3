<script setup lang="ts">
/**
 * Live tracking — a logistics control tower. A triage-sorted dispatch queue on
 * the left, a near-monochrome graphite fleet map on the right under a docked
 * KPI ribbon, and a right-edge inspector drawer for the selected trip. Hovering
 * a rail card lights its lane, selecting opens the inspector and flies the map.
 * Dispatcher-gated.
 */
import { ref, computed, watch, nextTick } from 'vue'
import { Target, MapPin, Truck, Star, X } from 'lucide-vue-next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OverlayScroll } from '@/components/ui/overlay-scroll'
import LiveMapLeaflet from '@/components/LiveMapLeaflet.vue'
import { toneBadge, toneDot, shortDate } from '@/lib/utils'

import { resolvedTrips, type ResolvedTrip } from '~/mocks/live'
import { STATUS_LABELS, type Tone } from '~/mocks/shipments'
import { DRIVERS, DRIVER_STATUS_LABELS, DRIVER_STATUS_TONE } from '~/mocks/drivers'
import { VEHICLES, VEHICLE_TYPE_LABELS, VEHICLE_STATUS_LABELS, VEHICLE_STATUS_TONE } from '~/mocks/fleet'

export interface LiveVesselItem {
  id: string
  vesselId: number
  name: string
  sog: number
  coords: [number, number]
  routeCoords: [number, number][]
  originCoords: [number, number] | null
  destCoords: [number, number] | null
  distanceNm: number
  progress: number
  packetTs: string
  windSpeedBF: number
  waveDirection: string
  swellDirection: string
  currentSpeed: string
  currentDirection: string
  heading: string
  status: 'in-transit' | 'manoeuvring' | 'moored'
  tone: Tone
}

definePageMeta({ middleware: 'require-dispatcher' })
useHead({ title: 'Live tracking · Smart Ship Hub' })

const { tenant } = useTenant()

// Fetch real vessel data dynamically forwarding the user's active session
const { data: vesselResponse, status: vesselStatus, refresh: refreshVessels } = await useAsyncData(
  () => `vessels-geojson-${tenant.value}`,
  () =>
    $fetch<{ success: boolean; vessels: LiveVesselItem[] }>('/api/vessels/geojson', {
      params: { tenant: tenant.value },
    }).catch(() => null),
  {
    watch: [tenant],
    default: () => null,
  }
)

const liveVessels = computed(() => vesselResponse.value?.vessels || [])
const isRealData = computed(() => liveVessels.value.length > 0)

const trips = resolvedTrips() // mock fallback
const activeTrips = computed<any[]>(() => (isRealData.value ? liveVessels.value : trips))

const selectedId = ref<string | null>(null)
const mapRef = ref<{ hover?: (id: string | null) => void } | null>(null)
const inspectorRef = ref<HTMLElement | null>(null)
let triggerEl: HTMLElement | null = null

function select(id: string) {
  const next = selectedId.value === id ? null : id
  if (next && !import.meta.server) triggerEl = (document.activeElement as HTMLElement) ?? null
  selectedId.value = next
}
function closeInspector() {
  selectedId.value = null
}
function onHover(id: string | null) {
  mapRef.value?.hover?.(id)
}

watch(selectedId, async (val, old) => {
  if (import.meta.server) return
  if (val) {
    await nextTick()
    inspectorRef.value?.focus()
  } else if (old) {
    triggerEl?.focus?.()
    triggerEl = null
  }
})

/** Tone → CSS variable, for tinting rail accents + progress fills inline. */
const TONE_BG: Record<Tone, string> = {
  success: 'var(--success)',
  info: 'var(--info)',
  warning: 'var(--warning)',
  destructive: 'var(--destructive)',
  muted: 'var(--muted-foreground)',
}

function initials(name?: string): string {
  if (!name) return '—'
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// Telemetry for the inspector
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
function headingOf(t: any): string {
  if (t.heading) return t.heading
  if (!t.coords || !t.coords.length) return 'N'
  const a = t.coords[0]!,
    b = t.coords[t.coords.length - 1]!
  const deg = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]!
}

function speedOf(t: any): string {
  if (t.sog !== undefined) return `${t.sog} kts`
  if (!['in-transit', 'out-for-delivery', 'picked-up'].includes(t.shipment?.status)) return '0 kts'
  const n = parseInt((t.shipment?.id || '').replace(/\D/g, '').slice(-3) || '0', 10)
  return `${12 + (n % 10)} kts`
}

function etaChip(tone: Tone): { label: string; variant: ReturnType<typeof toneBadge> } {
  if (tone === 'destructive') return { label: 'Exception', variant: 'destructive' }
  if (tone === 'warning') return { label: 'Caution', variant: 'warning' }
  if (tone === 'muted') return { label: 'Moored', variant: 'secondary' }
  return { label: 'Underway', variant: 'success' }
}

/** Live fleet summary for the docked KPI ribbon. */
const stats = computed(() => {
  if (isRealData.value) {
    const list = liveVessels.value
    const onRoute = list.filter((v) => v.sog > 0.5).length
    const attention = list.filter((v) => v.windSpeedBF >= 7 || v.tone === 'warning').length
    const avgProgress = Math.round(list.reduce((s, v) => s + v.progress, 0) / Math.max(1, list.length))
    return { active: list.length, onRoute, attention, avgProgress }
  }
  const onRoute = trips.filter((t) =>
    ['in-transit', 'out-for-delivery', 'picked-up'].includes(t.shipment.status)
  ).length
  const attention = trips.filter((t) => ['delayed', 'exception'].includes(t.shipment.status)).length
  const avgProgress = Math.round(
    trips.reduce((s, t) => s + t.shipment.progress, 0) / Math.max(1, trips.length)
  )
  return { active: trips.length, onRoute, attention, avgProgress }
})

/** Route-colour key */
const legend = computed(() => {
  if (isRealData.value) {
    return [
      { label: 'Underway', tone: 'success' as Tone },
      { label: 'Moored / In Port', tone: 'muted' as Tone },
      { label: 'High Wind (BF ≥ 7)', tone: 'warning' as Tone },
    ]
  }
  const seen = new Set<Tone>()
  const out: { label: string; tone: Tone }[] = []
  for (const t of trips) {
    if (seen.has(t.tone)) continue
    seen.add(t.tone)
    out.push({ label: STATUS_LABELS[t.shipment.status], tone: t.tone })
  }
  return out
})

const selected = computed(() => {
  if (isRealData.value) {
    return liveVessels.value.find((v) => v.id === selectedId.value) ?? null
  }
  return trips.find((t) => t.shipment.id === selectedId.value) ?? null
})

const drivers = computed(() =>
  [...DRIVERS].sort((a, b) => (a.status === 'on-route' ? 0 : 1) - (b.status === 'on-route' ? 0 : 1))
)
const vehicles = computed(() => VEHICLES.filter((v) => v.status === 'active'))
</script>

<template>
  <div class="bg-background flex h-[calc(100svh-3.5rem)] flex-col lg:flex-row">
    <!-- ── Dispatch queue rail ─────────────────────────────────────────── -->
    <aside class="bg-background flex w-full shrink-0 flex-col border-b lg:w-[384px] lg:border-b-0 lg:border-r">
      <div class="px-4 pb-3 pt-4">
        <div class="flex items-center justify-between gap-2">
          <h1 class="text-[15px] font-semibold tracking-tight">Live tracking</h1>
          <span class="text-muted-foreground inline-flex items-center gap-1.5 text-[11px] font-medium">
            <span class="bg-success size-1.5 rounded-full" />
            Live
          </span>
        </div>
        <p class="text-muted-foreground mt-0.5 text-xs tabular-nums">{{ stats.active }} active · {{ stats.onRoute }} on route</p>
        <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          <span v-for="l in legend" :key="l.label" class="inline-flex items-center gap-1.5">
            <span class="size-2 rounded-full" :class="toneDot(l.tone)" />
            <span class="text-muted-foreground text-[11px]">{{ l.label }}</span>
          </span>
        </div>
      </div>

      <Tabs default-value="trips" class="flex min-h-0 flex-1 flex-col">
        <div class="px-4">
          <TabsList class="w-full justify-start">
            <TabsTrigger value="trips">
              {{ isRealData ? 'Vessels' : 'Trips' }}
              <span class="text-muted-foreground ml-1 tabular-nums">{{ activeTrips.length }}</span>
            </TabsTrigger>
            <TabsTrigger v-if="!isRealData" value="drivers">
              Drivers<span class="text-muted-foreground ml-1 tabular-nums">{{ drivers.length }}</span>
            </TabsTrigger>
            <TabsTrigger v-if="!isRealData" value="vehicles">
              Vehicles<span class="text-muted-foreground ml-1 tabular-nums">{{ vehicles.length }}</span>
            </TabsTrigger>
            <TabsTrigger v-if="isRealData" value="underway">
              Underway<span class="text-muted-foreground ml-1 tabular-nums">{{ stats.onRoute }}</span>
            </TabsTrigger>
            <TabsTrigger v-if="isRealData" value="attention">
              Caution<span class="text-muted-foreground ml-1 tabular-nums">{{ stats.attention }}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <!-- Vessels / Trips -->
        <TabsContent value="trips" class="mt-0 min-h-0 flex-1">
          <OverlayScroll class="h-full">
            <div class="space-y-1.5 p-4">
              <button
                v-for="t in activeTrips"
                :key="t.id || t.shipment?.id"
                type="button"
                class="focus-visible:ring-ring block w-full rounded-lg border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2"
                :class="selectedId === (t.id || t.shipment?.id) ? 'border-foreground/25 bg-accent' : 'bg-card hover:bg-accent/50'"
                @click="select(t.id || t.shipment?.id)"
                @mouseenter="onHover(t.id || t.shipment?.id)"
                @mouseleave="onHover(null)"
                @focus="onHover(t.id || t.shipment?.id)"
                @blur="onHover(null)"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="font-semibold text-[13px] tracking-tight truncate">{{ t.name || t.shipment?.id }}</span>
                  <Badge :variant="toneBadge(t.tone)" class="shrink-0 text-xs">
                    {{ t.sog !== undefined ? (t.sog > 0.5 ? `${t.sog} kts` : 'Moored') : STATUS_LABELS[t.shipment?.status] }}
                  </Badge>
                </div>
                <div class="mt-1.5 flex items-baseline justify-between gap-2">
                  <p class="min-w-0 truncate text-[12px] text-muted-foreground">
                    {{ t.vesselId ? `Vessel #${t.vesselId} · Heading: ${t.heading}` : (t.shipment?.driver ?? 'Unassigned') }}
                  </p>
                  <span v-if="t.distanceNm || t.distanceKm" class="text-muted-foreground shrink-0 text-[11px] tabular-nums font-mono">
                    {{ t.distanceNm ? `${t.distanceNm} nm` : `${t.distanceKm} km` }}
                  </span>
                </div>
                <div class="bg-muted mt-2 h-[3px] w-full overflow-hidden rounded-full">
                  <div class="h-full rounded-full" :style="{ width: `${t.progress ?? t.shipment?.progress}%`, background: TONE_BG[t.tone] }" />
                </div>
                <div class="mt-1 flex items-center justify-between text-muted-foreground text-[11px] tabular-nums">
                  <span>{{ t.progress ?? t.shipment?.progress }}% complete</span>
                  <span v-if="t.packetTs">{{ t.packetTs.slice(11, 16) }} UTC</span>
                </div>
              </button>
            </div>
          </OverlayScroll>
        </TabsContent>

        <!-- Underway (vessel mode) -->
        <TabsContent v-if="isRealData" value="underway" class="mt-0 min-h-0 flex-1">
          <OverlayScroll class="h-full">
            <div class="space-y-1.5 p-4">
              <button
                v-for="t in liveVessels.filter(v => v.sog > 0.5)"
                :key="t.id"
                type="button"
                class="focus-visible:ring-ring block w-full rounded-lg border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2"
                :class="selectedId === t.id ? 'border-foreground/25 bg-accent' : 'bg-card hover:bg-accent/50'"
                @click="select(t.id)"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="font-semibold text-[13px] tracking-tight truncate">{{ t.name }}</span>
                  <Badge variant="success" class="shrink-0 text-xs">{{ t.sog }} kts</Badge>
                </div>
                <p class="mt-1 text-xs text-muted-foreground font-mono">Heading: {{ t.heading }} · Wind: BF {{ t.windSpeedBF }}</p>
              </button>
            </div>
          </OverlayScroll>
        </TabsContent>

        <!-- Caution (vessel mode) -->
        <TabsContent v-if="isRealData" value="attention" class="mt-0 min-h-0 flex-1">
          <OverlayScroll class="h-full">
            <div class="space-y-1.5 p-4">
              <button
                v-for="t in liveVessels.filter(v => v.windSpeedBF >= 7 || v.tone === 'warning')"
                :key="t.id"
                type="button"
                class="focus-visible:ring-ring block w-full rounded-lg border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2"
                :class="selectedId === t.id ? 'border-foreground/25 bg-accent' : 'bg-card hover:bg-accent/50'"
                @click="select(t.id)"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="font-semibold text-[13px] tracking-tight truncate">{{ t.name }}</span>
                  <Badge variant="warning" class="shrink-0 text-xs">BF {{ t.windSpeedBF }}</Badge>
                </div>
                <p class="mt-1 text-xs text-muted-foreground">High wind conditions reported</p>
              </button>
            </div>
          </OverlayScroll>
        </TabsContent>

        <!-- Drivers -->
        <TabsContent v-if="!isRealData" value="drivers" class="mt-0 min-h-0 flex-1">
          <OverlayScroll class="h-full">
            <div class="space-y-1.5 p-4">
              <div v-for="d in drivers" :key="d.id" class="bg-card flex items-center gap-3 rounded-lg border p-3">
                <Avatar class="size-9"><AvatarFallback class="text-xs font-semibold">{{ d.initials }}</AvatarFallback></Avatar>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">{{ d.name }}</p>
                  <p class="text-muted-foreground text-xs">{{ d.vehicle ?? 'No vehicle' }} · {{ d.deliveriesToday }} today</p>
                </div>
                <div class="flex flex-col items-end gap-1">
                  <Badge :variant="toneBadge(DRIVER_STATUS_TONE[d.status])" class="text-xs">{{ DRIVER_STATUS_LABELS[d.status] }}</Badge>
                  <span class="text-muted-foreground inline-flex items-center gap-0.5 text-xs"><Star class="fill-warning text-warning size-3" />{{ d.rating }}</span>
                </div>
              </div>
            </div>
          </OverlayScroll>
        </TabsContent>

        <!-- Vehicles -->
        <TabsContent v-if="!isRealData" value="vehicles" class="mt-0 min-h-0 flex-1">
          <OverlayScroll class="h-full">
            <div class="space-y-1.5 p-4">
              <div v-for="v in vehicles" :key="v.id" class="bg-card flex items-center gap-3 rounded-lg border p-3">
                <span class="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg"><Truck class="text-muted-foreground size-4" /></span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">{{ v.id }}</p>
                  <p class="text-muted-foreground text-xs">{{ VEHICLE_TYPE_LABELS[v.type] }} · {{ v.location }}</p>
                </div>
                <Badge :variant="toneBadge(VEHICLE_STATUS_TONE[v.status])" class="shrink-0 text-xs">{{ VEHICLE_STATUS_LABELS[v.status] }}</Badge>
              </div>
            </div>
          </OverlayScroll>
        </TabsContent>
      </Tabs>
    </aside>

    <!-- ── Map column: docked KPI ribbon + graphite map ────────────────── -->
    <div class="flex min-h-[420px] flex-1 flex-col">
      <!-- Docked status ribbon -->
      <div class="bg-card flex h-[52px] shrink-0 items-center border-b px-4">
        <div class="flex items-stretch">
          <div class="flex flex-col justify-center pr-4">
            <span class="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
              {{ isRealData ? 'Fleet' : 'Active' }}
            </span>
            <span class="text-foreground text-[15px] font-semibold tabular-nums">{{ stats.active }}</span>
          </div>
          <div class="border-border flex flex-col justify-center border-l px-4">
            <span class="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
              {{ isRealData ? 'Underway' : 'On route' }}
            </span>
            <span class="text-foreground text-[15px] font-semibold tabular-nums">{{ stats.onRoute }}</span>
          </div>
          <div class="border-border flex flex-col justify-center border-l px-4">
            <span class="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">Avg progress</span>
            <span class="text-foreground text-[15px] font-semibold tabular-nums">{{ stats.avgProgress }}%</span>
          </div>
          <div class="border-border flex flex-col justify-center border-l px-4">
            <span class="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
              {{ isRealData ? 'High wind / Caution' : 'Needs attention' }}
            </span>
            <span class="text-[15px] font-semibold tabular-nums" :class="stats.attention > 0 ? 'text-warning' : 'text-muted-foreground'">{{ stats.attention }}</span>
          </div>
        </div>
        <div class="ml-auto flex items-center gap-3">
          <span class="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-medium">
            <span class="bg-success size-1.5 rounded-full" />
            Live
          </span>
          <Button variant="ghost" size="sm" class="h-7 text-xs" @click="() => refreshVessels()">
            Refresh
          </Button>
        </div>
      </div>

      <!-- Map fills remaining height; inspector drawer docks to its right edge -->
      <div class="relative flex-1 overflow-hidden isolate">
        <ClientOnly>
          <div class="size-full z-0 relative">
            <LiveMapLeaflet ref="mapRef" :trips="activeTrips" :selected-id="selectedId" @select="select" />
          </div>
          <template #fallback>
            <div class="bg-muted size-full" />
          </template>
        </ClientOnly>

        <!-- Selected-trip / vessel inspector drawer -->
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="translate-x-full"
          enter-to-class="translate-x-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="translate-x-0"
          leave-to-class="translate-x-full"
        >
          <div
            v-if="selected"
            ref="inspectorRef"
            role="dialog"
            tabindex="-1"
            :aria-label="`Details for ${selected.name || selected.shipment?.id}`"
            class="bg-card text-card-foreground absolute bottom-0 right-0 top-0 z-[1001] w-[340px] overflow-y-auto border-l shadow-2xl outline-none"
            @keydown.esc="closeInspector"
          >
            <div class="p-5">
              <div class="flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <h2 class="font-semibold text-sm truncate">{{ selected.name || selected.shipment?.id }}</h2>
                  <p v-if="selected.vesselId" class="text-xs text-muted-foreground font-mono">Vessel #{{ selected.vesselId }}</p>
                </div>
                <button type="button" class="text-muted-foreground hover:text-foreground focus-visible:ring-ring -mr-1.5 rounded-md p-1 outline-none focus-visible:ring-2" aria-label="Close" @click="closeInspector"><X class="size-4" /></button>
              </div>

              <!-- Speed/Status Hero -->
              <div class="mt-4">
                <p class="text-muted-foreground text-[11px] uppercase tracking-wide">{{ selected.vesselId ? 'Speed Over Ground' : 'Arrives' }}</p>
                <div class="mt-0.5 flex items-center gap-2">
                  <span class="text-2xl font-semibold tabular-nums">
                    {{ selected.sog !== undefined ? `${selected.sog} kts` : shortDate(selected.shipment?.estimatedDelivery) }}
                  </span>
                  <Badge :variant="toneBadge(selected.tone)" class="text-xs">
                    {{ selected.vesselId ? (selected.sog > 0.5 ? 'Underway' : 'Moored') : etaChip(selected.tone).label }}
                  </Badge>
                </div>
              </div>

              <!-- Telemetry -->
              <div class="border-border divide-border mt-4 grid grid-cols-3 divide-x border-y py-2.5 text-center">
                <div>
                  <p class="text-muted-foreground text-[10px] uppercase tracking-wide">{{ selected.vesselId ? 'Heading' : 'Speed' }}</p>
                  <p class="mt-0.5 text-sm font-semibold tabular-nums">{{ selected.heading || speedOf(selected) }}</p>
                </div>
                <div>
                  <p class="text-muted-foreground text-[10px] uppercase tracking-wide">{{ selected.vesselId ? 'Wind' : 'Heading' }}</p>
                  <p class="mt-0.5 text-sm font-semibold">{{ selected.windSpeedBF !== undefined ? `BF ${selected.windSpeedBF}` : headingOf(selected) }}</p>
                </div>
                <div>
                  <p class="text-muted-foreground text-[10px] uppercase tracking-wide">Distance</p>
                  <p class="mt-0.5 text-sm font-semibold tabular-nums">
                    {{ selected.distanceNm ? `${selected.distanceNm} nm` : (selected.distanceKm ? `${selected.distanceKm} km` : '—') }}
                  </p>
                </div>
              </div>

              <!-- Telemetry extra rows -->
              <div v-if="selected.vesselId" class="mt-4 space-y-2 text-xs">
                <div class="flex justify-between py-1 border-b border-border/50">
                  <span class="text-muted-foreground">Coordinates</span>
                  <span class="font-mono">{{ selected.coords[0].toFixed(3) }}°, {{ selected.coords[1].toFixed(3) }}°</span>
                </div>
                <div class="flex justify-between py-1 border-b border-border/50">
                  <span class="text-muted-foreground">Last Packet</span>
                  <span class="font-mono text-muted-foreground">{{ selected.packetTs }}</span>
                </div>
                <div v-if="selected.waveDirection && selected.waveDirection !== 'NA'" class="flex justify-between py-1 border-b border-border/50">
                  <span class="text-muted-foreground">Wave Direction</span>
                  <span>{{ selected.waveDirection }}</span>
                </div>
                <div v-if="selected.currentSpeed && selected.currentSpeed !== 'NA'" class="flex justify-between py-1 border-b border-border/50">
                  <span class="text-muted-foreground">Current Speed</span>
                  <span>{{ selected.currentSpeed }}</span>
                </div>
              </div>

              <!-- Driver / Vehicle (if legacy mock) -->
              <div v-if="!selected.vesselId && selected.shipment" class="mt-4 flex items-center gap-2.5">
                <Avatar class="size-8"><AvatarFallback class="text-[11px] font-semibold">{{ initials(selected.shipment.driver) }}</AvatarFallback></Avatar>
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium">{{ selected.shipment.driver ?? 'Unassigned' }}</p>
                  <p class="text-muted-foreground font-mono text-xs">{{ selected.shipment.vehicle ?? '—' }}</p>
                </div>
              </div>

              <!-- Progress -->
              <div class="mt-4">
                <div class="text-muted-foreground mb-1 text-[11px] tabular-nums">
                  {{ selected.progress ?? selected.shipment?.progress }}% voyage complete
                </div>
                <div class="bg-muted h-1 w-full overflow-hidden rounded-full">
                  <div class="h-full rounded-full" :style="{ width: `${selected.progress ?? selected.shipment?.progress}%`, background: TONE_BG[selected.tone] }" />
                </div>
              </div>

              <Button v-if="!selected.vesselId && selected.shipment" as-child variant="secondary" class="mt-5 w-full">
                <NuxtLink :to="`/shipments/${selected.shipment.id}`">Open shipment</NuxtLink>
              </Button>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>
