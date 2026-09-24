<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
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
  Sparkles,
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
  kpiSummary,
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

const heuristicDirectives = computed<QuickDirective[]>(() => {
  const vesselName = selectedVessel.value?.name || 'this vessel'
  const noons = dailyNoons.value || []
  const kpi = kpiSummary.value
  const directives: QuickDirective[] = []

  // 1. Contextual Day Selection (Highest priority if user explicitly clicked a day in the timeline/drawer/map)
  if (selectedDay.value) {
    const day = selectedDay.value
    const dayRating = day.rating || 'C'
    const isDegraded = dayRating === 'D' || dayRating === 'E'
    const bf = Math.min(12, day.weather?.beaufort || 0)
    directives.push({
      label: `Audit Day ${day.dayNumber} (${isDegraded ? 'Degraded ' : ''}Grade ${dayRating})`,
      query: `Analyze Day ${day.dayNumber} performance on ${vesselName}. Why is attained CII ${day.attainedCii} (Grade ${dayRating}) with ${day.sog} kts SOG and ${day.slipPct}% slip in BF ${bf} conditions?`,
      icon: isDegraded ? AlertTriangle : Compass,
    })
  }

  // 2. Real Degraded Days from the current active passage (Grade D or E)
  const degradedDays = noons.filter((d) => d.rating === 'D' || d.rating === 'E')
  if (degradedDays.length > 0) {
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

  // 3. Screen HUD Weather Alert or Heavy Weather Encounters
  if (kpi?.weatherAlertHeadline && kpi.weatherAlertHeadline !== 'Favorable passage weather') {
    directives.push({
      label: `Weather Ahead (${kpi.weatherAlertSubtext?.slice(0, 22) || 'Adverse Sea State'})`,
      query: `Evaluate the operational impact and added fuel penalty of ${kpi.weatherAlertHeadline} (${kpi.weatherAlertSubtext || ''}) on ${vesselName}.`,
      icon: Wind,
    })
  } else {
    const heavyWeatherDays = noons.filter((d) => (d.weather?.beaufort || 0) >= 6 || (d.weather?.waveHeightM || 0) >= 2.5)
    if (heavyWeatherDays.length > 0) {
      const peakWeather = heavyWeatherDays.reduce((max, d) => {
        return (d.weather?.beaufort || 0) > (max.weather?.beaufort || 0) ? d : max
      }, heavyWeatherDays[0]!)
      const bf = Math.min(12, peakWeather.weather?.beaufort || 6)

      directives.push({
        label: `Weather penalty (Day ${peakWeather.dayNumber}: BF ${bf})`,
        query: `Evaluate the added weather fuel penalty and speed loss from BF ${bf} conditions on Day ${peakWeather.dayNumber} and across this voyage for ${vesselName}.`,
        icon: Wind,
      })
    } else {
      directives.push({
        label: 'Weather vs Fuel Trend',
        query: `Evaluate the added fuel consumption and carbon penalty caused by MetOcean weather conditions along this route for ${vesselName}.`,
        icon: Wind,
      })
    }
  }

  // 4. Screen HUD Speed Advisory & Laycan Buffer
  if (kpi?.recommendedSpeedKts != null && kpi.laycanBufferHours != null) {
    directives.push({
      label: `Speed ${kpi.recommendedSpeedKts} kts vs Laycan (+${kpi.laycanBufferHours}h)`,
      query: `Evaluate whether cruising speed of ${kpi.recommendedSpeedKts} kts on ${vesselName} can be optimized while preserving the +${kpi.laycanBufferHours}h charter laycan arrival window.`,
      icon: TrendingUp,
    })
  } else {
    const highSlipDays = noons.filter((d) => d.slipPct >= 12)
    if (highSlipDays.length > 0) {
      const peakSlip = highSlipDays.reduce((max, d) => (d.slipPct > max.slipPct ? d : max), highSlipDays[0]!)
      directives.push({
        label: `Investigate ${peakSlip.slipPct.toFixed(1)}% slip on Day ${peakSlip.dayNumber}`,
        query: `Investigate the elevated propeller slip of ${peakSlip.slipPct.toFixed(1)}% on Day ${peakSlip.dayNumber} for ${vesselName}.`,
        icon: Gauge,
      })
    } else {
      directives.push({
        label: 'Propulsion & Slip Analysis',
        query: `Analyze apparent propeller slip and engine RPM trends for ${vesselName} to verify propulsion efficiency.`,
        icon: Gauge,
      })
    }
  }

  // 5. Screen HUD CII Trajectory Target Recovery / Optimization
  if (kpi?.attainedCii != null && kpi.requiredCii != null) {
    const margin = kpi.ciiMarginPct != null ? `${kpi.ciiMarginPct > 0 ? '+' : ''}${kpi.ciiMarginPct}%` : ''
    directives.push({
      label: `Maintain Band B (${kpi.attainedCii} vs ${kpi.requiredCii} Req)`,
      query: `What adjustments to steaming speed and engine RPM are recommended to maintain compliant IMO Band B trajectory (${kpi.attainedCii} attained vs ${kpi.requiredCii} required, ${margin} margin) on ${vesselName}?`,
      icon: TrendingUp,
    })
  } else if (degradedDays.length > 0) {
    directives.push({
      label: 'How to recover Band B?',
      query: `What speed reduction or RPM adjustment is required to recover IMO Band B trajectory for the remainder of this passage on ${vesselName}?`,
      icon: TrendingUp,
    })
  }

  return directives.slice(0, 4)
})

const aiDirectives = ref<QuickDirective[]>([])
const loadingAiDirectives = ref(false)
let directivesAbortController: AbortController | null = null

const voyageQuickDirectives = computed<QuickDirective[]>(() => {
  if (aiDirectives.value.length > 0) {
    return aiDirectives.value
  }
  return heuristicDirectives.value
})

async function fetchAiQuestions(_force = false) {
  if (directivesAbortController) {
    directivesAbortController.abort()
  }
  directivesAbortController = new AbortController()

  const vessel = selectedVessel.value
  const noons = dailyNoons.value || []
  const voyNum = selectedVoyage.value || mrvData.value?.voyage || 'active voyage'
  const kpi = kpiSummary.value

  const degradedDays = noons
    .filter((d) => d.rating === 'D' || d.rating === 'E')
    .map((d) => ({
      dayNumber: d.dayNumber,
      rating: d.rating,
      attainedCii: d.attainedCii,
      requiredCii: d.requiredCii,
      sog: d.sog,
      slipPct: d.slipPct,
      weather: d.weather
        ? {
            beaufort: Math.min(12, d.weather.beaufort || 0),
            waveHeightM: d.weather.waveHeightM,
          }
        : undefined,
    }))

  const heavyWeatherDays = noons
    .filter((d) => (d.weather?.beaufort || 0) >= 6 || (d.weather?.waveHeightM || 0) >= 2.5)
    .map((d) => ({
      dayNumber: d.dayNumber,
      beaufort: Math.min(12, d.weather?.beaufort || 6),
      waveHeightM: d.weather?.waveHeightM,
    }))

  const highSlipDays = noons
    .filter((d) => d.slipPct >= 12)
    .map((d) => ({
      dayNumber: d.dayNumber,
      slipPct: d.slipPct,
    }))

  const selected = selectedDay.value
    ? {
        dayNumber: selectedDay.value.dayNumber,
        date: selectedDay.value.dateIso,
        rating: selectedDay.value.rating,
        attainedCii: selectedDay.value.attainedCii,
        requiredCii: selectedDay.value.requiredCii,
        sog: selectedDay.value.sog,
        slipPct: selectedDay.value.slipPct,
        weather: selectedDay.value.weather
          ? {
              beaufort: Math.min(12, selectedDay.value.weather.beaufort || 0),
              waveHeightM: selectedDay.value.weather.waveHeightM,
              windSpeedKts: selectedDay.value.weather.windSpeedKts,
            }
          : undefined,
      }
    : undefined

  const hudData = kpi
    ? {
        attainedCii: kpi.attainedCii,
        requiredCii: kpi.requiredCii,
        rating: kpi.attainedRating,
        ciiMarginPct: kpi.ciiMarginPct,
        speedKts: kpi.recommendedSpeedKts,
        weatherAlertHeadline: kpi.weatherAlertHeadline,
        weatherAlertSubtext: kpi.weatherAlertSubtext,
        weatherRiskLevel: kpi.weatherRiskLevel,
        laycanBufferHours: kpi.laycanBufferHours,
        carbonSavingsEur: kpi.carbonSavingsEur,
      }
    : undefined

  loadingAiDirectives.value = true
  try {
    const res = await $fetch<{ questions: Array<{ label: string; query: string; category?: string }>; source: string }>(
      '/api/sentinel/suggested-questions',
      {
        method: 'POST',
        body: {
          vesselId: vessel?.id,
          vesselName: vessel?.name,
          voyage: voyNum,
          originPort: currentVoyageInfo.value?.startPort || mrvData.value?.scr,
          destinationPort: currentVoyageInfo.value?.destinationPort || mrvData.value?.destination,
          hud: hudData,
          selectedDay: selected,
          degradedDays,
          heavyWeatherDays,
          highSlipDays,
          totalDays: noons.length,
        },
        signal: directivesAbortController.signal,
      }
    )

    if (res?.questions?.length) {
      aiDirectives.value = res.questions.map((q) => {
        let icon: any = Sparkles
        if (q.category === 'degradation') icon = AlertTriangle
        else if (q.category === 'weather') icon = Wind
        else if (q.category === 'slip') icon = Gauge
        else if (q.category === 'recovery') icon = TrendingUp
        else if (q.category === 'audit') icon = ClipboardCheck
        return {
          label: q.label,
          query: q.query,
          icon,
        }
      })
    }
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      console.warn('Could not fetch AI questions, using heuristic directives:', err)
    }
  } finally {
    loadingAiDirectives.value = false
  }
}

watch(
  [() => selectedVessel.value?.id, () => selectedVoyage.value, () => selectedDay.value?.dayNumber, () => dailyNoons.value.length],
  () => {
    aiDirectives.value = []
    fetchAiQuestions()
  }
)

const voyageCopilotInitialMessage = computed(() => {
  const name = selectedVessel.value?.name || 'this vessel'
  const noons = dailyNoons.value || []
  const kpi = kpiSummary.value
  const degradedDays = noons.filter((d) => d.rating === 'D' || d.rating === 'E')

  if (degradedDays.length > 0) {
    const worst = degradedDays[0]!
    return `Voyage Analytics Copilot ready for ${name}. Detected Day ${worst.dayNumber} (Grade ${worst.rating}) on the active passage. Select a directive below or ask any question to inspect performance.`
  }
  if (kpi?.weatherRiskLevel === 'high') {
    return `Voyage Analytics Copilot ready for ${name}. ${kpi.weatherAlertHeadline} (${kpi.weatherAlertSubtext || ''}) identified along route. Select a directive below to review operational impact.`
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
  fetchAiQuestions()
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
        :loading-directives="loadingAiDirectives"
        @refresh-directives="() => fetchAiQuestions(true)"
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
