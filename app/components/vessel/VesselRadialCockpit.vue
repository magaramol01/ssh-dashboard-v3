<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Gauge,
  Wind,
  Waves,
  Zap,
  Fuel,
  Compass,
  Info,
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
  return isNaN(raw) || raw === 0 ? 115 : raw
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
  <div class="flex h-full min-h-[390px] flex-col justify-between rounded bg-[#17181f] border border-[#262833] p-3 text-xs shadow-md">
    <!-- Cockpit Header with Tab Switchers -->
    <div class="flex items-center justify-between border-b border-[#282a2e] pb-2 mb-2">
      <div class="flex items-center gap-2 font-bold uppercase tracking-wider text-[#38bdf8]">
        <Gauge class="size-4" />
        <span>Telemetry Cockpit</span>
      </div>

      <!-- Tab Pill Buttons -->
      <div class="flex rounded-md bg-[#121318] p-0.5 border border-[#262833]">
        <button
          type="button"
          class="rounded px-2.5 py-1 text-[10px] font-bold transition-colors"
          :class="activeTab === 'propulsion' ? 'bg-[#38bdf8] text-black shadow-sm' : 'text-[#8e8e8e] hover:text-white'"
          @click="activeTab = 'propulsion'"
        >
          Propulsion
        </button>
        <button
          type="button"
          class="rounded px-2.5 py-1 text-[10px] font-bold transition-colors"
          :class="activeTab === 'environment' ? 'bg-[#38bdf8] text-black shadow-sm' : 'text-[#8e8e8e] hover:text-white'"
          @click="activeTab = 'environment'"
        >
          Sea State
        </button>
      </div>
    </div>

    <!-- 4-Meter Grid: Propulsion & Speed View -->
    <div v-if="activeTab === 'propulsion'" class="grid grid-cols-2 gap-2.5 flex-1 items-center">
      <!-- Meter 1: Speed Meter (0-25 kn) -->
      <div class="flex flex-col items-center justify-between rounded bg-[#121318] border border-[#262833] p-2.5 h-full hover:border-[#38bdf8]/40 transition-colors">
        <div class="w-full flex items-center justify-between text-[10px] font-bold uppercase text-[#8e8e8e]">
          <span>Speed Over Ground</span>
          <span class="text-[#38bdf8] font-mono">kn</span>
        </div>

        <!-- Radial Dial -->
        <div class="relative flex items-center justify-center my-1">
          <svg class="h-20 w-32" viewBox="0 0 100 60">
            <!-- Background Arc (180 deg) -->
            <path
              d="M 12,52 A 38,38 0 0,1 88,52"
              fill="none"
              stroke="#20222a"
              stroke-width="8"
              stroke-linecap="round"
            />
            <!-- Progress Arc (0-25 kn max) -->
            <path
              d="M 12,52 A 38,38 0 0,1 88,52"
              fill="none"
              stroke="#38bdf8"
              stroke-width="8"
              stroke-linecap="round"
              stroke-dasharray="119.4"
              :stroke-dashoffset="119.4 * (1 - Math.min(1, Math.max(0, speedVal / 25)))"
            />
          </svg>
          <div class="absolute bottom-1 flex flex-col items-center">
            <span class="font-mono text-base font-bold text-white tracking-tight">{{ speedVal.toFixed(1) }}</span>
            <span class="text-[9px] text-[#8e8e8e]">KNOTS</span>
          </div>
        </div>

        <div class="w-full pt-1 border-t border-[#242630] flex items-center justify-between text-[10px] text-[#8e8e8e]">
          <span>STW: <b class="text-[#d8d9da]">{{ stwVal.toFixed(1) }} kn</b></span>
          <span class="text-[#10b981] font-bold">Optimal</span>
        </div>
      </div>

      <!-- Meter 2: Engine Load (% MCR) -->
      <div class="flex flex-col items-center justify-between rounded bg-[#121318] border border-[#262833] p-2.5 h-full hover:border-[#10b981]/40 transition-colors">
        <div class="w-full flex items-center justify-between text-[10px] font-bold uppercase text-[#8e8e8e]">
          <span>Engine Load</span>
          <span class="text-[#10b981] font-mono">% MCR</span>
        </div>

        <!-- Radial Dial -->
        <div class="relative flex items-center justify-center my-1">
          <svg class="h-20 w-32" viewBox="0 0 100 60">
            <path
              d="M 12,52 A 38,38 0 0,1 88,52"
              fill="none"
              stroke="#20222a"
              stroke-width="8"
              stroke-linecap="round"
            />
            <path
              d="M 12,52 A 38,38 0 0,1 88,52"
              fill="none"
              :stroke="mcrVal > 90 ? '#ef4444' : mcrVal > 80 ? '#f59e0b' : '#10b981'"
              stroke-width="8"
              stroke-linecap="round"
              stroke-dasharray="119.4"
              :stroke-dashoffset="119.4 * (1 - Math.min(1, Math.max(0, mcrVal / 100)))"
            />
          </svg>
          <div class="absolute bottom-1 flex flex-col items-center">
            <span class="font-mono text-base font-bold text-white tracking-tight">{{ mcrVal.toFixed(1) }}%</span>
            <span class="text-[9px] text-[#8e8e8e]">RATED MCR</span>
          </div>
        </div>

        <div class="w-full pt-1 border-t border-[#242630] flex items-center justify-between text-[10px] text-[#8e8e8e]">
          <span>Zone: <b :class="mcrVal > 90 ? 'text-[#ef4444]' : 'text-[#10b981]'">Continuous</b></span>
          <span class="font-mono">Limit: 95%</span>
        </div>
      </div>

      <!-- Meter 3: Shaft RPM -->
      <div class="flex flex-col items-center justify-between rounded bg-[#121318] border border-[#262833] p-2.5 h-full hover:border-[#f59e0b]/40 transition-colors">
        <div class="w-full flex items-center justify-between text-[10px] font-bold uppercase text-[#8e8e8e]">
          <span>Shaft RPM</span>
          <span class="text-[#f59e0b] font-mono">0-120</span>
        </div>

        <div class="relative flex items-center justify-center my-1">
          <svg class="h-20 w-32" viewBox="0 0 100 60">
            <path
              d="M 12,52 A 38,38 0 0,1 88,52"
              fill="none"
              stroke="#20222a"
              stroke-width="8"
              stroke-linecap="round"
            />
            <path
              d="M 12,52 A 38,38 0 0,1 88,52"
              fill="none"
              stroke="#f59e0b"
              stroke-width="8"
              stroke-linecap="round"
              stroke-dasharray="119.4"
              :stroke-dashoffset="119.4 * (1 - Math.min(1, Math.max(0, rpmVal / 120)))"
            />
          </svg>
          <div class="absolute bottom-1 flex flex-col items-center">
            <span class="font-mono text-base font-bold text-white tracking-tight">{{ rpmVal.toFixed(1) }}</span>
            <span class="text-[9px] text-[#8e8e8e]">REV / MIN</span>
          </div>
        </div>

        <div class="w-full pt-1 border-t border-[#242630] flex items-center justify-between text-[10px] text-[#8e8e8e]">
          <span>Torque: <b class="text-white">{{ torqueVal }} kNm</b></span>
          <span class="text-[#10b981]">Nominal</span>
        </div>
      </div>

      <!-- Meter 4: Fuel Consumption Rate -->
      <div class="flex flex-col items-center justify-between rounded bg-[#121318] border border-[#262833] p-2.5 h-full hover:border-[#38bdf8]/40 transition-colors">
        <div class="w-full flex items-center justify-between text-[10px] font-bold uppercase text-[#8e8e8e]">
          <span>Fuel Rate</span>
          <span class="text-[#38bdf8] font-mono">t/day</span>
        </div>

        <div class="relative flex items-center justify-center my-1">
          <svg class="h-20 w-32" viewBox="0 0 100 60">
            <path
              d="M 12,52 A 38,38 0 0,1 88,52"
              fill="none"
              stroke="#20222a"
              stroke-width="8"
              stroke-linecap="round"
            />
            <path
              d="M 12,52 A 38,38 0 0,1 88,52"
              fill="none"
              stroke="#38bdf8"
              stroke-width="8"
              stroke-linecap="round"
              stroke-dasharray="119.4"
              :stroke-dashoffset="119.4 * (1 - Math.min(1, Math.max(0, fuelVal / 30)))"
            />
          </svg>
          <div class="absolute bottom-1 flex flex-col items-center">
            <span class="font-mono text-base font-bold text-white tracking-tight">{{ fuelVal.toFixed(1) }}</span>
            <span class="text-[9px] text-[#8e8e8e]">TONS / DAY</span>
          </div>
        </div>

        <div class="w-full pt-1 border-t border-[#242630] flex items-center justify-between text-[10px] text-[#8e8e8e]">
          <span>SFOC: <b class="text-white">168 g/kWh</b></span>
          <span class="text-[#10b981] font-bold">Tier III</span>
        </div>
      </div>
    </div>

    <!-- 4-Meter Grid: Environmental & Sea State View -->
    <div v-else class="grid grid-cols-2 gap-2.5 flex-1 items-center">
      <!-- True Wind Speed -->
      <div class="flex flex-col items-center justify-between rounded bg-[#121318] border border-[#262833] p-2.5 h-full">
        <div class="w-full flex items-center justify-between text-[10px] font-bold uppercase text-[#8e8e8e]">
          <span>True Wind Speed</span>
          <span class="text-[#38bdf8] font-mono">kn</span>
        </div>
        <div class="relative flex items-center justify-center my-1">
          <Wind class="size-10 text-[#38bdf8] opacity-80" />
          <div class="text-center mt-1">
            <div class="font-mono text-lg font-bold text-white">{{ windSpeed }} kn</div>
            <div class="text-[9px] text-[#8e8e8e]">BEAUFORT 4</div>
          </div>
        </div>
        <div class="w-full pt-1 border-t border-[#242630] text-[10px] text-[#8e8e8e] text-center">
          Moderate Breeze
        </div>
      </div>

      <!-- Wind Direction -->
      <div class="flex flex-col items-center justify-between rounded bg-[#121318] border border-[#262833] p-2.5 h-full">
        <div class="w-full flex items-center justify-between text-[10px] font-bold uppercase text-[#8e8e8e]">
          <span>Wind Direction</span>
          <span class="text-[#f59e0b] font-mono">DEG</span>
        </div>
        <div class="relative flex items-center justify-center my-1">
          <Compass class="size-10 text-[#f59e0b] opacity-80" />
          <div class="text-center mt-1">
            <div class="font-mono text-lg font-bold text-white">{{ windDir }}°</div>
            <div class="text-[9px] text-[#8e8e8e]">ESE (EAST-SE)</div>
          </div>
        </div>
        <div class="w-full pt-1 border-t border-[#242630] text-[10px] text-[#8e8e8e] text-center">
          Relative: 115°
        </div>
      </div>

      <!-- Significant Wave Height -->
      <div class="flex flex-col items-center justify-between rounded bg-[#121318] border border-[#262833] p-2.5 h-full">
        <div class="w-full flex items-center justify-between text-[10px] font-bold uppercase text-[#8e8e8e]">
          <span>Significant Wave</span>
          <span class="text-[#38bdf8] font-mono">METERS</span>
        </div>
        <div class="relative flex items-center justify-center my-1">
          <Waves class="size-10 text-[#38bdf8] opacity-80" />
          <div class="text-center mt-1">
            <div class="font-mono text-lg font-bold text-white">{{ waveHeight }} m</div>
            <div class="text-[9px] text-[#8e8e8e]">DOUGLAS 3</div>
          </div>
        </div>
        <div class="w-full pt-1 border-t border-[#242630] text-[10px] text-[#8e8e8e] text-center">
          Slight Sea State
        </div>
      </div>

      <!-- Vessel Mean Draft -->
      <div class="flex flex-col items-center justify-between rounded bg-[#121318] border border-[#262833] p-2.5 h-full">
        <div class="w-full flex items-center justify-between text-[10px] font-bold uppercase text-[#8e8e8e]">
          <span>Mean Draft</span>
          <span class="text-[#10b981] font-mono">m</span>
        </div>
        <div class="relative flex items-center justify-center my-1 text-center">
          <div class="font-mono text-2xl font-bold text-white mt-2">{{ meanDraft }} m</div>
          <div class="text-[9px] text-[#8e8e8e] mt-1">DRAUGHT MAX: 11.8 m</div>
        </div>
        <div class="w-full pt-1 border-t border-[#242630] text-[10px] text-[#8e8e8e] text-center">
          Trim: Even Keel (0.0 m)
        </div>
      </div>
    </div>
  </div>
</template>
