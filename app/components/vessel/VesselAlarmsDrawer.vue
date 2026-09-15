<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Bell,
  Search,
  X,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Sparkles,
  CheckCheck,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useVesselDashboard, type VesselAlarmItem } from '~/composables/useVesselDashboard'

const props = withDefaults(
  defineProps<{
    modelValue?: boolean
    open?: boolean
  }>(),
  {
    modelValue: undefined,
    open: undefined,
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'update:open', val: boolean): void
}>()

const isOpen = computed({
  get: () => (props.modelValue !== undefined ? props.modelValue : (props.open !== undefined ? props.open : false)),
  set: (val: boolean) => {
    emit('update:modelValue', val)
    emit('update:open', val)
  },
})

function close() {
  isOpen.value = false
}

const {
  alarmsList,
  isAlarmsMuted,
  activeAlarmsCount,
  criticalAlarmsCount,
  warningAlarmsCount,
  infoAlarmsCount,
  advisoryAlarmsCount,
  acknowledgeAlarm,
  acknowledgeAllAlarms,
  resetAllAlarms,
  toggleMuteAlarms,
} = useVesselDashboard()

// Local UI state
const searchQuery = ref<string>('')
const activeCategory = ref<'all' | 'alarm' | 'alert' | 'advisory'>('all')
const activeSeverity = ref<'all' | 'critical' | 'warning' | 'info'>('all')
const hideAcknowledged = ref<boolean>(false)
const expandedIds = ref<Set<string>>(new Set(['ALM-1', 'ALM-2'])) // Expand first two criticals by default

function toggleExpand(id: string) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
  } else {
    expandedIds.value.add(id)
  }
}

function isExpanded(id: string): boolean {
  return expandedIds.value.has(id)
}

function playNotificationSound(type: 'ack' | 'chime' = 'chime') {
  if (isAlarmsMuted.value || typeof window === 'undefined') return
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    if (type === 'ack') {
      osc.frequency.setValueAtTime(523.25, ctx.currentTime) // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08) // E5
      gain.gain.setValueAtTime(0.04, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.22)
    } else {
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15)
      gain.gain.setValueAtTime(0.05, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.2)
    }
  } catch {
    // AudioContext unavailable or blocked
  }
}

function handleAcknowledge(id: string) {
  acknowledgeAlarm(id)
  playNotificationSound('ack')
}

function handleAcknowledgeAll() {
  acknowledgeAllAlarms()
  playNotificationSound('ack')
}

function handleToggleMute() {
  toggleMuteAlarms()
  if (!isAlarmsMuted.value) {
    playNotificationSound('chime')
  }
}

// Category counts
const categoryCounts = computed(() => ({
  all: alarmsList.value.length,
  alarm: alarmsList.value.filter((a) => a.category === 'alarm').length,
  alert: alarmsList.value.filter((a) => a.category === 'alert').length,
  advisory: alarmsList.value.filter((a) => a.category === 'advisory').length,
}))

// Filtered list
const filteredAlarms = computed(() => {
  let list = alarmsList.value

  // Category filter
  if (activeCategory.value !== 'all') {
    list = list.filter((a) => a.category === activeCategory.value)
  }

  // Severity filter
  if (activeSeverity.value !== 'all') {
    list = list.filter((a) => a.level === activeSeverity.value)
  }

  // Hide acknowledged
  if (hideAcknowledged.value) {
    list = list.filter((a) => !a.acknowledged)
  }

  // Search query
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter((a) =>
      a.title.toLowerCase().includes(q) ||
      a.code.toLowerCase().includes(q) ||
      a.system.toLowerCase().includes(q) ||
      (a.reading && a.reading.toLowerCase().includes(q)) ||
      (a.advisory && a.advisory.toLowerCase().includes(q))
    )
  }

  return list
})
</script>

<template>
  <aside
    v-if="isOpen"
    class="sticky top-14 h-[calc(100svh-3.5rem)] w-[360px] xl:w-[390px] shrink-0 border-l border-border bg-card flex flex-col text-foreground z-10"
  >
        <!-- Top Main Header (Aligned 1:1 with 72px main sticky header bar) -->
        <div class="flex h-[72px] shrink-0 items-center justify-between border-b border-border px-4 bg-muted/20">
          <div class="flex items-center gap-2.5 min-w-0">
            <div
              :class="[
                'flex size-9 items-center justify-center rounded-lg border shrink-0 transition-colors',
                criticalAlarmsCount > 0
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-500'
              ]"
            >
              <Bell class="size-5" :class="{ 'animate-bounce': criticalAlarmsCount > 0 && !isAlarmsMuted }" />
            </div>

            <div class="min-w-0">
              <div class="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground leading-none mb-1">Safety & Monitoring</div>
              <div class="flex items-center gap-2">
                <h2 class="font-semibold text-sm tracking-tight text-foreground truncate leading-tight">
                  Alarms & Events
                </h2>
                <Badge
                  variant="outline"
                  class="text-[10px] font-mono px-2 py-0.5 font-medium border-border/80 bg-muted/60 text-muted-foreground flex items-center gap-1.5"
                >
                  <span v-if="criticalAlarmsCount > 0" class="size-1.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                  <span>{{ activeAlarmsCount }} active</span>
                </Badge>
              </div>
              <p class="text-xs text-muted-foreground truncate mt-0.5 leading-normal">
                Real-time safety alerts & predictive CBM events
              </p>
            </div>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <!-- Mute / Unmute Sound -->
            <Button
              variant="ghost"
              size="icon"
              class="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
              :title="isAlarmsMuted ? 'Sound Muted (Click to Unmute)' : 'Sound Active (Click to Mute)'"
              @click="handleToggleMute"
            >
              <VolumeX v-if="isAlarmsMuted" class="size-4 text-muted-foreground" />
              <Volume2 v-else class="size-4 text-primary" />
            </Button>

            <!-- Close / Collapse Sidebar (>) -->
            <Button
              variant="ghost"
              size="icon"
              class="size-8 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded-md"
              title="Close Alarms Sidebar (>)"
              @click="close"
            >
              <ChevronRight class="size-5" />
            </Button>
          </div>
        </div>

        <!-- Severity Proportion Bar & Counters -->
        <div class="px-4 py-2.5 border-b border-border bg-muted/10 space-y-2">
          <div class="flex items-center justify-between text-[11px]">
            <span class="flex items-center gap-1.5 text-rose-500 font-normal">
              <span class="size-1.5 rounded-full bg-rose-500" :class="{ 'animate-ping': criticalAlarmsCount > 0 }" />
              <span class="font-semibold font-mono">{{ criticalAlarmsCount }}</span> critical
            </span>
            <span class="flex items-center gap-1.5 text-amber-500 font-normal">
              <span class="size-1.5 rounded-full bg-amber-500" />
              <span class="font-semibold font-mono">{{ warningAlarmsCount }}</span> warnings
            </span>
            <span class="flex items-center gap-1.5 text-sky-500 font-normal">
              <span class="size-1.5 rounded-full bg-sky-500" />
              <span class="font-semibold font-mono">{{ infoAlarmsCount }}</span> info
            </span>
          </div>

          <!-- Multi-colored ratio bar -->
          <div class="w-full bg-muted h-1.5 rounded-full overflow-hidden flex">
            <div
              class="bg-rose-500 transition-all duration-300"
              :style="{ width: `${(criticalAlarmsCount / (alarmsList.length || 1)) * 100}%` }"
              title="Critical Alarms"
            />
            <div
              class="bg-amber-500 transition-all duration-300"
              :style="{ width: `${(warningAlarmsCount / (alarmsList.length || 1)) * 100}%` }"
              title="Warning Alarms"
            />
            <div
              class="bg-sky-500 transition-all duration-300"
              :style="{ width: `${(infoAlarmsCount / (alarmsList.length || 1)) * 100}%` }"
              title="Info / Advisories"
            />
          </div>
        </div>

        <!-- Category Tabs Strip (All, Alarms, Alerts, Advisories) -->
        <div class="flex items-center border-b border-border bg-muted/20 px-2 py-1 gap-1 text-xs">
          <button
            type="button"
            @click="activeCategory = 'all'"
            :class="[
              'flex-1 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer text-center',
              activeCategory === 'all'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            ]"
          >
            All ({{ categoryCounts.all }})
          </button>

          <button
            type="button"
            @click="activeCategory = 'alarm'"
            :class="[
              'flex-1 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer text-center',
              activeCategory === 'alarm'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            ]"
          >
            Alarms ({{ categoryCounts.alarm }})
          </button>

          <button
            type="button"
            @click="activeCategory = 'alert'"
            :class="[
              'flex-1 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer text-center',
              activeCategory === 'alert'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            ]"
          >
            Alerts ({{ categoryCounts.alert }})
          </button>

          <button
            type="button"
            @click="activeCategory = 'advisory'"
            :class="[
              'flex-1 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer text-center flex items-center justify-center gap-1',
              activeCategory === 'advisory'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            ]"
          >
            <Sparkles class="size-3 text-primary" />
            CBM ({{ categoryCounts.advisory }})
          </button>
        </div>

        <!-- Search Bar & Filter Options -->
        <div class="p-2.5 border-b border-border bg-background space-y-2">
          <!-- Search Input -->
          <div class="relative">
            <Search class="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
            <input
              v-model="searchQuery"
              placeholder="Search code, equipment, parameter, or message..."
              class="h-8 w-full rounded-md border border-border bg-muted/20 pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              v-if="searchQuery"
              type="button"
              @click="searchQuery = ''"
              class="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X class="size-3" />
            </button>
          </div>

          <!-- Quick Severity Filters & Bulk Actions -->
          <div class="flex items-center justify-between gap-1 text-[10px]">
            <div class="flex items-center gap-1 overflow-x-auto">
              <button
                type="button"
                @click="activeSeverity = 'all'"
                :class="[
                  'px-2 py-0.5 rounded border transition-colors cursor-pointer',
                  activeSeverity === 'all'
                    ? 'border-foreground/30 bg-muted font-medium text-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground'
                ]"
              >
                All
              </button>
              <button
                type="button"
                @click="activeSeverity = 'critical'"
                :class="[
                  'px-1.5 py-0.5 rounded border transition-colors cursor-pointer flex items-center gap-1',
                  activeSeverity === 'critical'
                    ? 'border-rose-500/50 bg-rose-500/15 text-rose-500 font-medium'
                    : 'border-border text-muted-foreground hover:text-rose-500'
                ]"
              >
                <span class="size-1 rounded-full bg-rose-500" />
                Critical
              </button>
              <button
                type="button"
                @click="activeSeverity = 'warning'"
                :class="[
                  'px-1.5 py-0.5 rounded border transition-colors cursor-pointer flex items-center gap-1',
                  activeSeverity === 'warning'
                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-500 font-medium'
                    : 'border-border text-muted-foreground hover:text-amber-500'
                ]"
              >
                <span class="size-1 rounded-full bg-amber-500" />
                Warning
              </button>
              <button
                type="button"
                @click="activeSeverity = 'info'"
                :class="[
                  'px-1.5 py-0.5 rounded border transition-colors cursor-pointer flex items-center gap-1',
                  activeSeverity === 'info'
                    ? 'border-sky-500/50 bg-sky-500/15 text-sky-500 font-medium'
                    : 'border-border text-muted-foreground hover:text-sky-500'
                ]"
              >
                <span class="size-1 rounded-full bg-sky-500" />
                Advisory
              </button>
            </div>

            <!-- Bulk Acknowledge / Reset -->
            <div class="flex items-center gap-1 shrink-0">
              <button
                type="button"
                @click="hideAcknowledged = !hideAcknowledged"
                :class="[
                  'px-1.5 py-0.5 rounded border text-[10px] cursor-pointer transition-colors',
                  hideAcknowledged
                    ? 'bg-primary/15 border-primary/40 text-primary font-semibold'
                    : 'border-border text-muted-foreground hover:text-foreground'
                ]"
                title="Hide acknowledged alarms from list"
              >
                {{ hideAcknowledged ? 'Hiding ACK' : 'All ACK' }}
              </button>
              <button
                type="button"
                @click="handleAcknowledgeAll"
                class="px-1.5 py-0.5 rounded border border-border text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer flex items-center gap-1"
                title="Mark all alarms as acknowledged"
              >
                <CheckCheck class="size-2.5 text-primary" />
                Ack All
              </button>
            </div>
          </div>
        </div>

        <!-- Alarms List Container -->
        <div class="flex-1 overflow-y-auto p-3 space-y-2.5">
          <div
            v-for="item in filteredAlarms"
            :key="item.id"
            :class="[
              'rounded-lg border p-3 transition-all flex flex-col gap-2 shadow-xs',
              item.acknowledged
                ? 'bg-muted/15 border-border/40 opacity-60'
                : item.level === 'critical'
                  ? 'border-l-4 border-l-rose-500 bg-rose-500/5 border-border/80 hover:border-rose-500/40'
                  : item.level === 'warning'
                    ? 'border-l-4 border-l-amber-500 bg-amber-500/5 border-border/80 hover:border-amber-500/40'
                    : 'border-l-4 border-l-sky-500 bg-sky-500/5 border-border/80 hover:border-sky-500/40'
            ]"
          >
            <!-- Card Header: Severity Code, System Tag, UTC Time -->
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-1.5 flex-wrap">
                <!-- Severity Badge -->
                <span
                  :class="[
                    'inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium font-mono',
                    item.level === 'critical'
                      ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                      : item.level === 'warning'
                        ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                        : 'bg-sky-500/15 text-sky-500 border border-sky-500/30'
                  ]"
                >
                  <span
                    class="size-1.5 rounded-full shrink-0"
                    :class="[
                      item.level === 'critical' && !item.acknowledged
                        ? 'bg-rose-500 animate-ping'
                        : item.level === 'warning'
                          ? 'bg-amber-500'
                          : 'bg-sky-500'
                    ]"
                  />
                  {{ item.code }}
                </span>

                <!-- System / Equipment Badge -->
                <span class="text-[10px] text-muted-foreground font-normal bg-muted px-1.5 py-0.5 rounded border border-border/50">
                  {{ item.system }}
                </span>

                <!-- Acknowledged Badge -->
                <span
                  v-if="item.acknowledged"
                  class="inline-flex items-center gap-0.5 text-[9px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded"
                >
                  <CheckCircle2 class="size-2.5 text-muted-foreground" />
                  ACK
                </span>
              </div>

              <!-- Timestamp -->
              <span class="text-[10px] font-mono text-muted-foreground shrink-0">
                {{ item.time }} UTC
              </span>
            </div>

            <!-- Alarm Title -->
            <div class="text-xs font-semibold text-foreground leading-snug">
              {{ item.title }}
            </div>

            <!-- Observed vs Limit Comparison Box -->
            <div
              v-if="item.reading || item.limit"
              class="flex items-center gap-2 text-xs bg-muted/40 p-2 rounded-md border border-border/50"
            >
              <div class="flex-1 truncate">
                <span class="text-muted-foreground text-xs font-normal">Observed:</span>
                <span
                  class="font-mono font-semibold ml-1.5"
                  :class="item.level === 'critical' ? 'text-rose-500' : item.level === 'warning' ? 'text-amber-500' : 'text-sky-500'"
                >
                  {{ item.reading }}
                </span>
              </div>
              <div class="text-muted-foreground/30 font-normal">|</div>
              <div class="flex-1 truncate">
                <span class="text-muted-foreground text-xs font-normal">Threshold:</span>
                <span class="font-mono font-medium text-muted-foreground ml-1.5">{{ item.limit }}</span>
              </div>
            </div>

            <!-- Actionable Troubleshooting / Advisory Checklist -->
            <div v-if="item.advisory" class="pt-0.5">
              <button
                type="button"
                @click="toggleExpand(item.id)"
                class="text-[10px] text-primary hover:underline flex items-center gap-1 font-medium cursor-pointer"
              >
                <Sparkles class="size-3" />
                <span>{{ isExpanded(item.id) ? 'Hide Troubleshooting Advisory' : 'View Actionable Advisory' }}</span>
                <ChevronUp v-if="isExpanded(item.id)" class="size-3" />
                <ChevronDown v-else class="size-3" />
              </button>

              <div
                v-if="isExpanded(item.id)"
                class="mt-1.5 p-2 rounded-md bg-muted/60 border border-border/70 text-[11px] text-muted-foreground leading-relaxed flex items-start gap-2"
              >
                <div class="size-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <div>{{ item.advisory }}</div>
              </div>
            </div>

            <!-- Card Footer: Type & Inline Acknowledge Action -->
            <div class="flex items-center justify-between pt-1 border-t border-border/40 mt-0.5">
              <span class="text-[10px] text-muted-foreground capitalize">
                Category: {{ item.category }}
              </span>

              <Button
                variant="ghost"
                size="sm"
                :class="[
                  'h-6 px-2 text-[10px] gap-1 cursor-pointer font-medium rounded',
                  item.acknowledged
                    ? 'text-muted-foreground hover:text-foreground'
                    : 'text-primary hover:bg-primary/10 font-semibold'
                ]"
                @click.stop="handleAcknowledge(item.id)"
              >
                <CheckCircle2 class="size-3" :class="{ 'text-primary': !item.acknowledged }" />
                <span>{{ item.acknowledged ? 'Unacknowledge' : 'Acknowledge' }}</span>
              </Button>
            </div>
          </div>

          <!-- Empty State -->
          <div v-if="filteredAlarms.length === 0" class="py-16 text-center space-y-2">
            <div class="size-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <CheckCircle2 class="size-5 text-emerald-500" />
            </div>
            <div class="text-xs font-semibold text-foreground">No Alarms Found</div>
            <p class="text-[11px] text-muted-foreground max-w-[240px] mx-auto">
              {{ searchQuery ? 'No events match your search filters.' : 'All events matching the selected category are cleared or acknowledged.' }}
            </p>
            <div v-if="hideAcknowledged || searchQuery || activeSeverity !== 'all'" class="pt-2">
              <Button
                variant="outline"
                size="sm"
                class="h-7 text-xs cursor-pointer"
                @click="searchQuery = ''; activeSeverity = 'all'; hideAcknowledged = false"
              >
                Reset Filters
              </Button>
            </div>
          </div>
        </div>

        <!-- Footer Strip -->
        <div class="p-2.5 border-t border-border bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground">
          <div class="flex items-center gap-1.5">
            <span class="size-2 rounded-full bg-emerald-500" />
            <span class="font-mono text-[10px]">CBM Engine Live</span>
          </div>
          <button
            type="button"
            @click="resetAllAlarms"
            class="text-[10px] text-muted-foreground hover:text-foreground underline cursor-pointer"
          >
            Reset All to Active
          </button>
        </div>
  </aside>
</template>
