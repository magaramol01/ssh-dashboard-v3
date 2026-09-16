<script setup lang="ts">
import { computed } from 'vue'
import {
  Gauge,
  RefreshCw,
  Bell,
  PanelRightClose,
  PanelRightOpen,
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

const props = withDefaults(
  defineProps<{
    isAlarmsOpen?: boolean
  }>(),
  {
    isAlarmsOpen: true,
  }
)

const emit = defineEmits<{
  (e: 'toggleAlarms'): void
}>()

const {
  selectedVesselId,
  selectedSisterGroup,
  sisterGroups,
  filteredVessels,
  selectedVessel,
  activeAlarmsCount,
  criticalAlarmsCount,
  isLoading,
  refreshAll,
} = useVesselDashboard()
</script>

<template>
  <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between w-full">
    <!-- Title & Icon -->
    <div class="flex items-center gap-3">
      <div class="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
        <Gauge class="size-5" />
      </div>
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-xl font-bold tracking-tight text-foreground">
            {{ selectedVessel?.name || 'Avery Point' }} Operations
          </h1>
          <Badge variant="outline" class="text-xs font-semibold border-emerald-500/30 text-emerald-400 bg-emerald-500/10 flex items-center gap-1.5 px-2 py-0.5">
            <span class="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Telemetry
          </Badge>
        </div>
      </div>
    </div>

    <!-- Controls Bar -->
    <div class="flex flex-wrap items-center gap-2">
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
        class="h-8 text-xs gap-1.5 cursor-pointer px-3"
        :disabled="isLoading"
        @click="refreshAll"
      >
        <RefreshCw class="size-3.5" :class="{ 'animate-spin': isLoading }" />
        <span>Refresh</span>
      </Button>

      <!-- Toggle Alert Rail Button -->
      <Button
        variant="outline"
        size="sm"
        class="h-8 text-xs gap-1.5 cursor-pointer px-3 transition-colors"
        :class="props.isAlarmsOpen ? 'border-primary/40 bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'"
        :title="props.isAlarmsOpen ? 'Collapse Alert Rail' : 'Expand Alert Rail'"
        @click="emit('toggleAlarms')"
      >
        <component :is="props.isAlarmsOpen ? PanelRightClose : PanelRightOpen" class="size-3.5" />
        <span class="hidden sm:inline">Alerts</span>
        <span
          v-if="activeAlarmsCount > 0"
          class="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-full"
          :class="criticalAlarmsCount > 0 ? 'bg-rose-500 text-white' : 'bg-amber-500 text-black'"
        >
          {{ activeAlarmsCount }}
        </span>
      </Button>
    </div>
  </div>
</template>
