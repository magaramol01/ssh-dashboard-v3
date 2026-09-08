<script setup lang="ts">
/**
 * Marine analytics — live alarm, connectivity and voyage signals.
 * Performance baselines, CP compliance and RUL stay unavailable until their
 * validated reference/time-series read models are connected.
 */
import { computed, ref, watch } from 'vue'
import { Activity, AlertTriangle, Anchor, HeartPulse, RadioTower, RefreshCw, Ship } from 'lucide-vue-next'
import type { ThresholdAnalysis } from '#shared/types/marine'
import type { VesselHealth } from '#shared/types/marine-health'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { KpiGrid } from '@/components/ui/kpi-grid'
import { AreaChart } from '@/components/ui/charts/area-chart'
import { BarChart } from '@/components/ui/charts/bar-chart'
import KpiTile from '@/components/KpiTile.vue'

type Point = { label: string; value: number }
type Alert = {
  id: number
  vessel_name: string | null
  system_name: string | null
  message: string | null
  severity: 'critical' | 'warning'
  live_value: string | null
  live_value_unit: string | null
  last_fired_at: string | null
  occurrences: number
} & Partial<ThresholdAnalysis>
type HealthResponse = VesselHealth & {
  vessel: { id: number; name: string | null; imo: string | null }
  latestPacket: string | null
  profileDays: number
  latestDays: number
  provenance: { telemetry: string; metadata: string; method: string }
}
type AnalyticsResponse = {
  asOf: string
  days: number
  provenance: { alarms: string; connectivity: string; voyages: string }
  vesselOptions: Array<{ vessel_id: number; vessel_name: string | null }>
  kpis: {
    alarms: number
    openAlerts: number
    criticalAlerts: number
    vessels: number
    connected: number
    offline: number
    activeVoyages: number
  }
  trends: { hourly_trend: Point[]; by_vessel: Point[]; by_system: Point[] }
  alerts: Alert[]
}

definePageMeta({ middleware: 'require-dispatcher' })
useHead({ title: 'Analytics · ShipTrack' })

const days = ref(1)
const { data, pending, error, refresh } = await useFetch<AnalyticsResponse>('/api/analytics', { query: { days } })
const kpis = computed(() => data.value?.kpis ?? {
  alarms: 0, openAlerts: 0, criticalAlerts: 0, vessels: 0, connected: 0, offline: 0, activeVoyages: 0,
})
const connectivityRate = computed(() => {
  const total = kpis.value.connected + kpis.value.offline
  return total ? Math.round(kpis.value.connected / total * 100) : 0
})
const hourlyData = computed(() => (data.value?.trends.hourly_trend ?? []).map((p) => ({ time: p.label, Alarms: p.value })))
const vesselData = computed(() => (data.value?.trends.by_vessel ?? []).map((p) => ({ vessel: p.label, Alarms: p.value })))
const systemData = computed(() => (data.value?.trends.by_system ?? []).map((p) => ({ system: p.label, Alarms: p.value })))
const selectedVesselId = ref<number | null>(null)
const health = ref<HealthResponse | null>(null)
const healthPending = ref(false)
const healthError = ref(false)

watch(() => data.value?.vesselOptions, (vessels) => {
  if (selectedVesselId.value == null && vessels?.length) selectedVesselId.value = vessels[0].vessel_id
}, { immediate: true })
watch(selectedVesselId, async (vesselId) => {
  if (!vesselId) return
  healthPending.value = true
  healthError.value = false
  try {
    health.value = await $fetch<HealthResponse>('/api/health', { query: { vesselId } })
  } catch {
    health.value = null
    healthError.value = true
  } finally {
    healthPending.value = false
  }
}, { immediate: true })

function time(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
}
</script>

<template>
  <div class="space-y-5 p-4 md:p-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div class="flex items-center gap-2.5">
          <h1 class="text-xl font-semibold tracking-tight">Fleet analytics</h1>
          <Badge v-if="data" variant="outline" class="font-mono text-[10px]">{{ data.days }}h window</Badge>
        </div>
        <p class="text-muted-foreground text-xs">Evidence-backed alarm, connectivity and voyage signals.</p>
        <div v-if="data" class="mt-2 flex flex-wrap gap-1.5">
          <Badge variant="outline" class="text-[10px] font-mono">Alarms · {{ data.provenance.alarms }}</Badge>
          <Badge variant="outline" class="text-[10px] font-mono">Connectivity · {{ data.provenance.connectivity }}</Badge>
          <Badge variant="outline" class="text-[10px] font-mono">Voyages · {{ data.provenance.voyages }}</Badge>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="inline-flex rounded-lg border border-border/60 bg-muted/40 p-0.5 text-xs">
          <button v-for="window in [1, 3, 7]" :key="window" type="button" :class="['rounded-md px-2.5 py-1 font-medium cursor-pointer', days === window ? 'bg-background shadow-xs' : 'text-muted-foreground']" @click="days = window">
            {{ window }}d
          </button>
        </div>
        <Button variant="outline" size="sm" :disabled="pending" @click="refresh">
          <RefreshCw class="mr-1.5 size-3.5" :class="pending ? 'animate-spin' : ''" />Refresh
        </Button>
      </div>
    </header>

    <div v-if="error" class="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <p class="font-medium">Fleet analytics are currently unavailable.</p>
      <Button variant="outline" size="sm" class="mt-3" @click="refresh">Retry</Button>
    </div>

    <KpiGrid v-if="!pending">
      <KpiTile label="Alarms recorded" :value="kpis.alarms" :hint="`Last ${data?.days ?? days} day(s)`" tone="warning" :icon="Activity" />
      <KpiTile label="Critical alerts" :value="kpis.criticalAlerts" hint="Open now" :tone="kpis.criticalAlerts ? 'destructive' : 'success'" :icon="AlertTriangle" />
      <KpiTile label="Connectivity" :value="`${connectivityRate}%`" :hint="`${kpis.connected} online · ${kpis.offline} offline`" :tone="kpis.offline ? 'warning' : 'success'" :icon="RadioTower" />
      <KpiTile label="Active voyages" :value="kpis.activeVoyages" :hint="`${kpis.vessels} vessels monitored`" tone="info" :icon="Anchor" />
    </KpiGrid>
    <KpiGrid v-else><Skeleton v-for="i in 4" :key="i" variant="rounded" class="h-[120px] w-full" /></KpiGrid>

    <div class="grid gap-3 lg:grid-cols-12">
      <Card class="lg:col-span-8">
        <CardHeader class="pb-2"><CardTitle class="text-base">Alarm frequency</CardTitle><CardDescription>Hourly trend from the selected window</CardDescription></CardHeader>
        <CardContent>
          <ClientOnly>
            <AreaChart v-if="!pending && hourlyData.length" role="img" aria-label="Hourly fleet alarm frequency" :data="hourlyData" x-field="time" y-field="Alarms" :height="260" />
            <Skeleton v-else class="h-[260px] w-full" />
            <template #fallback><Skeleton class="h-[260px] w-full" /></template>
          </ClientOnly>
        </CardContent>
      </Card>
      <Card class="lg:col-span-4">
        <CardHeader class="pb-2"><CardTitle class="text-base">Alarm volume by system</CardTitle><CardDescription>Subsystem distribution</CardDescription></CardHeader>
        <CardContent>
          <ClientOnly>
            <BarChart v-if="!pending && systemData.length" role="img" aria-label="Alarm volume by subsystem" :data="systemData" x-field="system" y-field="Alarms" :height="260" />
            <Skeleton v-else class="h-[260px] w-full" />
            <template #fallback><Skeleton class="h-[260px] w-full" /></template>
          </ClientOnly>
        </CardContent>
      </Card>
    </div>

    <div class="grid gap-3 lg:grid-cols-12">
      <Card class="lg:col-span-5">
        <CardHeader class="pb-2"><CardTitle class="text-base">Alarm distribution by vessel</CardTitle><CardDescription>Highest-volume vessels first</CardDescription></CardHeader>
        <CardContent>
          <ClientOnly>
            <BarChart v-if="!pending && vesselData.length" role="img" aria-label="Alarm distribution by vessel" :data="vesselData" x-field="vessel" y-field="Alarms" :height="260" />
            <Skeleton v-else class="h-[260px] w-full" />
            <template #fallback><Skeleton class="h-[260px] w-full" /></template>
          </ClientOnly>
        </CardContent>
      </Card>
      <Card class="lg:col-span-7">
        <CardHeader class="pb-2"><CardTitle class="text-base">Current risk queue</CardTitle><CardDescription>Open alerts ranked by severity, threshold breach and recurrence</CardDescription></CardHeader>
        <CardContent class="p-0">
          <div v-if="!pending && data?.alerts.length" class="divide-y divide-border/60">
            <div v-for="alert in data.alerts" :key="alert.id" class="flex items-start gap-3 px-4 py-3 text-xs">
              <span :class="['mt-1 size-2 shrink-0 rounded-full', alert.severity === 'critical' ? 'bg-destructive' : 'bg-warning']" />
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-semibold">{{ alert.vessel_name || 'Unknown vessel' }}</span>
                  <Badge variant="outline" class="font-mono text-[10px]">{{ alert.system_name || 'Machinery' }}</Badge>
                  <Badge :variant="alert.severity === 'critical' ? 'destructive' : 'warning'" class="text-[10px] uppercase">{{ alert.severity }}</Badge>
                </div>
                <p class="mt-1 text-muted-foreground">{{ alert.message || 'Alert triggered' }}</p>
                <p v-if="alert.breached != null" :class="['mt-1 font-mono text-[10px]', alert.breached ? 'text-destructive' : 'text-success']">
                  {{ alert.breached ? 'Threshold breached' : 'Within threshold' }}<span v-if="alert.deviationPercent != null"> · {{ alert.deviationPercent.toFixed(1) }}% deviation</span>
                </p>
              </div>
              <div class="shrink-0 text-right text-muted-foreground font-mono">
                <div>{{ alert.occurrences }} {{ alert.occurrences === 1 ? 'fire' : 'fires' }}</div>
                <div>{{ time(alert.last_fired_at) }}</div>
              </div>
            </div>
          </div>
          <div v-else class="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
            <Ship class="size-5" />
            <p class="text-sm">No open alerts</p>
          </div>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader class="flex flex-row items-start justify-between gap-3 pb-2">
        <div><CardTitle class="text-base">Vessel-specific health baseline</CardTitle><CardDescription>Separate baseline per vessel; anomaly indicator only, not RUL.</CardDescription></div>
        <select v-model="selectedVesselId" class="h-8 max-w-[190px] rounded-md border border-border bg-background px-2 text-xs" aria-label="Vessel for health baseline">
          <option v-for="vessel in data?.vesselOptions ?? []" :key="vessel.vessel_id" :value="vessel.vessel_id">{{ vessel.vessel_name || `Vessel ${vessel.vessel_id}` }}</option>
        </select>
      </CardHeader>
      <CardContent>
        <div v-if="healthPending" class="grid gap-2 sm:grid-cols-3"><Skeleton v-for="i in 3" :key="i" class="h-16 w-full" /></div>
        <div v-else-if="healthError" class="text-sm text-destructive">This vessel health baseline is unavailable.</div>
        <div v-else-if="health" class="space-y-3">
          <div class="grid gap-2 sm:grid-cols-3">
            <div class="rounded-lg border border-border/60 p-3"><div class="text-[10px] uppercase text-muted-foreground">Health index</div><div class="mt-1 flex items-center gap-2 text-xl font-semibold"><HeartPulse class="size-4 text-success" />{{ health.healthIndex == null ? '—' : Math.round(health.healthIndex) }}<span class="text-xs font-normal text-muted-foreground">/ 100</span></div></div>
            <div class="rounded-lg border border-border/60 p-3"><div class="text-[10px] uppercase text-muted-foreground">Confidence</div><div class="mt-1 text-xl font-semibold">{{ Math.round(health.confidence * 100) }}%</div></div>
            <div class="rounded-lg border border-border/60 p-3"><div class="text-[10px] uppercase text-muted-foreground">Latest packet</div><div class="mt-1 font-mono text-xs">{{ time(health.latestPacket) }}</div></div>
          </div>
          <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div v-for="component in health.components" :key="component.id" class="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-xs">
              <span>{{ component.label }}</span><span class="font-mono" :class="component.state === 'attention' ? 'text-destructive' : component.state === 'watch' ? 'text-warning' : component.state === 'insufficient_data' ? 'text-muted-foreground' : 'text-success'">{{ component.healthIndex == null ? 'No data' : Math.round(component.healthIndex) }}</span>
            </div>
          </div>
          <p class="text-[10px] text-muted-foreground">{{ health.provenance.method }} Profile: {{ health.profileDays }}d; current window: {{ health.latestDays }}d.</p>
        </div>
        <div v-else class="text-sm text-muted-foreground">Select a vessel to calculate its health baseline.</div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader class="pb-2"><CardTitle class="text-base">Unavailable until validated sources are connected</CardTitle><CardDescription>Demo baselines are intentionally not shown.</CardDescription></CardHeader>
      <CardContent class="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        <div><strong class="text-foreground">Performance baseline</strong><br />Sea-trial speed/power and SFOC reference data.</div>
        <div><strong class="text-foreground">Charter-party compliance</strong><br />Warranted speed/fuel envelope against good-weather reports.</div>
        <div><strong class="text-foreground">Health and RUL</strong><br />Historical telemetry trends with validated action thresholds.</div>
      </CardContent>
    </Card>
  </div>
</template>
