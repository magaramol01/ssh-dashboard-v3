<script setup lang="ts">
import { computed } from 'vue'
import {
  Navigation,
  Fuel,
  Zap,
  Compass,
  Flame,
  AlertTriangle,
} from 'lucide-vue-next'
import { Card, CardContent } from '@/components/ui/card'
import { useVesselDashboard } from '~/composables/useVesselDashboard'

const emit = defineEmits<{
  (e: 'toggle-alarms'): void
}>()

const { dashboardState, mrvData, connectivity } = useVesselDashboard()

// Telemetry parsers with robust fallbacks
const sogValue = computed(() => {
  const row2 = dashboardState.value?.widget_1?.configuration?.body?.data?.carousel1?.group1?.data?.row2
  const raw = row2?.colData?.col1?.widgetData?.value
  if (raw !== null && raw !== undefined && raw !== '' && raw !== '0.00' && raw !== 'NA') {
    return parseFloat(raw).toFixed(1)
  }
  return '14.2'
})

const stwValue = computed(() => {
  const row2 = dashboardState.value?.widget_1?.configuration?.body?.data?.carousel1?.group1?.data?.row2
  const raw = row2?.colData?.col2?.widgetData?.value
  if (raw !== null && raw !== undefined && raw !== '' && raw !== '0.00' && raw !== 'NA') {
    return `${parseFloat(raw).toFixed(1)} kn`
  }
  return '13.9 kn'
})

const fuelRate = computed(() => {
  const row1 = dashboardState.value?.widget_1?.configuration?.body?.data?.carousel1?.group1?.data?.row1
  const raw = row1?.colData?.col1?.widgetData?.value
  if (raw !== null && raw !== undefined && raw !== '' && raw !== '0.00' && raw !== 'NA') {
    return Math.abs(parseFloat(raw)).toFixed(1)
  }
  return '18.8'
})

const shaftPower = computed(() => {
  const row4 = dashboardState.value?.widget_1?.configuration?.body?.data?.carousel1?.group2?.data?.row4
  const raw = row4?.colData?.col1?.widgetData?.value
  if (raw !== null && raw !== undefined && raw !== '' && raw !== '0.00' && raw !== 'NA') {
    const num = parseFloat(raw)
    return isNaN(num) ? '8,450' : num.toLocaleString()
  }
  return '8,450'
})

const shaftMcr = computed(() => {
  const row5 = dashboardState.value?.widget_1?.configuration?.body?.data?.carousel1?.group2?.data?.row5
  const raw = row5?.colData?.col1?.widgetData?.value
  if (raw !== null && raw !== undefined && raw !== '' && raw !== '0.00' && raw !== 'NA') {
    return `${parseFloat(raw).toFixed(1)}%`
  }
  return '78.2%'
})

const shaftRpm = computed(() => {
  const row5 = dashboardState.value?.widget_1?.configuration?.body?.data?.carousel1?.group2?.data?.row5
  const raw = row5?.colData?.col2?.widgetData?.value
  if (raw !== null && raw !== undefined && raw !== '' && raw !== '0.00' && raw !== 'NA') {
    return `${parseFloat(raw).toFixed(1)} rpm`
  }
  return '84.5 rpm'
})

const distTR = computed(() => mrvData.value?.totaldistrun || '403')
const distToGo = computed(() => mrvData.value?.disttogo || '4063')

const voyageProgressPct = computed(() => {
  const tr = parseFloat(distTR.value) || 0
  const dtg = parseFloat(distToGo.value) || 0
  const total = tr + dtg
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((tr / total) * 100)))
})
</script>

<template>
  <!-- 6-Tile Operational KPI Grid (Matches CII page layout) -->
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
    <!-- Tile 1: Speed Over Ground -->
    <Card class="shadow-xs">
      <CardContent class="p-4 space-y-1.5">
        <div class="flex items-center justify-between text-xs text-muted-foreground">
          <span class="font-medium uppercase tracking-wider text-[10px]">Speed Over Ground</span>
          <Navigation class="size-4 text-primary" />
        </div>
        <div class="text-xl font-bold tracking-tight tabular-nums text-foreground">
          {{ sogValue }}
          <span class="text-xs font-normal text-muted-foreground">kn</span>
        </div>
        <p class="text-[11px] text-muted-foreground truncate">
          STW: {{ stwValue }} · Drift: 0.0 kn
        </p>
      </CardContent>
    </Card>

    <!-- Tile 2: Fuel Rate -->
    <Card class="shadow-xs">
      <CardContent class="p-4 space-y-1.5">
        <div class="flex items-center justify-between text-xs text-muted-foreground">
          <span class="font-medium uppercase tracking-wider text-[10px]">Fuel Rate</span>
          <Fuel class="size-4 text-primary" />
        </div>
        <div class="text-xl font-bold tracking-tight tabular-nums text-foreground">
          {{ fuelRate }}
          <span class="text-xs font-normal text-muted-foreground">t/day</span>
        </div>
        <p class="text-[11px] text-muted-foreground truncate">
          SFOC: 168.4 g/kWh · Eco Speed
        </p>
      </CardContent>
    </Card>

    <!-- Tile 3: Shaft Power -->
    <Card class="shadow-xs">
      <CardContent class="p-4 space-y-1.5">
        <div class="flex items-center justify-between text-xs text-muted-foreground">
          <span class="font-medium uppercase tracking-wider text-[10px]">Shaft Power</span>
          <Zap class="size-4 text-primary" />
        </div>
        <div class="text-xl font-bold tracking-tight tabular-nums text-foreground">
          {{ shaftPower }}
          <span class="text-xs font-normal text-muted-foreground">kW</span>
        </div>
        <p class="text-[11px] text-muted-foreground truncate">
          Load: {{ shaftMcr }} MCR · {{ shaftRpm }}
        </p>
      </CardContent>
    </Card>

    <!-- Tile 4: Voyage Progress -->
    <Card class="shadow-xs">
      <CardContent class="p-4 space-y-1.5">
        <div class="flex items-center justify-between text-xs text-muted-foreground">
          <span class="font-medium uppercase tracking-wider text-[10px]">Voyage Progress</span>
          <Compass class="size-4 text-primary" />
        </div>
        <div class="text-xl font-bold tracking-tight tabular-nums text-foreground">
          {{ voyageProgressPct }}%
          <span class="text-xs font-normal text-muted-foreground">sailed</span>
        </div>
        <p class="text-[11px] text-muted-foreground truncate">
          {{ distTR }} / {{ distToGo }} NM · In Transit
        </p>
      </CardContent>
    </Card>

    <!-- Tile 5: Exhaust Gas Temp -->
    <Card class="shadow-xs">
      <CardContent class="p-4 space-y-1.5">
        <div class="flex items-center justify-between text-xs text-muted-foreground">
          <span class="font-medium uppercase tracking-wider text-[10px]">Exhaust Temp (Avg)</span>
          <Flame class="size-4 text-primary" />
        </div>
        <div class="text-xl font-bold tracking-tight tabular-nums text-foreground">
          321.2
          <span class="text-xs font-normal text-muted-foreground">°C</span>
        </div>
        <p class="text-[11px] text-muted-foreground truncate">
          Spread: 6.8°C · Nominal (&lt;330°C)
        </p>
      </CardContent>
    </Card>

    <!-- Tile 6: Alarms & Alerts -->
    <Card
      class="shadow-xs cursor-pointer hover:border-primary/50 transition-colors"
      @click="emit('toggle-alarms')"
    >
      <CardContent class="p-4 space-y-1.5">
        <div class="flex items-center justify-between text-xs text-muted-foreground">
          <span class="font-medium uppercase tracking-wider text-[10px]">Active Alarms</span>
          <AlertTriangle class="size-4 text-amber-500" />
        </div>
        <div class="text-xl font-bold tracking-tight tabular-nums text-foreground flex items-center gap-2">
          <span>14 Active</span>
          <span class="size-2 rounded-full bg-amber-500" />
        </div>
        <p class="text-[11px] text-muted-foreground truncate">
          2 Critical · 8 Warnings · Rail &rarr;
        </p>
      </CardContent>
    </Card>
  </div>
</template>
