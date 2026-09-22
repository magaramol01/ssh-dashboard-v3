<script setup lang="ts">
import { computed } from 'vue'
import {
  Ship,
  Compass,
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  Layers,
  ChevronDown,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useVoyageOptimization } from '~/composables/useVoyageOptimization'

const props = withDefaults(defineProps<{
  isDrawerOpen: boolean
  isCopilotOpen?: boolean
}>(), {
  isCopilotOpen: false,
})

const emit = defineEmits<{
  (e: 'toggle-drawer'): void
  (e: 'toggle-copilot'): void
}>()

const {
  selectedVesselId,
  selectedVessel,
  vesselsList,
  selectedVoyage,
  availableVoyages,
  currentVoyageInfo,
  mrvData,
  activeStrategy,
  isMapLoading,
  isWeatherLoading,
  isCiiLoading,
  isVoyagesLoading,
  setStrategy,
  refreshAll,
  fetchRouteWeather,
  fetchCiiDateRange,
} = useVoyageOptimization()

function formatEta(raw?: string | null): string {
  if (!raw) return '—'
  try {
    const d = new Date(raw)
    if (!isNaN(d.getTime())) {
      const year = d.getUTCFullYear()
      const month = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      const hours = String(d.getUTCHours()).padStart(2, '0')
      const mins = String(d.getUTCMinutes()).padStart(2, '0')
      return `${year}-${month}-${day} ${hours}:${mins} UTC`
    }
  } catch {
    // fallback to raw
  }
  return raw
}

const voyageDetails = computed(() => {
  const voyMeta = currentVoyageInfo.value
  return {
    source: voyMeta?.startPort || mrvData.value?.scr || '—',
    destination: voyMeta?.destinationPort || mrvData.value?.destination || '—',
    voyageNo: selectedVoyage.value || mrvData.value?.voyage || '—',
    eta: formatEta(voyMeta?.etaNextPort || voyMeta?.arrivalTime || mrvData.value?.etanextport),
  }
})

const isRefreshing = computed(() => isMapLoading.value || isWeatherLoading.value || isCiiLoading.value)

async function handleRefresh() {
  await Promise.allSettled([refreshAll(), fetchRouteWeather(), fetchCiiDateRange()])
}
</script>

<template>
  <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 w-full">
    <!-- Left: Vessel Switcher & Voyage Fixture Context -->
    <div class="flex flex-wrap items-center gap-3">
      <!-- Vessel Selector -->
      <div class="flex items-center gap-2">
        <div class="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
          <Ship class="w-4 h-4" />
        </div>
        <div class="w-[200px] sm:w-[220px]">
          <Select v-model="selectedVesselId">
            <SelectTrigger class="h-9 font-medium text-xs sm:text-sm bg-background/80">
              <SelectValue placeholder="Select vessel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="v in vesselsList"
                :key="v.id"
                :value="String(v.id)"
                class="text-xs sm:text-sm"
              >
                {{ v.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>


      <!-- Voyage Selector Dropdown (Running selected by default) -->
      <div class="flex items-center gap-1.5">
        <div class="w-[145px] sm:w-[175px]">
          <Select v-model="selectedVoyage">
            <SelectTrigger class="h-9 font-medium text-xs sm:text-sm bg-background/80">
              <SelectValue :placeholder="selectedVoyage ? `Voy. ${selectedVoyage}` : 'Select voyage'" />
            </SelectTrigger>
            <SelectContent class="max-h-[300px]">
              <SelectItem
                v-for="voy in availableVoyages"
                :key="voy.voyageNumber"
                :value="voy.voyageNumber"
                class="text-xs sm:text-sm cursor-pointer"
              >
                <div class="flex items-center justify-between gap-2 w-full">
                  <span class="font-mono font-semibold">{{ voy.voyageNumber }}</span>
                  <span
                    v-if="voy.isOngoing"
                    class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0"
                  >
                    RUNNING
                  </span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <!-- Voyage Fixture Pills: Route & ETA -->
      <div class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 border border-border/80 text-xs">
        <Badge
          v-if="currentVoyageInfo?.isOngoing"
          variant="outline"
          class="text-[9px] uppercase font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 shrink-0"
        >
          ● Running
        </Badge>
        <span class="font-medium text-foreground flex items-center gap-1.5">
          {{ voyageDetails.source }}
          <ArrowRight class="w-3.5 h-3.5 text-muted-foreground" />
          {{ voyageDetails.destination }}
        </span>
        <span class="text-border">|</span>
        <span class="text-muted-foreground">ETA {{ voyageDetails.eta }}</span>
      </div>
    </div>

    <!-- Right: Actions -->
    <div class="flex items-center gap-2 self-end lg:self-auto overflow-x-auto max-w-full pb-1 lg:pb-0">
      <!-- Copilot Toggle Button -->
      <Button
        variant="outline"
        size="sm"
        class="h-9 px-2.5 sm:px-3 text-xs gap-1.5 font-medium shrink-0 cursor-pointer"
        :class="isCopilotOpen ? 'bg-primary/10 border-primary/40 text-primary font-semibold' : 'text-foreground'"
        title="Toggle Operations Copilot (⌘J)"
        @click="emit('toggle-copilot')"
      >
        <SlidersHorizontal class="w-3.5 h-3.5 text-muted-foreground" />
        <span class="hidden sm:inline">Copilot</span>
        <span class="text-[10px] font-mono opacity-70 border border-current/30 rounded px-1 hidden md:inline">⌘J</span>
      </Button>

      <!-- Refresh Button -->
      <Button
        variant="outline"
        size="sm"
        class="h-9 px-2.5 text-muted-foreground hover:text-foreground shrink-0"
        :disabled="isRefreshing"
        @click="handleRefresh"
      >
        <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isRefreshing }" />
      </Button>

      <!-- Performance Benchmarks Drawer Toggle -->
      <Button
        :variant="isDrawerOpen ? 'default' : 'outline'"
        size="sm"
        class="h-9 px-3 gap-1.5 text-xs font-medium shrink-0 cursor-pointer"
        :title="isDrawerOpen ? 'Hide Benchmarks Drawer' : 'Open Performance Benchmarks Drawer'"
        @click="emit('toggle-drawer')"
      >
        <SlidersHorizontal class="w-3.5 h-3.5" />
        <span class="hidden sm:inline">{{ isDrawerOpen ? 'Hide Drawer' : 'Performance Benchmarks' }}</span>
      </Button>
    </div>
  </div>
</template>
