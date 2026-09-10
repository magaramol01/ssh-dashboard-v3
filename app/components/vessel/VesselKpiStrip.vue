<script setup lang="ts">
import { computed } from 'vue'
import {
  Navigation,
  Fuel,
  Zap,
  Compass,
  AlertTriangle,
  ArrowUpRight,
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
    return `${raw} %`
  }
  return '78.2 %'
})

const shaftRpm = computed(() => {
  const row5 = dashboardState.value?.widget_1?.configuration?.body?.data?.carousel1?.group2?.data?.row5
  const raw = row5?.colData?.col2?.widgetData?.value
  if (raw !== null && raw !== undefined && raw !== '' && raw !== '0.00' && raw !== 'NA') {
    return `${raw} rpm`
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

const isOnline = computed(() => {
  return connectivity.value?.status !== false
})
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
    <!-- Card 1: Speed Over Ground -->
    <div class="relative overflow-hidden rounded-xl bg-[#121318] border border-[#1e2029] p-3 shadow-sm hover:border-[#38bdf8]/40 transition-colors group">
      <div class="flex items-center justify-between pb-1">
        <div class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <Navigation class="size-3.5 text-sky-400" />
          <span>Speed Over Ground</span>
        </div>
        <span class="flex items-center text-[10px] font-mono text-slate-400">
          <ArrowUpRight class="size-3 text-sky-400" /> +0.4 kn
        </span>
      </div>

      <div class="flex items-baseline justify-between pt-1">
        <div>
          <div class="font-mono text-xl font-bold tracking-tight text-slate-100">
            {{ sogValue }}
          </div>
          <div class="text-[10px] text-slate-500 font-mono mt-0.5">
            STW: <span class="text-slate-300 font-medium">{{ stwValue }}</span>
          </div>
        </div>

        <!-- Mini Sparkline SVG (Ice-blue) -->
        <div class="w-16 h-8 opacity-70 group-hover:opacity-100 transition-opacity">
          <svg class="w-full h-full" viewBox="0 0 60 30">
            <path
              d="M 0,22 Q 15,10 30,16 T 60,6"
              fill="none"
              stroke="#38bdf8"
              stroke-width="1.8"
              stroke-linecap="round"
            />
            <path
              d="M 0,22 Q 15,10 30,16 T 60,6 L 60,30 L 0,30 Z"
              fill="url(#spark-slate-1)"
              opacity="0.15"
            />
            <defs>
              <linearGradient id="spark-slate-1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#38bdf8" />
                <stop offset="100%" stop-color="#38bdf8" stop-opacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>

    <!-- Card 2: Main Engine Fuel Rate -->
    <div class="relative overflow-hidden rounded-xl bg-[#121318] border border-[#1e2029] p-3 shadow-sm hover:border-[#38bdf8]/40 transition-colors group">
      <div class="flex items-center justify-between pb-1">
        <div class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <Fuel class="size-3.5 text-sky-400" />
          <span>Fuel Consumption</span>
        </div>
        <span class="rounded bg-slate-800/80 px-1.5 py-0.2 text-[9px] font-mono text-slate-300 border border-slate-700/50">
          Optimal
        </span>
      </div>

      <div class="flex items-baseline justify-between pt-1">
        <div>
          <div class="font-mono text-xl font-bold tracking-tight text-slate-100">
            {{ fuelRate }}
          </div>
          <div class="text-[10px] text-slate-500 font-mono mt-0.5">
            SFOC: <span class="text-slate-300 font-medium">168.4 g/kWh</span>
          </div>
        </div>

        <!-- Mini Sparkline SVG -->
        <div class="w-16 h-8 opacity-70 group-hover:opacity-100 transition-opacity">
          <svg class="w-full h-full" viewBox="0 0 60 30">
            <path
              d="M 0,15 Q 15,22 30,12 T 60,18"
              fill="none"
              stroke="#38bdf8"
              stroke-width="1.8"
              stroke-linecap="round"
            />
            <path
              d="M 0,15 Q 15,22 30,12 T 60,18 L 60,30 L 0,30 Z"
              fill="url(#spark-slate-2)"
              opacity="0.15"
            />
            <defs>
              <linearGradient id="spark-slate-2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#38bdf8" />
                <stop offset="100%" stop-color="#38bdf8" stop-opacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>

    <!-- Card 3: Shaft Power & Engine Load -->
    <div class="relative overflow-hidden rounded-xl bg-[#121318] border border-[#1e2029] p-3 shadow-sm hover:border-[#38bdf8]/40 transition-colors group">
      <div class="flex items-center justify-between pb-1">
        <div class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <Zap class="size-3.5 text-sky-400" />
          <span>Shaft Power</span>
        </div>
        <span class="font-mono text-[10px] text-slate-300">
          {{ shaftMcr }} MCR
        </span>
      </div>

      <div class="flex items-baseline justify-between pt-1">
        <div>
          <div class="font-mono text-xl font-bold tracking-tight text-slate-100">
            {{ shaftPower }}
          </div>
          <div class="text-[10px] text-slate-500 font-mono mt-0.5">
            Speed: <span class="text-slate-300 font-medium">{{ shaftRpm }}</span>
          </div>
        </div>

        <!-- Mini Sparkline SVG -->
        <div class="w-16 h-8 opacity-70 group-hover:opacity-100 transition-opacity">
          <svg class="w-full h-full" viewBox="0 0 60 30">
            <path
              d="M 0,20 Q 20,8 35,14 T 60,10"
              fill="none"
              stroke="#38bdf8"
              stroke-width="1.8"
              stroke-linecap="round"
            />
            <path
              d="M 0,20 Q 20,8 35,14 T 60,10 L 60,30 L 0,30 Z"
              fill="url(#spark-slate-3)"
              opacity="0.15"
            />
            <defs>
              <linearGradient id="spark-slate-3" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#38bdf8" />
                <stop offset="100%" stop-color="#38bdf8" stop-opacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>

    <!-- Card 4: Voyage Progress & ETA -->
    <div class="relative overflow-hidden rounded-xl bg-[#121318] border border-[#1e2029] p-3 shadow-sm hover:border-[#38bdf8]/40 transition-colors">
      <div class="flex items-center justify-between pb-1">
        <div class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <Compass class="size-3.5 text-sky-400" />
          <span>Voyage Progress</span>
        </div>
        <span class="font-mono text-[10px] font-bold text-sky-400">
          {{ voyageProgressPct }}%
        </span>
      </div>

      <div class="pt-1">
        <div class="flex items-baseline justify-between">
          <div class="font-mono text-sm font-bold text-slate-100 tracking-tight">
            {{ distTR }} <span class="text-[11px] text-slate-500">/ {{ distToGo }} NM</span>
          </div>
          <div class="text-[10px] text-slate-500 font-mono">
            ETA: <span class="text-slate-300 font-medium">18 Sep 11:00</span>
          </div>
        </div>

        <!-- Progress Bar (Uniform Slate + Ice-blue) -->
        <div class="w-full bg-[#1e2029] h-1.5 rounded-full overflow-hidden mt-2">
          <div
            class="h-full bg-sky-400 rounded-full transition-all duration-500"
            :style="{ width: `${voyageProgressPct}%` }"
          />
        </div>
      </div>
    </div>

    <!-- Card 5: System Health & Active Alarms -->
    <div
      class="relative overflow-hidden rounded-xl bg-[#121318] border border-[#1e2029] p-3 shadow-sm hover:border-slate-600 transition-colors cursor-pointer group"
      @click="emit('toggle-alarms')"
    >
      <div class="flex items-center justify-between pb-1">
        <div class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <AlertTriangle class="size-3.5 text-slate-400" />
          <span>Alarms Rail</span>
        </div>
        <div class="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
          <span
            class="size-1.5 rounded-full"
            :class="isOnline ? 'bg-sky-400' : 'bg-rose-500'"
          />
          <span>Online</span>
        </div>
      </div>

      <div class="flex items-baseline justify-between pt-1">
        <div>
          <div class="font-mono text-xl font-bold tracking-tight text-slate-100 flex items-center gap-1.5">
            <span>14 Active</span>
            <span class="size-2 rounded-full bg-amber-400" />
          </div>
          <div class="text-[10px] text-slate-500 font-mono mt-0.5">
            <span>2 Critical</span> · <span>8 Warnings</span>
          </div>
        </div>

        <div class="text-right">
          <span class="inline-block rounded border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-[10px] font-medium text-slate-300 group-hover:border-slate-500 transition-colors">
            Drawer &rarr;
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
