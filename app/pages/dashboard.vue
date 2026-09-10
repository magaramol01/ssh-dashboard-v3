<script setup lang="ts">
/**
 * Vessel Dashboard — Real-time maritime operations and telemetry overview.
 * Backed by live SmartShip Hub backend APIs:
 * getShipBySisterGroup, getDashboardState, getWindyMapGeoJson, getMRVLatestData,
 * getSystemConnectivityStatus, and getRechartData.
 */
import VesselHeaderBar from '~/components/vessel/VesselHeaderBar.vue'
import VesselTelemetryCard from '~/components/vessel/VesselTelemetryCard.vue'
import VesselVoyageMap from '~/components/vessel/VesselVoyageMap.vue'
import VesselEngineSection from '~/components/vessel/VesselEngineSection.vue'
import VesselAlarmsDrawer from '~/components/vessel/VesselAlarmsDrawer.vue'

definePageMeta({ middleware: 'require-dispatcher' })
useHead({ title: 'Vessel Dashboard · Smart Ship Hub' })
</script>

<template>
  <div class="flex min-h-[calc(100vh-3.5rem)] w-full flex-col bg-[#141518] text-[#d8d9da] font-sans overflow-x-hidden">
    <!-- Top Vessel Filter & Status Header Bar -->
    <div class="sticky top-0 z-30 bg-[#16171a] p-2 border-b border-[#282a2e]">
      <VesselHeaderBar />
    </div>

    <!-- Main Content Area with RHS Drawer -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Main Dashboard Grid -->
      <main class="flex-1 overflow-y-auto p-2.5 space-y-2.5">
        <!-- Top Row: Telemetry Cards (Left) + Voyage Map (Center) -->
        <div class="flex flex-col lg:flex-row gap-2.5 items-stretch">
          <!-- Left Telemetry Card -->
          <div class="w-full lg:w-[390px] xl:w-[430px] shrink-0 h-[390px]">
            <VesselTelemetryCard />
          </div>

          <!-- Center Voyage Map -->
          <div class="flex-1 h-[390px]">
            <VesselVoyageMap />
          </div>
        </div>

        <!-- Bottom Row: Engine Cylinders, ECharts Timeline Strip, and Operating Data Tables -->
        <div class="w-full">
          <VesselEngineSection />
        </div>
      </main>

      <!-- Right-Hand Side (RHS) Alarms Drawer -->
      <VesselAlarmsDrawer />
    </div>
  </div>
</template>
