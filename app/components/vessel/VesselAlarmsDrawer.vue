<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Bell,
  Settings,
  Search,
  ChevronRight,
  ChevronLeft,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
} from 'lucide-vue-next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useVesselDashboard, type RHSPanelFlag } from '~/composables/useVesselDashboard'

const props = withDefaults(
  defineProps<{
    open?: boolean
  }>(),
  {
    open: true,
  }
)

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
}>()

const { rhsFlags, updateRHSFlags } = useVesselDashboard()

const isExpanded = ref<boolean>(props.open)

watch(
  () => props.open,
  (val) => {
    isExpanded.value = val
  }
)

function toggleDrawer() {
  isExpanded.value = !isExpanded.value
  emit('update:open', isExpanded.value)
}

const searchQuery = ref<string>('')
const activeFilter = ref<'all' | 'critical' | 'warning' | 'info'>('all')
const isMuted = ref<boolean>(false)
const isSettingsOpen = ref<boolean>(false)

interface AlarmItem {
  id: string
  code: string
  title: string
  level: 'critical' | 'warning' | 'info'
  time: string
  acknowledged?: boolean
}

// Baseline alarms with rich metadata
const alarmItems = ref<AlarmItem[]>([
  { id: 'ALM-1', code: 'A-04', title: 'DG3 RPM SENSOR DISCONNECTED', level: 'critical', time: '05:38:22' },
  { id: 'ALM-2', code: 'A-12', title: 'TC EXH GAS OUTLET HI TEMP', level: 'critical', time: '05:15:00' },
  { id: 'ALM-3', code: 'W-01', title: 'ME JCW INLET PRESS LOW', level: 'warning', time: '05:42:10' },
  { id: 'ALM-4', code: 'W-09', title: 'ME SCAV AIR TEMP ELEVATED', level: 'warning', time: '05:30:15' },
  { id: 'ALM-5', code: 'W-03', title: 'DG1 HT FW LOW LEVEL', level: 'warning', time: '04:42:19' },
  { id: 'ALM-6', code: 'W-05', title: 'ME SCAV AIR RECEIVER TEMP HIGH', level: 'warning', time: '04:20:11' },
  { id: 'ALM-7', code: 'W-08', title: 'FO SERVICE TANK LOW LEVEL', level: 'warning', time: '04:02:18' },
  { id: 'ALM-8', code: 'I-02', title: 'AUTO UNLOADER IN OPERATION', level: 'info', time: '04:58:30' },
  { id: 'ALM-9', code: 'I-01', title: 'AUX BLOWER #1 STARTED', level: 'info', time: '03:12:05' },
])

const counts = computed(() => ({
  critical: alarmItems.value.filter((a) => a.level === 'critical').length,
  warning: alarmItems.value.filter((a) => a.level === 'warning').length,
  info: alarmItems.value.filter((a) => a.level === 'info').length,
  total: alarmItems.value.length,
}))

const filteredAlarms = computed(() => {
  let list = alarmItems.value

  if (activeFilter.value !== 'all') {
    list = list.filter((a) => a.level === activeFilter.value)
  }

  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (a) => a.title.toLowerCase().includes(q) || a.code.toLowerCase().includes(q)
    )
  }

  return list
})

function acknowledgeAlarm(id: string) {
  const item = alarmItems.value.find((a) => a.id === id)
  if (item) {
    item.acknowledged = !item.acknowledged
  }
}

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
    class="flex flex-col bg-[#17181f] border-l border-[#262833] transition-all duration-300 relative z-20 shrink-0 select-none shadow-2xl h-full"
    :class="isExpanded ? 'w-80 lg:w-84' : 'w-12'"
  >
    <!-- Top Bar with Toggle and Title -->
    <div class="flex h-11 items-center justify-between border-b border-[#262833] px-3 bg-[#13141a]">
      <button
        type="button"
        class="rounded-lg p-1.5 text-slate-400 hover:bg-[#262833] hover:text-slate-100 transition-colors"
        :title="isExpanded ? 'Collapse Alarms' : 'Expand Alarms'"
        @click="toggleDrawer"
      >
        <ChevronRight v-if="isExpanded" class="h-4 w-4" />
        <ChevronLeft v-else class="h-4 w-4" />
      </button>

      <template v-if="isExpanded">
        <div class="flex items-center gap-2">
          <Bell class="h-4 w-4 text-amber-400" />
          <h3 class="text-xs font-bold uppercase tracking-wider text-slate-200">
            Alarms Rail
          </h3>
          <span class="rounded-full bg-rose-500/20 px-1.5 py-0.2 text-[10px] font-bold text-rose-400 border border-rose-500/30">
            {{ counts.total }}
          </span>
        </div>

        <div class="flex items-center gap-1">
          <!-- Mute Button -->
          <button
            type="button"
            class="rounded-lg p-1.5 text-slate-400 hover:bg-[#262833] hover:text-slate-100 transition-colors"
            :title="isMuted ? 'Unmute Alarms' : 'Mute Alarms'"
            @click="isMuted = !isMuted"
          >
            <VolumeX v-if="isMuted" class="h-3.5 w-3.5 text-rose-400" />
            <Volume2 v-else class="h-3.5 w-3.5 text-slate-400" />
          </button>

          <!-- Settings Button -->
          <button
            type="button"
            class="rounded-lg p-1.5 text-slate-400 hover:bg-[#262833] hover:text-slate-100 transition-colors"
            title="Panel Settings"
            @click="openSettings"
          >
            <Settings class="h-3.5 w-3.5" />
          </button>
        </div>
      </template>
    </div>

    <!-- Expanded Drawer Content -->
    <template v-if="isExpanded">
      <!-- Search Bar -->
      <div class="p-2 border-b border-[#262833]/60 bg-[#101116]/50">
        <div class="relative">
          <Search class="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
          <input
            v-model="searchQuery"
            placeholder="Search code or description..."
            class="h-7 w-full rounded-lg border border-[#262833] bg-[#101116] pl-8 pr-2 text-[11px] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50"
          />
        </div>
      </div>

      <!-- Priority Filter Strip -->
      <div class="flex items-center justify-between border-b border-[#262833] px-2 py-1.5 bg-[#101116] text-[10px]">
        <button
          type="button"
          @click="activeFilter = 'all'"
          :class="[
            'px-2 py-0.5 rounded font-semibold transition-all',
            activeFilter === 'all'
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-slate-200'
          ]"
        >
          All ({{ counts.total }})
        </button>

        <button
          type="button"
          @click="activeFilter = 'critical'"
          :class="[
            'px-2 py-0.5 rounded font-semibold flex items-center gap-1 transition-all',
            activeFilter === 'critical'
              ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40'
              : 'text-rose-400/80 hover:text-rose-300'
          ]"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-rose-500" />
          Crit ({{ counts.critical }})
        </button>

        <button
          type="button"
          @click="activeFilter = 'warning'"
          :class="[
            'px-2 py-0.5 rounded font-semibold flex items-center gap-1 transition-all',
            activeFilter === 'warning'
              ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
              : 'text-amber-400/80 hover:text-amber-300'
          ]"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Warn ({{ counts.warning }})
        </button>

        <button
          type="button"
          @click="activeFilter = 'info'"
          :class="[
            'px-2 py-0.5 rounded font-semibold flex items-center gap-1 transition-all',
            activeFilter === 'info'
              ? 'bg-sky-500/25 text-sky-300 border border-sky-500/40'
              : 'text-sky-400/80 hover:text-sky-300'
          ]"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-sky-500" />
          Info ({{ counts.info }})
        </button>
      </div>

      <!-- Alarms List -->
      <div class="flex-1 overflow-y-auto divide-y divide-[#262833]/50 p-1.5 space-y-1">
        <div
          v-for="item in filteredAlarms"
          :key="item.id"
          class="group flex flex-col gap-1 p-2 rounded-lg bg-[#101116]/60 border border-transparent hover:border-[#262833] hover:bg-[#101116] transition-all cursor-pointer"
          :class="{ 'opacity-60': item.acknowledged }"
          @click="acknowledgeAlarm(item.id)"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5 min-w-0">
              <!-- Glow Dot -->
              <span
                class="h-2 w-2 rounded-full shrink-0"
                :class="{
                  'bg-rose-500 shadow-[0_0_8px_#f43f5e]': item.level === 'critical',
                  'bg-amber-400 shadow-[0_0_8px_#f59e0b]': item.level === 'warning',
                  'bg-sky-400 shadow-[0_0_8px_#38bdf8]': item.level === 'info',
                }"
              />
              <span class="font-mono text-[10px] font-bold tracking-wider"
                :class="{
                  'text-rose-400': item.level === 'critical',
                  'text-amber-300': item.level === 'warning',
                  'text-sky-300': item.level === 'info',
                }"
              >
                {{ item.code }}
              </span>
              <span v-if="item.acknowledged" class="text-[9px] text-emerald-400 font-semibold px-1 rounded bg-emerald-500/10">
                ACK
              </span>
            </div>

            <span class="font-mono text-[10px] text-slate-500">
              {{ item.time }}
            </span>
          </div>

          <div class="text-[11px] font-medium text-slate-300 leading-snug line-clamp-2">
            {{ item.title }}
          </div>
        </div>

        <div v-if="filteredAlarms.length === 0" class="py-8 text-center text-xs text-slate-500">
          No alarms match filter
        </div>
      </div>
    </template>

    <!-- Collapsed Vertical Rail -->
    <template v-else>
      <div class="flex flex-col items-center gap-4 py-4 text-slate-400">
        <button
          type="button"
          class="p-2 rounded-lg hover:bg-[#262833] text-amber-400"
          @click="toggleDrawer"
          title="Expand Alarms"
        >
          <Bell class="h-4 w-4" />
        </button>

        <span class="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/20 text-[10px] font-bold text-rose-400 border border-rose-500/40">
          {{ counts.total }}
        </span>

        <span class="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/20 text-[9px] font-bold text-amber-400 border border-amber-500/40">
          {{ counts.warning }}
        </span>
      </div>
    </template>

    <!-- RSH Panel Settings Dialog -->
    <Dialog v-model:open="isSettingsOpen">
      <DialogContent class="border-[#262833] bg-[#17181f] text-slate-200 sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-sm font-bold text-slate-100">Telemetry & Alarm Panels</DialogTitle>
        </DialogHeader>

        <div class="space-y-3 py-3">
          <p class="text-xs text-slate-400">
            Configure up to 2 telemetry feeds to stream onto the operations rail.
          </p>

          <div class="space-y-2">
            <div
              v-for="flag in draftFlags"
              :key="flag.typename"
              class="flex items-center justify-between rounded-lg border border-[#262833] bg-[#101116] p-2.5"
            >
              <span class="text-xs font-medium text-slate-200 capitalize">
                {{ flag.typename.replace('widget_', 'Telemetry Stream ') }}
              </span>
              <input
                type="checkbox"
                :checked="flag.status"
                class="size-4 accent-sky-500 rounded cursor-pointer"
                @change="toggleDraftFlag(flag.typename)"
              />
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-2 border-t border-[#262833] pt-3">
          <button
            type="button"
            class="rounded-lg border border-[#262833] px-3 py-1.5 text-xs text-slate-400 hover:text-slate-100"
            @click="isSettingsOpen = false"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-sky-500"
            @click="saveSettings"
          >
            Save Changes
          </button>
        </div>
      </DialogContent>
    </Dialog>
  </aside>
</template>
