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
  <div class="flex flex-col flex-1 min-h-[calc(100svh-3.5rem)] w-full">
    <!-- Full-Width Sticky Top Header (Spans 100% width cleanly across the page) -->
    <header class="sticky top-14 z-20 w-full h-[72px] flex items-center bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border shadow-xs px-4 md:px-6">
      <VesselHeaderBar
        class="w-full"
        :is-alarms-open="isAlarmsOpen"
        @toggle-alarms="toggleAlarms"
      />
    </header>

    <!-- Main Content Area: Dashboard View + Docked Alarms Sidebar -->
    <div class="flex flex-1 min-w-0">
      <!-- Left Dashboard Content -->
      <div class="flex-1 min-w-0 space-y-6 p-4 md:p-6 pb-12">
        <!-- Vessel Operations Context Strip -->
        <VesselContextStrip />

        <!-- 5-Tile Operational KPI Grid -->
        <VesselKpiStrip />

        <!-- Middle Operations Grid: Map (~60%) + Telemetry Cockpit (~40%) -->
        <div class="grid gap-6 lg:grid-cols-12 items-stretch">
          <div class="lg:col-span-7 flex">
            <VesselVoyageMap class="w-full h-full" />
          </div>
          <div class="lg:col-span-5 flex">
            <VesselRadialCockpit class="w-full h-full" />
          </div>
        </div>

        <!-- Bottom Multi-Graph Analytics Suite -->
        <div class="space-y-6">
          <div class="grid gap-6 lg:grid-cols-12 items-stretch">
            <div class="lg:col-span-7 flex">
              <VesselTelemetryChart class="w-full h-full" />
            </div>
            <div class="lg:col-span-5 flex">
              <VesselCylinderBarChart class="w-full h-full" />
            </div>
          </div>

          <div>
            <VesselDiagnosticsMatrix />
          </div>
        </div>
      </div>

      <!-- Right Alarms Sidebar (Docked neatly below full-width header) -->
      <VesselAlarmsDrawer v-model="isAlarmsOpen" />
    </div>
  </div>
</template>
