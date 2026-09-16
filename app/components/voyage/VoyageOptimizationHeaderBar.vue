<script setup lang="ts">
import { computed } from 'vue'
import {
  Ship,
  Compass,
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  Leaf,
  ShieldAlert,
  Zap,
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

const props = defineProps<{
  isDrawerOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-drawer'): void
}>()

const {
  selectedVesselId,
  selectedVessel,
  vesselsList,
  mrvData,
  activeStrategy,
  isMapLoading,
  isWeatherLoading,
  setStrategy,
  refreshAll,
  fetchRouteWeather,
} = useVoyageOptimization()

const voyageDetails = computed(() => {
  return {
    source: mrvData.value?.scr || 'PECLL',
    destination: mrvData.value?.destination || 'CNNDE',
    voyageNo: mrvData.value?.voyage || '2604',
    eta: mrvData.value?.etanextport || '2026-09-24 14:00 UTC',
  }
})

const isRefreshing = computed(() => isMapLoading.value || isWeatherLoading.value)

async function handleRefresh() {
  await Promise.allSettled([refreshAll(), fetchRouteWeather()])
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

      <!-- Voyage Fixture Pills -->
      <div class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/60 border border-border/80 text-xs">
        <span class="font-mono font-semibold text-muted-foreground">Voy. {{ voyageDetails.voyageNo }}</span>
        <span class="text-border">|</span>
        <span class="font-medium text-foreground flex items-center gap-1.5">
          {{ voyageDetails.source }}
          <ArrowRight class="w-3.5 h-3.5 text-muted-foreground" />
          {{ voyageDetails.destination }}
        </span>
        <span class="text-border">|</span>
        <span class="text-muted-foreground">ETA {{ voyageDetails.eta }}</span>
      </div>
    </div>

    <!-- Right: Strategy Selector Tabs & Actions -->
    <div class="flex items-center gap-2 self-end lg:self-auto overflow-x-auto max-w-full pb-1 lg:pb-0">
      <!-- Route Strategy Pill Buttons -->
      <div class="flex items-center rounded-lg bg-muted/70 p-1 border border-border/70 text-xs shrink-0">
        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all font-medium"
          :class="activeStrategy === 'current' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'"
          @click="setStrategy('current')"
        >
          <Compass class="w-3.5 h-3.5 text-blue-500" />
          <span>Current</span>
        </button>

        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all font-medium"
          :class="activeStrategy === 'lowest-fuel' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'"
          @click="setStrategy('lowest-fuel')"
        >
          <Leaf class="w-3.5 h-3.5 text-emerald-500" />
          <span>Lowest Fuel</span>
          <span class="text-[10px] px-1 py-0.2 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded font-semibold">-19%</span>
        </button>

        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all font-medium"
          :class="activeStrategy === 'safest' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'"
          @click="setStrategy('safest')"
        >
          <ShieldAlert class="w-3.5 h-3.5 text-cyan-500" />
          <span>Safest</span>
        </button>

        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all font-medium"
          :class="activeStrategy === 'fastest' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'"
          @click="setStrategy('fastest')"
        >
          <Zap class="w-3.5 h-3.5 text-violet-500" />
          <span>Fastest</span>
        </button>
      </div>

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

      <!-- Inspector Drawer Toggle -->
      <Button
        variant="default"
        size="sm"
        class="h-9 px-3 gap-1.5 text-xs font-medium shrink-0"
        @click="emit('toggle-drawer')"
      >
        <SlidersHorizontal class="w-3.5 h-3.5" />
        <span class="hidden sm:inline">{{ isDrawerOpen ? 'Close Drawer' : 'Advisory Drawer' }}</span>
      </Button>
    </div>
  </div>
</template>
