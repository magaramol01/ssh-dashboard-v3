<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Skeleton } from '@/components/ui/skeleton'
import VoyageOptimizationHeaderBar from '~/components/voyage/VoyageOptimizationHeaderBar.vue'
import VoyageOptimizationKpiHud from '~/components/voyage/VoyageOptimizationKpiHud.vue'
import VoyageOptimizationMap from '~/components/voyage/VoyageOptimizationMap.vue'
import VoyageOptimizationDrawer from '~/components/voyage/VoyageOptimizationDrawer.vue'
import SentinelCopilotPanel, { type QuickDirective } from '~/components/sentinel/SentinelCopilotPanel.vue'
import { useVoyageOptimization } from '~/composables/useVoyageOptimization'

definePageMeta({ middleware: 'require-dispatcher' })
useHead({ title: 'Voyage Optimization & Weather Routing · Smart Ship Hub' })

const {
  fetchVesselsList,
  fetchRouteWeather,
  refreshAll,
  vesselsList,
  selectedDay,
  selectedVessel,
  effectiveVesselId,
  mrvData,
} = useVoyageOptimization()

const isDrawerOpen = ref(true)
const isCopilotOpen = ref(false)
const isCopilotFullscreen = ref(false)
const copilotPanelRef = ref<any>(null)

function toggleDrawer() {
  isDrawerOpen.value = !isDrawerOpen.value
}

function toggleCopilot() {
  isCopilotOpen.value = !isCopilotOpen.value
}

function handleSelectDay() {
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

    <!-- Map Canvas Hero Area with Floating HUD and Right Inspection Drawer -->
    <div class="relative flex-1 flex w-full h-full min-h-0 overflow-hidden">
      <!-- Main Interactive Leaflet Map Hero Canvas -->
      <div class="relative flex-1 w-full h-full min-w-0 flex flex-col">
        <!-- Floating 5-Tile Advisory KPI HUD (Mounted Over the Map) -->
        <div class="absolute top-3 left-0 right-0 z-20 pointer-events-none">
          <VoyageOptimizationKpiHud />
        </div>

        <!-- Client-Only Interactive Leaflet Map -->
        <div class="flex-1 w-full h-full min-h-0">
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
      </div>

      <!-- Slide-Out Right Inspection Drawer -->
      <VoyageOptimizationDrawer
        :is-open="isDrawerOpen"
        @close="isDrawerOpen = false"
        @ask-copilot="handleAskCopilot"
      />

      <!-- Operations Copilot Sidebar for Voyage & CII Intelligence -->
      <SentinelCopilotPanel
        ref="copilotPanelRef"
        v-model="isCopilotOpen"
        v-model:fullscreen="isCopilotFullscreen"
        variant="sidebar"
        agent="voyage"
        :title="`${selectedVessel?.name || 'Vessel'} Operations Copilot`"
        subtitle="Voyage Performance & Carbon Intensity Advisory"
        badge-text="Operations"
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
