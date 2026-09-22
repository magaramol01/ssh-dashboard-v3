<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { SlidersHorizontal, Activity, Calendar } from 'lucide-vue-next'
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
  mrvData,
} = useVoyageOptimization()

// Map-first: drawer starts closed so the passage map is the clear hero on load
const isDrawerOpen = ref(false)
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
  copilotPanelRef.value?.askPrompt(prompt)
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

const voyageQuickDirectives: QuickDirective[] = [
  {
    label: 'Why did rating drop to D/E?',
    query: 'Analyze the primary factors (heavy weather, propeller slip, speed loss) causing recent CII rating degradation on this voyage.',
  },
  {
    label: 'How to recover Band B?',
    query: 'What speed reduction or RPM adjustment is required to recover IMO Band B trajectory for the remainder of this passage?',
  },
  {
    label: 'Weather Impact on Fuel',
    query: 'Evaluate the added fuel consumption and carbon penalty caused by adverse MetOcean conditions along this route.',
  },
  {
    label: 'Simulate -10% Speed Cut',
    query: 'Simulate a 10% speed reduction and calculate projected CII rating and fuel savings.',
  },
]

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

    <!-- Main Container: 100% Full-Screen Edge-to-Edge Map with Floating Overlays -->
    <div class="relative flex-1 w-full h-full min-h-0 overflow-hidden">
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

      <!-- Floating 5-Tile Advisory KPI HUD (Mounted Over the Map) -->
      <div class="absolute top-3 left-0 right-0 z-20 pointer-events-none">
        <VoyageOptimizationKpiHud />
      </div>

      <!-- Floating Bottom Passage Timeline Scrubber -->
      <div class="absolute bottom-4 left-4 right-4 max-w-4xl mx-auto z-20 pointer-events-auto flex items-center gap-3 p-2 px-3.5 rounded-xl bg-background/92 dark:bg-card/92 backdrop-blur-md border border-border/80 shadow-lg animate-in fade-in slide-in-from-bottom-2">
        <div class="flex items-center gap-2 shrink-0 text-xs font-medium text-muted-foreground pr-1 border-r border-border/70 hidden sm:flex">
          <Calendar class="w-3.5 h-3.5 text-primary" />
          <span>Timeline</span>
          <span class="text-[10px] font-mono px-1 rounded bg-muted text-muted-foreground">{{ dailyNoons.length }}d</span>
        </div>

        <!-- Scrubber Carousel (D1..Dn) -->
        <div class="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-thin py-0.5 min-w-0">
          <button
            v-for="d in dailyNoons"
            :key="d.dayNumber"
            type="button"
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-all shrink-0 border cursor-pointer select-none"
            :class="[
              selectedDay?.dayNumber === d.dayNumber
                ? 'bg-primary text-primary-foreground border-primary shadow-xs ring-1 ring-primary/40'
                : 'bg-muted/50 hover:bg-muted text-foreground border-border/70'
            ]"
            @click="handleSelectDay(d)"
          >
            <span>D{{ d.dayNumber }}</span>
            <span
              class="w-1.5 h-1.5 rounded-full shrink-0"
              :class="selectedDay?.dayNumber === d.dayNumber ? 'bg-white' : ciiDotClass(d.rating)"
            />
            <span class="text-[10px] opacity-75 font-normal">{{ d.sog }}kt</span>
          </button>
        </div>
      </div>

      <!-- Floating Translucent Glass Benchmark Cockpit -->
      <VoyageOptimizationDrawer
        :is-open="isDrawerOpen"
        @close="isDrawerOpen = false"
        @ask-copilot="handleAskCopilot"
      />

      <!-- Operations Copilot Overlay for Voyage Analytics & CII Intelligence -->
      <SentinelCopilotPanel
        ref="copilotPanelRef"
        v-model="isCopilotOpen"
        v-model:fullscreen="isCopilotFullscreen"
        variant="overlay"
        agent="voyage-analytics"
        :title="`${selectedVessel?.name || 'Vessel'} Voyage Analytics Copilot`"
        subtitle="Voyage Performance, CII Trajectory & Speed Advisory"
        badge-text="Analytics"
        :quick-directives="voyageQuickDirectives"
        :active-context="{
          vesselId: Number(effectiveVesselId) || 1,
          vesselName: selectedVessel?.name || 'Vessel',
          voyage: mrvData?.voyage,
        }"
      />
    </div>
  </div>
</template>
