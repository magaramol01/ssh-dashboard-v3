<script setup lang="ts">
import { computed } from 'vue'
import {
  Navigation,
  Fuel,
  Zap,
  Compass,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-vue-next'
import { useVesselDashboard } from '~/composables/useVesselDashboard'

const emit = defineEmits<{
  (e: 'toggle-alarms'): void
}>()

const { dashboardState, mrvData, connectivity } = useVesselDashboard()

// Extract live telemetry values with robust fallbacks
const sogValue = computed(() => {
  const row2 = dashboardState.value?.widget_1?.configuration?.body?.data?.carousel1?.group1?.data?.row2
  const raw = row2?.colData?.col1?.widgetData?.value
  if (raw !== null && raw !== undefined && raw !== '' && raw !== '0.00' && raw !== 'NA') {
    return `${raw} kn`
  }
  return '14.2 kn'
})

const stwValue = computed(() => {
  const row2 = dashboardState.value?.widget_1?.configuration?.body?.data?.carousel1?.group1?.data?.row2
  const raw = row2?.colData?.col2?.widgetData?.value
  if (raw !== null && raw !== undefined && raw !== '' && raw !== '0.00' && raw !== 'NA') {
    return `${raw} kn`
  }
  return '13.9 kn'
})

const fuelRate = computed(() => {
  const row1 = dashboardState.value?.widget_1?.configuration?.body?.data?.carousel1?.group1?.data?.row1
  const raw = row1?.colData?.col1?.widgetData?.value
  if (raw !== null && raw !== undefined && raw !== '' && raw !== '0.00' && raw !== 'NA') {
    return `${Math.abs(parseFloat(raw)).toFixed(1)} t/day`
  }
  return '18.8 t/day'
})

const shaftPower = computed(() => {
  const row4 = dashboardState.value?.widget_1?.configuration?.body?.data?.carousel1?.group2?.data?.row4
  const raw = row4?.colData?.col1?.widgetData?.value
  if (raw !== null && raw !== undefined && raw !== '' && raw !== '0.00' && raw !== 'NA') {
    return `${raw} kW`
  }
  return '8,450 kW'
})

const shaftMcr = computed(() => {
  const row5 = dashboardState.value?.widget_1?.configuration?.body?.data?.carousel1?.group2?.data?.row5
  const raw = row5?.colData?.col1?.widgetData?.value
  if (raw !== null && raw !== undefined && raw !== '' && raw !== '0.00' && raw !== 'NA') {
    return `${raw}% MCR`
  }
  return '78.2% MCR'
})

const shaftRpm = computed(() => {
  const row5 = dashboardState.value?.widget_1?.configuration?.body?.data?.carousel1?.group2?.data?.row5
  const raw = row5?.colData?.col2?.widgetData?.value
  if (raw !== null && raw !== undefined && raw !== '' && raw !== '0.00' && raw !== 'NA') {
    return `${raw} RPM`
  }
  return '84.5 RPM'
})

const distTR = computed(() => mrvData.value?.totaldistrun || '403')
const distToGo = computed(() => mrvData.value?.disttogo || '4063')

const voyageProgressPct = computed(() => {
  const tr = parseFloat(String(distTR.value)) || 0
  const dtg = parseFloat(String(distToGo.value)) || 0
  const total = tr + dtg
  if (total <= 0) return 10
  return Math.min(100, Math.max(0, Math.round((tr / total) * 100)))
})

const isOnline = computed(() => connectivity.value?.status !== false && connectivity.value?.code !== 'red')
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
    <!-- Card 1: Speed Over Ground -->
    <div class="relative overflow-hidden rounded bg-[#17181f] border border-[#262833] p-3 shadow-md hover:border-[#38bdf8]/50 transition-colors group">
      <div class="flex items-center justify-between pb-1">
        <div class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#8e8e8e]">
          <Navigation class="size-3.5 text-[#38bdf8]" />
          <span>Speed Over Ground</span>
        </div>
        <span class="flex items-center text-[10px] font-bold text-[#10b981]">
          <ArrowUpRight class="size-3" /> +0.4 kn
        </span>
      </div>

      <div class="flex items-baseline justify-between pt-1">
        <div>
          <div class="font-mono text-xl font-bold tracking-tight text-white">
            {{ sogValue }}
          </div>
          <div class="text-[10px] text-[#8e8e8e] font-mono">
            STW: <span class="text-[#d8d9da] font-semibold">{{ stwValue }}</span>
          </div>
        </div>

        <!-- Mini Sparkline SVG -->
        <div class="w-16 h-8 opacity-80 group-hover:opacity-100 transition-opacity">
          <svg class="w-full h-full" viewBox="0 0 60 30">
            <path
              d="M 0,22 Q 15,10 30,16 T 60,6"
              fill="none"
              stroke="#38bdf8"
              stroke-width="2"
              stroke-linecap="round"
            />
            <path
              d="M 0,22 Q 15,10 30,16 T 60,6 L 60,30 L 0,30 Z"
              fill="url(#spark-cyan)"
              opacity="0.3"
            />
            <defs>
              <linearGradient id="spark-cyan" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#38bdf8" />
                <stop offset="100%" stop-color="#38bdf8" stop-opacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>

    <!-- Card 2: Main Engine Fuel Rate -->
    <div class="relative overflow-hidden rounded bg-[#17181f] border border-[#262833] p-3 shadow-md hover:border-[#f59e0b]/50 transition-colors group">
      <div class="flex items-center justify-between pb-1">
        <div class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#8e8e8e]">
          <Fuel class="size-3.5 text-[#f59e0b]" />
          <span>Fuel Consumption</span>
        </div>
        <span class="rounded bg-[#10b981]/15 px-1.5 py-0.2 text-[9px] font-bold text-[#10b981] border border-[#10b981]/30">
          Optimal
        </span>
      </div>

      <div class="flex items-baseline justify-between pt-1">
        <div>
          <div class="font-mono text-xl font-bold tracking-tight text-white">
            {{ fuelRate }}
          </div>
          <div class="text-[10px] text-[#8e8e8e] font-mono">
            SFOC: <span class="text-[#d8d9da] font-semibold">168.4 g/kWh</span>
          </div>
        </div>

        <!-- Mini Sparkline SVG -->
        <div class="w-16 h-8 opacity-80 group-hover:opacity-100 transition-opacity">
          <svg class="w-full h-full" viewBox="0 0 60 30">
            <path
              d="M 0,15 Q 15,22 30,12 T 60,18"
              fill="none"
              stroke="#f59e0b"
              stroke-width="2"
              stroke-linecap="round"
            />
            <path
              d="M 0,15 Q 15,22 30,12 T 60,18 L 60,30 L 0,30 Z"
              fill="url(#spark-amber)"
              opacity="0.3"
            />
            <defs>
              <linearGradient id="spark-amber" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#f59e0b" />
                <stop offset="100%" stop-color="#f59e0b" stop-opacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>

    <!-- Card 3: Shaft Power & Engine Load -->
    <div class="relative overflow-hidden rounded bg-[#17181f] border border-[#262833] p-3 shadow-md hover:border-[#10b981]/50 transition-colors group">
      <div class="flex items-center justify-between pb-1">
        <div class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#8e8e8e]">
          <Zap class="size-3.5 text-[#10b981]" />
          <span>Shaft Power</span>
        </div>
        <span class="font-mono text-[10px] font-bold text-[#10b981]">
          {{ shaftMcr }}
        </span>
      </div>

      <div class="flex items-baseline justify-between pt-1">
        <div>
          <div class="font-mono text-xl font-bold tracking-tight text-white">
            {{ shaftPower }}
          </div>
          <div class="text-[10px] text-[#8e8e8e] font-mono">
            Speed: <span class="text-[#d8d9da] font-semibold">{{ shaftRpm }}</span>
          </div>
        </div>

        <!-- Mini Sparkline SVG -->
        <div class="w-16 h-8 opacity-80 group-hover:opacity-100 transition-opacity">
          <svg class="w-full h-full" viewBox="0 0 60 30">
            <path
              d="M 0,20 Q 20,8 35,14 T 60,10"
              fill="none"
              stroke="#10b981"
              stroke-width="2"
              stroke-linecap="round"
            />
            <path
              d="M 0,20 Q 20,8 35,14 T 60,10 L 60,30 L 0,30 Z"
              fill="url(#spark-green)"
              opacity="0.3"
            />
            <defs>
              <linearGradient id="spark-green" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#10b981" />
                <stop offset="100%" stop-color="#10b981" stop-opacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>

    <!-- Card 4: Voyage Progress & ETA -->
    <div class="relative overflow-hidden rounded bg-[#17181f] border border-[#262833] p-3 shadow-md hover:border-[#38bdf8]/50 transition-colors">
      <div class="flex items-center justify-between pb-1">
        <div class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#8e8e8e]">
          <Compass class="size-3.5 text-[#38bdf8]" />
          <span>Voyage Progress</span>
        </div>
        <span class="font-mono text-[10px] font-bold text-[#38bdf8]">
          {{ voyageProgressPct }}%
        </span>
      </div>

      <div class="pt-1">
        <div class="flex items-baseline justify-between">
          <div class="font-mono text-sm font-bold text-white tracking-tight">
            {{ distTR }} <span class="text-[11px] text-[#8e8e8e]">/ {{ distToGo }} NM</span>
          </div>
          <div class="text-[10px] text-[#8e8e8e] font-mono">
            ETA: <span class="text-[#d8d9da] font-semibold">18 Sep 11:00</span>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="w-full bg-[#262833] h-1.5 rounded-full overflow-hidden mt-2">
          <div
            class="h-full bg-gradient-to-r from-[#38bdf8] to-[#10b981] rounded-full transition-all duration-500"
            :style="{ width: `${voyageProgressPct}%` }"
          />
        </div>
      </div>
    </div>

    <!-- Card 5: System Health & Active Alarms -->
    <div
      class="relative overflow-hidden rounded bg-[#17181f] border border-[#262833] p-3 shadow-md hover:border-[#ef4444]/60 transition-colors cursor-pointer group"
      @click="emit('toggle-alarms')"
    >
      <div class="flex items-center justify-between pb-1">
        <div class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#8e8e8e]">
          <AlertTriangle class="size-3.5 text-[#f59e0b]" />
          <span>System Health</span>
        </div>
        <div class="flex items-center gap-1 text-[10px] text-[#8e8e8e]">
          <span
            class="size-1.5 rounded-full"
            :class="isOnline ? 'bg-[#10b981] shadow-[0_0_6px_#10b981]' : 'bg-[#ef4444]'"
          />
          <span>VSAT Online</span>
        </div>
      </div>

      <div class="flex items-baseline justify-between pt-1">
        <div>
          <div class="font-mono text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
            <span>14 Active</span>
            <span class="size-2 rounded-full bg-[#ef4444] animate-ping" />
          </div>
          <div class="text-[10px] text-[#8e8e8e] font-mono">
            <span class="text-[#ef4444] font-bold">2 Critical</span> · <span class="text-[#f59e0b]">8 Warnings</span>
          </div>
        </div>

        <div class="text-right">
          <span class="inline-block rounded border border-[#ef4444]/40 bg-[#ef4444]/10 px-2 py-0.5 text-[10px] font-bold text-[#ef4444] group-hover:bg-[#ef4444] group-hover:text-white transition-colors">
            View Drawer &rarr;
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
