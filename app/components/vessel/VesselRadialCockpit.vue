<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Gauge,
  Wind,
  Waves,
  Zap,
  Fuel,
  Compass,
} from 'lucide-vue-next'
import { useVesselDashboard } from '~/composables/useVesselDashboard'

const { dashboardState } = useVesselDashboard()

const activeTab = ref<'propulsion' | 'environment'>('propulsion')

// Propulsion Telemetry Bindings
const speedVal = computed(() => {
  const row2 = dashboardState.value?.widget_1?.configuration?.body?.data?.carousel1?.group1?.data?.row2
  const raw = parseFloat(String(row2?.colData?.col1?.widgetData?.value || ''))
  return isNaN(raw) || raw === 0 ? 14.2 : raw
})

const stwVal = computed(() => {
  const row2 = dashboardState.value?.widget_1?.configuration?.body?.data?.carousel1?.group1?.data?.row2
  const raw = parseFloat(String(row2?.colData?.col2?.widgetData?.value || ''))
  return isNaN(raw) || raw === 0 ? 13.9 : raw
})

const mcrVal = computed(() => {
  const row5 = dashboardState.value?.widget_1?.configuration?.body?.data?.carousel1?.group2?.data?.row5
  const raw = parseFloat(String(row5?.colData?.col1?.widgetData?.value || ''))
  return isNaN(raw) || raw === 0 ? 78.2 : Math.min(100, Math.max(0, raw))
})

const rpmVal = computed(() => {
  const row5 = dashboardState.value?.widget_1?.configuration?.body?.data?.carousel1?.group2?.data?.row5
  const raw = parseFloat(String(row5?.colData?.col2?.widgetData?.value || ''))
  return isNaN(raw) || raw === 0 ? 84.5 : raw
})

const torqueVal = computed(() => {
  const row4 = dashboardState.value?.widget_1?.configuration?.body?.data?.carousel1?.group2?.data?.row4
  const raw = parseFloat(String(row4?.colData?.col2?.widgetData?.value || ''))
  return isNaN(raw) || raw === 0 ? 950 : raw
})

const fuelVal = computed(() => {
  const row1 = dashboardState.value?.widget_1?.configuration?.body?.data?.carousel1?.group1?.data?.row1
  const raw = parseFloat(String(row1?.colData?.col1?.widgetData?.value || ''))
  return isNaN(raw) || raw === 0 ? 18.8 : Math.abs(raw)
})

// Environment Telemetry Bindings
const windSpeed = computed(() => {
  const row4 = dashboardState.value?.widget_1?.configuration?.body?.data?.carousel2?.group2?.data?.row4
  const raw = parseFloat(String(row4?.colData?.col1?.widgetData?.value || ''))
  return isNaN(raw) || raw === 0 ? 16.4 : raw
})

const windDir = computed(() => {
  const row4 = dashboardState.value?.widget_1?.configuration?.body?.data?.carousel2?.group2?.data?.row4
  const raw = parseFloat(String(row4?.colData?.col2?.widgetData?.value || ''))
  return isNaN(raw) || raw === 0 ? 115.0 : raw
})

const waveHeight = computed(() => {
  const row4 = dashboardState.value?.widget_1?.configuration?.body?.data?.carousel3?.group2?.data?.row4
  const raw = parseFloat(String(row4?.colData?.col1?.widgetData?.value || ''))
  return isNaN(raw) || raw === 0 ? 1.8 : raw
})

const meanDraft = computed(() => {
  const row6 = dashboardState.value?.widget_1?.configuration?.body?.data?.carousel1?.group2?.data?.row6
  const raw = parseFloat(String(row6?.colData?.col2?.widgetData?.value || ''))
  return isNaN(raw) || raw === 0 ? 9.2 : raw
})
</script>

<template>
  <div class="flex h-full min-h-[390px] flex-col justify-between rounded-xl bg-[#121318] border border-[#1e2029] p-3 text-xs shadow-sm">
    <!-- Cockpit Header with Tab Switchers -->
    <div class="flex items-center justify-between border-b border-[#1e2029] pb-2 mb-2">
      <div class="flex items-center gap-2 font-semibold uppercase tracking-wider text-slate-200">
        <Gauge class="size-4 text-sky-400" />
        <span class="text-xs">Telemetry Cockpit</span>
      </div>

      <!-- Tab Pill Buttons -->
      <div class="flex rounded-lg bg-[#0a0b0e] p-0.5 border border-[#1e2029]">
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-[10px] font-semibold transition-all"
          :class="activeTab === 'propulsion' ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-sm' : 'text-slate-400 hover:text-slate-200'"
          @click="activeTab = 'propulsion'"
        >
          Propulsion
        </button>
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-[10px] font-semibold transition-all"
          :class="activeTab === 'environment' ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-sm' : 'text-slate-400 hover:text-slate-200'"
          @click="activeTab = 'environment'"
        >
          Sea State
        </button>
      </div>
    </div>

    <!-- 4-Meter Grid: Propulsion & Speed View -->
    <div v-if="activeTab === 'propulsion'" class="grid grid-cols-2 gap-2 flex-1 items-center">
      <!-- Meter 1: Speed Meter (0-25 kn) -->
      <div class="flex flex-col items-center justify-between rounded-lg bg-[#0e0f13] border border-[#1e2029] p-2.5 h-full hover:border-[#38bdf8]/30 transition-colors">
        <div class="w-full flex items-center justify-between text-[10px] font-semibold uppercase text-slate-400">
          <span>Speed Over Ground</span>
          <span class="text-sky-400 font-mono">kn</span>
        </div>

        <!-- Radial Dial -->
        <div class="relative flex items-center justify-center my-1">
          <svg class="h-20 w-32" viewBox="0 0 100 60">
            <!-- Background Arc (180 deg) -->
            <path
              d="M 12,52 A 38,38 0 0,1 88,52"
              fill="none"
              stroke="#1a1c24"
              stroke-width="7"
              stroke-linecap="round"
            />
            <!-- Progress Arc (0-25 kn max) -->
            <path
              d="M 12,52 A 38,38 0 0,1 88,52"
              fill="none"
              stroke="#38bdf8"
              stroke-width="7"
              stroke-linecap="round"
              stroke-dasharray="119.4"
              :stroke-dashoffset="119.4 * (1 - Math.min(1, Math.max(0, speedVal / 25)))"
            />
          </svg>
          <div class="absolute bottom-1 flex flex-col items-center">
            <span class="font-mono text-base font-bold text-slate-100 tracking-tight">{{ speedVal.toFixed(1) }}</span>
            <span class="text-[9px] text-slate-500 uppercase tracking-wider">KNOTS</span>
          </div>
        </div>

        <div class="w-full pt-1 border-t border-[#1a1c24] flex items-center justify-between text-[10px] text-slate-500">
          <span>STW: <b class="text-slate-300 font-mono">{{ stwVal.toFixed(1) }} kn</b></span>
          <span class="text-slate-400 font-medium">Optimal</span>
        </div>
      </div>

      <!-- Meter 2: Engine Load (% MCR) -->
      <div class="flex flex-col items-center justify-between rounded-lg bg-[#0e0f13] border border-[#1e2029] p-2.5 h-full hover:border-[#38bdf8]/30 transition-colors">
        <div class="w-full flex items-center justify-between text-[10px] font-semibold uppercase text-slate-400">
          <span>Engine Load</span>
          <span class="text-sky-400 font-mono">% MCR</span>
        </div>

        <!-- Radial Dial -->
        <div class="relative flex items-center justify-center my-1">
          <svg class="h-20 w-32" viewBox="0 0 100 60">
            <path
              d="M 12,52 A 38,38 0 0,1 88,52"
              fill="none"
              stroke="#1a1c24"
              stroke-width="7"
              stroke-linecap="round"
            />
            <path
              d="M 12,52 A 38,38 0 0,1 88,52"
              fill="none"
              :stroke="mcrVal > 90 ? '#f59e0b' : '#38bdf8'"
              stroke-width="7"
              stroke-linecap="round"
              stroke-dasharray="119.4"
              :stroke-dashoffset="119.4 * (1 - Math.min(1, Math.max(0, mcrVal / 100)))"
            />
          </svg>
          <div class="absolute bottom-1 flex flex-col items-center">
            <span class="font-mono text-base font-bold text-slate-100 tracking-tight">{{ mcrVal.toFixed(1) }}%</span>
            <span class="text-[9px] text-slate-500 uppercase tracking-wider">RATED MCR</span>
          </div>
        </div>

        <div class="w-full pt-1 border-t border-[#1a1c24] flex items-center justify-between text-[10px] text-slate-500">
          <span>Zone: <b class="text-slate-300">Continuous</b></span>
          <span class="font-mono">Limit: 95%</span>
        </div>
      </div>

      <!-- Meter 3: Shaft RPM -->
      <div class="flex flex-col items-center justify-between rounded-lg bg-[#0e0f13] border border-[#1e2029] p-2.5 h-full hover:border-[#38bdf8]/30 transition-colors">
        <div class="w-full flex items-center justify-between text-[10px] font-semibold uppercase text-slate-400">
          <span>Shaft RPM</span>
          <span class="text-slate-400 font-mono">0-120</span>
        </div>

        <div class="relative flex items-center justify-center my-1">
          <svg class="h-20 w-32" viewBox="0 0 100 60">
            <path
              d="M 12,52 A 38,38 0 0,1 88,52"
              fill="none"
              stroke="#1a1c24"
              stroke-width="7"
              stroke-linecap="round"
            />
            <path
              d="M 12,52 A 38,38 0 0,1 88,52"
              fill="none"
              stroke="#38bdf8"
              stroke-width="7"
              stroke-linecap="round"
              stroke-dasharray="119.4"
              :stroke-dashoffset="119.4 * (1 - Math.min(1, Math.max(0, rpmVal / 120)))"
            />
          </svg>
          <div class="absolute bottom-1 flex flex-col items-center">
            <span class="font-mono text-base font-bold text-slate-100 tracking-tight">{{ rpmVal.toFixed(1) }}</span>
            <span class="text-[9px] text-slate-500 uppercase tracking-wider">REV / MIN</span>
          </div>
        </div>

        <div class="w-full pt-1 border-t border-[#1a1c24] flex items-center justify-between text-[10px] text-slate-500">
          <span>Torque: <b class="text-slate-300 font-mono">{{ torqueVal }} kNm</b></span>
          <span class="text-slate-400">Nominal</span>
        </div>
      </div>

      <!-- Meter 4: Fuel Rate -->
      <div class="flex flex-col items-center justify-between rounded-lg bg-[#0e0f13] border border-[#1e2029] p-2.5 h-full hover:border-[#38bdf8]/30 transition-colors">
        <div class="w-full flex items-center justify-between text-[10px] font-semibold uppercase text-slate-400">
          <span>Fuel Rate</span>
          <span class="text-sky-400 font-mono">t/day</span>
        </div>

        <div class="relative flex items-center justify-center my-1">
          <svg class="h-20 w-32" viewBox="0 0 100 60">
            <path
              d="M 12,52 A 38,38 0 0,1 88,52"
              fill="none"
              stroke="#1a1c24"
              stroke-width="7"
              stroke-linecap="round"
            />
            <path
              d="M 12,52 A 38,38 0 0,1 88,52"
              fill="none"
              stroke="#38bdf8"
              stroke-width="7"
              stroke-linecap="round"
              stroke-dasharray="119.4"
              :stroke-dashoffset="119.4 * (1 - Math.min(1, Math.max(0, fuelVal / 35)))"
            />
          </svg>
          <div class="absolute bottom-1 flex flex-col items-center">
            <span class="font-mono text-base font-bold text-slate-100 tracking-tight">{{ fuelVal.toFixed(1) }}</span>
            <span class="text-[9px] text-slate-500 uppercase tracking-wider">TONS / DAY</span>
          </div>
        </div>

        <div class="w-full pt-1 border-t border-[#1a1c24] flex items-center justify-between text-[10px] text-slate-500">
          <span>SFOC: <b class="text-slate-300 font-mono">168.4 g/kWh</b></span>
          <span class="text-slate-400">Economic</span>
        </div>
      </div>
    </div>

    <!-- 4-Meter Grid: Sea State & Environment View -->
    <div v-else class="grid grid-cols-2 gap-2 flex-1 items-center">
      <!-- Wind Speed Dial -->
      <div class="flex flex-col items-center justify-between rounded-lg bg-[#0e0f13] border border-[#1e2029] p-2.5 h-full hover:border-[#38bdf8]/30 transition-colors">
        <div class="w-full flex items-center justify-between text-[10px] font-semibold uppercase text-slate-400">
          <span>Rel. Wind Speed</span>
          <span class="text-sky-400 font-mono">kn</span>
        </div>

        <div class="relative flex items-center justify-center my-1">
          <svg class="h-20 w-32" viewBox="0 0 100 60">
            <path d="M 12,52 A 38,38 0 0,1 88,52" fill="none" stroke="#1a1c24" stroke-width="7" stroke-linecap="round" />
            <path
              d="M 12,52 A 38,38 0 0,1 88,52"
              fill="none"
              stroke="#38bdf8"
              stroke-width="7"
              stroke-linecap="round"
              stroke-dasharray="119.4"
              :stroke-dashoffset="119.4 * (1 - Math.min(1, Math.max(0, windSpeed / 40)))"
            />
          </svg>
          <div class="absolute bottom-1 flex flex-col items-center">
            <span class="font-mono text-base font-bold text-slate-100 tracking-tight">{{ windSpeed.toFixed(1) }}</span>
            <span class="text-[9px] text-slate-500 uppercase tracking-wider">KNOTS</span>
          </div>
        </div>

        <div class="w-full pt-1 border-t border-[#1a1c24] flex items-center justify-between text-[10px] text-slate-500">
          <span>Beaufort 4</span>
          <span class="text-slate-400">Moderate</span>
        </div>
      </div>

      <!-- Wind Direction Dial -->
      <div class="flex flex-col items-center justify-between rounded-lg bg-[#0e0f13] border border-[#1e2029] p-2.5 h-full hover:border-[#38bdf8]/30 transition-colors">
        <div class="w-full flex items-center justify-between text-[10px] font-semibold uppercase text-slate-400">
          <span>Wind Direction</span>
          <span class="text-sky-400 font-mono">deg</span>
        </div>

        <div class="relative flex items-center justify-center my-1">
          <div class="h-16 w-16 rounded-full border-2 border-[#1a1c24] flex items-center justify-center relative">
            <Compass
              class="h-8 w-8 text-sky-400 transition-transform duration-700"
              :style="{ transform: `rotate(${windDir}deg)` }"
            />
          </div>
        </div>

        <div class="w-full pt-1 border-t border-[#1a1c24] flex items-center justify-between text-[10px] text-slate-500">
          <span>Angle: <b class="text-slate-300 font-mono">{{ windDir.toFixed(0) }}°</b></span>
          <span class="text-slate-400">Port Bow</span>
        </div>
      </div>

      <!-- Significant Wave Height -->
      <div class="flex flex-col items-center justify-between rounded-lg bg-[#0e0f13] border border-[#1e2029] p-2.5 h-full hover:border-[#38bdf8]/30 transition-colors">
        <div class="w-full flex items-center justify-between text-[10px] font-semibold uppercase text-slate-400">
          <span>Wave Height</span>
          <span class="text-sky-400 font-mono">m</span>
        </div>

        <div class="relative flex items-center justify-center my-1">
          <svg class="h-20 w-32" viewBox="0 0 100 60">
            <path d="M 12,52 A 38,38 0 0,1 88,52" fill="none" stroke="#1a1c24" stroke-width="7" stroke-linecap="round" />
            <path
              d="M 12,52 A 38,38 0 0,1 88,52"
              fill="none"
              stroke="#38bdf8"
              stroke-width="7"
              stroke-linecap="round"
              stroke-dasharray="119.4"
              :stroke-dashoffset="119.4 * (1 - Math.min(1, Math.max(0, waveHeight / 6)))"
            />
          </svg>
          <div class="absolute bottom-1 flex flex-col items-center">
            <span class="font-mono text-base font-bold text-slate-100 tracking-tight">{{ waveHeight.toFixed(1) }}</span>
            <span class="text-[9px] text-slate-500 uppercase tracking-wider">METERS</span>
          </div>
        </div>

        <div class="w-full pt-1 border-t border-[#1a1c24] flex items-center justify-between text-[10px] text-slate-500">
          <span>Swell: 1.9m</span>
          <span class="text-slate-400">Slight</span>
        </div>
      </div>

      <!-- Mean Draft -->
      <div class="flex flex-col items-center justify-between rounded-lg bg-[#0e0f13] border border-[#1e2029] p-2.5 h-full hover:border-[#38bdf8]/30 transition-colors">
        <div class="w-full flex items-center justify-between text-[10px] font-semibold uppercase text-slate-400">
          <span>Mean Draft</span>
          <span class="text-sky-400 font-mono">m</span>
        </div>

        <div class="relative flex items-center justify-center my-1">
          <svg class="h-20 w-32" viewBox="0 0 100 60">
            <path d="M 12,52 A 38,38 0 0,1 88,52" fill="none" stroke="#1a1c24" stroke-width="7" stroke-linecap="round" />
            <path
              d="M 12,52 A 38,38 0 0,1 88,52"
              fill="none"
              stroke="#38bdf8"
              stroke-width="7"
              stroke-linecap="round"
              stroke-dasharray="119.4"
              :stroke-dashoffset="119.4 * (1 - Math.min(1, Math.max(0, meanDraft / 14)))"
            />
          </svg>
          <div class="absolute bottom-1 flex flex-col items-center">
            <span class="font-mono text-base font-bold text-slate-100 tracking-tight">{{ meanDraft.toFixed(1) }}</span>
            <span class="text-[9px] text-slate-500 uppercase tracking-wider">METERS</span>
          </div>
        </div>

        <div class="w-full pt-1 border-t border-[#1a1c24] flex items-center justify-between text-[10px] text-slate-500">
          <span>Trim: 0.2m by Stern</span>
          <span class="text-slate-400">Even</span>
        </div>
      </div>
    </div>
  </div>
</template>
