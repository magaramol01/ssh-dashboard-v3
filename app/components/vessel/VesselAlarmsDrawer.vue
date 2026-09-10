<script setup lang="ts">
import { ref, computed, watch } from 'vue'
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
} from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

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

const searchQuery = ref<string>('')
const activeFilter = ref<'all' | 'critical' | 'warning' | 'info'>('all')
const isMuted = ref<boolean>(false)

interface AlarmItem {
  id: string
  code: string
  title: string
  level: 'critical' | 'warning' | 'info'
  time: string
  acknowledged?: boolean
}

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
</script>

<template>
  <div>
    <!-- Mobile Backdrop -->
    <Transition name="fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 bg-background/60 backdrop-blur-xs z-25 lg:hidden"
        @click="close"
      />
    </Transition>

    <!-- Docked Alarms Drawer (Matches CII Copilot panel docking) -->
    <Transition name="alarm-slide">
      <aside
        v-if="isOpen"
        class="fixed right-0 top-14 bottom-0 z-30 w-full sm:w-[360px] xl:w-[380px] border-l border-border bg-card shadow-2xl flex flex-col"
      >
        <!-- Header -->
        <div class="flex h-[52px] shrink-0 items-center justify-between border-b border-border px-4 bg-muted/20">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="size-7 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Bell class="size-4 text-amber-500" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 leading-none">
                <h2 class="font-semibold text-xs tracking-tight truncate leading-none">Alarms & Events</h2>
                <Badge variant="outline" class="text-[9px] font-mono px-1.5 py-0 border-amber-500/40 text-amber-500">
                  {{ counts.total }} Active
                </Badge>
              </div>
              <p class="text-[10px] text-muted-foreground truncate leading-none mt-1">Real-time alerts & machinery alarms</p>
            </div>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              class="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
              :title="isMuted ? 'Unmute' : 'Mute'"
              @click="isMuted = !isMuted"
            >
              <VolumeX v-if="isMuted" class="size-3.5 text-muted-foreground" />
              <Volume2 v-else class="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
              title="Close Drawer"
              @click="close"
            >
              <X class="size-3.5" />
            </Button>
          </div>
        </div>

        <!-- Search Bar -->
        <div class="p-3 border-b border-border bg-muted/10">
          <div class="relative">
            <Search class="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
            <input
              v-model="searchQuery"
              placeholder="Filter by alarm code or title..."
              class="h-8 w-full rounded-md border border-border bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <!-- Filter Strip -->
        <div class="flex items-center justify-between border-b border-border px-3 py-1.5 bg-muted/10 text-xs">
          <button
            type="button"
            @click="activeFilter = 'all'"
            :class="[
              'px-2 py-0.5 rounded font-medium text-[11px] transition-all cursor-pointer',
              activeFilter === 'all'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            ]"
          >
            All ({{ counts.total }})
          </button>

          <button
            type="button"
            @click="activeFilter = 'critical'"
            :class="[
              'px-2 py-0.5 rounded font-medium text-[11px] flex items-center gap-1 transition-all cursor-pointer',
              activeFilter === 'critical'
                ? 'bg-rose-500/10 text-rose-500 font-semibold border border-rose-500/30'
                : 'text-muted-foreground hover:text-rose-500'
            ]"
          >
            <span class="size-1.5 rounded-full bg-rose-500" />
            Crit ({{ counts.critical }})
          </button>

          <button
            type="button"
            @click="activeFilter = 'warning'"
            :class="[
              'px-2 py-0.5 rounded font-medium text-[11px] flex items-center gap-1 transition-all cursor-pointer',
              activeFilter === 'warning'
                ? 'bg-amber-500/10 text-amber-500 font-semibold border border-amber-500/30'
                : 'text-muted-foreground hover:text-amber-500'
            ]"
          >
            <span class="size-1.5 rounded-full bg-amber-500" />
            Warn ({{ counts.warning }})
          </button>

          <button
            type="button"
            @click="activeFilter = 'info'"
            :class="[
              'px-2 py-0.5 rounded font-medium text-[11px] flex items-center gap-1 transition-all cursor-pointer',
              activeFilter === 'info'
                ? 'bg-primary/10 text-primary font-semibold border border-primary/30'
                : 'text-muted-foreground hover:text-primary'
            ]"
          >
            <span class="size-1.5 rounded-full bg-primary" />
            Info ({{ counts.info }})
          </button>
        </div>

        <!-- Alarms List -->
        <div class="flex-1 overflow-y-auto divide-y divide-border/60 p-2 space-y-1">
          <div
            v-for="item in filteredAlarms"
            :key="item.id"
            class="group flex flex-col gap-1.5 p-2.5 rounded-lg border border-transparent hover:border-border hover:bg-muted/30 transition-all cursor-pointer"
            :class="{ 'opacity-50': item.acknowledged }"
            @click="acknowledgeAlarm(item.id)"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 min-w-0">
                <span
                  class="size-1.5 rounded-full shrink-0"
                  :class="{
                    'bg-rose-500': item.level === 'critical',
                    'bg-amber-500': item.level === 'warning',
                    'bg-primary': item.level === 'info',
                  }"
                />
                <span
                  class="font-mono text-xs font-bold"
                  :class="{
                    'text-rose-500': item.level === 'critical',
                    'text-amber-500': item.level === 'warning',
                    'text-foreground': item.level === 'info',
                  }"
                >
                  {{ item.code }}
                </span>
                <span v-if="item.acknowledged" class="text-[9px] text-muted-foreground font-mono px-1 rounded bg-muted">
                  ACK
                </span>
              </div>

              <span class="font-mono text-[10px] text-muted-foreground">
                {{ item.time }}
              </span>
            </div>

            <div class="text-xs text-foreground font-medium leading-snug line-clamp-2">
              {{ item.title }}
            </div>
          </div>

          <div v-if="filteredAlarms.length === 0" class="py-12 text-center text-xs text-muted-foreground">
            No alarms match the active filter
          </div>
        </div>
      </aside>
    </Transition>
  </div>
</template>

<style scoped>
.alarm-slide-enter-active,
.alarm-slide-leave-active {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.alarm-slide-enter-from,
.alarm-slide-leave-to {
  transform: translateX(100%);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
