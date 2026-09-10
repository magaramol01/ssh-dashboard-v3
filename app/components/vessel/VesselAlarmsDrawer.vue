<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Bell,
  Globe,
  Settings,
  Search,
  ChevronRight,
  ChevronLeft,
} from 'lucide-vue-next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useVesselDashboard, type RHSPanelFlag } from '~/composables/useVesselDashboard'

const { rhsFlags, updateRHSFlags } = useVesselDashboard()

const isExpanded = ref<boolean>(true)
const searchQuery = ref<string>('')
const activeTab = ref<'alarms' | 'alerts' | 'muted'>('alarms')
const isSettingsOpen = ref<boolean>(false)

// Baseline real alarms matching SmartShip production screenshot
const alarmItems = [
  { id: 'ALM-1', code: 'W-01', title: 'ME JCW INLET PRESS LOW', level: 'warning', time: '05:42:10' },
  { id: 'ALM-2', code: 'A-04', title: 'DG3 RPM SENSOR DISCONNECTED', level: 'destructive', time: '05:38:22' },
  { id: 'ALM-3', code: 'W-09', title: 'ME SCAV AIR TEMP ELEVATED', level: 'warning', time: '05:30:15' },
  { id: 'ALM-4', code: 'A-12', title: 'TC EXH GAS OUTLET HI TEMP', level: 'destructive', time: '05:15:00' },
  { id: 'ALM-5', code: 'I-02', title: 'AUTO UNLOADER IN OPERATION', level: 'info', time: '04:58:30' },
  { id: 'ALM-6', code: 'W-03', title: 'DG1 HT FW LOW LEVEL', level: 'warning', time: '04:42:19' },
  { id: 'ALM-7', code: 'W-05', title: 'ME SCAV AIR RECEIVER TEMP HIGH', level: 'warning', time: '04:20:11' },
  { id: 'ALM-8', code: 'A-02', title: 'TC SPEED SENSOR DISCONNECTED', level: 'destructive', time: '03:55:40' },
  { id: 'ALM-9', code: 'I-01', title: 'AUX BLOWER #1 STARTED', level: 'info', time: '03:12:05' },
]

const filteredAlarms = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return alarmItems
  return alarmItems.filter(
    (a) => a.title.toLowerCase().includes(q) || a.code.toLowerCase().includes(q)
  )
})

const counts = computed(() => ({
  alerts: 0,
  alarms: 14,
  muted: 0,
}))

// Local draft for settings dialog
const draftFlags = ref<RHSPanelFlag[]>([])

function openSettings() {
  draftFlags.value = JSON.parse(JSON.stringify(rhsFlags.value))
  isSettingsOpen.value = true
}

function toggleDraftFlag(typename: string) {
  const item = draftFlags.value.find((f) => f.typename === typename)
  if (item) {
    const currentTrueCount = draftFlags.value.filter((f) => f.status).length
    if (!item.status && currentTrueCount >= 2) {
      alert('Only 2 panels can be shown at a time.')
      return
    }
    item.status = !item.status
  }
}

async function saveSettings() {
  await updateRHSFlags(draftFlags.value)
  isSettingsOpen.value = false
}
</script>

<template>
  <aside
    class="flex flex-col bg-[#1e1f23] border-l border-[#2a2b2f] transition-all duration-200 relative z-20 shrink-0 select-none shadow-xl"
    :class="isExpanded ? 'w-72 lg:w-80' : 'w-10'"
  >
    <!-- Top Header Bar with Toggle & Search -->
    <div class="flex h-10 items-center justify-between border-b border-[#282a2e] px-2.5">
      <button
        type="button"
        class="rounded p-1 text-[#8e8e8e] hover:bg-[#282a2f] hover:text-white transition-colors"
        :title="isExpanded ? 'Collapse Drawer' : 'Expand Drawer'"
        @click="isExpanded = !isExpanded"
      >
        <ChevronRight v-if="isExpanded" class="size-4" />
        <ChevronLeft v-else class="size-4" />
      </button>

      <template v-if="isExpanded">
        <h2 class="text-xs font-bold uppercase tracking-wider text-white">
          ALARM
        </h2>
        <div class="relative w-36">
          <Search class="absolute left-2 top-1.5 size-3 text-[#8e8e8e]" />
          <input
            v-model="searchQuery"
            placeholder="Search"
            class="h-6 w-full rounded border border-[#2e3035] bg-[#17181b] pl-6 pr-2 text-[10px] text-[#d8d9da] placeholder:text-[#8e8e8e] focus:outline-none focus:border-[#33b5e5]"
          />
        </div>
      </template>
    </div>

    <!-- Expanded Drawer Content -->
    <template v-if="isExpanded">
      <!-- Tabs Strip with Icons & Badges -->
      <div class="flex items-center justify-between border-b border-[#282a2e] bg-[#17181b] px-3 py-1.5 text-xs">
        <button
          type="button"
          class="rounded p-1 text-[#8e8e8e] hover:bg-[#282a2f] hover:text-white transition-colors"
          title="RSH Panel Settings"
          @click="openSettings"
        >
          <Settings class="size-3.5" />
        </button>

        <div class="flex items-center gap-3">
          <!-- Alerts Bell -->
          <button
            type="button"
            class="flex items-center gap-1 text-[#8e8e8e] hover:text-white transition-colors"
            :class="{ 'text-[#33b5e5] font-bold': activeTab === 'alerts' }"
            @click="activeTab = 'alerts'"
          >
            <Bell class="size-3.5" />
            <span class="flex size-4 items-center justify-center rounded-full bg-[#f59e0b] text-[9px] font-bold text-black">
              {{ counts.alerts }}
            </span>
          </button>

          <!-- Alarms Globe -->
          <button
            type="button"
            class="flex items-center gap-1 text-[#8e8e8e] hover:text-white transition-colors"
            :class="{ 'text-[#33b5e5] font-bold': activeTab === 'alarms' }"
            @click="activeTab = 'alarms'"
          >
            <Globe class="size-3.5" />
            <span class="flex size-4 items-center justify-center rounded-full bg-[#ff631c] text-[9px] font-bold text-white">
              {{ counts.alarms }}
            </span>
          </button>

          <!-- Muted Alarms -->
          <button
            type="button"
            class="flex items-center gap-1 text-[#8e8e8e] hover:text-white transition-colors"
            :class="{ 'text-[#33b5e5] font-bold': activeTab === 'muted' }"
            @click="activeTab = 'muted'"
          >
            <span class="text-[11px] font-bold">🔕</span>
            <span class="flex size-4 items-center justify-center rounded-full bg-[#f59e0b] text-[9px] font-bold text-black">
              {{ counts.muted }}
            </span>
          </button>
        </div>
      </div>

      <!-- Alarms List -->
      <div class="flex-1 overflow-y-auto divide-y divide-[#242529] p-1">
        <div
          v-for="item in filteredAlarms"
          :key="item.id"
          class="flex items-center justify-between gap-2 px-2.5 py-2 transition-colors hover:bg-[#25272c] rounded cursor-pointer"
        >
          <!-- Left Status Indicator & Description -->
          <div class="flex items-center gap-2 min-w-0">
            <!-- Colored Status Dot -->
            <span
              class="size-2 shrink-0 rounded-full"
              :class="{
                'bg-[#ef4444] shadow-[0_0_6px_#ef4444]': item.level === 'destructive',
                'bg-[#f59e0b] shadow-[0_0_6px_#f59e0b]': item.level === 'warning',
                'bg-[#3b82f6] shadow-[0_0_6px_#3b82f6]': item.level === 'info',
              }"
            />
            <div class="flex flex-col min-w-0">
              <span class="truncate text-[11px] font-semibold text-[#d8d9da]">
                <b class="text-white">{{ item.code }}</b> {{ item.title }}
              </span>
            </div>
          </div>

          <!-- Right Timestamp -->
          <span class="shrink-0 font-mono text-[10px] text-[#8e8e8e]">
            {{ item.time }}
          </span>
        </div>
      </div>
    </template>

    <!-- Collapsed Vertical Rail -->
    <template v-else>
      <div class="flex flex-col items-center gap-4 py-4 text-[#8e8e8e]">
        <Globe class="size-4 text-[#ff631c]" />
        <span class="flex size-4 items-center justify-center rounded-full bg-[#ff631c] text-[9px] font-bold text-white">
          {{ counts.alarms }}
        </span>
      </div>
    </template>

    <!-- RSH Panel Settings Dialog -->
    <Dialog v-model:open="isSettingsOpen">
      <DialogContent class="border-[#2e3035] bg-[#1e1f23] text-[#d8d9da] sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-sm font-bold text-white">RSH Panel Settings</DialogTitle>
        </DialogHeader>

        <div class="space-y-3 py-3">
          <p class="text-xs text-[#8e8e8e]">
            Choose up to 2 telemetry & alert panels to display on the right-hand panel rail.
          </p>

          <div class="space-y-2">
            <div
              v-for="flag in draftFlags"
              :key="flag.typename"
              class="flex items-center justify-between rounded border border-[#2a2b2f] bg-[#17181b] p-2.5"
            >
              <span class="text-xs font-medium text-white capitalize">
                {{ flag.typename.replace('widget_', 'Telemetry Widget ') }}
              </span>
              <input
                type="checkbox"
                :checked="flag.status"
                class="size-4 accent-[#33b5e5] rounded cursor-pointer"
                @change="toggleDraftFlag(flag.typename)"
              />
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-2 border-t border-[#282a2e] pt-3">
          <button
            type="button"
            class="rounded border border-[#2e3035] px-3 py-1.5 text-xs text-[#8e8e8e] hover:text-white"
            @click="isSettingsOpen = false"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded bg-[#33b5e5] px-4 py-1.5 text-xs font-bold text-black hover:bg-[#33b5e5]/90"
            @click="saveSettings"
          >
            Save Changes
          </button>
        </div>
      </DialogContent>
    </Dialog>
  </aside>
</template>
