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
  <Card class="border border-border/50 bg-card shadow-xs flex flex-col h-full min-h-[450px]">
    <CardHeader class="p-4 pb-2">
      <div class="flex items-center justify-between">
        <CardTitle class="text-sm font-semibold flex items-center gap-2">
          <Gauge class="size-4 text-primary" />
          <span>Propulsion Dynamics</span>
        </CardTitle>

        <!-- Pill Switcher -->
        <div class="h-8 flex items-center rounded-lg bg-muted/50 p-1 border border-border/40">
          <button
            type="button"
            class="h-6 rounded-md px-3 text-xs font-medium transition-all cursor-pointer"
            :class="activeTab === 'propulsion' ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'"
            @click="activeTab = 'propulsion'"
          >
            Propulsion
          </button>
          <button
            type="button"
            class="h-6 rounded-md px-3 text-xs font-medium transition-all cursor-pointer"
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
        <div class="flex flex-col items-center justify-between rounded-lg bg-muted/20 hover:bg-muted/30 border border-border/30 p-3 h-full transition-colors">
          <div class="w-full flex items-center justify-between text-xs">
            <span class="font-medium text-muted-foreground">Speed (SOG)</span>
            <span class="text-xs text-muted-foreground font-mono">kn</span>
          </div>

          <!-- Radial Dial -->
          <div class="relative flex items-center justify-center my-1.5">
            <svg class="h-20 w-32" viewBox="0 0 100 60">
              <path d="M 12,52 A 38,38 0 0,1 88,52" fill="none" stroke="currentColor" class="text-muted/30" stroke-width="7" stroke-linecap="round" />
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
            <div class="absolute bottom-0 flex flex-col items-center">
              <span class="font-mono text-xl font-bold text-foreground tabular-nums">{{ speedVal.toFixed(1) }}</span>
              <span class="text-[11px] font-medium text-muted-foreground/75">kn</span>
            </div>
          </div>

          <div class="w-full pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
            <span>STW: <span class="text-foreground font-mono font-medium">{{ stwVal.toFixed(1) }} kn</span></span>
            <span class="text-teal-400 font-medium">Optimal</span>
          </div>
        </div>

        <!-- Meter 2: Engine Load (% MCR) -->
        <div class="flex flex-col items-center justify-between rounded-lg bg-muted/20 hover:bg-muted/30 border border-border/30 p-3 h-full transition-colors">
          <div class="w-full flex items-center justify-between text-xs">
            <span class="font-medium text-muted-foreground">Engine load</span>
            <span class="text-xs text-muted-foreground font-mono">% MCR</span>
          </div>

          <div class="relative flex items-center justify-center my-1.5">
            <svg class="h-20 w-32" viewBox="0 0 100 60">
              <path d="M 12,52 A 38,38 0 0,1 88,52" fill="none" stroke="currentColor" class="text-muted/30" stroke-width="7" stroke-linecap="round" />
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
            <div class="absolute bottom-0 flex flex-col items-center">
              <span class="font-mono text-xl font-bold text-foreground tabular-nums">{{ mcrVal.toFixed(1) }}%</span>
              <span class="text-[11px] font-medium text-muted-foreground/75">MCR</span>
            </div>
          </div>

          <div class="w-full pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
            <span>Zone: <span class="text-teal-400 font-medium">Continuous</span></span>
            <span class="font-mono text-xs text-muted-foreground">Limit: 95%</span>
          </div>
        </div>

        <!-- Meter 3: Shaft RPM -->
        <div class="flex flex-col items-center justify-between rounded-lg bg-muted/20 hover:bg-muted/30 border border-border/30 p-3 h-full transition-colors">
          <div class="w-full flex items-center justify-between text-xs">
            <span class="font-medium text-muted-foreground">Shaft speed</span>
            <span class="text-xs text-muted-foreground font-mono">0–120 rpm</span>
          </div>

          <div class="relative flex items-center justify-center my-1.5">
            <svg class="h-20 w-32" viewBox="0 0 100 60">
              <path d="M 12,52 A 38,38 0 0,1 88,52" fill="none" stroke="currentColor" class="text-muted/30" stroke-width="7" stroke-linecap="round" />
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
            <div class="absolute bottom-0 flex flex-col items-center">
              <span class="font-mono text-xl font-bold text-foreground tabular-nums">{{ rpmVal.toFixed(1) }}</span>
              <span class="text-[11px] font-medium text-muted-foreground/75">rpm</span>
            </div>
          </div>

          <div class="w-full pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
            <span>Torque: <span class="text-foreground font-mono font-medium">{{ torqueVal }} kNm</span></span>
            <span class="text-teal-400 font-medium">Nominal</span>
          </div>
        </div>

        <!-- Meter 4: Fuel Rate -->
        <div class="flex flex-col items-center justify-between rounded-lg bg-muted/20 hover:bg-muted/30 border border-border/30 p-3 h-full transition-colors">
          <div class="w-full flex items-center justify-between text-xs">
            <span class="font-medium text-muted-foreground">Fuel rate</span>
            <span class="text-xs text-muted-foreground font-mono">t/day</span>
          </div>

          <div class="relative flex items-center justify-center my-1.5">
            <svg class="h-20 w-32" viewBox="0 0 100 60">
              <path d="M 12,52 A 38,38 0 0,1 88,52" fill="none" stroke="currentColor" class="text-muted/30" stroke-width="7" stroke-linecap="round" />
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
            <div class="absolute bottom-0 flex flex-col items-center">
              <span class="font-mono text-xl font-bold text-foreground tabular-nums">{{ fuelVal.toFixed(1) }}</span>
              <span class="text-[11px] font-medium text-muted-foreground/75">t/d</span>
            </div>
          </div>

          <div class="w-full pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
            <span>SFOC: <span class="text-foreground font-mono font-medium">168.4 g/kWh</span></span>
            <span class="text-teal-400 font-medium">Economic</span>
          </div>
        </div>
      </div>

      <!-- 4-Meter Grid: Sea State View -->
      <div v-else class="grid grid-cols-2 gap-3 flex-1 items-center">
        <!-- Wind Speed -->
        <div class="flex flex-col items-center justify-between rounded-lg bg-muted/20 hover:bg-muted/30 border border-border/30 p-3 h-full transition-colors">
          <div class="w-full flex items-center justify-between text-xs">
            <span class="font-medium text-muted-foreground">Relative wind speed</span>
            <span class="text-xs text-muted-foreground font-mono">kn</span>
          </div>

          <div class="relative flex items-center justify-center my-1.5">
            <svg class="h-20 w-32" viewBox="0 0 100 60">
              <path d="M 12,52 A 38,38 0 0,1 88,52" fill="none" stroke="currentColor" class="text-muted/30" stroke-width="7" stroke-linecap="round" />
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
            <div class="absolute bottom-0 flex flex-col items-center">
              <span class="font-mono text-xl font-bold text-foreground tabular-nums">{{ windSpeed.toFixed(1) }}</span>
              <span class="text-[11px] font-medium text-muted-foreground/75">kn</span>
            </div>
          </div>

          <div class="w-full pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
            <span>Beaufort 4</span>
            <span class="text-teal-400 font-medium">Moderate</span>
          </div>
        </div>

        <!-- Wind Direction -->
        <div class="flex flex-col items-center justify-between rounded-lg bg-muted/20 hover:bg-muted/30 border border-border/30 p-3 h-full transition-colors">
          <div class="w-full flex items-center justify-between text-xs">
            <span class="font-medium text-muted-foreground">Wind direction</span>
            <span class="text-xs text-muted-foreground font-mono">deg</span>
          </div>

          <div class="relative flex items-center justify-center my-1.5">
            <div class="size-16 rounded-full border border-border/60 bg-muted/30 flex items-center justify-center relative">
              <Compass
                class="size-8 text-primary transition-transform duration-700"
                :style="{ transform: `rotate(${windDir}deg)` }"
              />
            </div>
          </div>

          <div class="w-full pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
            <span>Angle: <span class="text-foreground font-mono font-medium">{{ windDir.toFixed(0) }}°</span></span>
            <span class="text-teal-400 font-medium">Port bow</span>
          </div>
        </div>

        <!-- Wave Height -->
        <div class="flex flex-col items-center justify-between rounded-lg bg-muted/20 hover:bg-muted/30 border border-border/30 p-3 h-full transition-colors">
          <div class="w-full flex items-center justify-between text-xs">
            <span class="font-medium text-muted-foreground">Wave height</span>
            <span class="text-xs text-muted-foreground font-mono">m</span>
          </div>

          <div class="relative flex items-center justify-center my-1.5">
            <svg class="h-20 w-32" viewBox="0 0 100 60">
              <path d="M 12,52 A 38,38 0 0,1 88,52" fill="none" stroke="currentColor" class="text-muted/30" stroke-width="7" stroke-linecap="round" />
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
            <div class="absolute bottom-0 flex flex-col items-center">
              <span class="font-mono text-xl font-bold text-foreground tabular-nums">{{ waveHeight.toFixed(1) }}</span>
              <span class="text-[11px] font-medium text-muted-foreground/75">m</span>
            </div>
          </div>

          <div class="w-full pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
            <span>Swell: 1.9m</span>
            <span class="text-teal-400 font-medium">Slight</span>
          </div>
        </div>

        <!-- Mean Draft -->
        <div class="flex flex-col items-center justify-between rounded-lg bg-muted/20 hover:bg-muted/30 border border-border/30 p-3 h-full transition-colors">
          <div class="w-full flex items-center justify-between text-xs">
            <span class="font-medium text-muted-foreground">Mean draft</span>
            <span class="text-xs text-muted-foreground font-mono">m</span>
          </div>

          <div class="relative flex items-center justify-center my-1.5">
            <svg class="h-20 w-32" viewBox="0 0 100 60">
              <path d="M 12,52 A 38,38 0 0,1 88,52" fill="none" stroke="currentColor" class="text-muted/30" stroke-width="7" stroke-linecap="round" />
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
            <div class="absolute bottom-0 flex flex-col items-center">
              <span class="font-mono text-xl font-bold text-foreground tabular-nums">{{ meanDraft.toFixed(1) }}</span>
              <span class="text-[11px] font-medium text-muted-foreground/75">m</span>
            </div>
          </div>

          <div class="w-full pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
            <span>Trim: 0.2m</span>
            <span class="text-teal-400 font-medium">Even</span>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
