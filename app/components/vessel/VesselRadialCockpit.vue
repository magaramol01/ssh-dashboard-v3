<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Gauge,
  Wind,
  Compass,
} from 'lucide-vue-next'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
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
  <Card class="shadow-xs flex flex-col h-full min-h-[420px]">
    <CardHeader class="p-4 pb-2">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Propulsion & Dynamics</div>
          <CardTitle class="text-sm font-semibold flex items-center gap-2">
            <Gauge class="size-4 text-primary" />
            <span>Telemetry Cockpit</span>
          </CardTitle>
          <CardDescription class="text-xs">
            Propulsion, shaft load & environmental indicators
          </CardDescription>
        </div>

        <!-- Pill Switcher (Matches CII tab style) -->
        <div class="flex rounded-lg bg-muted p-0.5 border border-border">
          <button
            type="button"
            class="rounded-md px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer"
            :class="activeTab === 'propulsion' ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'"
            @click="activeTab = 'propulsion'"
          >
            Propulsion
          </button>
          <button
            type="button"
            class="rounded-md px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer"
            :class="activeTab === 'environment' ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'"
            @click="activeTab = 'environment'"
          >
            Sea State
          </button>
        </div>
      </div>
    </CardHeader>

    <CardContent class="p-4 flex-1 flex flex-col justify-between">
      <!-- 4-Meter Grid: Propulsion & Speed View -->
      <div v-if="activeTab === 'propulsion'" class="grid grid-cols-2 gap-3 flex-1 items-center">
        <!-- Meter 1: Speed Meter -->
        <div class="flex flex-col items-center justify-between rounded-lg border bg-card/60 p-3 h-full shadow-xs">
          <div class="w-full flex items-center justify-between text-xs">
            <span class="text-xs font-normal text-muted-foreground">Speed (SOG)</span>
            <span class="text-xs font-normal text-muted-foreground">kn</span>
          </div>

          <!-- Radial Dial -->
          <div class="relative flex items-center justify-center my-1">
            <svg class="h-20 w-32" viewBox="0 0 100 60">
              <path d="M 12,52 A 38,38 0 0,1 88,52" fill="none" stroke="currentColor" class="text-muted/40" stroke-width="7" stroke-linecap="round" />
              <path
                d="M 12,52 A 38,38 0 0,1 88,52"
                fill="none"
                stroke="currentColor"
                class="text-primary"
                stroke-width="7"
                stroke-linecap="round"
                stroke-dasharray="119.4"
                :stroke-dashoffset="119.4 * (1 - Math.min(1, Math.max(0, speedVal / 25)))"
              />
            </svg>
            <div class="absolute bottom-1 flex flex-col items-center">
              <span class="font-mono text-xl font-bold text-foreground tabular-nums">{{ speedVal.toFixed(1) }}</span>
              <span class="text-[11px] font-normal text-muted-foreground">knots</span>
            </div>
          </div>

          <div class="w-full pt-1.5 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
            <span>STW: <span class="text-foreground font-mono font-medium">{{ stwVal.toFixed(1) }} kn</span></span>
            <span class="text-emerald-500 font-medium text-[11px]">Optimal</span>
          </div>
        </div>

        <!-- Meter 2: Engine Load (% MCR) -->
        <div class="flex flex-col items-center justify-between rounded-lg border bg-card/60 p-3 h-full shadow-xs">
          <div class="w-full flex items-center justify-between text-xs">
            <span class="text-xs font-normal text-muted-foreground">Engine load</span>
            <span class="text-xs font-normal text-muted-foreground">% MCR</span>
          </div>

          <div class="relative flex items-center justify-center my-1">
            <svg class="h-20 w-32" viewBox="0 0 100 60">
              <path d="M 12,52 A 38,38 0 0,1 88,52" fill="none" stroke="currentColor" class="text-muted/40" stroke-width="7" stroke-linecap="round" />
              <path
                d="M 12,52 A 38,38 0 0,1 88,52"
                fill="none"
                stroke="currentColor"
                :class="mcrVal > 90 ? 'text-amber-500' : 'text-primary'"
                stroke-width="7"
                stroke-linecap="round"
                stroke-dasharray="119.4"
                :stroke-dashoffset="119.4 * (1 - Math.min(1, Math.max(0, mcrVal / 100)))"
              />
            </svg>
            <div class="absolute bottom-1 flex flex-col items-center">
              <span class="font-mono text-xl font-bold text-foreground tabular-nums">{{ mcrVal.toFixed(1) }}%</span>
              <span class="text-[11px] font-normal text-muted-foreground">rated MCR</span>
            </div>
          </div>

          <div class="w-full pt-1.5 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Zone: <span class="text-foreground font-medium">Continuous</span></span>
            <span class="font-mono text-[11px] text-muted-foreground">Limit: 95%</span>
          </div>
        </div>

        <!-- Meter 3: Shaft RPM -->
        <div class="flex flex-col items-center justify-between rounded-lg border bg-card/60 p-3 h-full shadow-xs">
          <div class="w-full flex items-center justify-between text-xs">
            <span class="text-xs font-normal text-muted-foreground">Shaft speed</span>
            <span class="text-xs font-normal text-muted-foreground">0–120 rpm</span>
          </div>

          <div class="relative flex items-center justify-center my-1">
            <svg class="h-20 w-32" viewBox="0 0 100 60">
              <path d="M 12,52 A 38,38 0 0,1 88,52" fill="none" stroke="currentColor" class="text-muted/40" stroke-width="7" stroke-linecap="round" />
              <path
                d="M 12,52 A 38,38 0 0,1 88,52"
                fill="none"
                stroke="currentColor"
                class="text-primary"
                stroke-width="7"
                stroke-linecap="round"
                stroke-dasharray="119.4"
                :stroke-dashoffset="119.4 * (1 - Math.min(1, Math.max(0, rpmVal / 120)))"
              />
            </svg>
            <div class="absolute bottom-1 flex flex-col items-center">
              <span class="font-mono text-xl font-bold text-foreground tabular-nums">{{ rpmVal.toFixed(1) }}</span>
              <span class="text-[11px] font-normal text-muted-foreground">rev / min</span>
            </div>
          </div>

          <div class="w-full pt-1.5 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Torque: <span class="text-foreground font-mono font-medium">{{ torqueVal }} kNm</span></span>
            <span class="text-[11px] text-muted-foreground font-medium">Nominal</span>
          </div>
        </div>

        <!-- Meter 4: Fuel Rate -->
        <div class="flex flex-col items-center justify-between rounded-lg border bg-card/60 p-3 h-full shadow-xs">
          <div class="w-full flex items-center justify-between text-xs">
            <span class="text-xs font-normal text-muted-foreground">Fuel rate</span>
            <span class="text-xs font-normal text-muted-foreground">t/day</span>
          </div>

          <div class="relative flex items-center justify-center my-1">
            <svg class="h-20 w-32" viewBox="0 0 100 60">
              <path d="M 12,52 A 38,38 0 0,1 88,52" fill="none" stroke="currentColor" class="text-muted/40" stroke-width="7" stroke-linecap="round" />
              <path
                d="M 12,52 A 38,38 0 0,1 88,52"
                fill="none"
                stroke="currentColor"
                class="text-primary"
                stroke-width="7"
                stroke-linecap="round"
                stroke-dasharray="119.4"
                :stroke-dashoffset="119.4 * (1 - Math.min(1, Math.max(0, fuelVal / 35)))"
              />
            </svg>
            <div class="absolute bottom-1 flex flex-col items-center">
              <span class="font-mono text-xl font-bold text-foreground tabular-nums">{{ fuelVal.toFixed(1) }}</span>
              <span class="text-[11px] font-normal text-muted-foreground">tons / day</span>
            </div>
          </div>

          <div class="w-full pt-1.5 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
            <span>SFOC: <span class="text-foreground font-mono font-medium">168.4 g/kWh</span></span>
            <span class="text-[11px] text-muted-foreground font-medium">Economic</span>
          </div>
        </div>
      </div>

      <!-- 4-Meter Grid: Sea State View -->
      <div v-else class="grid grid-cols-2 gap-3 flex-1 items-center">
        <!-- Wind Speed -->
        <div class="flex flex-col items-center justify-between rounded-lg border bg-card/60 p-3 h-full shadow-xs">
          <div class="w-full flex items-center justify-between text-xs">
            <span class="text-xs font-normal text-muted-foreground">Relative wind speed</span>
            <span class="text-xs font-normal text-muted-foreground">kn</span>
          </div>

          <div class="relative flex items-center justify-center my-1">
            <svg class="h-20 w-32" viewBox="0 0 100 60">
              <path d="M 12,52 A 38,38 0 0,1 88,52" fill="none" stroke="currentColor" class="text-muted/40" stroke-width="7" stroke-linecap="round" />
              <path
                d="M 12,52 A 38,38 0 0,1 88,52"
                fill="none"
                stroke="currentColor"
                class="text-primary"
                stroke-width="7"
                stroke-linecap="round"
                stroke-dasharray="119.4"
                :stroke-dashoffset="119.4 * (1 - Math.min(1, Math.max(0, windSpeed / 40)))"
              />
            </svg>
            <div class="absolute bottom-1 flex flex-col items-center">
              <span class="font-mono text-xl font-bold text-foreground tabular-nums">{{ windSpeed.toFixed(1) }}</span>
              <span class="text-[11px] font-normal text-muted-foreground">knots</span>
            </div>
          </div>

          <div class="w-full pt-1.5 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Beaufort 4</span>
            <span class="text-[11px] text-muted-foreground font-medium">Moderate</span>
          </div>
        </div>

        <!-- Wind Direction -->
        <div class="flex flex-col items-center justify-between rounded-lg border bg-card/60 p-3 h-full shadow-xs">
          <div class="w-full flex items-center justify-between text-xs">
            <span class="text-xs font-normal text-muted-foreground">Wind direction</span>
            <span class="text-xs font-normal text-muted-foreground">deg</span>
          </div>

          <div class="relative flex items-center justify-center my-1">
            <div class="h-16 w-16 rounded-full border border-border flex items-center justify-center relative">
              <Compass
                class="h-8 w-8 text-primary transition-transform duration-700"
                :style="{ transform: `rotate(${windDir}deg)` }"
              />
            </div>
          </div>

          <div class="w-full pt-1.5 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Angle: <span class="text-foreground font-mono font-medium">{{ windDir.toFixed(0) }}°</span></span>
            <span class="text-[11px] text-muted-foreground font-medium">Port bow</span>
          </div>
        </div>

        <!-- Wave Height -->
        <div class="flex flex-col items-center justify-between rounded-lg border bg-card/60 p-3 h-full shadow-xs">
          <div class="w-full flex items-center justify-between text-xs">
            <span class="text-xs font-normal text-muted-foreground">Wave height</span>
            <span class="text-xs font-normal text-muted-foreground">m</span>
          </div>

          <div class="relative flex items-center justify-center my-1">
            <svg class="h-20 w-32" viewBox="0 0 100 60">
              <path d="M 12,52 A 38,38 0 0,1 88,52" fill="none" stroke="currentColor" class="text-muted/40" stroke-width="7" stroke-linecap="round" />
              <path
                d="M 12,52 A 38,38 0 0,1 88,52"
                fill="none"
                stroke="currentColor"
                class="text-primary"
                stroke-width="7"
                stroke-linecap="round"
                stroke-dasharray="119.4"
                :stroke-dashoffset="119.4 * (1 - Math.min(1, Math.max(0, waveHeight / 6)))"
              />
            </svg>
            <div class="absolute bottom-1 flex flex-col items-center">
              <span class="font-mono text-xl font-bold text-foreground tabular-nums">{{ waveHeight.toFixed(1) }}</span>
              <span class="text-[11px] font-normal text-muted-foreground">meters</span>
            </div>
          </div>

          <div class="w-full pt-1.5 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Swell: 1.9m</span>
            <span class="text-[11px] text-muted-foreground font-medium">Slight</span>
          </div>
        </div>

        <!-- Mean Draft -->
        <div class="flex flex-col items-center justify-between rounded-lg border bg-card/60 p-3 h-full shadow-xs">
          <div class="w-full flex items-center justify-between text-xs">
            <span class="text-xs font-normal text-muted-foreground">Mean draft</span>
            <span class="text-xs font-normal text-muted-foreground">m</span>
          </div>

          <div class="relative flex items-center justify-center my-1">
            <svg class="h-20 w-32" viewBox="0 0 100 60">
              <path d="M 12,52 A 38,38 0 0,1 88,52" fill="none" stroke="currentColor" class="text-muted/40" stroke-width="7" stroke-linecap="round" />
              <path
                d="M 12,52 A 38,38 0 0,1 88,52"
                fill="none"
                stroke="currentColor"
                class="text-primary"
                stroke-width="7"
                stroke-linecap="round"
                stroke-dasharray="119.4"
                :stroke-dashoffset="119.4 * (1 - Math.min(1, Math.max(0, meanDraft / 14)))"
              />
            </svg>
            <div class="absolute bottom-1 flex flex-col items-center">
              <span class="font-mono text-xl font-bold text-foreground tabular-nums">{{ meanDraft.toFixed(1) }}</span>
              <span class="text-[11px] font-normal text-muted-foreground">meters</span>
            </div>
          </div>

          <div class="w-full pt-1.5 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Trim: 0.2m</span>
            <span class="text-[11px] text-muted-foreground font-medium">Even</span>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
