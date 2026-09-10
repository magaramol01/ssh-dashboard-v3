<script setup lang="ts">
/**
 * Vessel Dashboard — Real-time Fleet Operations & Telemetry
 * Aligned 1:1 with the CII Intelligence page (app/pages/emissions.vue)
 * design tokens, card hierarchy, 6-tile KPI grid, and responsive drawer.
 */
import { ref } from 'vue'
import VesselHeaderBar from '~/components/vessel/VesselHeaderBar.vue'
import VesselContextStrip from '~/components/vessel/VesselContextStrip.vue'
import VesselKpiStrip from '~/components/vessel/VesselKpiStrip.vue'
import VesselVoyageMap from '~/components/vessel/VesselVoyageMap.vue'
import VesselRadialCockpit from '~/components/vessel/VesselRadialCockpit.vue'
import VesselTelemetryChart from '~/components/vessel/VesselTelemetryChart.vue'
import VesselCylinderBarChart from '~/components/vessel/VesselCylinderBarChart.vue'
import VesselDiagnosticsMatrix from '~/components/vessel/VesselDiagnosticsMatrix.vue'
import VesselAlarmsDrawer from '~/components/vessel/VesselAlarmsDrawer.vue'

definePageMeta({ middleware: 'require-dispatcher' })
useHead({ title: 'Vessel Operations & Telemetry | Smart Ship Hub' })

const isAlarmsOpen = ref(false)

function toggleAlarms() {
  isAlarmsOpen.value = !isAlarmsOpen.value
}
</script>

<template>
  <div class="flex flex-1 min-h-[calc(100svh-3.5rem)] w-full relative">
    <!-- Main Dashboard Area (Contracts smoothly when Alarms Rail is docked) -->
    <div
      :class="[
        'flex-1 min-w-0 space-y-6 p-4 md:p-6 pb-12 transition-[margin] duration-350 ease-[cubic-bezier(0.16,1,0.3,1)]',
        isAlarmsOpen ? 'lg:mr-[360px] xl:mr-[380px]' : ''
      ]"
    >
      <!-- Header Controls & Filters (Sticky Bar matching emissions.vue) -->
      <div class="sticky top-14 z-20 -mx-4 md:-mx-6 -mt-4 md:-mt-6 px-4 md:px-6 py-3.5 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border shadow-xs">
        <VesselHeaderBar @toggle-alarms="toggleAlarms" />
      </div>

      <!-- Vessel Operations Context Strip -->
      <VesselContextStrip />

      <!-- 6-Tile Operational KPI Grid -->
      <VesselKpiStrip @toggle-alarms="toggleAlarms" />

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

    <!-- Sliding Alarms Rail (Matching Copilot Drawer Docking) -->
    <VesselAlarmsDrawer v-model="isAlarmsOpen" />
  </div>
</template>
