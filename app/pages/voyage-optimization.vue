<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Skeleton } from '@/components/ui/skeleton'
import VoyageOptimizationHeaderBar from '~/components/voyage/VoyageOptimizationHeaderBar.vue'
import VoyageOptimizationKpiHud from '~/components/voyage/VoyageOptimizationKpiHud.vue'
import VoyageOptimizationMap from '~/components/voyage/VoyageOptimizationMap.vue'
import VoyageOptimizationDrawer from '~/components/voyage/VoyageOptimizationDrawer.vue'
import { useVoyageOptimization } from '~/composables/useVoyageOptimization'

definePageMeta({ middleware: 'require-dispatcher' })
useHead({ title: 'Voyage Optimization & Weather Routing · Smart Ship Hub' })

const {
  fetchVesselsList,
  fetchRouteWeather,
  refreshAll,
  vesselsList,
  selectedDay,
} = useVoyageOptimization()

const isDrawerOpen = ref(true)

function toggleDrawer() {
  isDrawerOpen.value = !isDrawerOpen.value
}

function handleSelectDay() {
  isDrawerOpen.value = true
}

onMounted(async () => {
  await fetchVesselsList()
  await Promise.allSettled([
    refreshAll(),
    fetchRouteWeather(),
  ])
})
</script>

<template>
  <div class="flex flex-col flex-1 h-[calc(100svh-3.5rem)] w-full overflow-hidden bg-background">
    <!-- Header Bar -->
    <header class="relative z-20 w-full min-h-[58px] py-2 px-4 md:px-6 flex items-center bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border shadow-xs shrink-0">
      <VoyageOptimizationHeaderBar
        :is-drawer-open="isDrawerOpen"
        @toggle-drawer="toggleDrawer"
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
      />
    </div>
  </div>
</template>
