<script setup lang="ts">
/**
 * Live tracking — a logistics control tower. A triage-sorted dispatch queue on
 * the left, a near-monochrome graphite fleet map on the right under a docked
 * KPI ribbon, and a right-edge inspector drawer for the selected trip. Hovering
 * a rail card lights its lane, selecting opens the inspector and flies the map.
 * Dispatcher-gated.
 */
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import {
  Target, MapPin, Truck, Star, X, Bot, Send, RotateCcw, ArrowUpRight,
  CloudRain, Compass, AlertTriangle, RefreshCw, ChevronDown, Maximize2, Minimize2,
  Gauge, Clock, Search, Anchor, CheckCircle2
} from 'lucide-vue-next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OverlayScroll } from '@/components/ui/overlay-scroll'
import LiveMapLeaflet from '@/components/LiveMapLeaflet.vue'
import SentinelBlockRenderer from '@/components/sentinel/SentinelBlockRenderer.vue'
import { toneBadge, toneDot, shortDate } from '@/lib/utils'

import type { SentinelAction, SentinelBlock, SentinelChatResponse } from '#shared/types/sentinel'
import type { WeatherDetail } from '~~/server/api/vessels/geojson.get'

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
  travelledNm: number
  remainingNm: number
  progress: number
  packetTs: string
  windSpeedBF: number
  waveDirection: string
  swellDirection: string
  currentSpeed: string
  currentDirection: string
  heading: string
  vesselHeading?: number
  weather?: WeatherDetail
  status: 'in-transit' | 'manoeuvring' | 'moored'
  scheduleStatus: 'on-time' | 'late' | 'early' | 'moored'
  varianceHours: number
  etaHours: number
  etaIso: string
  etaFormatted: string
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
const activeTab = ref<string>('all')
const mapRef = ref<{ hover?: (id: string | null) => void } | null>(null)
const inspectorRef = ref<HTMLElement | null>(null)
let triggerEl: HTMLElement | null = null

// Copilot State
interface AgentMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  blocks?: SentinelBlock[]
  tools?: { name: string; args: string; summary: string }[]
  actions?: { label: string; handler: () => void }[]
}

const isCopilotOpen = ref(false)
const isCopilotFullscreen = ref(false)
const isAgentProcessing = ref(false)
const agentInput = ref('')
const agentMessages = ref<AgentMessage[]>([
  {
    id: 'sentinel-ready',
    role: 'agent',
    content: 'Fleet Operations Copilot ready. Inquire about schedule risks, weather conditions, or select any fleet directive below.',
  },
])

const quickDirectives = [
  {
    label: 'Delayed Vessels Audit',
    query: 'Analyze fleet vessels running late against charter ETA and assess cause of delay.',
    icon: Clock,
  },
  {
    label: 'Weather & Sea Conditions',
    query: 'Identify vessels encountering high Beaufort winds or heavy seas and evaluate route risks.',
    icon: CloudRain,
  },
  {
    label: 'Speed vs Baseline',
    query: 'Compare active fleet speed against the 13.5 kts planned baseline and summarize performance.',
    icon: Gauge,
  },
  {
    label: 'Passage Progress',
    query: 'Audit passage completion percentage, remaining nautical miles, and ETA forecasts across the fleet.',
    icon: Anchor,
  },
]

async function askAgent(promptText: string, context?: { vesselId?: number }) {
  const q = promptText.trim()
  if (!q || isAgentProcessing.value) return
  agentInput.value = ''
  isCopilotOpen.value = true
  agentMessages.value.push({ id: `user-${Date.now()}`, role: 'user', content: q })
  isAgentProcessing.value = true

  try {
    const response = await $fetch<SentinelChatResponse>('/api/sentinel/chat', {
      method: 'POST',
      body: {
        messages: agentMessages.value.slice(-20).map(({ role, content }) => ({
          role: role === 'agent' ? 'assistant' : 'user',
          content,
        })),
        context,
      },
    })
    agentMessages.value.push({
      id: `agent-${Date.now()}`,
      role: 'agent',
      content: response.message.content,
      blocks: response.blocks,
      tools: response.activity.map(({ name, args, summary }) => ({ name, args: JSON.stringify(args), summary })),
      actions: response.actions.map((action) => ({ label: action.label, handler: () => applyAgentAction(action) })),
    })
  } catch (requestError) {
    agentMessages.value.push({
      id: `agent-err-${Date.now()}`,
      role: 'agent',
      content: requestError instanceof Error ? requestError.message : 'Copilot is temporarily unavailable.',
    })
  } finally {
    isAgentProcessing.value = false
  }
}

function askCopilotForVessel(vessel: any) {
  const vId = vessel.vesselId
  const vName = vessel.name || `Vessel #${vId}`
  const bf = vessel.windSpeedBF !== undefined ? `Beaufort ${vessel.windSpeedBF} (${vessel.weather?.windDescription || ''})` : ''
  const prompt = `Evaluate passage telemetry, weather conditions (${bf}), speed over ground (${vessel.sog} kts vs 13.5 kts baseline), and arrival ETA for ${vName}.`
  askAgent(prompt, vId ? { vesselId: vId } : undefined)
}

function applyAgentAction(action: SentinelAction) {
  if (action.type === 'filter-alerts') {
    if (action.label.toLowerCase().includes('late')) {
      activeTab.value = 'late'
    } else if (action.label.toLowerCase().includes('on-time') || action.label.toLowerCase().includes('on time')) {
      activeTab.value = 'on-time'
    }
  } else {
    const matchedVessel = liveVessels.value.find((v) =>
      action.label.toLowerCase().includes(v.name.toLowerCase()) ||
      action.label.includes(String(v.vesselId))
    )
    if (matchedVessel) {
      select(matchedVessel.id)
    }
  }
}

function toolLabel(name: string) {
  return name.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function resetAgentSession() {
  agentMessages.value = [
    {
      id: `ready-${Date.now()}`,
      role: 'agent',
      content: 'Copilot session reset. Ask a question or select a fleet directive below.',
    },
  ]
}

function handleKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
    e.preventDefault()
    isCopilotOpen.value = !isCopilotOpen.value
  } else if (e.key === 'Escape') {
    if (isCopilotFullscreen.value) {
      isCopilotFullscreen.value = false
    } else if (isCopilotOpen.value) {
      isCopilotOpen.value = false
    } else if (selectedId.value) {
      closeInspector()
    }
  }
}

onMounted(() => {
  if (!import.meta.server) window.addEventListener('keydown', handleKeydown)
})
onUnmounted(() => {
  if (!import.meta.server) window.removeEventListener('keydown', handleKeydown)
})

watch(
  isRealData,
  (val) => {
    if (val && !['all', 'on-time', 'late', 'early', 'moored'].includes(activeTab.value)) {
      activeTab.value = 'all'
    } else if (!val && !['trips', 'drivers', 'vehicles'].includes(activeTab.value)) {
      activeTab.value = 'trips'
    }
  },
  { immediate: true }
)

function scheduleBadgeText(item: LiveVesselItem): string {
  if (item.scheduleStatus === 'on-time') return 'On time'
  if (item.scheduleStatus === 'late') {
    return `Late +${item.varianceHours}h`
  }
  if (item.scheduleStatus === 'early') {
    return `Early ${item.varianceHours}h`
  }
  return 'In port'
}

function scheduleBadgeVariant(
  item: LiveVesselItem
): 'success' | 'warning' | 'destructive' | 'info' | 'secondary' {
  if (item.scheduleStatus === 'moored') return 'secondary'
  if (item.scheduleStatus === 'on-time') return 'success'
  if (item.scheduleStatus === 'early') return 'info'
  if (item.varianceHours > 12 || item.windSpeedBF >= 7) return 'destructive'
  return 'warning'
}

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

/** Live fleet schedule and progress summary for the docked KPI ribbon. */
const stats = computed(() => {
  if (isRealData.value) {
    const list = liveVessels.value
    const onRoute = list.filter((v) => v.sog > 0.5).length
    const onTime = list.filter((v) => v.scheduleStatus === 'on-time').length
    const late = list.filter((v) => v.scheduleStatus === 'late').length
    const early = list.filter((v) => v.scheduleStatus === 'early').length
    const moored = list.filter((v) => v.scheduleStatus === 'moored').length
    const avgProgress = Math.round(list.reduce((s, v) => s + v.progress, 0) / Math.max(1, list.length))
    return { active: list.length, onRoute, onTime, late, early, moored, avgProgress }
  }
  const onRoute = trips.filter((t) =>
    ['in-transit', 'out-for-delivery', 'picked-up'].includes(t.shipment.status)
  ).length
  const attention = trips.filter((t) => ['delayed', 'exception'].includes(t.shipment.status)).length
  const avgProgress = Math.round(
    trips.reduce((s, t) => s + t.shipment.progress, 0) / Math.max(1, trips.length)
  )
  return {
    active: trips.length,
    onRoute,
    onTime: onRoute - attention,
    late: attention,
    early: 0,
    moored: 0,
    avgProgress,
  }
})

/** Filtered list based on activeTab */
const displayedTrips = computed(() => {
  if (!isRealData.value) return trips
  if (activeTab.value === 'all') return liveVessels.value
  return liveVessels.value.filter((v) => v.scheduleStatus === activeTab.value)
})

/** Route-colour key */
const legend = computed(() => {
  if (isRealData.value) {
    return [
      { label: 'On time', tone: 'success' as Tone },
      { label: 'Running early', tone: 'info' as Tone },
      { label: 'Running late', tone: 'warning' as Tone },
      { label: 'In port', tone: 'muted' as Tone },
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
        <p class="text-muted-foreground mt-0.5 text-xs tabular-nums">
          <template v-if="isRealData">
            {{ stats.active }} vessels · {{ stats.onTime }} on time · {{ stats.late }} late
          </template>
          <template v-else>
            {{ stats.active }} active · {{ stats.onRoute }} on route
          </template>
        </p>
        <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          <span v-for="l in legend" :key="l.label" class="inline-flex items-center gap-1.5">
            <span class="size-2 rounded-full" :class="toneDot(l.tone)" />
            <span class="text-muted-foreground text-[11px]">{{ l.label }}</span>
          </span>
        </div>
      </div>

      <Tabs v-model="activeTab" class="flex min-h-0 flex-1 flex-col">
        <div class="px-4">
          <!-- Real vessel schedule tabs -->
          <TabsList v-if="isRealData" class="w-full justify-start overflow-x-auto">
            <TabsTrigger value="all">
              All<span class="text-muted-foreground ml-1 tabular-nums">{{ stats.active }}</span>
            </TabsTrigger>
            <TabsTrigger value="on-time">
              On Time<span class="text-success ml-1 tabular-nums font-semibold">{{ stats.onTime }}</span>
            </TabsTrigger>
            <TabsTrigger value="late">
              Late<span class="text-warning ml-1 tabular-nums font-semibold">{{ stats.late }}</span>
            </TabsTrigger>
            <TabsTrigger value="early">
              Early<span class="text-info ml-1 tabular-nums font-semibold">{{ stats.early }}</span>
            </TabsTrigger>
            <TabsTrigger value="moored">
              In Port<span class="text-muted-foreground ml-1 tabular-nums">{{ stats.moored }}</span>
            </TabsTrigger>
          </TabsList>

          <!-- Mock fallback tabs -->
          <TabsList v-else class="w-full justify-start">
            <TabsTrigger value="trips">
              Trips<span class="text-muted-foreground ml-1 tabular-nums">{{ activeTrips.length }}</span>
            </TabsTrigger>
            <TabsTrigger value="drivers">
              Drivers<span class="text-muted-foreground ml-1 tabular-nums">{{ drivers.length }}</span>
            </TabsTrigger>
            <TabsTrigger value="vehicles">
              Vehicles<span class="text-muted-foreground ml-1 tabular-nums">{{ vehicles.length }}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <!-- Real vessels list for schedule tabs -->
        <template v-if="isRealData">
          <TabsContent
            v-for="tabKey in ['all', 'on-time', 'late', 'early', 'moored']"
            :key="tabKey"
            :value="tabKey"
            class="mt-0 min-h-0 flex-1"
          >
            <OverlayScroll class="h-full">
              <div class="space-y-1.5 p-4">
                <div v-if="displayedTrips.length === 0" class="py-8 text-center text-xs text-muted-foreground">
                  No vessels in this category
                </div>
                <button
                  v-for="t in displayedTrips"
                  :key="t.id"
                  type="button"
                  class="focus-visible:ring-ring block w-full rounded-lg border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2"
                  :class="selectedId === t.id ? 'border-foreground/25 bg-accent' : 'bg-card hover:bg-accent/50'"
                  @click="select(t.id)"
                  @mouseenter="onHover(t.id)"
                  @mouseleave="onHover(null)"
                  @focus="onHover(t.id)"
                  @blur="onHover(null)"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-semibold text-[13px] tracking-tight truncate">{{ t.name }}</span>
                    <Badge :variant="scheduleBadgeVariant(t)" class="shrink-0 text-xs font-mono">
                      {{ scheduleBadgeText(t) }}
                    </Badge>
                  </div>
                  <div class="mt-1 flex items-baseline justify-between gap-2 text-[12px] text-muted-foreground">
                    <span class="truncate">SOG: <strong class="text-foreground font-medium">{{ t.sog }} kts</strong> · {{ t.heading }}</span>
                    <span class="shrink-0 font-mono text-[11px] text-foreground font-medium">ETA: {{ t.etaFormatted }}</span>
                  </div>
                  <div class="bg-muted mt-2 h-[3px] w-full overflow-hidden rounded-full">
                    <div class="h-full rounded-full transition-all" :style="{ width: `${t.progress}%`, background: TONE_BG[t.tone] }" />
                  </div>
                  <div class="mt-1 flex items-center justify-between text-muted-foreground text-[11px] tabular-nums font-mono">
                    <span>{{ t.progress }}% ({{ t.travelledNm }} / {{ t.distanceNm }} nm)</span>
                    <span>Rem {{ t.remainingNm }} nm</span>
                  </div>
                </button>
              </div>
            </OverlayScroll>
          </TabsContent>
        </template>

        <!-- Mock trips / drivers / vehicles -->
        <template v-else>
          <TabsContent value="trips" class="mt-0 min-h-0 flex-1">
            <OverlayScroll class="h-full">
              <div class="space-y-1.5 p-4">
                <button
                  v-for="t in activeTrips"
                  :key="t.shipment?.id"
                  type="button"
                  class="focus-visible:ring-ring block w-full rounded-lg border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2"
                  :class="selectedId === t.shipment?.id ? 'border-foreground/25 bg-accent' : 'bg-card hover:bg-accent/50'"
                  @click="select(t.shipment?.id)"
                  @mouseenter="onHover(t.shipment?.id)"
                  @mouseleave="onHover(null)"
                  @focus="onHover(t.shipment?.id)"
                  @blur="onHover(null)"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-semibold text-[13px] tracking-tight truncate">{{ t.shipment?.id }}</span>
                    <Badge :variant="toneBadge(t.tone)" class="shrink-0 text-xs">
                      {{ STATUS_LABELS[t.shipment?.status] }}
                    </Badge>
                  </div>
                  <div class="mt-1.5 flex items-baseline justify-between gap-2">
                    <p class="min-w-0 truncate text-[12px] text-muted-foreground">
                      {{ t.shipment?.driver ?? 'Unassigned' }}
                    </p>
                    <span v-if="t.distanceKm" class="text-muted-foreground shrink-0 text-[11px] tabular-nums font-mono">
                      {{ t.distanceKm }} km
                    </span>
                  </div>
                  <div class="bg-muted mt-2 h-[3px] w-full overflow-hidden rounded-full">
                    <div class="h-full rounded-full" :style="{ width: `${t.shipment?.progress}%`, background: TONE_BG[t.tone] }" />
                  </div>
                  <div class="mt-1 flex items-center justify-between text-muted-foreground text-[11px] tabular-nums">
                    <span>{{ t.shipment?.progress }}% complete</span>
                  </div>
                </button>
              </div>
            </OverlayScroll>
          </TabsContent>

          <TabsContent value="drivers" class="mt-0 min-h-0 flex-1">
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

          <TabsContent value="vehicles" class="mt-0 min-h-0 flex-1">
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
        </template>
      </Tabs>
    </aside>

    <!-- ── Map column: docked KPI ribbon + graphite map ────────────────── -->
    <div
      :class="[
        'flex min-h-[420px] flex-1 flex-col transition-[margin] duration-350 ease-[cubic-bezier(0.16,1,0.3,1)]',
        isCopilotOpen && !isCopilotFullscreen ? 'lg:mr-[440px] xl:mr-[480px]' : ''
      ]"
    >
      <!-- Docked status ribbon -->
      <div class="bg-card flex h-[52px] shrink-0 items-center border-b px-4">
        <div class="flex items-stretch overflow-x-auto">
          <div class="flex flex-col justify-center pr-4">
            <span class="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
              {{ isRealData ? 'Fleet' : 'Active' }}
            </span>
            <span class="text-foreground text-[15px] font-semibold tabular-nums">{{ stats.active }}</span>
          </div>
          <template v-if="isRealData">
            <div class="border-border flex flex-col justify-center border-l px-4">
              <span class="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">On time</span>
              <span class="text-success text-[15px] font-semibold tabular-nums">{{ stats.onTime }}</span>
            </div>
            <div class="border-border flex flex-col justify-center border-l px-4">
              <span class="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">Running late</span>
              <span class="text-warning text-[15px] font-semibold tabular-nums">{{ stats.late }}</span>
            </div>
            <div class="border-border flex flex-col justify-center border-l px-4">
              <span class="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">Running early</span>
              <span class="text-info text-[15px] font-semibold tabular-nums">{{ stats.early }}</span>
            </div>
            <div class="border-border flex flex-col justify-center border-l px-4">
              <span class="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">In port</span>
              <span class="text-muted-foreground text-[15px] font-semibold tabular-nums">{{ stats.moored }}</span>
            </div>
            <div class="border-border flex flex-col justify-center border-l px-4">
              <span class="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">Avg progress</span>
              <span class="text-foreground text-[15px] font-semibold tabular-nums">{{ stats.avgProgress }}%</span>
            </div>
          </template>
          <template v-else>
            <div class="border-border flex flex-col justify-center border-l px-4">
              <span class="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">On route</span>
              <span class="text-foreground text-[15px] font-semibold tabular-nums">{{ stats.onRoute }}</span>
            </div>
            <div class="border-border flex flex-col justify-center border-l px-4">
              <span class="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">Avg progress</span>
              <span class="text-foreground text-[15px] font-semibold tabular-nums">{{ stats.avgProgress }}%</span>
            </div>
            <div class="border-border flex flex-col justify-center border-l px-4">
              <span class="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">Needs attention</span>
              <span class="text-[15px] font-semibold tabular-nums text-warning">{{ stats.late }}</span>
            </div>
          </template>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            :class="[
              'h-7 text-xs gap-1.5 px-2.5 font-medium cursor-pointer transition-colors',
              isCopilotOpen
                ? 'bg-primary/10 border-primary/50 text-primary font-semibold'
                : 'border-primary/30 hover:bg-primary/10 hover:text-primary text-foreground'
            ]"
            title="Toggle Fleet Operations Copilot (⌘J)"
            @click="isCopilotOpen = !isCopilotOpen"
          >
            <Bot class="size-3.5 text-primary" />
            <span>Copilot</span>
            <kbd class="hidden sm:inline-block text-[10px] text-muted-foreground border border-border px-1 py-0.2 rounded bg-muted/60">⌘J</kbd>
          </Button>
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
            class="bg-card text-card-foreground absolute bottom-0 right-0 top-0 z-[1001] w-[360px] overflow-y-auto border-l shadow-2xl outline-none"
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

              <!-- Vessel Real Data Display -->
              <template v-if="selected.vesselId">
                <!-- Schedule / ETA Hero Box -->
                <div class="mt-4 rounded-lg border bg-muted/40 p-3.5 space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">Estimated Arrival (ETA)</span>
                    <Badge :variant="scheduleBadgeVariant(selected)" class="text-xs font-mono">
                      {{ scheduleBadgeText(selected) }}
                    </Badge>
                  </div>
                  <div class="flex items-baseline justify-between">
                    <span class="text-xl font-bold tracking-tight">
                      {{ selected.etaFormatted }}
                    </span>
                  </div>
                  <p v-if="selected.scheduleStatus !== 'moored'" class="text-xs font-mono" :class="selected.varianceHours > 0 ? 'text-warning' : (selected.varianceHours < 0 ? 'text-info' : 'text-success')">
                    {{ selected.varianceHours > 0 ? `+${selected.varianceHours}h behind baseline charter ETA` : (selected.varianceHours < 0 ? `${selected.varianceHours}h ahead of baseline charter ETA` : 'On track with baseline charter ETA') }}
                  </p>
                </div>

                <!-- Telemetry 3-col Grid -->
                <div class="border-border divide-border mt-4 grid grid-cols-3 divide-x border-y py-2.5 text-center">
                  <div>
                    <p class="text-muted-foreground text-[10px] uppercase tracking-wide">Current SOG</p>
                    <p class="mt-0.5 text-sm font-semibold tabular-nums">{{ selected.sog }} kts</p>
                  </div>
                  <div>
                    <p class="text-muted-foreground text-[10px] uppercase tracking-wide">Baseline</p>
                    <p class="mt-0.5 text-sm font-semibold tabular-nums text-muted-foreground">13.5 kts</p>
                  </div>
                  <div>
                    <p class="text-muted-foreground text-[10px] uppercase tracking-wide">Remaining</p>
                    <p class="mt-0.5 text-sm font-semibold tabular-nums font-mono">{{ selected.remainingNm }} nm</p>
                  </div>
                </div>

                <!-- Voyage Progress -->
                <div class="mt-4">
                  <div class="flex justify-between text-xs mb-1.5">
                    <span class="text-muted-foreground">Voyage Progress</span>
                    <span class="font-medium tabular-nums">{{ selected.progress }}% ({{ selected.travelledNm }} / {{ selected.distanceNm }} nm)</span>
                  </div>
                  <div class="bg-muted h-2 w-full overflow-hidden rounded-full">
                    <div class="h-full rounded-full transition-all" :style="{ width: `${selected.progress}%`, background: TONE_BG[selected.tone] }" />
                  </div>
                </div>

                <!-- Maritime Weather & Sea State Card -->
                <div class="mt-4 rounded-lg border bg-muted/30 p-3.5 space-y-2.5">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1.5">
                      <CloudRain class="size-3.5 text-primary" />
                      <span class="text-xs font-semibold text-foreground">Weather & Sea State</span>
                    </div>
                    <Badge
                      :variant="selected.windSpeedBF >= 7 ? 'destructive' : (selected.windSpeedBF >= 6 ? 'warning' : 'outline')"
                      class="text-[10px] font-mono px-1.5 py-0"
                    >
                      BF {{ selected.windSpeedBF }} · {{ selected.weather?.windDescription || 'Moderate' }}
                    </Badge>
                  </div>

                  <div class="grid grid-cols-2 gap-2 text-xs">
                    <div class="rounded border border-border/60 bg-background/80 p-2">
                      <div class="text-[10px] uppercase font-mono text-muted-foreground">Wind Velocity</div>
                      <div class="font-semibold text-foreground mt-0.5">{{ selected.weather?.windSpeedKts || '11 – 16 kts' }}</div>
                      <div class="text-[10px] text-muted-foreground">Beaufort Force {{ selected.windSpeedBF }}</div>
                    </div>
                    <div class="rounded border border-border/60 bg-background/80 p-2">
                      <div class="text-[10px] uppercase font-mono text-muted-foreground">Est. Wave Height</div>
                      <div class="font-semibold text-foreground mt-0.5">{{ selected.weather?.waveHeightM || '1.0 – 1.5 m' }}</div>
                      <div class="text-[10px] text-muted-foreground truncate">{{ selected.weather?.seaState || 'Moderate Sea' }}</div>
                    </div>
                  </div>

                  <!-- Impact Notice -->
                  <div
                    class="rounded-md px-2.5 py-1.5 text-xs flex items-start gap-2"
                    :class="selected.windSpeedBF >= 7
                      ? 'bg-destructive/10 text-destructive border border-destructive/30'
                      : (selected.windSpeedBF >= 6
                        ? 'bg-warning/10 text-warning border border-warning/30'
                        : 'bg-muted/50 text-muted-foreground border border-border/40')"
                  >
                    <AlertTriangle v-if="selected.windSpeedBF >= 6" class="size-3.5 shrink-0 mt-0.5" />
                    <Compass v-else class="size-3.5 shrink-0 mt-0.5 text-primary" />
                    <div class="min-w-0">
                      <p class="font-medium leading-tight">{{ selected.weather?.impactText || 'Favorable passage conditions' }}</p>
                    </div>
                  </div>

                  <!-- Telemetry Table -->
                  <div class="text-[11px] space-y-1 pt-1 border-t border-border/40 text-muted-foreground font-mono">
                    <div class="flex justify-between">
                      <span>Heading / Course:</span>
                      <span class="text-foreground font-medium">{{ selected.vesselHeading !== undefined ? `${selected.vesselHeading}° (${selected.heading})` : selected.heading }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span>Wave / Swell Dir:</span>
                      <span class="text-foreground">{{ selected.weather?.waveDirection || 'Fair' }} / {{ selected.weather?.swellDirection || 'Nominal' }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span>Surface Current:</span>
                      <span class="text-foreground">{{ selected.weather?.currentSpeed || 'Normal' }} ({{ selected.weather?.currentDirection || 'Nominal' }})</span>
                    </div>
                    <div class="flex justify-between">
                      <span>Coordinates:</span>
                      <span class="font-mono text-foreground">{{ selected.coords[0].toFixed(3) }}°, {{ selected.coords[1].toFixed(3) }}°</span>
                    </div>
                    <div class="flex justify-between">
                      <span>Last Transmission:</span>
                      <span class="font-mono text-muted-foreground">{{ selected.packetTs }}</span>
                    </div>
                  </div>
                </div>

                <!-- Ask Copilot for this Vessel Button -->
                <Button
                  variant="outline"
                  size="sm"
                  class="w-full mt-3.5 h-8 text-xs gap-1.5 font-medium border-primary/40 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                  @click="askCopilotForVessel(selected)"
                >
                  <Bot class="size-3.5 text-primary" />
                  <span>Audit {{ selected.name }} with Copilot</span>
                </Button>
              </template>

              <!-- Mock Legacy Shipment Display -->
              <template v-else>
                <div class="mt-4">
                  <p class="text-muted-foreground text-[11px] uppercase tracking-wide">Arrives</p>
                  <div class="mt-0.5 flex items-center gap-2">
                    <span class="text-2xl font-semibold tabular-nums">
                      {{ shortDate(selected.shipment?.estimatedDelivery) }}
                    </span>
                    <Badge :variant="toneBadge(selected.tone)" class="text-xs">
                      {{ etaChip(selected.tone).label }}
                    </Badge>
                  </div>
                </div>

                <div class="border-border divide-border mt-4 grid grid-cols-3 divide-x border-y py-2.5 text-center">
                  <div>
                    <p class="text-muted-foreground text-[10px] uppercase tracking-wide">Speed</p>
                    <p class="mt-0.5 text-sm font-semibold tabular-nums">{{ speedOf(selected) }}</p>
                  </div>
                  <div>
                    <p class="text-muted-foreground text-[10px] uppercase tracking-wide">Heading</p>
                    <p class="mt-0.5 text-sm font-semibold">{{ headingOf(selected) }}</p>
                  </div>
                  <div>
                    <p class="text-muted-foreground text-[10px] uppercase tracking-wide">Distance</p>
                    <p class="mt-0.5 text-sm font-semibold tabular-nums">
                      {{ selected.distanceKm ? `${selected.distanceKm} km` : '—' }}
                    </p>
                  </div>
                </div>

                <div v-if="selected.shipment" class="mt-4 flex items-center gap-2.5">
                  <Avatar class="size-8"><AvatarFallback class="text-[11px] font-semibold">{{ initials(selected.shipment.driver) }}</AvatarFallback></Avatar>
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium">{{ selected.shipment.driver ?? 'Unassigned' }}</p>
                    <p class="text-muted-foreground font-mono text-xs">{{ selected.shipment.vehicle ?? '—' }}</p>
                  </div>
                </div>

                <div class="mt-4">
                  <div class="text-muted-foreground mb-1 text-[11px] tabular-nums">
                    {{ selected.shipment?.progress }}% complete
                  </div>
                  <div class="bg-muted h-1 w-full overflow-hidden rounded-full">
                    <div class="h-full rounded-full" :style="{ width: `${selected.shipment?.progress}%`, background: TONE_BG[selected.tone] }" />
                  </div>
                </div>

                <Button v-if="selected.shipment" as-child variant="secondary" class="mt-5 w-full">
                  <NuxtLink :to="`/shipments/${selected.shipment.id}`">Open shipment</NuxtLink>
                </Button>
              </template>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Mobile backdrop when Copilot is open -->
    <Transition
      enter-active-class="transition-opacity duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isCopilotOpen && !isCopilotFullscreen"
        class="fixed inset-0 bg-background/60 backdrop-blur-xs z-25 lg:hidden"
        @click="isCopilotOpen = false"
      />
    </Transition>

    <!-- Operations Copilot (Sentinel) Docked Sidebar Panel or Fullscreen Cockpit (same like Control Tower) -->
    <Transition name="copilot-slide">
      <aside
        v-if="isCopilotOpen"
        :class="[
          'copilot-panel bg-card flex flex-col shadow-2xl z-30',
          isCopilotFullscreen
            ? 'copilot-fullscreen fixed inset-0 z-50 h-screen w-screen'
            : 'copilot-docked fixed right-0 top-14 bottom-0 z-30 w-full sm:w-[440px] xl:w-[480px] border-l border-border'
        ]"
        role="region"
        aria-label="Fleet Operations Copilot"
      >
        <!-- Copilot Header -->
        <div class="flex items-center justify-between border-b border-border/80 px-4 py-3 bg-muted/20 shrink-0">
          <div class="flex items-center gap-2 min-w-0">
            <div class="size-7 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
              <Bot class="size-4 text-primary" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h2 class="font-semibold text-xs tracking-tight truncate">Fleet Operations Copilot</h2>
                <Badge variant="outline" class="font-mono text-[9px] px-1.5 py-0 border-primary/40 text-primary">
                  AI Marine
                </Badge>
              </div>
              <p class="text-[10px] text-muted-foreground truncate">Live schedule & weather triage</p>
            </div>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              class="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
              title="Reset Session"
              @click="resetAgentSession"
            >
              <RotateCcw class="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="size-7 text-muted-foreground hover:text-foreground hidden sm:inline-flex cursor-pointer"
              :title="isCopilotFullscreen ? 'Exit Fullscreen' : 'Fullscreen'"
              @click="isCopilotFullscreen = !isCopilotFullscreen"
            >
              <Minimize2 v-if="isCopilotFullscreen" class="size-3.5" />
              <Maximize2 v-else class="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
              title="Close (Esc)"
              @click="isCopilotOpen = false"
            >
              <X class="size-4" />
            </Button>
          </div>
        </div>

        <!-- Quick Directives Chips -->
        <div class="py-2.5 px-3.5 border-b border-border/60 bg-muted/10 shrink-0">
          <div class="text-[10px] uppercase font-mono tracking-wider text-muted-foreground font-semibold mb-1.5">
            Quick Directives
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="chip in quickDirectives"
              :key="chip.label"
              type="button"
              class="inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded border border-border/80 bg-background hover:border-primary/50 hover:bg-primary/5 text-foreground transition-all cursor-pointer"
              @click="askAgent(chip.query)"
            >
              <component :is="chip.icon" class="size-3 text-primary shrink-0" />
              <span>{{ chip.label }}</span>
            </button>
          </div>
        </div>

        <!-- Messages Stream -->
        <div class="flex-1 min-h-0 overflow-hidden relative">
          <OverlayScroll class="h-full p-4 space-y-3.5">
            <div v-for="msg in agentMessages" :key="msg.id" class="space-y-2">
              <!-- User Message Bubble -->
              <div v-if="msg.role === 'user'" class="flex justify-end">
                <div class="rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-medium shadow-xs max-w-[85%]">
                  {{ msg.content }}
                </div>
              </div>

              <!-- Copilot Structured Response -->
              <div v-else class="rounded-lg border border-border/80 bg-background/90 p-3 space-y-2.5 shadow-xs">
                <!-- Tool Executions Diagnostic Summary -->
                <div v-if="msg.tools?.length" class="pb-1">
                  <details class="group text-[11px] font-mono">
                    <summary class="inline-flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground select-none py-1 px-2 rounded-md bg-muted/40 hover:bg-muted/70 border border-border/50 transition-colors">
                      <span class="text-emerald-500 font-bold">✓</span>
                      <span class="font-medium text-[10px]">{{ msg.tools.length }} diagnostic {{ msg.tools.length === 1 ? 'source' : 'sources' }} verified</span>
                      <ChevronDown class="size-3 text-muted-foreground transition-transform group-open:rotate-180 ml-0.5" />
                    </summary>
                    <div class="mt-1.5 space-y-1 pl-2.5 border-l-2 border-border/70 pt-0.5">
                      <div
                        v-for="(t, idx) in msg.tools"
                        :key="idx"
                        class="flex items-start gap-1.5 text-[10px] text-muted-foreground"
                      >
                        <span class="text-foreground font-semibold shrink-0">{{ toolLabel(t.name) }}:</span>
                        <span class="opacity-80 leading-tight">{{ t.summary }}</span>
                      </div>
                    </div>
                  </details>
                </div>

                <!-- Blocks Renderer -->
                <div v-if="msg.blocks?.length" class="space-y-2.5">
                  <SentinelBlockRenderer v-for="(block, idx) in msg.blocks" :key="`${msg.id}-block-${idx}`" :block="block" />
                </div>
                <p v-else class="text-xs text-foreground leading-relaxed whitespace-pre-line">{{ msg.content }}</p>

                <!-- Interactive Actions -->
                <div v-if="msg.actions?.length" class="pt-1.5 border-t border-border/40 flex flex-wrap gap-1.5">
                  <Button
                    v-for="act in msg.actions"
                    :key="act.label"
                    variant="outline"
                    size="sm"
                    class="h-6 text-[11px] font-mono px-2 py-0 border-primary/40 hover:bg-primary/10 text-foreground cursor-pointer gap-1 transition-colors"
                    @click="act.handler()"
                  >
                    <ArrowUpRight class="size-2.5 text-primary shrink-0" />
                    <span>{{ act.label }}</span>
                  </Button>
                </div>
              </div>
            </div>

            <!-- Processing Spinner -->
            <div v-if="isAgentProcessing" class="flex items-center gap-2 text-xs text-muted-foreground font-mono p-2.5 rounded border border-border/50 bg-muted/20">
              <RefreshCw class="size-3 text-primary animate-spin" />
              <span>Analyzing fleet telemetry and weather...</span>
            </div>
          </OverlayScroll>
        </div>

        <!-- Command Input Footer -->
        <div class="border-t border-border/80 bg-muted/20 p-3 shrink-0">
          <form class="flex items-center gap-2" @submit.prevent="askAgent(agentInput)">
            <div class="relative flex-1">
              <Search class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
              <Input
                v-model="agentInput"
                placeholder="Ask about ETA delays, weather, or vessel..."
                class="h-8 pl-8 pr-7 text-xs border-border/80 bg-background font-mono"
              />
              <button
                v-if="agentInput"
                type="button"
                class="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 text-xs cursor-pointer"
                @click="agentInput = ''"
              >
                ✕
              </button>
            </div>
            <Button
              type="submit"
              size="sm"
              class="h-8 px-2.5 text-xs cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground font-medium shrink-0"
              :disabled="!agentInput.trim()"
            >
              <Send class="size-3" />
            </Button>
          </form>
          <div class="flex items-center justify-between mt-1.5 px-0.5 text-[10px] text-muted-foreground font-mono">
            <span>Fleet AI Triage & ETA Forecasts</span>
            <span>Esc to close · ⌘J toggle</span>
          </div>
        </div>
      </aside>
    </Transition>
  </div>
</template>

<style scoped>
.copilot-panel {
  transition:
    top 350ms cubic-bezier(0.16, 1, 0.3, 1),
    width 350ms cubic-bezier(0.16, 1, 0.3, 1),
    max-width 350ms cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 300ms ease;
  will-change: width, top;
}

.copilot-slide-enter-active {
  transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1), opacity 250ms ease;
}

.copilot-slide-leave-active {
  transition: transform 260ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease;
}

.copilot-slide-enter-from,
.copilot-slide-leave-to {
  transform: translateX(100%);
  opacity: 0.85;
}

.copilot-slide-enter-to,
.copilot-slide-leave-from {
  transform: translateX(0);
  opacity: 1;
}

.icon-flip-enter-active,
.icon-flip-leave-active {
  transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1), opacity 150ms ease;
}

.icon-flip-enter-from {
  transform: scale(0.6) rotate(-45deg);
  opacity: 0;
}

.icon-flip-leave-to {
  transform: scale(0.6) rotate(45deg);
  opacity: 0;
}
</style>
