<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import {
  Anchor, AlertTriangle, ChevronLeft, ChevronRight, CircleAlert, CircleCheck,
  RadioTower, RefreshCw, Ship, Wifi, WifiOff,
  Activity, LayoutList, Search, ShieldAlert, Gauge, Clock,
  Send, Bot, X, RotateCcw, ArrowUpRight, FileText, CheckCircle2
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import type { SentinelAction, SentinelBlock, SentinelChatResponse } from '#shared/types/sentinel'

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
import { useSidebar } from '@/components/ui/sidebar'

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
  started_at: string | null
  last_fired_at: string | null
  occurrences: number
  acknowledged: boolean | null
}

type Voyage = {
  vessel_id: number
  vessel_name: string
  departure_port: string | null
  departure_port_code: string | null
  departure_at: string | null
  next_port: string | null
  next_port_code: string | null
  eta: string | null
  packet_at: string | null
  route_name: string | null
  load_status: string | null
  distance_travelled: string | number | null
  distance_to_go: string | number | null
  total_distance: string | number | null
  progress_value?: string | number | null
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
    criticalAlerts?: number
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
const sortBySeverity = ref(true)

const { data, pending, error, refresh } = await useFetch<ControlTowerResponse>('/api/control-tower', {
  query: {
    page: alertPage,
    pageSize: ALERT_PAGE_SIZE,
    severity: filterSeverity,
    search: searchQuery,
  },
})

watch([filterSeverity, searchQuery], () => {
  alertPage.value = 1
})

const zeroKpis = {
  vessels: 0,
  activeVoyages: 0,
  connected: 0,
  offline: 0,
  unknown: 0,
  openAlerts: 0,
  criticalAlerts: 0,
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

const connectivityRate = computed(() => {
  const total = kpis.value.connected + kpis.value.offline
  if (!total) return 100
  return Math.round((kpis.value.connected / total) * 100)
})

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

function voyageTransit(voyage: Voyage) {
  const serverProgress = voyage.progress_value != null ? Number(voyage.progress_value) : NaN
  const travelled = Number(voyage.distance_travelled)
  const toGo = Number(voyage.distance_to_go)
  const total = Number(voyage.total_distance) || (Number.isFinite(travelled) && Number.isFinite(toGo) ? travelled + toGo : 0)

  let progress = 0
  let distanceText = ''

  if (Number.isFinite(serverProgress) && serverProgress >= 0) {
    progress = Math.min(100, Math.max(0, Math.round(serverProgress)))
    if (total > 0 && Number.isFinite(travelled)) {
      distanceText = `${Math.round(travelled)} / ${Math.round(total)} nm`
    }
  } else if (total > 0 && Number.isFinite(travelled)) {
    progress = Math.min(100, Math.max(0, Math.round((travelled / total) * 100)))
    distanceText = `${Math.round(travelled)} / ${Math.round(total)} nm`
  } else if (voyage.departure_at && voyage.eta) {
    const depTime = new Date(voyage.departure_at).getTime()
    const arrTime = new Date(voyage.eta).getTime()
    const now = Date.now()
    if (!Number.isNaN(depTime) && !Number.isNaN(arrTime) && arrTime > depTime) {
      progress = Math.min(100, Math.max(0, Math.round(((now - depTime) / (arrTime - depTime)) * 100)))
    }
  } else if (voyage.next_port) {
    progress = 50
  }

  if (!distanceText && Number.isFinite(toGo) && toGo > 0) {
    distanceText = `${Math.round(toGo)} nm to go`
  }

  return { progress, distanceText }
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

const criticalCount = computed(() => {
  if (filterSeverity.value === 'all' && data.value?.kpis?.criticalAlerts !== undefined) {
    return data.value.kpis.criticalAlerts
  }
  return alerts.value.filter((a) => alertTone(a) === 'destructive').length
})

const warningCount = computed(() => {
  if (filterSeverity.value === 'all' && data.value?.kpis?.criticalAlerts !== undefined) {
    return Math.max(0, kpis.value.openAlerts - data.value.kpis.criticalAlerts)
  }
  return alerts.value.filter((a) => alertTone(a) === 'warning').length
})

const filteredAlerts = computed(() => {
  let list = [...alerts.value]

  if (sortBySeverity.value) {
    list = [...list].sort((a, b) => {
      const toneA = alertTone(a) === 'destructive' ? 2 : 1
      const toneB = alertTone(b) === 'destructive' ? 2 : 1
      if (toneA !== toneB) return toneB - toneA
      if (a.live_value && !b.live_value) return -1
      if (!a.live_value && b.live_value) return 1
      return 0
    })
  }

  return list
})

function connectionRank(vessel: NetworkVessel) {
  return vessel.connected === true ? 1 : 0
}

function vesselStatus(vessel: NetworkVessel) {
  if (vessel.connected === true) return { label: 'Online', tone: 'success' as const, icon: Wifi }
  return { label: 'Offline', tone: 'destructive' as const, icon: WifiOff }
}

// ----------------------------------------------------
// Operations Copilot (Sentinel) Workbench State
// ----------------------------------------------------
type AgentToolCall = {
  name: string
  args: string
  summary: string
}

type AgentAction = {
  label: string
  handler: () => void
}

type AgentMessage = {
  id: string
  role: 'user' | 'agent'
  content: string
  blocks?: SentinelBlock[]
  tools?: AgentToolCall[]
  actions?: AgentAction[]
}

const isWorkbenchOpen = ref(false)
const agentInput = ref('')
const isAgentProcessing = ref(false)

const { open: isSidebarOpen, setOpen: setSidebarOpen, openMobile, setOpenMobile } = useSidebar()

// Mutually exclusive single-panel rule:
// Only one panel can be visible at a time. Opening one overwrites (closes) the other.
watch(isWorkbenchOpen, (open) => {
  if (open) {
    if (isSidebarOpen.value) setSidebarOpen(false)
    if (openMobile?.value) setOpenMobile(false)
  }
})

watch([isSidebarOpen, () => openMobile?.value], ([desktopOpen, mobileOpen]) => {
  if (desktopOpen || mobileOpen) {
    if (isWorkbenchOpen.value) {
      isWorkbenchOpen.value = false
    }
  }
})

const quickDirectives = [
  { label: 'Triage Critical', query: 'Triage critical alarms across the fleet', icon: AlertTriangle },
  { label: 'Engine Diagnostics', query: 'Diagnose main engine and generator telemetry alarms', icon: Gauge },
  { label: 'VSAT Connectivity', query: 'Analyze VSAT outages and comms drops', icon: WifiOff },
  { label: 'Shift Handover', query: 'Generate shift handover summary for current active alarms', icon: FileText },
]

const agentMessages = ref<AgentMessage[]>([
  {
    id: 'sentinel-ready',
    role: 'agent',
    content: 'Operations Copilot ready. Inquire about machinery alerts, fleet connectivity status, or voyage forecasts.',
  },
])

async function askAgent(promptText: string, context?: { alertId?: number; vesselId?: number }) {
  const q = promptText.trim()
  if (!q || isAgentProcessing.value) return
  agentInput.value = ''
  isWorkbenchOpen.value = true
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
    toast.error(requestError instanceof Error ? requestError.message : 'Copilot is temporarily unavailable.')
  } finally {
    isAgentProcessing.value = false
  }
}

function toolLabel(name: string) {
  return name.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function applyAgentAction(action: SentinelAction) {
  if (action.type === 'filter-alerts') {
    filterSeverity.value = action.severity ?? 'all'
    searchQuery.value = action.search ?? ''
    alertPage.value = 1
    toast.info('Alert filters updated')
  } else {
    searchQuery.value = action.label.replace(/^Focus /, '')
    alertPage.value = 1
    toast.info(`Focused ${action.label.replace(/^Focus /, '')}`)
  }
}

function openAgentForAlert(alert: Alert) {
  isWorkbenchOpen.value = true
  const vName = alert.vessel_name || `Vessel ${alert.vessel_id ?? ''}`
  void askAgent(`Diagnose ${vName}: ${alert.message || 'Alert'}`, {
    alertId: alert.id,
    vesselId: alert.vessel_id ?? undefined,
  })
}

function resetAgentSession() {
  agentMessages.value = [{
    id: `ready-${Date.now()}`,
    role: 'agent',
    content: 'Copilot session reset. Enter a query or select a fleet directive below.',
  }]
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isWorkbenchOpen.value) {
    isWorkbenchOpen.value = false
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
    e.preventDefault()
    isWorkbenchOpen.value = !isWorkbenchOpen.value
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeydown)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeydown)
  }
})
</script>

<template>
  <div class="flex flex-1 min-h-[calc(100svh-3.5rem)] w-full relative">
    <!-- Main Dashboard Area -->
    <div class="flex-1 min-w-0 space-y-5 p-4 md:p-6 pb-12 transition-all duration-300">
      <!-- Clean Maritime Topbar -->
      <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div class="flex items-center gap-2.5">
            <h1 class="text-2xl font-semibold tracking-tight">Control tower</h1>
            <span v-if="data?.asOf" class="text-[11px] font-mono text-muted-foreground border border-border/70 rounded px-2 py-0.5 bg-muted/30">
              Synced {{ formatTimeAgo(data.asOf) }}
            </span>
          </div>
          <p class="text-muted-foreground text-xs mt-0.5">Fleet operations & telemetry command center</p>
        </div>

        <div class="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            :class="[
              'gap-2 text-xs font-mono cursor-pointer transition-colors',
              isWorkbenchOpen ? 'bg-primary/10 border-primary/50 text-primary font-semibold' : 'text-foreground'
            ]"
            title="Toggle Operations Copilot (⌘J)"
            @click="isWorkbenchOpen = !isWorkbenchOpen"
          >
            <Bot class="size-3.5 text-primary" />
            <span>Copilot</span>
            <kbd class="hidden sm:inline-block text-[10px] text-muted-foreground border border-border px-1 py-0.2 rounded bg-muted/60">⌘J</kbd>
          </Button>

          <Button variant="outline" size="sm" :disabled="pending" class="cursor-pointer text-xs" @click="refresh()">
            <RefreshCw class="mr-1.5 size-3.5" :class="pending ? 'animate-spin' : ''" />
            <span>Refresh</span>
          </Button>
        </div>
      </header>

      <!-- Error Banner -->
      <div v-if="error" class="border-destructive/40 bg-destructive/5 flex items-center justify-between gap-4 rounded-lg border p-4">
        <div class="flex items-start gap-3">
          <CircleAlert class="text-destructive mt-0.5 size-4 shrink-0" />
          <div>
            <p class="text-sm font-medium">Control tower telemetry is currently unavailable</p>
            <p class="text-muted-foreground text-xs">Verify database connectivity and configuration.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" @click="refresh">Retry</Button>
      </div>

      <!-- Deduplicated High-Signal KPI Grid -->
      <KpiGrid v-if="!pending">
        <KpiTile
          label="Fleet vessels"
          :value="kpis.vessels"
          :hint="`${kpis.activeVoyages} vessels currently underway`"
          tone="info"
          :icon="Ship"
        />
        <KpiTile
          label="VSAT connectivity"
          :value="`${connectivityRate}%`"
          :hint="`${kpis.connected} online · ${kpis.offline} offline`"
          :tone="kpis.offline > 0 ? 'warning' : 'success'"
          :icon="RadioTower"
        />
        <KpiTile
          label="Active voyages"
          :value="kpis.activeVoyages"
          hint="En route to next destination"
          tone="info"
          :icon="Anchor"
        />
        <KpiTile
          label="Critical attention"
          :value="criticalCount"
          :hint="`${pagination.total} total open incidents`"
          :tone="criticalCount > 0 ? 'destructive' : 'success'"
          :icon="ShieldAlert"
        />
      </KpiGrid>
      <KpiGrid v-else>
        <Skeleton v-for="i in 4" :key="i" variant="rounded" class="h-[120px] w-full" />
      </KpiGrid>

      <!-- Active Incidents & Telemetry Alarms Feed -->
      <Card class="flex flex-col border-border/80 shadow-xs">
        <CardHeader class="flex flex-col gap-4 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div class="flex items-center gap-2.5">
              <CardTitle class="text-base font-semibold">Active Incidents</CardTitle>
              <button
                type="button"
                :class="[
                  'text-[11px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer',
                  sortBySeverity ? 'border-primary/40 bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:text-foreground'
                ]"
                title="Toggle sort order"
                @click="sortBySeverity = !sortBySeverity"
              >
                {{ sortBySeverity ? 'Sort: Severity First' : 'Sort: Most Recent' }}
              </button>
            </div>
            <CardDescription class="text-xs mt-0.5">
              Real-time machinery telemetry alarms and unacknowledged events
            </CardDescription>
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
                All ({{ pagination.total }})
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
                placeholder="Filter vessel, system..."
                class="h-8 pl-8 pr-6 text-xs font-mono"
              />
              <button
                v-if="searchQuery"
                type="button"
                class="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 text-xs cursor-pointer"
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
                title="Activity Stream"
                aria-label="Activity Stream"
                @click="viewMode = 'timeline'"
              >
                <Activity class="size-3.5" />
                <span class="hidden sm:inline">Stream</span>
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent class="flex-1 p-0">
          <!-- Loading State -->
          <div v-if="pending" class="p-6 space-y-3">
            <Skeleton v-for="i in 6" :key="i" class="h-11 w-full rounded-md" />
          </div>

          <!-- VIEW A: Enterprise Telemetry Table -->
          <div v-else-if="viewMode === 'table'" class="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow class="bg-muted/30 hover:bg-muted/30">
                  <TableHead class="w-[95px]">Severity</TableHead>
                  <TableHead class="min-w-[130px]">Vessel</TableHead>
                  <TableHead class="min-w-[110px]">Subsystem</TableHead>
                  <TableHead class="min-w-[280px]">Condition</TableHead>
                  <TableHead class="min-w-[110px]">Telemetry</TableHead>
                  <TableHead class="min-w-[150px]">Timeline</TableHead>
                  <TableHead class="w-[90px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="alert in filteredAlerts"
                  :key="alert.alert_key"
                  class="hover:bg-muted/40 transition-colors text-xs"
                >
                  <!-- Severity -->
                  <TableCell>
                    <Badge
                      :variant="alertTone(alert) === 'destructive' ? 'destructive' : 'warning'"
                      class="font-semibold uppercase text-[10px] tracking-wider font-mono py-0 px-1.5"
                    >
                      {{ alertLabel(alert) }}
                    </Badge>
                  </TableCell>

                  <!-- Vessel Link -->
                  <TableCell>
                    <NuxtLink
                      to="/fleet"
                      class="font-medium text-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5"
                    >
                      <Ship class="text-muted-foreground size-3.5 shrink-0" />
                      <span>{{ alert.vessel_name || `Vessel ${alert.vessel_id ?? '—'}` }}</span>
                    </NuxtLink>
                  </TableCell>

                  <!-- System Tag -->
                  <TableCell>
                    <span class="inline-flex items-center rounded bg-muted/60 border border-border/60 px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground">
                      {{ parseAlertDetails(alert).system }}
                    </span>
                  </TableCell>

                  <!-- Condition Message (Clean, No AI Clickbait) -->
                  <TableCell>
                    <span class="font-medium text-foreground leading-snug">
                      {{ parseAlertDetails(alert).cleanedMessage }}
                    </span>
                  </TableCell>

                  <!-- Live Value -->
                  <TableCell>
                    <div v-if="alert.live_value" class="inline-flex items-center gap-1 font-mono text-xs tabular-nums font-semibold">
                      <Gauge class="size-3 text-muted-foreground shrink-0" />
                      <span>{{ alert.live_value }}</span>
                      <span v-if="alert.live_value_unit" class="text-muted-foreground text-[10px] font-normal">{{ alert.live_value_unit }}</span>
                    </div>
                    <span v-else class="text-muted-foreground">—</span>
                  </TableCell>

                  <!-- Timeline Summary -->
                  <TableCell class="whitespace-nowrap">
                    <div class="flex flex-col text-[11px]" :title="`Started ${formatTimestamp(alert.started_at)} · Last fired ${formatTimestamp(alert.last_fired_at)} (${alert.occurrences} occurrences)`">
                      <span class="font-medium text-foreground tabular-nums">{{ formatTimeAgo(alert.last_fired_at) }}</span>
                      <span class="text-[10px] text-muted-foreground tabular-nums">{{ alert.occurrences > 1 ? `${alert.occurrences} fires` : 'Initial trigger' }}</span>
                    </div>
                  </TableCell>

                  <!-- Single Clean Diagnose CTA -->
                  <TableCell class="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      class="h-7 text-xs font-mono gap-1 text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer px-2"
                      title="Analyze with Copilot"
                      @click="openAgentForAlert(alert)"
                    >
                      <Bot class="size-3 text-primary" />
                      <span>Diagnose</span>
                    </Button>
                  </TableCell>
                </TableRow>

                <!-- Empty Table State -->
                <TableRow v-if="!filteredAlerts.length">
                  <TableCell colspan="7" class="text-muted-foreground h-28 text-center">
                    <CircleCheck class="text-success mx-auto mb-2 size-5" />
                    <p class="text-sm font-medium text-foreground">No active incidents</p>
                    <p class="text-xs text-muted-foreground mt-0.5">All monitored systems are within nominal operating limits.</p>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <!-- VIEW B: Activity Stream (Clean, High-Density Incident Cards) -->
          <div v-else-if="viewMode === 'timeline'" class="p-4 sm:p-5">
            <OverlayScroll class="h-[520px] pr-2">
              <div v-if="filteredAlerts.length" class="space-y-3 pb-2">
                <div
                  v-for="alert in filteredAlerts"
                  :key="`stream-${alert.alert_key}`"
                  class="rounded-lg border border-border/70 bg-card p-3.5 transition-colors hover:border-border space-y-2.5"
                >
                  <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                    <div class="flex items-center gap-2">
                      <Badge
                        :variant="alertTone(alert) === 'destructive' ? 'destructive' : 'warning'"
                        class="font-semibold uppercase text-[10px] tracking-wider font-mono py-0 px-1.5"
                      >
                        {{ alertLabel(alert) }}
                      </Badge>
                      <NuxtLink to="/fleet" class="font-semibold text-xs text-foreground hover:underline">
                        {{ alert.vessel_name || `Vessel ${alert.vessel_id ?? '—'}` }}
                      </NuxtLink>
                      <span class="rounded bg-muted/60 border border-border/60 px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground">
                        {{ parseAlertDetails(alert).system }}
                      </span>
                    </div>

                    <div class="flex items-center gap-2.5">
                      <div v-if="alert.live_value" class="inline-flex items-center gap-1 font-mono text-xs tabular-nums">
                        <Gauge class="size-3 text-muted-foreground" />
                        <span class="font-semibold text-foreground">{{ alert.live_value }}</span>
                        <span v-if="alert.live_value_unit" class="text-muted-foreground text-[10px]">{{ alert.live_value_unit }}</span>
                      </div>
                      <span class="text-muted-foreground text-[11px] font-mono tabular-nums">
                        {{ formatTimeAgo(alert.last_fired_at) }}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        class="h-6 text-[11px] font-mono gap-1 px-2 cursor-pointer"
                        @click="openAgentForAlert(alert)"
                      >
                        <Bot class="size-2.5 text-primary" />
                        <span>Diagnose</span>
                      </Button>
                    </div>
                  </div>

                  <p class="text-xs text-foreground font-medium leading-relaxed">
                    {{ parseAlertDetails(alert).cleanedMessage }}
                  </p>
                </div>
              </div>

              <!-- Empty Stream State -->
              <div v-else class="text-muted-foreground py-14 text-center">
                <CircleCheck class="text-success mx-auto mb-2 size-5" />
                <p class="text-sm font-medium text-foreground">No incidents in this view</p>
                <p class="text-xs text-muted-foreground mt-0.5">Try clearing filters or search parameters.</p>
              </div>
            </OverlayScroll>
          </div>

          <!-- Footer Pagination -->
          <div class="relative z-10 bg-card border-t border-border/60 flex flex-col gap-3 p-3.5 text-xs sm:flex-row sm:items-center sm:justify-between">
            <span class="text-muted-foreground">
              {{ pagination.total ? `Showing ${alertStart}–${alertEnd} of ${pagination.total} incidents` : 'No incidents to display' }}
              <span v-if="searchQuery || filterSeverity !== 'all'" class="ml-1 text-primary font-medium font-mono">
                (filtered)
              </span>
            </span>
            <div class="flex items-center gap-2">
              <span class="text-muted-foreground tabular-nums">Page {{ pagination.page }} of {{ pagination.totalPages }}</span>
              <Button
                variant="outline"
                size="sm"
                class="h-7 text-xs cursor-pointer px-2.5"
                :disabled="pending || pagination.page <= 1"
                aria-label="Previous incident page"
                @click="goToAlertPage(pagination.page - 1)"
              >
                <ChevronLeft class="mr-1 size-3" />Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                class="h-7 text-xs cursor-pointer px-2.5"
                :disabled="pending || pagination.page >= pagination.totalPages"
                aria-label="Next incident page"
                @click="goToAlertPage(pagination.page + 1)"
              >
                Next<ChevronRight class="ml-1 size-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Operations Deck (Fleet Connectivity & Voyage Watch) -->
      <div class="grid gap-6 lg:grid-cols-12">
        <!-- Fleet Connectivity (Network Status) Card -->
        <Card class="flex flex-col lg:h-[500px] lg:col-span-7 border-border/80 shadow-xs">
          <CardHeader class="flex-row items-center justify-between pb-3 shrink-0">
            <div>
              <CardTitle class="text-base font-semibold">Fleet connectivity</CardTitle>
              <CardDescription class="text-xs">VSAT satellite link status and heartbeat telemetry</CardDescription>
            </div>
            <Badge variant="outline" class="tabular-nums font-mono text-xs">
              {{ networkVessels.length }} vessels monitored
            </Badge>
          </CardHeader>
          <CardContent class="flex flex-col flex-1 min-h-0 space-y-3 pb-3">
            <!-- Actionable Communication Health Status Banner (Replaces redundant progress bars) -->
            <div
              v-if="kpis.offline === 0"
              class="flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400 shrink-0"
            >
              <CheckCircle2 class="size-4 shrink-0" />
              <span class="font-medium">All {{ kpis.connected }} monitored vessels communicating on schedule.</span>
            </div>
            <div
              v-else
              class="flex items-center gap-2.5 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive shrink-0"
            >
              <AlertTriangle class="size-4 shrink-0" />
              <span class="font-medium">{{ kpis.offline }} {{ kpis.offline === 1 ? 'vessel is' : 'vessels are' }} currently experiencing VSAT link silence.</span>
            </div>

            <!-- Vessel List (Offline vessels ranked first) -->
            <div class="flex-1 min-h-0 flex flex-col">
              <OverlayScroll class="flex-1 min-h-0 pr-2">
                <ul v-if="networkVessels.length" class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  <li
                    v-for="vessel in networkVessels"
                    :key="vessel.vessel_id"
                    class="border-border/70 bg-card hover:bg-muted/30 flex min-w-0 items-center justify-between gap-2.5 rounded-lg border p-2.5 transition-colors text-xs"
                  >
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-1.5">
                        <component :is="vesselStatus(vessel).icon" :class="['size-3.5 shrink-0', toneText(vesselStatus(vessel).tone)]" />
                        <p class="truncate font-medium text-foreground">{{ vessel.vessel_name || `Vessel ${vessel.vessel_id}` }}</p>
                      </div>
                      <p class="text-muted-foreground mt-0.5 truncate text-[11px] font-mono">
                        {{ vessel.updated_at ? `Ping ${formatTimeAgo(vessel.updated_at)}` : 'No signal recorded' }}
                      </p>
                    </div>
                    <Badge :variant="toneBadge(vesselStatus(vessel).tone)" class="shrink-0 text-[10px] py-0 px-1.5 font-mono">
                      {{ vesselStatus(vessel).label }}
                    </Badge>
                  </li>
                </ul>
                <p v-else class="text-muted-foreground py-8 text-center text-xs">No vessel heartbeat records available.</p>
              </OverlayScroll>
            </div>

            <div class="border-border/60 border-t pt-2 text-[11px] text-muted-foreground flex items-center justify-between shrink-0 font-mono">
              <span>Telemetry: VSAT satellite stream</span>
              <span v-if="data?.asOf">Last read {{ formatTimestamp(data.asOf) }}</span>
            </div>
          </CardContent>
        </Card>

        <!-- Voyage Watch Card -->
        <Card class="flex flex-col lg:h-[500px] lg:col-span-5 border-border/80 shadow-xs">
          <CardHeader class="flex-row items-center justify-between pb-3 shrink-0">
            <div>
              <CardTitle class="text-base font-semibold">Voyage watch</CardTitle>
              <CardDescription class="text-xs">Destination, ETA & passage status</CardDescription>
            </div>
            <Badge variant="outline" class="tabular-nums font-mono text-xs">
              {{ voyages.length }} en route
            </Badge>
          </CardHeader>
          <CardContent class="flex flex-col flex-1 min-h-0 space-y-3 pb-3">
            <div v-if="pending" class="space-y-2.5">
              <Skeleton v-for="i in 4" :key="i" class="h-14 w-full rounded-lg" />
            </div>
            <OverlayScroll v-else-if="voyages.length" class="flex-1 min-h-0 pr-2">
              <ul class="space-y-2">
                <li
                  v-for="voyage in voyages"
                  :key="voyage.vessel_id"
                  class="border-border/60 bg-card hover:bg-muted/30 flex flex-col gap-2 rounded-lg border p-3 transition-colors text-xs"
                >
                  <!-- Vessel + Status Header -->
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-1.5 min-w-0">
                      <Ship class="size-3.5 text-muted-foreground shrink-0" />
                      <NuxtLink to="/fleet" class="truncate font-semibold text-foreground hover:underline">
                        {{ voyage.vessel_name }}
                      </NuxtLink>
                    </div>

                    <div class="flex items-center gap-1.5 shrink-0">
                      <Badge
                        v-if="voyage.load_status && voyage.load_status !== 'N/A'"
                        variant="secondary"
                        class="text-[9px] font-mono px-1.5 py-0 uppercase"
                      >
                        {{ voyage.load_status }}
                      </Badge>
                      <Badge
                        v-if="voyage.next_port_code"
                        variant="outline"
                        class="font-mono text-[10px] px-1.5 py-0"
                      >
                        {{ voyage.next_port_code }}
                      </Badge>
                    </div>
                  </div>

                  <!-- Transit Progress Bar between Departure and Arrival Ports -->
                  <div class="space-y-1.5 bg-muted/20 border border-border/50 rounded-md p-2">
                    <div class="flex items-center justify-between text-[11px] font-mono">
                      <!-- Departure Port -->
                      <div class="flex items-center gap-1 min-w-0 text-muted-foreground" :title="voyage.departure_port ? `Departure: ${voyage.departure_port}` : 'Departure port'">
                        <span class="size-1.5 rounded-full bg-muted-foreground/70 shrink-0" />
                        <span class="font-semibold text-foreground truncate max-w-[110px]">
                          {{ voyage.departure_port_code || voyage.departure_port || 'DEP' }}
                        </span>
                      </div>

                      <!-- Progress percentage & distance info -->
                      <div class="text-[10px] text-muted-foreground font-mono shrink-0 flex items-center gap-1 px-1">
                        <span v-if="voyageTransit(voyage).distanceText" class="opacity-75 hidden sm:inline">
                          {{ voyageTransit(voyage).distanceText }} ·
                        </span>
                        <span class="font-semibold text-primary">{{ voyageTransit(voyage).progress }}%</span>
                      </div>

                      <!-- Arrival Port -->
                      <div class="flex items-center gap-1 min-w-0 text-muted-foreground justify-end text-right" :title="voyage.next_port ? `Destination: ${voyage.next_port}` : 'Destination port'">
                        <span class="font-semibold text-foreground truncate max-w-[110px]">
                          {{ voyage.next_port_code || voyage.next_port || 'DEST' }}
                        </span>
                        <span class="size-1.5 rounded-full bg-primary shrink-0" />
                      </div>
                    </div>

                    <!-- Progress Bar Track -->
                    <div class="relative w-full bg-muted/70 h-1.5 rounded-full overflow-hidden">
                      <div
                        class="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                        :style="{ width: `${voyageTransit(voyage).progress}%` }"
                      />
                    </div>

                    <!-- Port Names Subline -->
                    <div class="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span class="truncate max-w-[130px]" :title="voyage.departure_port || ''">
                        {{ voyage.departure_port || 'Underway' }}
                      </span>
                      <span class="truncate max-w-[130px] text-right" :title="voyage.next_port || ''">
                        {{ voyage.next_port || 'Awaiting orders' }}
                      </span>
                    </div>
                  </div>

                  <!-- Destination ETA & Route Metadata -->
                  <div class="flex items-center justify-between gap-2 text-[11px] pt-0.5">
                    <span v-if="voyage.route_name" class="text-muted-foreground/80 truncate text-[10px]">
                      Route: {{ voyage.route_name }}
                    </span>
                    <span v-else class="text-muted-foreground/70 text-[10px]">
                      {{ voyage.next_port ? 'Passage active' : 'In port operations' }}
                    </span>

                    <div class="text-right shrink-0">
                      <span v-if="voyage.eta" class="tabular-nums font-semibold text-foreground font-mono text-[11px]" :title="formatTimestamp(voyage.eta)">
                        ETA {{ formatTimestamp(voyage.eta) }}
                      </span>
                      <span v-else class="text-muted-foreground text-[10px]">
                        No ETA scheduled
                      </span>
                    </div>
                  </div>
                </li>
              </ul>
            </OverlayScroll>
            <p v-else class="text-muted-foreground py-8 text-center text-xs">No voyage forecasts available.</p>
          </CardContent>
        </Card>
      </div> <!-- /Bottom Deck Grid -->
    </div> <!-- /Main Dashboard Area -->

    <!-- Operations Copilot (Sentinel) Docked Sidebar Panel -->
    <aside
      v-if="isWorkbenchOpen"
      class="w-full md:w-[420px] xl:w-[460px] shrink-0 border-l border-border bg-card flex flex-col h-[calc(100svh-3.5rem)] sticky top-14 transition-all duration-300 z-20 shadow-xs"
    >
      <!-- Workbench Topbar -->
      <div class="px-4 py-3 border-b border-border/80 flex items-center justify-between bg-muted/20 shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="size-7 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Bot class="size-4" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-sm font-semibold text-foreground tracking-tight">Operations Copilot</h2>
              <span class="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.2 rounded border border-border/60">
                Read-only
              </span>
            </div>
            <p class="text-[11px] text-muted-foreground">Automated fleet diagnostics & operational triage</p>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            class="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
            title="Reset session"
            @click="resetAgentSession"
          >
            <RotateCcw class="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
            title="Close Panel (Esc)"
            @click="isWorkbenchOpen = false"
          >
            <X class="size-4" />
          </Button>
        </div>
      </div>

      <!-- Operational Directives -->
      <div class="px-3.5 py-2 border-b border-border/60 bg-muted/10 shrink-0">
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

      <!-- Messages & Telemetry Stream -->
      <div class="flex-1 min-h-0 overflow-hidden relative">
        <OverlayScroll class="h-full p-4 space-y-3.5">
          <div v-for="msg in agentMessages" :key="msg.id" class="space-y-2">
            <!-- User Prompt Bubble -->
            <div v-if="msg.role === 'user'" class="flex justify-end">
              <div class="rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-medium max-w-[85%] shadow-xs">
                {{ msg.content }}
              </div>
            </div>

            <!-- Copilot Structured Response -->
            <div v-else class="rounded-lg border border-border/80 bg-background/90 p-3 space-y-2.5 shadow-xs">
              <!-- Tool Executions Trace -->
              <div v-if="msg.tools?.length" class="space-y-1">
                <div
                  v-for="(t, idx) in msg.tools"
                  :key="idx"
                  class="flex items-center gap-1.5 text-[10px] font-mono bg-muted/40 border border-border/40 rounded px-2 py-0.5 text-muted-foreground"
                >
                  <span class="text-emerald-500 font-bold">✓</span>
                  <span class="text-foreground/90 font-semibold">{{ toolLabel(t.name) }}</span>
                  <span class="opacity-70 truncate">{{ t.summary }}</span>
                </div>
              </div>

              <!-- Blocks Renderer -->
              <div v-if="msg.blocks?.length" class="space-y-2.5">
                <SentinelBlockRenderer v-for="(block, idx) in msg.blocks" :key="`${msg.id}-block-${idx}`" :block="block" />
              </div>
              <p v-else class="text-xs text-foreground leading-relaxed">{{ msg.content }}</p>

              <!-- Interactive Actions (Filters / Highlights) -->
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

          <!-- In-Flight Processing Indicator -->
          <div v-if="isAgentProcessing" class="flex items-center gap-2 text-xs text-muted-foreground font-mono p-2.5 rounded border border-border/50 bg-muted/20">
            <RefreshCw class="size-3 text-primary animate-spin" />
            <span>Analyzing fleet telemetry...</span>
          </div>
        </OverlayScroll>
      </div>

      <!-- Command Footer -->
      <div class="p-3 border-t border-border/80 bg-muted/20 shrink-0">
        <form class="flex items-center gap-2" @submit.prevent="askAgent(agentInput)">
          <div class="relative flex-1">
            <Search class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              v-model="agentInput"
              placeholder="Ask about alerts or vessel status..."
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
          <span>Read-only triage & summaries</span>
          <span>Esc to close · ⌘J toggle</span>
        </div>
      </div>
    </aside>
  </div>
</template>
