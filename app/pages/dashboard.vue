<script setup lang="ts">
/**
 * Vessel Dashboard — Real-time Fleet Operations & Telemetry
 * Aligned 1:1 with the CII Intelligence page (app/pages/emissions.vue)
 * design tokens, card hierarchy, 6-tile KPI grid, and responsive drawer.
 */
import { ref } from 'vue'
import { ChevronLeft } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import VesselHeaderBar from '~/components/vessel/VesselHeaderBar.vue'
import VesselContextStrip from '~/components/vessel/VesselContextStrip.vue'
import VesselKpiStrip from '~/components/vessel/VesselKpiStrip.vue'
import VesselVoyageMap from '~/components/vessel/VesselVoyageMap.vue'
import VesselRadialCockpit from '~/components/vessel/VesselRadialCockpit.vue'
import VesselTelemetryChart from '~/components/vessel/VesselTelemetryChart.vue'
import VesselCylinderBarChart from '~/components/vessel/VesselCylinderBarChart.vue'
import VesselDiagnosticsMatrix from '~/components/vessel/VesselDiagnosticsMatrix.vue'
import VesselAlarmsDrawer from '~/components/vessel/VesselAlarmsDrawer.vue'
import { useVesselDashboard } from '~/composables/useVesselDashboard'

definePageMeta({ middleware: 'require-dispatcher' })
useHead({ title: 'Vessel Operations & Telemetry | Smart Ship Hub' })

const { activeAlarmsCount, criticalAlarmsCount } = useVesselDashboard()
const isAlarmsOpen = ref(true)

function toggleAlarms() {
  isAlarmsOpen.value = !isAlarmsOpen.value
}
</script>

<template>
  <div class="flex flex-1 min-h-[calc(100svh-3.5rem)] w-full">
    <!-- Main Dashboard Area (Naturally resizes beside docked Alarms Sidebar) -->
    <div class="flex-1 min-w-0 space-y-6 p-4 md:p-6 pb-12">
      <!-- Header Controls & Filters (Sticky Bar matching emissions.vue) -->
      <div class="sticky top-14 z-20 -mx-4 md:-mx-6 -mt-4 md:-mt-6 px-4 md:px-6 h-[72px] flex items-center bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border shadow-xs">
        <VesselHeaderBar class="w-full" />
      </div>

      <!-- Vessel Operations Context Strip -->
      <VesselContextStrip />

      <!-- 5-Tile Operational KPI Grid -->
      <VesselKpiStrip />

      <!-- Middle Operations Grid: Map (~60%) + Telemetry Cockpit (~40%) -->
      <div class="grid gap-6 lg:grid-cols-12 items-stretch">
        <div class="lg:col-span-7">
          <VesselVoyageMap />
        </div>
        <div class="lg:col-span-5">
          <VesselRadialCockpit />
        </div>
      </div>

      <!-- Bottom Multi-Graph Analytics Suite -->
      <div class="space-y-6">
        <div class="grid gap-6 lg:grid-cols-12">
          <div class="lg:col-span-7">
            <VesselTelemetryChart />
          </div>
          <div class="lg:col-span-5">
            <VesselCylinderBarChart />
          </div>
        </div>

        <div>
          <VesselDiagnosticsMatrix />
        </div>
      </div>
    </div>

    <!-- Collapsed Sidebar Open Handle (<) -->
    <div
      v-if="!isAlarmsOpen"
      class="sticky top-14 h-[72px] shrink-0 flex items-center border-b border-l border-border bg-background/95 backdrop-blur z-20 px-1.5"
    >
      <Button
        variant="ghost"
        size="icon"
        class="size-9 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer relative rounded-md"
        title="Open Alarms Sidebar (<)"
        @click="toggleAlarms"
      >
        <ChevronLeft class="size-5 text-primary" />
        <span
          v-if="activeAlarmsCount > 0"
          class="absolute top-1.5 right-1.5 size-2 rounded-full"
          :class="criticalAlarmsCount > 0 ? 'bg-rose-500 animate-ping' : 'bg-amber-500'"
        />
      </Button>
    </div>

    <!-- Right Alarms Sidebar (True Sidebar, Closed with >) -->
    <VesselAlarmsDrawer v-model="isAlarmsOpen" />
  </div>
</template>
