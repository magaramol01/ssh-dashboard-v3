<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Anchor, AlertTriangle, BellRing, ChevronLeft, ChevronRight, CircleAlert, CircleCheck,
  RadioTower, RefreshCw, Ship, Wifi, WifiOff,
  Activity, LayoutList, Search, ShieldAlert, Gauge, Clock, ExternalLink
} from 'lucide-vue-next'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { KpiGrid } from '@/components/ui/kpi-grid'
import { OverlayScroll } from '@/components/ui/overlay-scroll'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import KpiTile from '@/components/KpiTile.vue'
import { toneBadge, toneDot, toneText } from '@/lib/utils'

type Alert = {
  alert_key: string
  id: number
  vessel_id: number | null
  vessel_name: string | null
  category: string | null
  system_name: string | null
  message: string | null
  live_value: string | null
  live_value_unit: string | null
  reported_at: string | null
  acknowledged: boolean | null
}

type Voyage = {
  vessel_id: number
  vessel_name: string
  next_port: string | null
  next_port_code: string | null
  eta: string | null
  packet_at: string | null
  route_name: string | null
  load_status: string | null
}

type NetworkVessel = {
  vessel_id: number
  vessel_name: string | null
  connected: boolean | null
  updated_at: string | null
}

type ControlTowerResponse = {
  asOf: string
  networkVessels: NetworkVessel[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  kpis: {
    vessels: number
    activeVoyages: number
    connected: number
    offline: number
    unknown: number
    openAlerts: number
  }
  alerts: Alert[]
  voyages: Voyage[]
}

definePageMeta({ middleware: 'require-dispatcher' })
useHead({ title: 'Control tower · ShipTrack' })

const ALERT_PAGE_SIZE = 10
const alertPage = ref(1)
const viewMode = ref<'table' | 'timeline'>('table')
const filterSeverity = ref<'all' | 'critical' | 'warning'>('all')
const searchQuery = ref('')

const { data, pending, error, refresh } = await useFetch<ControlTowerResponse>('/api/control-tower', {
  query: { page: alertPage, pageSize: ALERT_PAGE_SIZE },
})

const zeroKpis = {
  vessels: 0,
  activeVoyages: 0,
  connected: 0,
  offline: 0,
  unknown: 0,
  openAlerts: 0,
}
const kpis = computed(() => data.value?.kpis ?? zeroKpis)
const alerts = computed(() => data.value?.alerts ?? [])
const voyages = computed(() => data.value?.voyages ?? [])
const networkVessels = computed(() => [...(data.value?.networkVessels ?? [])].sort((a, b) => connectionRank(a) - connectionRank(b)))
const pagination = computed(() => data.value?.pagination ?? {
  page: 1,
  pageSize: ALERT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
})
const alertStart = computed(() => pagination.value.total ? (pagination.value.page - 1) * pagination.value.pageSize + 1 : 0)
const alertEnd = computed(() => Math.min(pagination.value.page * pagination.value.pageSize, pagination.value.total))

watch(() => data.value?.pagination.page, (page) => {
  if (page && page !== alertPage.value) alertPage.value = page
})

function goToAlertPage(page: number) {
  if (page < 1 || page > pagination.value.totalPages || page === alertPage.value) return
  alertPage.value = page
}

const network = computed(() => [
  { label: 'Connected', value: kpis.value.connected, tone: 'success' as const, icon: Wifi },
  { label: 'Offline', value: kpis.value.offline, tone: 'destructive' as const, icon: WifiOff },
  { label: 'Unknown', value: kpis.value.unknown, tone: 'muted' as const, icon: CircleAlert },
])
const networkMax = computed(() => Math.max(1, ...network.value.map((item) => item.value)))

function formatTimestamp(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })} UTC`
}

function formatTimeAgo(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const diffMs = Math.max(0, Date.now() - date.getTime())
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

function alertTone(alert: Alert): 'destructive' | 'warning' {
  const category = `${alert.category ?? ''} ${alert.message ?? ''}`.toLowerCase()
  return /(critical|failure|shutdown|trip|high-high|low-low)/.test(category) ? 'destructive' : 'warning'
}

function alertLabel(alert: Alert) {
  return alertTone(alert) === 'destructive' ? 'Critical' : 'Warning'
}

function parseAlertDetails(alert: Alert) {
  const rawMsg = alert.message || 'Alert triggered'
  let system = alert.system_name && alert.system_name !== '—' ? alert.system_name : ''
  let cleanedMessage = rawMsg

  if (!system) {
    if (/\b(ME|M\/E|MAIN ENGINE)\b/i.test(rawMsg)) {
      system = 'Main Engine'
    } else if (/\b(DG-?[1-9]|G\/E-?[1-9]|DIESEL GEN|GENERATOR)\b/i.test(rawMsg)) {
      const match = rawMsg.match(/\b(DG-?[1-9]|G\/E-?[1-9])\b/i)
      system = match ? match[0].toUpperCase() : 'Aux Generator'
    } else if (/\b(STARTING AIR)\b/i.test(rawMsg)) {
      system = 'Starting Air'
    } else if (/\b(BOILER)\b/i.test(rawMsg)) {
      system = 'Aux Boiler'
    } else if (/\b(STEERING)\b/i.test(rawMsg)) {
      system = 'Steering Gear'
    } else {
      system = 'Machinery'
    }
  }

  cleanedMessage = cleanedMessage.replace(/\s*\((warning|alarm|critical)\)\s*$/i, '').trim()

  return {
    system,
    cleanedMessage,
  }
}

const criticalCount = computed(() => alerts.value.filter(a => alertTone(a) === 'destructive').length)
const warningCount = computed(() => alerts.value.filter(a => alertTone(a) === 'warning').length)

const filteredAlerts = computed(() => {
  return alerts.value.filter(alert => {
    if (filterSeverity.value === 'critical' && alertTone(alert) !== 'destructive') return false
    if (filterSeverity.value === 'warning' && alertTone(alert) !== 'warning') return false

    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase().trim()
      const vName = (alert.vessel_name || '').toLowerCase()
      const msg = (alert.message || '').toLowerCase()
      const sys = (alert.system_name || '').toLowerCase()
      if (!vName.includes(q) && !msg.includes(q) && !sys.includes(q)) {
        return false
      }
    }
    return true
  })
})

function connectionRank(vessel: NetworkVessel) {
  if (vessel.connected === false) return 0
  if (vessel.connected === null) return 1
  return 2
}

function vesselStatus(vessel: NetworkVessel) {
  if (vessel.connected === true) return { label: 'Online', tone: 'success' as const, icon: Wifi }
  if (vessel.connected === false) return { label: 'Offline', tone: 'destructive' as const, icon: WifiOff }
  return { label: 'Unknown', tone: 'muted' as const, icon: CircleAlert }
}
</script>

<template>
  <div class="space-y-6 p-4 md:p-6">
    <!-- Header -->
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Control tower</h1>
        <p class="text-muted-foreground text-xs">Marine operations command center · live fleet health, alerts and voyages.</p>
      </div>
      <div class="flex items-center gap-2 self-start sm:self-auto">
        <Badge variant="outline" class="gap-1.5 px-2.5 py-1 text-xs font-mono">
          <span class="bg-warning size-2 rounded-full animate-pulse" aria-hidden="true" />
          {{ kpis.openAlerts }} open alerts
        </Badge>
        <Button variant="outline" size="sm" :disabled="pending" @click="refresh()">
          <RefreshCw class="mr-2 size-4" :class="pending ? 'animate-spin' : ''" />Refresh
        </Button>
      </div>
    </header>

    <!-- Error Banner -->
    <div v-if="error" class="border-destructive/40 bg-destructive/5 flex items-center justify-between gap-4 rounded-lg border p-4">
      <div class="flex items-start gap-3">
        <CircleAlert class="text-destructive mt-0.5 size-4 shrink-0" />
        <div>
          <p class="text-sm font-medium">Control tower data is unavailable</p>
          <p class="text-muted-foreground text-xs">Configure the server-side PostgreSQL environment variables and try again.</p>
        </div>
      </div>
      <Button variant="outline" size="sm" @click="refresh">Retry</Button>
    </div>

    <!-- KPI Grid -->
    <KpiGrid v-if="!pending">
      <KpiTile label="Fleet vessels" :value="kpis.vessels" hint="Registered vessels" tone="info" :icon="Ship" />
      <KpiTile label="Active voyages" :value="kpis.activeVoyages" hint="Latest voyage per vessel" tone="info" :icon="Anchor" />
      <KpiTile label="Open alerts" :value="kpis.openAlerts" hint="Unacknowledged outcomes" tone="warning" :icon="BellRing" />
      <KpiTile label="Offline VSAT" :value="kpis.offline" hint="Heartbeat status" tone="destructive" :icon="WifiOff" />
    </KpiGrid>
    <KpiGrid v-else>
      <Skeleton v-for="i in 4" :key="i" variant="rounded" class="h-[150px] w-full" />
    </KpiGrid>

    <!-- Tier 1: Unified Alert Triage & Activity Hub -->
    <Card class="flex flex-col border-border/80 shadow-xs">
      <CardHeader class="flex flex-col gap-4 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-3">
          <div class="flex size-9 items-center justify-center rounded-lg bg-warning/15 text-warning shrink-0">
            <ShieldAlert class="size-5" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <CardTitle class="text-base font-semibold">Alert Triage & Activity Hub</CardTitle>
              <Badge variant="outline" class="font-mono text-xs tabular-nums">
                {{ pagination.total }} open
              </Badge>
            </div>
            <CardDescription class="text-xs">
              Live operational triage, machine limits, sensor telemetry & chronological activity
            </CardDescription>
          </div>
        </div>

        <!-- Controls toolbar: Severity filter, Search, and View switcher -->
        <div class="flex flex-wrap items-center gap-2">
          <!-- Severity Filter Tabs -->
          <div class="inline-flex rounded-lg border border-border/60 bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              :class="['px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer', filterSeverity === 'all' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground']"
              @click="filterSeverity = 'all'"
            >
              All ({{ alerts.length }})
            </button>
            <button
              type="button"
              :class="['px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer', filterSeverity === 'critical' ? 'bg-background text-destructive shadow-xs' : 'text-muted-foreground hover:text-foreground']"
              @click="filterSeverity = 'critical'"
            >
              <span class="size-1.5 rounded-full bg-destructive" />
              Critical ({{ criticalCount }})
            </button>
            <button
              type="button"
              :class="['px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer', filterSeverity === 'warning' ? 'bg-background text-warning shadow-xs' : 'text-muted-foreground hover:text-foreground']"
              @click="filterSeverity = 'warning'"
            >
              <span class="size-1.5 rounded-full bg-warning" />
              Warnings ({{ warningCount }})
            </button>
          </div>

          <!-- Search Filter -->
          <div class="relative w-40 sm:w-52">
            <Search class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              v-model="searchQuery"
              placeholder="Search alert, vessel..."
              class="h-8 pl-8 pr-6 text-xs"
            />
            <button
              v-if="searchQuery"
              type="button"
              class="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 text-xs"
              @click="searchQuery = ''"
            >
              ✕
            </button>
          </div>

          <!-- View Mode Toggle -->
          <div class="inline-flex rounded-lg border border-border/60 bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              :class="['flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors cursor-pointer', viewMode === 'table' ? 'bg-background text-foreground font-medium shadow-xs' : 'text-muted-foreground hover:text-foreground']"
              title="Table View"
              aria-label="Table View"
              @click="viewMode = 'table'"
            >
              <LayoutList class="size-3.5" />
              <span class="hidden sm:inline">Table</span>
            </button>
            <button
              type="button"
              :class="['flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors cursor-pointer', viewMode === 'timeline' ? 'bg-background text-foreground font-medium shadow-xs' : 'text-muted-foreground hover:text-foreground']"
              title="Timeline Activity Stream"
              aria-label="Timeline Activity Stream"
              @click="viewMode = 'timeline'"
            >
              <Activity class="size-3.5" />
              <span class="hidden sm:inline">Activity Stream</span>
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent class="flex-1 p-0">
        <!-- Loading State -->
        <div v-if="pending" class="p-6 space-y-3">
          <Skeleton v-for="i in 6" :key="i" class="h-11 w-full rounded-md" />
        </div>

        <!-- VIEW A: Enterprise Table View -->
        <div v-else-if="viewMode === 'table'" class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow class="bg-muted/30 hover:bg-muted/30">
                <TableHead class="w-[110px]">Severity</TableHead>
                <TableHead class="min-w-[150px]">Vessel</TableHead>
                <TableHead class="min-w-[130px]">System / Unit</TableHead>
                <TableHead class="min-w-[240px]">Trigger & Condition</TableHead>
                <TableHead class="min-w-[120px]">Live Telemetry</TableHead>
                <TableHead class="min-w-[140px]">Reported</TableHead>
                <TableHead class="w-[120px] text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="alert in filteredAlerts"
                :key="alert.alert_key"
                class="hover:bg-muted/40 transition-colors"
              >
                <!-- Severity -->
                <TableCell>
                  <Badge
                    :variant="alertTone(alert) === 'destructive' ? 'destructive' : 'warning'"
                    class="gap-1 font-semibold uppercase text-[10px] tracking-wide"
                  >
                    <span class="size-1.5 rounded-full" :class="alertTone(alert) === 'destructive' ? 'bg-white' : 'bg-current'" />
                    {{ alertLabel(alert) }}
                  </Badge>
                </TableCell>

                <!-- Vessel Link -->
                <TableCell>
                  <NuxtLink
                    to="/fleet"
                    class="group inline-flex items-center gap-1.5 font-medium text-foreground hover:text-primary transition-colors text-xs sm:text-sm"
                  >
                    <Ship class="text-muted-foreground size-3.5 group-hover:text-primary transition-colors" />
                    <span>{{ alert.vessel_name || `Vessel ${alert.vessel_id ?? '—'}` }}</span>
                  </NuxtLink>
                </TableCell>

                <!-- System Tag -->
                <TableCell>
                  <span class="inline-flex items-center rounded-md bg-muted/60 border border-border/60 px-2 py-0.5 text-xs font-mono font-medium text-muted-foreground">
                    {{ parseAlertDetails(alert).system }}
                  </span>
                </TableCell>

                <!-- Condition Message -->
                <TableCell>
                  <div class="flex flex-col gap-0.5">
                    <span class="text-xs font-medium text-foreground leading-snug">
                      {{ parseAlertDetails(alert).cleanedMessage }}
                    </span>
                    <span class="text-[11px] text-muted-foreground">
                      Category: {{ alert.category || 'Operational outcome' }}
                    </span>
                  </div>
                </TableCell>

                <!-- Live Value -->
                <TableCell>
                  <div v-if="alert.live_value" class="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-0.5 text-xs font-mono tabular-nums font-semibold">
                    <Gauge class="size-3 text-muted-foreground" />
                    <span>{{ alert.live_value }}</span>
                    <span v-if="alert.live_value_unit" class="text-muted-foreground text-[11px] font-normal">{{ alert.live_value_unit }}</span>
                  </div>
                  <span v-else class="text-muted-foreground text-xs">—</span>
                </TableCell>

                <!-- Reported Time -->
                <TableCell class="whitespace-nowrap">
                  <div class="flex flex-col" :title="formatTimestamp(alert.reported_at)">
                    <span class="text-xs font-medium text-foreground tabular-nums">{{ formatTimeAgo(alert.reported_at) }}</span>
                    <span class="text-[11px] text-muted-foreground tabular-nums">{{ formatTimestamp(alert.reported_at) }}</span>
                  </div>
                </TableCell>

                <!-- Status Badge -->
                <TableCell class="text-right">
                  <Badge variant="outline" class="border-warning/30 bg-warning/5 text-warning text-[11px] gap-1 font-normal">
                    <span class="size-1.5 rounded-full bg-warning" />
                    Awaiting action
                  </Badge>
                </TableCell>
              </TableRow>

              <!-- Empty Table State -->
              <TableRow v-if="!filteredAlerts.length">
                <TableCell colspan="7" class="text-muted-foreground h-32 text-center">
                  <CircleCheck class="text-success mx-auto mb-2 size-6" />
                  <p class="text-sm font-medium text-foreground">No alerts match your filter</p>
                  <p class="text-xs text-muted-foreground mt-0.5">Try clearing your search query or severity filter.</p>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <!-- VIEW B: Activity Timeline Stream -->
        <div v-else-if="viewMode === 'timeline'" class="p-4 sm:p-6">
          <OverlayScroll class="h-[520px] pr-2">
            <div v-if="filteredAlerts.length" class="space-y-4 pb-2">
              <div
                v-for="(alert, idx) in filteredAlerts"
                :key="`timeline-${alert.alert_key}`"
                class="group relative flex items-start gap-3 sm:gap-4"
              >
                <!-- Left: Timestamp Column (Desktop/Tablet) -->
                <div class="hidden sm:flex flex-col items-end w-24 shrink-0 pt-1 text-right select-none">
                  <span class="text-xs font-semibold text-foreground tabular-nums">{{ formatTimeAgo(alert.reported_at) }}</span>
                  <span class="text-[11px] text-muted-foreground tabular-nums">{{ formatTimestamp(alert.reported_at).split(' ').slice(1, 3).join(' ') }}</span>
                </div>

                <!-- Center: Continuous Rail & Node -->
                <div class="relative flex flex-col items-center self-stretch shrink-0">
                  <!-- Continuous vertical line (connects to next item unless last) -->
                  <div
                    v-if="idx < filteredAlerts.length - 1"
                    class="absolute top-6 bottom-0 w-[2px] bg-border/80 group-hover:bg-border transition-colors"
                  />
                  <!-- Event node circle -->
                  <div
                    :class="[
                      'relative z-10 flex size-7 items-center justify-center rounded-full ring-4 ring-card shadow-xs transition-transform group-hover:scale-110',
                      alertTone(alert) === 'destructive'
                        ? 'bg-destructive/15 text-destructive border border-destructive/40'
                        : 'bg-warning/15 text-warning border border-warning/40'
                    ]"
                  >
                    <AlertTriangle class="size-3.5" />
                  </div>
                </div>

                <!-- Right: Incident Event Card -->
                <div class="flex-1 min-w-0 rounded-lg border border-border/70 bg-card/60 hover:bg-card hover:border-border p-3.5 sm:p-4 transition-all shadow-xs">
                  <!-- Header: Vessel, Severity, System Tag, and Telemetry Pill -->
                  <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                    <div class="flex flex-wrap items-center gap-2">
                      <NuxtLink
                        to="/fleet"
                        class="font-semibold text-sm text-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5"
                      >
                        <Ship class="size-3.5 text-muted-foreground" />
                        {{ alert.vessel_name || `Vessel ${alert.vessel_id ?? '—'}` }}
                      </NuxtLink>
                      <Badge
                        :variant="alertTone(alert) === 'destructive' ? 'destructive' : 'warning'"
                        class="font-semibold uppercase text-[10px] tracking-wide py-0.5 px-2"
                      >
                        {{ alertLabel(alert) }}
                      </Badge>
                      <span class="rounded-md bg-muted/60 border border-border/60 px-2 py-0.5 text-xs font-mono font-medium text-muted-foreground">
                        {{ parseAlertDetails(alert).system }}
                      </span>
                    </div>

                    <!-- Telemetry & Mobile Time -->
                    <div class="flex items-center gap-2">
                      <div
                        v-if="alert.live_value"
                        class="inline-flex items-center gap-1.5 rounded-md bg-muted/60 border border-border/60 px-2.5 py-1 text-xs font-mono tabular-nums font-semibold"
                      >
                        <Gauge class="size-3.5 text-primary" />
                        <span class="text-foreground">{{ alert.live_value }}</span>
                        <span v-if="alert.live_value_unit" class="text-muted-foreground text-[11px] font-normal">{{ alert.live_value_unit }}</span>
                      </div>
                      <span class="sm:hidden text-xs text-muted-foreground tabular-nums">{{ formatTimeAgo(alert.reported_at) }}</span>
                    </div>
                  </div>

                  <!-- Body: Message & Status Details -->
                  <div class="pt-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div class="space-y-0.5 min-w-0">
                      <p class="text-sm font-medium text-foreground leading-snug">
                        {{ parseAlertDetails(alert).cleanedMessage }}
                      </p>
                      <p class="text-xs text-muted-foreground">
                        Reported category: <span class="capitalize">{{ alert.category || 'Operational outcome' }}</span> · Unacknowledged
                      </p>
                    </div>

                    <Badge variant="outline" class="self-start sm:self-auto shrink-0 text-[10px] border-warning/30 bg-warning/5 text-warning font-normal gap-1">
                      <span class="size-1.5 rounded-full bg-warning animate-pulse" />
                      Open alert
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <!-- Empty Timeline State -->
            <div v-else class="text-muted-foreground py-16 text-center">
              <CircleCheck class="text-success mx-auto mb-2 size-6" />
              <p class="text-sm font-medium text-foreground">No alerts match your filter</p>
              <p class="text-xs text-muted-foreground mt-0.5">Try changing your severity filter or search query.</p>
            </div>
          </OverlayScroll>
        </div>

        <!-- Footer Pagination -->
        <div class="relative z-10 bg-card border-t border-border/60 flex flex-col gap-3 p-4 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span class="text-muted-foreground">
            {{ pagination.total ? `Showing ${alertStart}–${alertEnd} of ${pagination.total} total alerts` : 'No alerts to display' }}
            <span v-if="searchQuery || filterSeverity !== 'all'" class="ml-1 text-primary font-medium">
              ({{ filteredAlerts.length }} displayed on this page)
            </span>
          </span>
          <div class="flex items-center gap-2">
            <span class="text-muted-foreground tabular-nums">Page {{ pagination.page }} of {{ pagination.totalPages }}</span>
            <Button
              variant="outline"
              size="sm"
              class="h-8"
              :disabled="pending || pagination.page <= 1"
              aria-label="Previous alert page"
              @click="goToAlertPage(pagination.page - 1)"
            >
              <ChevronLeft class="mr-1 size-3.5" />Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              class="h-8"
              :disabled="pending || pagination.page >= pagination.totalPages"
              aria-label="Next alert page"
              @click="goToAlertPage(pagination.page + 1)"
            >
              Next<ChevronRight class="ml-1 size-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Tier 2: Balanced Bottom Operations Deck (Network Status + Voyage Watch) -->
    <div class="grid gap-6 lg:grid-cols-12">
      <!-- Network Status Card (lg:col-span-7) -->
      <Card class="flex flex-col lg:h-[580px] lg:col-span-7 border-border/80 shadow-xs">
        <CardHeader class="flex-row items-center justify-between pb-3 shrink-0">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <div class="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <RadioTower class="size-4" />
              </div>
              <div>
                <CardTitle class="text-base font-semibold">Network status</CardTitle>
                <CardDescription class="text-xs">Latest VSAT satellite heartbeat telemetry per vessel</CardDescription>
              </div>
            </div>
          </div>
          <Badge variant="outline" class="tabular-nums font-mono text-xs">
            {{ networkVessels.length }} vessels
          </Badge>
        </CardHeader>
        <CardContent class="flex flex-col flex-1 min-h-0 space-y-3 pb-3">
          <!-- Heartbeat percentage bars -->
          <ul class="space-y-2 shrink-0">
            <li v-for="item in network" :key="item.label" class="space-y-1">
              <div class="flex items-center gap-2 text-xs">
                <component :is="item.icon" :class="['size-3.5', toneText(item.tone)]" />
                <span class="text-muted-foreground">{{ item.label }}</span>
                <span class="ml-auto font-semibold tabular-nums text-foreground">{{ item.value }}</span>
              </div>
              <div class="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                <div :class="['h-full rounded-full transition-all duration-500', toneDot(item.tone)]" :style="{ width: `${(item.value / networkMax) * 100}%` }" />
              </div>
            </li>
          </ul>

          <!-- Vessel Grid -->
          <div class="border-border/60 border-t pt-2.5 flex flex-col flex-1 min-h-0">
            <div class="mb-2 flex items-center justify-between shrink-0">
              <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fleet connectivity status</p>
              <span class="text-muted-foreground text-xs">{{ networkVessels.length }} monitored</span>
            </div>
            <OverlayScroll class="flex-1 min-h-0 pr-2">
              <ul v-if="networkVessels.length" class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <li
                  v-for="vessel in networkVessels"
                  :key="vessel.vessel_id"
                  class="border-border/70 bg-muted/20 hover:bg-muted/40 flex min-w-0 items-center gap-2.5 rounded-lg border p-2.5 transition-colors"
                >
                  <component :is="vesselStatus(vessel).icon" :class="['size-4 shrink-0', toneText(vesselStatus(vessel).tone)]" />
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-xs font-medium">{{ vessel.vessel_name || `Vessel ${vessel.vessel_id}` }}</p>
                    <p class="text-muted-foreground mt-0.5 truncate text-[10px]">
                      {{ vessel.updated_at ? `Last ping ${formatTimeAgo(vessel.updated_at)}` : 'No heartbeat' }}
                    </p>
                  </div>
                  <Badge :variant="toneBadge(vesselStatus(vessel).tone)" class="shrink-0 text-[10px] py-0 px-1.5">{{ vesselStatus(vessel).label }}</Badge>
                </li>
              </ul>
              <p v-else class="text-muted-foreground py-5 text-center text-xs">No vessel heartbeat data.</p>
            </OverlayScroll>
          </div>

          <div class="border-border/60 border-t pt-2.5 text-[11px] text-muted-foreground flex items-center justify-between shrink-0">
            <div class="flex items-center gap-1.5">
              <RadioTower class="size-3" />
              <span>Source: VSAT telemetry</span>
            </div>
            <p v-if="data?.asOf">Read {{ formatTimestamp(data.asOf) }}</p>
          </div>
        </CardContent>
      </Card>

      <!-- Voyage Watch Card (lg:col-span-5) -->
      <Card class="flex flex-col lg:h-[580px] lg:col-span-5 border-border/80 shadow-xs">
        <CardHeader class="flex-row items-center justify-between pb-3 shrink-0">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <div class="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Anchor class="size-4" />
              </div>
              <div>
                <CardTitle class="text-base font-semibold">Voyage Watch</CardTitle>
                <CardDescription class="text-xs">Next port, schedule & ETA by vessel</CardDescription>
              </div>
            </div>
          </div>
          <Badge variant="outline" class="tabular-nums font-mono text-xs">
            {{ voyages.length }} vessels
          </Badge>
        </CardHeader>
        <CardContent class="flex flex-col flex-1 min-h-0 space-y-3 pb-3">
          <div v-if="pending" class="space-y-3">
            <Skeleton v-for="i in 5" :key="i" class="h-14 w-full rounded-lg" />
          </div>
          <OverlayScroll v-else-if="voyages.length" class="flex-1 min-h-0 pr-2">
            <ul class="space-y-2">
              <li
                v-for="voyage in voyages"
                :key="voyage.vessel_id"
                class="border-border/60 bg-muted/20 hover:bg-muted/40 hover:border-border flex flex-col gap-1.5 rounded-lg border p-2.5 transition-colors"
              >
                <!-- Vessel + Port Code Header -->
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-md">
                      <Ship class="size-3.5" />
                    </span>
                    <NuxtLink to="/fleet" class="truncate text-xs font-semibold hover:underline">
                      {{ voyage.vessel_name }}
                    </NuxtLink>
                  </div>

                  <Badge
                    v-if="voyage.next_port"
                    variant="info"
                    class="shrink-0 font-mono text-[10px]"
                  >
                    {{ voyage.next_port_code || 'PORT' }}
                  </Badge>
                  <Badge
                    v-else
                    variant="secondary"
                    class="shrink-0 text-[10px] text-muted-foreground font-normal"
                  >
                    Awaiting Orders
                  </Badge>
                </div>

                <!-- Destination & ETA Details -->
                <div class="flex items-center justify-between gap-2 text-xs pt-0.5">
                  <div class="min-w-0 truncate text-muted-foreground">
                    <span v-if="voyage.next_port" class="font-medium text-foreground">
                      Port: {{ voyage.next_port }}
                    </span>
                    <span v-else class="italic text-[11px]">
                      In port / Berth operations
                    </span>
                    <span v-if="voyage.route_name" class="block text-[11px] text-muted-foreground/80 truncate">
                      Route: {{ voyage.route_name }}
                    </span>
                  </div>

                  <div class="text-right shrink-0">
                    <div v-if="voyage.eta" class="tabular-nums font-semibold text-foreground text-xs">
                      {{ formatTimestamp(voyage.eta) }}
                    </div>
                    <div v-else class="text-muted-foreground text-[11px]">
                      No ETA scheduled
                    </div>
                    <span class="text-muted-foreground text-[10px] uppercase tracking-wider font-semibold">ETA</span>
                  </div>
                </div>

                <!-- Load status footer if available -->
                <div v-if="voyage.load_status" class="flex items-center gap-1.5 pt-1.5 border-t border-border/40 text-[11px] text-muted-foreground">
                  <span class="size-1.5 rounded-full bg-primary/70" />
                  <span>Status: <strong class="text-foreground font-medium">{{ voyage.load_status }}</strong></span>
                </div>
              </li>
            </ul>
          </OverlayScroll>
          <p v-else class="text-muted-foreground py-10 text-center text-sm">No voyage forecasts available.</p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
