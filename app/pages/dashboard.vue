<script setup lang="ts">
/**
 * Vessel Dashboard — Real-time maritime operations and telemetry overview.
 * Backed by live SmartShip Hub APIs: getShipBySisterGroup, getDashboardState,
 * getWindyMapGeoJson, getMRVLatestData, getSystemConnectivityStatus, and getRechartData.
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
  <div class="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background text-foreground">
    <!-- Top Header & Vessel Selector -->
    <div class="sticky top-0 z-30 border-b border-border/40 bg-background/90 p-3 backdrop-blur-md">
      <VesselHeaderBar />
    </div>

    <!-- Main Content Area with RHS Drawer -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Main Vessel Operations Canvas -->
      <main class="flex-1 overflow-y-auto p-3 md:p-4 space-y-4">
        <!-- Top Half: Telemetry Left (35%) + Voyage Map Right (65%) -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <div class="lg:col-span-4 h-full min-h-[360px]">
            <VesselTelemetryCard />
          </div>
          <div class="lg:col-span-8 h-full min-h-[360px]">
            <VesselVoyageMap />
          </div>
        </div>

        <!-- Bottom Half: Main Engine / Auxiliaries Section with Gauges & Timeline -->
        <div class="w-full">
          <VesselEngineSection />
        </div>
      </main>

      <!-- Right-Hand Side (RHS) Alarms Drawer -->
      <VesselAlarmsDrawer />
    </div>
  </div>
</template>
