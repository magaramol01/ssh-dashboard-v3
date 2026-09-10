<script setup lang="ts">
import { computed } from 'vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  <div class="flex flex-wrap items-center justify-between gap-3 rounded bg-[#1e1f23] border border-[#2a2b2f] px-3 py-2 text-xs shadow-md">
    <!-- Left Filters Section -->
    <div class="flex flex-wrap items-center gap-3 md:gap-4">
      <!-- View By Toggle -->
      <div class="flex items-center gap-2 font-medium">
        <span class="text-[#33b5e5] font-semibold">View By :</span>
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-full border border-[#3b82f6]/40 bg-[#1e293b]/70 px-2.5 py-0.5 text-[11px] font-semibold text-[#d8d9da] transition-colors hover:bg-[#1e293b]"
          @click="toggleViewBy"
        >
          <span>{{ viewBy === 'sister' ? 'Sister Vessel' : 'Fleet' }}</span>
          <span
            class="size-2 rounded-full transition-colors"
            :class="viewBy === 'sister' ? 'bg-amber-400' : 'bg-[#33b5e5]'"
          />
        </button>
      </div>

      <!-- Sister Group Select -->
      <div class="min-w-[140px]">
        <Select v-model="selectedSisterGroup">
          <SelectTrigger class="h-7 border-[#2e3035] bg-[#17181b] text-[11px] text-[#d8d9da] focus:ring-1 focus:ring-[#33b5e5]">
            <SelectValue placeholder="Select Group" />
          </SelectTrigger>
          <SelectContent class="border-[#2e3035] bg-[#1e1f23] text-xs text-[#d8d9da]">
            <SelectItem
              v-for="group in sisterGroups"
              :key="group"
              :value="group"
              class="text-xs hover:bg-[#007fff] hover:text-white cursor-pointer"
            >
              {{ group }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Vessel Select Dropdown -->
      <div class="min-w-[210px]">
        <Select v-model="selectedVesselId">
          <SelectTrigger class="h-7 border-[#2e3035] bg-[#17181b] text-[11px] font-semibold text-[#d8d9da] focus:ring-1 focus:ring-[#33b5e5]">
            <SelectValue placeholder="Select Vessel" />
          </SelectTrigger>
          <SelectContent class="border-[#2e3035] bg-[#1e1f23] text-xs text-[#d8d9da]">
            <SelectItem
              v-for="v in filteredVessels"
              :key="v.id"
              :value="String(v.id)"
              class="text-xs hover:bg-[#007fff] hover:text-white cursor-pointer"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="font-bold">{{ v.name }}</span>
                <span v-if="v.sistergroup" class="text-[10px] text-[#8e8e8e]">({{ v.sistergroup }})</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <!-- Right Telemetry & Status Section -->
    <div class="flex flex-wrap items-center gap-3 text-xs">
      <!-- Loading indicator -->
      <div v-if="isLoading" class="flex items-center gap-1.5 text-[#33b5e5] animate-pulse text-[11px]">
        <span>Syncing...</span>
      </div>

      <!-- Connectivity / Last Updated Status -->
      <div class="flex items-center gap-2 rounded border border-[#2a2b2f] bg-[#17181b] px-2.5 py-1">
        <span
          class="size-2 rounded-full shadow-sm"
          :class="isOnline ? 'bg-[#0fcc45] shadow-[0_0_8px_#0fcc45] animate-pulse' : 'bg-red-500'"
        />
        <span class="font-mono text-[11px] text-[#d8d9da]">
          Last Updated : {{ formattedUpdatedTime }}
        </span>
      </div>

      <!-- Timezone Badge -->
      <div class="rounded border border-[#2a2b2f] bg-[#17181b] px-2 py-0.5 text-[11px] font-mono tracking-wider text-[#d8d9da]">
        UTC
      </div>
    </div>
  </div>
</template>
