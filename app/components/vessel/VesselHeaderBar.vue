<script setup lang="ts">
import { computed } from 'vue'
import {
  Gauge,
  RefreshCw,
  Bell,
  Radio,
} from 'lucide-vue-next'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useVesselDashboard } from '~/composables/useVesselDashboard'

const emit = defineEmits<{
  (e: 'toggle-alarms'): void
}>()

const {
  selectedVesselId,
  selectedSisterGroup,
  sisterGroups,
  filteredVessels,
  selectedVessel,
  connectivity,
  isLoading,
  refreshAll,
} = useVesselDashboard()

const isOnline = computed(() => connectivity.value?.status !== false && connectivity.value?.code !== 'red')
</script>

<template>
  <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <!-- Title & Icon (Matches CII page header) -->
    <div class="flex items-center gap-2.5">
      <div class="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
        <Gauge class="size-5" />
      </div>
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-xl font-bold tracking-tight text-foreground">
            {{ selectedVessel?.name || 'Vessel' }} Operations
          </h1>
          <Badge variant="outline" class="text-[10px] font-semibold border-primary/30 text-primary">
            Live Telemetry
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground">
          Real-time propulsion telemetry, 24h operational trends, and machinery diagnostics
        </p>
      </div>
    </div>

    <!-- Controls Bar (Matches CII page controls) -->
    <div class="flex flex-wrap items-center gap-2.5">
      <!-- Sister Group Select -->
      <div class="w-[140px]">
        <Select v-model="selectedSisterGroup">
          <SelectTrigger class="h-8 text-xs font-medium">
            <SelectValue placeholder="Sister Group" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="group in sisterGroups"
              :key="group"
              :value="group"
              class="text-xs cursor-pointer"
            >
              {{ group }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Vessel Select -->
      <div class="w-[180px]">
        <Select v-model="selectedVesselId">
          <SelectTrigger class="h-8 text-xs font-medium">
            <SelectValue placeholder="Select Vessel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="v in filteredVessels"
              :key="v.id"
              :value="String(v.id)"
              class="text-xs cursor-pointer"
            >
              {{ v.name }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Refresh Button -->
      <Button
        variant="outline"
        size="sm"
        class="h-8 text-xs gap-1.5 cursor-pointer"
        :disabled="isLoading"
        @click="refreshAll"
      >
        <RefreshCw class="size-3.5" :class="{ 'animate-spin': isLoading }" />
        <span>Refresh</span>
      </Button>

      <!-- Alarms Drawer Toggle Button -->
      <Button
        variant="outline"
        size="sm"
        class="h-8 text-xs gap-1.5 cursor-pointer border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
        @click="emit('toggle-alarms')"
      >
        <Bell class="size-3.5" />
        <span>Alarms</span>
        <span class="rounded-full bg-amber-500/20 px-1 py-0.2 text-[9px] font-bold text-amber-500">
          14
        </span>
      </Button>
    </div>
  </div>
</template>
