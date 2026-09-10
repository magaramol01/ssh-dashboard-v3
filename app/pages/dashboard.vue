<script setup lang="ts">
/**
 * Vessel Dashboard — Executive Operations Center (SmartShip Hub)
 * Built from scratch with KPI summary strip, Leaflet high-def voyage map,
 * radial telemetry cockpit, and multi-graph analytics suite.
 */
import { ref } from 'vue'
import VesselHeaderBar from '~/components/vessel/VesselHeaderBar.vue'
import VesselKpiStrip from '~/components/vessel/VesselKpiStrip.vue'
import VesselVoyageMap from '~/components/vessel/VesselVoyageMap.vue'
import VesselRadialCockpit from '~/components/vessel/VesselRadialCockpit.vue'
import VesselTelemetryChart from '~/components/vessel/VesselTelemetryChart.vue'
import VesselCylinderBarChart from '~/components/vessel/VesselCylinderBarChart.vue'
import VesselDiagnosticsMatrix from '~/components/vessel/VesselDiagnosticsMatrix.vue'
import VesselAlarmsDrawer from '~/components/vessel/VesselAlarmsDrawer.vue'

definePageMeta({ middleware: 'require-dispatcher' })
useHead({ title: 'Vessel Dashboard · Smart Ship Hub' })

const isAlarmsOpen = ref(true)

function toggleAlarms() {
  isAlarmsOpen.value = !isAlarmsOpen.value
}
</script>

<template>
  <div class="flex min-h-[calc(100vh-3.5rem)] w-full flex-col bg-[#0d0e12] text-slate-200 font-sans overflow-x-hidden">
    <!-- Top Vessel Filter & Status Header Bar -->
    <div class="sticky top-0 z-30 bg-[#121318]/90 backdrop-blur-md px-3.5 py-2 border-b border-[#262833]">
      <VesselHeaderBar />
    </div>

    <!-- Main Content Area with RHS Drawer -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Main Dashboard Scrollable Canvas -->
      <main class="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        <!-- Tier 1: Executive KPI Strip -->
        <section>
          <VesselKpiStrip @toggle-alarms="toggleAlarms" />
        </section>

        <!-- Tier 2: Middle Split (Leaflet Map ~60% + Radial Cockpit ~40%) -->
        <section class="grid grid-cols-1 xl:grid-cols-12 gap-3.5 items-stretch">
          <!-- Left: High-Definition Voyage Map (7 cols) -->
          <div class="xl:col-span-7 h-[420px] rounded-xl overflow-hidden">
            <VesselVoyageMap />
          </div>

          <!-- Right: Radial Telemetry Cockpit (5 cols) -->
          <div class="xl:col-span-5 h-[420px]">
            <VesselRadialCockpit />
          </div>
        </section>

        <!-- Tier 3: Bottom Multi-Graph Analytics Suite -->
        <section class="space-y-3.5">
          <!-- Graphs Grid: 24h Timeline Chart (7 cols) + Cylinder Exhaust Bar (5 cols) -->
          <div class="grid grid-cols-1 xl:grid-cols-12 gap-3.5">
            <div class="xl:col-span-7">
              <VesselTelemetryChart />
            </div>
            <div class="xl:col-span-5">
              <VesselCylinderBarChart />
            </div>
          </div>

          <!-- Diagnostics Matrix (Full Width Tabbed Subsystems) -->
          <div>
            <VesselDiagnosticsMatrix />
          </div>
        </section>
      </main>

      <!-- Tier 4: Right-Hand Side (RHS) Sliding Alarms Command Rail -->
      <VesselAlarmsDrawer v-model:open="isAlarmsOpen" />
    </div>
  </div>
</template>
