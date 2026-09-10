<script setup lang="ts">
import { computed } from 'vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useVesselDashboard } from '~/composables/useVesselDashboard'

const {
  selectedVesselId,
  selectedSisterGroup,
  viewBy,
  sisterGroups,
  filteredVessels,
  connectivity,
  isLoading,
} = useVesselDashboard()

function toggleViewBy() {
  viewBy.value = viewBy.value === 'sister' ? 'fleet' : 'sister'
}

const formattedUpdatedTime = computed(() => {
  if (connectivity.value?.lastUpdatedTime) {
    return connectivity.value.lastUpdatedTime
  }
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`
})

const isOnline = computed(() => connectivity.value?.status !== false && connectivity.value?.code !== 'red')
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/40 bg-card/60 px-4 py-2.5 backdrop-blur-md">
    <!-- Left Filters Section -->
    <div class="flex flex-wrap items-center gap-3 md:gap-5">
      <!-- View By Toggle -->
      <div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span>View By :</span>
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
          @click="toggleViewBy"
        >
          <span>{{ viewBy === 'sister' ? 'Sister Vessel' : 'Fleet' }}</span>
          <span
            class="size-2 rounded-full transition-colors"
            :class="viewBy === 'sister' ? 'bg-amber-500' : 'bg-primary'"
          />
        </button>
      </div>

      <!-- Sister Group Select -->
      <div class="min-w-[150px]">
        <Select v-model="selectedSisterGroup">
          <SelectTrigger class="h-8 border-border/50 bg-background/80 text-xs">
            <SelectValue placeholder="Select Group" />
          </SelectTrigger>
          <SelectContent class="border-border/60 bg-popover text-xs">
            <SelectItem
              v-for="group in sisterGroups"
              :key="group"
              :value="group"
              class="text-xs"
            >
              {{ group }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Vessel Select Dropdown -->
      <div class="min-w-[200px]">
        <Select v-model="selectedVesselId">
          <SelectTrigger class="h-8 border-border/50 bg-background/80 text-xs font-medium">
            <SelectValue placeholder="Select Vessel" />
          </SelectTrigger>
          <SelectContent class="border-border/60 bg-popover text-xs">
            <SelectItem
              v-for="v in filteredVessels"
              :key="v.id"
              :value="String(v.id)"
              class="text-xs"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="font-semibold">{{ v.name }}</span>
                <span v-if="v.sistergroup" class="text-[10px] text-muted-foreground">({{ v.sistergroup }})</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <!-- Right Telemetry & Status Section -->
    <div class="flex flex-wrap items-center gap-3 text-xs">
      <!-- Loading indicator -->
      <div v-if="isLoading" class="flex items-center gap-1.5 text-muted-foreground animate-pulse text-[11px]">
        <span>Syncing...</span>
      </div>

      <!-- Connectivity / Last Updated Status -->
      <div class="flex items-center gap-2 rounded-md border border-border/30 bg-muted/20 px-2.5 py-1">
        <span
          class="size-2 rounded-full"
          :class="isOnline ? 'bg-success animate-pulse' : 'bg-destructive'"
        />
        <span class="font-mono text-[11px] text-foreground/90">
          Last Updated : {{ formattedUpdatedTime }}
        </span>
      </div>

      <!-- Timezone Badge -->
      <Badge variant="outline" class="h-6 px-2 text-[11px] font-mono tracking-wider">
        UTC
      </Badge>
    </div>
  </div>
</template>
