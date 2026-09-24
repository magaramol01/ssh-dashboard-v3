<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  SlidersHorizontal,
  Activity,
  Calendar,
  AlertTriangle,
  Wind,
  Gauge,
  ClipboardCheck,
  TrendingUp,
  Compass,
} from 'lucide-vue-next'
import VoyageOptimizationHeaderBar from '~/components/voyage/VoyageOptimizationHeaderBar.vue'
import VoyageOptimizationKpiHud from '~/components/voyage/VoyageOptimizationKpiHud.vue'
import VoyageOptimizationMap from '~/components/voyage/VoyageOptimizationMap.vue'
import VoyageOptimizationDrawer from '~/components/voyage/VoyageOptimizationDrawer.vue'
import SentinelCopilotPanel, { type QuickDirective } from '~/components/sentinel/SentinelCopilotPanel.vue'
import { useVoyageOptimization } from '~/composables/useVoyageOptimization'

definePageMeta({ middleware: 'require-dispatcher' })
useHead({ title: 'Voyage Analytics & Weather Routing · Smart Ship Hub' })

const {
  fetchVesselsList,
  fetchRouteWeather,
  refreshAll,
  vesselsList,
  dailyNoons,
  selectedDay,
  selectDay,
  selectedVessel,
  effectiveVesselId,
  selectedVoyage,
  currentVoyage,
  currentVoyageInfo,
  mrvData,
} = useVoyageOptimization()

// Map-first: drawer starts closed so the passage map is the clear hero on load
const isDrawerOpen = ref(false)
const isDrawerExpanded = ref(false)
const isCopilotOpen = ref(false)
const isCopilotFullscreen = ref(false)
const copilotPanelRef = ref<any>(null)

function ciiDotClass(rating: string): string {
  switch (rating) {
    case 'A': return 'bg-emerald-400'
    case 'B': return 'bg-teal-400'
    case 'C': return 'bg-amber-400'
    case 'D': return 'bg-orange-500'
    case 'E': return 'bg-rose-500'
    default: return 'bg-muted-foreground'
  }
}

function toggleDrawer() {
  isDrawerOpen.value = !isDrawerOpen.value
}

function toggleCopilot() {
  isCopilotOpen.value = !isCopilotOpen.value
}

function handleSelectDay(day?: any) {
  if (day) selectDay(day)
  isDrawerOpen.value = true
}

function handleAskCopilot(prompt: string) {
  isCopilotOpen.value = true
  nextTick(() => {
    copilotPanelRef.value?.askPrompt(prompt)
  })
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (isCopilotFullscreen.value) {
      isCopilotFullscreen.value = false
      return
    }
    if (isCopilotOpen.value) {
      isCopilotOpen.value = false
    }
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
    e.preventDefault()
    isCopilotOpen.value = !isCopilotOpen.value
  }
}

const voyageQuickDirectives = computed<QuickDirective[]>(() => {
  const vesselName = selectedVessel.value?.name || 'this vessel'
  const noons = dailyNoons.value || []
  const voyNum = selectedVoyage.value || mrvData.value?.voyage || 'active voyage'
  const directives: QuickDirective[] = []

  // 1. Contextual Day Selection (Highest priority if user explicitly clicked a day in the timeline/drawer)
  if (selectedDay.value) {
    const day = selectedDay.value
    const dayRating = day.rating || 'C'
    const isDegraded = dayRating === 'D' || dayRating === 'E'
    directives.push({
      label: `Audit Day ${day.dayNumber} (${isDegraded ? `Degraded ` : ''}Grade ${dayRating})`,
      query: `Analyze Day ${day.dayNumber} performance on ${vesselName}. Why is attained CII ${day.attainedCii} (Grade ${dayRating}) with ${day.sog} kts SOG and ${day.slipPct}% slip in BF ${day.weather?.beaufort || 0} conditions?`,
      icon: isDegraded ? AlertTriangle : Compass,
    })
  }

  // 2. Suspicious / Degraded Days (Grade D or E)
  const degradedDays = noons.filter((d) => d.rating === 'D' || d.rating === 'E')
  if (degradedDays.length > 0) {
    // Pick the most critical day (Grade E prioritized, or highest attained CII)
    const worstDay = degradedDays.reduce((worst, d) => {
      if (d.rating === 'E' && worst.rating !== 'E') return d
      if (d.rating === worst.rating && d.attainedCii > worst.attainedCii) return d
      return worst
    }, degradedDays[0]!)

    if (!selectedDay.value || selectedDay.value.dayNumber !== worstDay.dayNumber) {
      directives.push({
        label: `Why did Day ${worstDay.dayNumber} drop to Grade ${worstDay.rating}?`,
        query: `Analyze why Day ${worstDay.dayNumber} degraded to Grade ${worstDay.rating} on ${vesselName} (attained CII ${worstDay.attainedCii} vs required ${worstDay.requiredCii}). What was the primary root cause?`,
        icon: AlertTriangle,
      })
    }
  }

  // 3. Suspicious / Heavy Weather Days (Beaufort 6+ or Wave >= 2.5m)
  const heavyWeatherDays = noons.filter((d) => (d.weather?.beaufort || 0) >= 6 || (d.weather?.waveHeightM || 0) >= 2.5)
  if (heavyWeatherDays.length > 0) {
    const peakWeather = heavyWeatherDays.reduce((max, d) => {
      return (d.weather?.beaufort || 0) > (max.weather?.beaufort || 0) ? d : max
    }, heavyWeatherDays[0]!)

    directives.push({
      label: `Weather penalty (Day ${peakWeather.dayNumber}: BF ${peakWeather.weather?.beaufort || 6})`,
      query: `Evaluate the added weather fuel penalty and speed loss from BF ${peakWeather.weather?.beaufort || 6} heavy weather on Day ${peakWeather.dayNumber} and across this voyage for ${vesselName}.`,
      icon: Wind,
    })
  } else {
    directives.push({
      label: 'Weather vs Fuel Trend',
      query: `Evaluate the added fuel consumption and carbon penalty caused by MetOcean weather conditions along this route for ${vesselName}.`,
      icon: Wind,
    })
  }

  // 4. Suspicious / High Propeller Slip (Apparent slip >= 12%)
  const highSlipDays = noons.filter((d) => d.slipPct >= 12)
  if (highSlipDays.length > 0) {
    const peakSlip = highSlipDays.reduce((max, d) => (d.slipPct > max.slipPct ? d : max), highSlipDays[0]!)
    directives.push({
      label: `Investigate ${peakSlip.slipPct.toFixed(1)}% slip on Day ${peakSlip.dayNumber}`,
      query: `Investigate the elevated propeller slip of ${peakSlip.slipPct.toFixed(1)}% on Day ${peakSlip.dayNumber} for ${vesselName}. Was it hull/propeller resistance, shallow water effect, or adverse currents?`,
      icon: Gauge,
    })
  } else {
    directives.push({
      label: 'Propulsion & Slip Analysis',
      query: `Analyze apparent propeller slip and engine RPM trends for ${vesselName} to verify propulsion efficiency.`,
      icon: Gauge,
    })
  }

  // 5. Recovery Plan vs Speed Optimization
  if (degradedDays.length > 0 || (noons.length > 0 && noons[noons.length - 1]?.rating !== 'A' && noons[noons.length - 1]?.rating !== 'B')) {
    directives.push({
      label: 'How to recover Band B?',
      query: `What speed reduction or RPM adjustment is required to recover IMO Band B trajectory for the remainder of this passage on ${vesselName}?`,
      icon: TrendingUp,
    })
  } else {
    directives.push({
      label: 'Optimize speed & laycan',
      query: `What is the recommended steaming speed and engine RPM to maintain compliant CII while arriving within the scheduled laycan window for ${vesselName}?`,
      icon: TrendingUp,
    })
  }

  // 6. Chief Engineer Noon Validation Audit
  directives.push({
    label: 'Audit Noon Reports QA',
    query: `Run a Chief Engineer audit on the daily noon reports for ${vesselName} on voyage ${voyNum}. Identify any steaming hour discrepancies, GC distance gaps, or reported fuel balance issues.`,
    icon: ClipboardCheck,
  })

  // Return the top 4 most actionable and suspicious directives
  return directives.slice(0, 4)
})

const voyageCopilotInitialMessage = computed(() => {
  const name = selectedVessel.value?.name || 'this vessel'
  const noons = dailyNoons.value || []
  const degradedCount = noons.filter((d) => d.rating === 'D' || d.rating === 'E').length
  const heavyWeatherCount = noons.filter((d) => (d.weather?.beaufort || 0) >= 6).length

  if (degradedCount > 0) {
    return `Voyage Analytics Copilot ready for ${name}. Detected ${degradedCount} degraded passage day${degradedCount > 1 ? 's' : ''} (Band D/E) on the current voyage. Select a suspicious finding below or ask any question.`
  }
  if (heavyWeatherCount > 0) {
    return `Voyage Analytics Copilot ready for ${name}. Identified ${heavyWeatherCount} heavy weather day${heavyWeatherCount > 1 ? 's' : ''} (Beaufort 6+) along the passage. Select a directive below to review operational impact.`
  }
  return `Voyage Analytics Copilot ready for ${name}. Live voyage telemetry, noon reports, and CII trajectory loaded. Select a directive below or ask any operational question.`
})

onMounted(async () => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeydown)
  }
  await fetchVesselsList()
  await Promise.allSettled([
    refreshAll(),
    fetchRouteWeather(),
  ])
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeydown)
  }
})
</script>

<template>
  <div class="flex flex-col flex-1 h-[calc(100svh-3.5rem)] w-full overflow-hidden bg-background">
    <!-- Header Bar -->
    <header class="relative z-20 w-full min-h-[58px] py-2 px-4 md:px-6 flex items-center bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border shadow-xs shrink-0">
      <VoyageOptimizationHeaderBar
        :is-drawer-open="isDrawerOpen"
        :is-copilot-open="isCopilotOpen"
        @toggle-drawer="toggleDrawer"
        @toggle-copilot="toggleCopilot"
      />
    </header>

    <!-- Main Passage Workspace: Map & Drawer + Docked Copilot Sidebar -->
    <div class="flex flex-1 w-full h-full min-h-0 overflow-hidden">
      <!-- Left: Passage Map Area & Benchmarks Cockpit -->
      <div class="relative flex-1 min-w-0 h-full overflow-hidden">
        <!-- Full-Height Hero Passage Map Canvas -->
        <div class="w-full h-full min-h-0">
          <ClientOnly>
            <VoyageOptimizationMap @select-day="handleSelectDay" />
            <template #fallback>
              <div class="w-full h-full min-h-[500px] flex items-center justify-center bg-muted/40 p-6">
                <div class="space-y-4 w-full max-w-md text-center">
                  <div class="h-10 w-10 mx-auto rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <p class="text-sm font-medium text-muted-foreground">Loading interactive passage map & weather grid...</p>
                  <Skeleton class="h-6 w-3/4 mx-auto" />
                </div>
              </div>
            </template>
          </ClientOnly>
        </div>

        <!-- Floating Map Overlays Layer (Confined to Visible Map Space) -->
        <div
          v-if="!isDrawerOpen || !isDrawerExpanded"
          class="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-3 sm:p-4 transition-all duration-300"
          :class="isDrawerOpen ? 'sm:right-[515px] xl:right-[575px]' : 'right-0'"
        >
          <!-- Top: 5-Tile Advisory KPI HUD -->
          <div class="w-full pointer-events-none">
            <VoyageOptimizationKpiHud />
          </div>

          <!-- Bottom: Passage Timeline Scrubber -->
          <div class="w-full max-w-4xl mx-auto pointer-events-auto flex items-center gap-3 p-2 px-3.5 rounded-xl bg-background/92 dark:bg-card/92 backdrop-blur-md border border-border/80 shadow-lg animate-in fade-in slide-in-from-bottom-2">
            <div class="flex items-center gap-2 shrink-0 text-xs font-medium text-muted-foreground pr-1 border-r border-border/70 hidden sm:flex">
              <Calendar class="w-4 h-4 text-primary" />
              <span class="font-semibold text-foreground">Timeline</span>
              <span class="text-xs font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground">{{ dailyNoons.length }}d</span>
            </div>

            <!-- Scrubber Carousel (D1..Dn) -->
            <div class="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-thin py-0.5 min-w-0">
              <button
                v-for="d in dailyNoons"
                :key="d.dayNumber"
                type="button"
                class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all shrink-0 border cursor-pointer select-none"
                :class="[
                  selectedDay?.dayNumber === d.dayNumber
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs ring-1 ring-primary/40'
                    : 'bg-muted/50 hover:bg-muted text-foreground border-border/70'
                ]"
                @click="handleSelectDay(d)"
              >
                <span>D{{ d.dayNumber }}</span>
                <span
                  class="w-2 h-2 rounded-full shrink-0"
                  :class="selectedDay?.dayNumber === d.dayNumber ? 'bg-white' : ciiDotClass(d.rating)"
                />
                <span class="text-xs opacity-85 font-medium">{{ d.sog }}kt</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Floating Translucent Glass Benchmark Cockpit (Full Screen & Normal Modes) -->
        <VoyageOptimizationDrawer
          :is-open="isDrawerOpen"
          v-model:is-expanded="isDrawerExpanded"
          @close="isDrawerOpen = false"
          @ask-copilot="handleAskCopilot"
        />
      </div>

      <!-- Docked Sidebar: Operations Copilot Intelligence -->
      <SentinelCopilotPanel
        ref="copilotPanelRef"
        v-model="isCopilotOpen"
        v-model:fullscreen="isCopilotFullscreen"
        variant="sidebar"
        agent="voyage-analytics"
        :title="`${selectedVessel?.name || 'Vessel'} Voyage Analytics Copilot`"
        subtitle="Voyage Performance, CII Trajectory & Speed Advisory"
        badge-text="Analytics"
        :quick-directives="voyageQuickDirectives"
        :initial-message="voyageCopilotInitialMessage"
        :active-context="{
          vesselId: Number(effectiveVesselId) || 1,
          vesselName: selectedVessel?.name || 'Vessel',
          voyage: selectedVoyage || mrvData?.voyage,
          selectedDayNumber: selectedDay?.dayNumber,
        }"
      />
    </div>
  </div>
</template>
