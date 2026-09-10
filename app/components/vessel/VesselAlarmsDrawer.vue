<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Bell,
  Globe,
  BellOff,
  Settings,
  Search,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useVesselDashboard, type RHSPanelFlag } from '~/composables/useVesselDashboard'

const { rhsFlags, updateRHSFlags, dashboardState } = useVesselDashboard()

const isExpanded = ref<boolean>(true)
const searchQuery = ref<string>('')
const activeTab = ref<'alarms' | 'alerts' | 'muted'>('alarms')
const isSettingsOpen = ref<boolean>(false)

// Sample live alarms derived from state or screenshot baseline
const alarmItems = [
  { id: 'ALM-1', code: 'W-01', title: 'ME JCW INLET PRESS LOW', level: 'warning', time: '05:42:10', acknowledged: false },
  { id: 'ALM-2', code: 'A-04', title: 'DG3 RPM SENSOR DISCONNECTED', level: 'destructive', time: '05:38:22', acknowledged: false },
  { id: 'ALM-3', code: 'W-09', title: 'ME SCAV AIR TEMP ELEVATED', level: 'warning', time: '05:30:15', acknowledged: true },
  { id: 'ALM-4', code: 'A-12', title: 'TC EXH GAS OUTLET HI TEMP', level: 'destructive', time: '05:15:00', acknowledged: false },
  { id: 'ALM-5', code: 'I-02', title: 'AUTO UNLOADER IN OPERATION', level: 'info', time: '04:58:30', acknowledged: true },
  { id: 'ALM-6', code: 'W-03', title: 'DG1 HT FW LOW LEVEL', level: 'warning', time: '04:42:19', acknowledged: false },
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
    class="flex flex-col border-l border-border/40 bg-card/85 backdrop-blur-md transition-all duration-300 relative z-20"
    :class="isExpanded ? 'w-80 md:w-88' : 'w-12'"
  >
    <!-- Top Header Bar -->
    <div class="flex h-12 items-center justify-between border-b border-border/40 px-3">
      <button
        type="button"
        class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        :title="isExpanded ? 'Collapse Drawer' : 'Expand Drawer'"
        @click="isExpanded = !isExpanded"
      >
        <ChevronRight v-if="isExpanded" class="size-4" />
        <ChevronLeft v-else class="size-4" />
      </button>

      <template v-if="isExpanded">
        <h2 class="text-xs font-bold tracking-wider text-foreground uppercase">
          Alarm
        </h2>
        <div class="relative w-40">
          <Search class="absolute left-2 top-2 size-3 text-muted-foreground" />
          <input
            v-model="searchQuery"
            placeholder="Search"
            class="h-7 w-full rounded border border-border/50 bg-background/80 pl-7 pr-2 text-[11px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </template>
    </div>

    <template v-if="isExpanded">
      <!-- Tabs & Badges Strip -->
      <div class="flex items-center justify-between border-b border-border/30 bg-background/40 px-3 py-2 text-xs">
        <button
          type="button"
          class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="RSH Panel Settings"
          @click="openSettings"
        >
          <Settings class="size-3.5" />
        </button>

        <div class="flex items-center gap-4">
          <!-- Alerts Bell -->
          <button
            type="button"
            class="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            :class="{ 'text-foreground font-bold': activeTab === 'alerts' }"
            @click="activeTab = 'alerts'"
          >
            <Bell class="size-3.5" />
            <span class="flex size-4 items-center justify-center rounded-full bg-amber-500/90 text-[10px] font-bold text-black">
              {{ counts.alerts }}
            </span>
          </button>

          <!-- Alarms Globe -->
          <button
            type="button"
            class="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            :class="{ 'text-foreground font-bold': activeTab === 'alarms' }"
            @click="activeTab = 'alarms'"
          >
            <Globe class="size-3.5" />
            <span class="flex size-4 items-center justify-center rounded-full bg-amber-500/90 text-[10px] font-bold text-black">
              {{ counts.alarms }}
            </span>
          </button>

          <!-- Muted Alarms -->
          <button
            type="button"
            class="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            :class="{ 'text-foreground font-bold': activeTab === 'muted' }"
            @click="activeTab = 'muted'"
          >
            <BellOff class="size-3.5" />
            <span class="flex size-4 items-center justify-center rounded-full bg-amber-500/90 text-[10px] font-bold text-black">
              {{ counts.muted }}
            </span>
          </button>
        </div>
      </div>

      <!-- Alarms List Container -->
      <div class="flex-1 overflow-y-auto p-3 space-y-2">
        <div
          v-for="item in filteredAlarms"
          :key="item.id"
          class="rounded border border-border/30 bg-background/50 p-2.5 text-xs transition-colors hover:border-border/60"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-1.5">
              <span
                class="size-1.5 rounded-full"
                :class="item.level === 'destructive' ? 'bg-destructive animate-ping' : item.level === 'warning' ? 'bg-warning' : 'bg-info'"
              />
              <span class="font-mono font-bold text-foreground">{{ item.code }}</span>
            </div>
            <span class="font-mono text-[10px] text-muted-foreground">{{ item.time }}</span>
          </div>
          <p class="mt-1 font-medium text-[11px] leading-tight text-foreground/90">
            {{ item.title }}
          </p>
        </div>

        <div v-if="!filteredAlarms.length" class="p-4 text-center text-xs text-muted-foreground">
          No alarms found matching criteria.
        </div>
      </div>
    </template>

    <!-- Collapsed Vertical Rail -->
    <template v-else>
      <div class="flex flex-col items-center gap-4 py-4 text-muted-foreground">
        <button type="button" @click="openSettings">
          <Settings class="size-4" />
        </button>
        <div class="flex flex-col items-center gap-1">
          <Globe class="size-4 text-amber-500" />
          <span class="text-[10px] font-bold text-foreground">14</span>
        </div>
      </div>
    </template>

    <!-- Settings Dialog for Panel Selection -->
    <Dialog v-model:open="isSettingsOpen">
      <DialogContent class="max-w-md border-border/60 bg-popover text-foreground">
        <DialogHeader>
          <DialogTitle class="text-base font-bold">RSH Panel Settings</DialogTitle>
          <DialogDescription class="text-xs text-muted-foreground">
            Select up to 2 panels to display in the Right-Hand Side drawer.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3 py-3 text-xs">
          <div
            v-for="panel in draftFlags"
            :key="panel.id"
            class="flex items-center justify-between rounded border border-border/40 p-2.5"
          >
            <span class="font-medium capitalize">
              {{ panel.typename === 'widget_4' ? 'Alarms' : panel.typename === 'widget_5' ? 'Alerts' : panel.typename === 'widget_6' ? 'Digital Alarm' : panel.typename === 'widget_7' ? 'Navigation Alert' : 'Charter Party' }}
            </span>
            <input
              type="checkbox"
              :checked="panel.status"
              class="size-4 rounded border-border accent-primary cursor-pointer"
              @change="toggleDraftFlag(panel.typename)"
            />
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" @click="isSettingsOpen = false">
            Cancel
          </Button>
          <Button size="sm" @click="saveSettings">
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </aside>
</template>
