<script setup lang="ts">
import { ref, computed } from 'vue'
import { Cpu, Zap, Search } from 'lucide-vue-next'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useVesselDashboard } from '~/composables/useVesselDashboard'

const { dashboardState } = useVesselDashboard()

type DiagnosticsTab = 'me' | 'dg'
const currentTab = ref<DiagnosticsTab>('me')
const searchQuery = ref<string>('')

interface ParamRow {
  group: string
  label: string
  value: string
  unit: string
  status: 'nominal' | 'warning' | 'standby'
}

// Extract live ME table values or baseline
const meParameters = computed<ParamRow[]>(() => {
  return [
    { group: 'Air System', label: 'ME Control Air In Press', value: '7.44', unit: 'bar', status: 'nominal' },
    { group: 'Air System', label: 'ME Start Air In Press', value: '0.24', unit: 'bar', status: 'nominal' },
    { group: 'Cooling & LO', label: 'ME JCW In Press', value: '0.85', unit: 'bar', status: 'nominal' },
    { group: 'Cooling & LO', label: 'ME LO Inlet Press', value: '2.40', unit: 'bar', status: 'nominal' },
    { group: 'Cooling & LO', label: 'ME LO In Temp', value: '39.00', unit: '°C', status: 'nominal' },
    { group: 'Cooling & LO', label: 'ME PCO In Press', value: '0.06', unit: 'bar', status: 'nominal' },
    { group: 'Fuel Oil', label: 'ME FO In Press', value: '7.66', unit: 'bar', status: 'nominal' },
    { group: 'Fuel Oil', label: 'ME FO In Temp', value: '107.00', unit: '°C', status: 'nominal' },
    { group: 'Turbocharger', label: 'Scav. Air Receiver Press', value: '1.85', unit: 'bar', status: 'nominal' },
    { group: 'Turbocharger', label: 'ME TC LO In Press', value: '0.03', unit: 'bar', status: 'nominal' },
    { group: 'Turbocharger', label: 'ME TC Exh Gas In Temp', value: '50.00', unit: '°C', status: 'nominal' },
    { group: 'Turbocharger', label: 'ME TC Exh Gas Out Temp', value: '27.00', unit: '°C', status: 'nominal' },
    { group: 'Bearings', label: 'ME Thrust Brg Temp', value: '37.00', unit: '°C', status: 'nominal' },
    { group: 'Bearings', label: 'Stern Tube Aft Brg Temp', value: '32.00', unit: '°C', status: 'nominal' },
  ]
})

// DG1, DG2, DG3 data
interface DGItem {
  id: string
  name: string
  rpm: string
  htFwPress: string
  htFwTemp: string
  loPress: string
  loTemp: string
  foTemp: string
  w1: string
  w2: string
  w3: string
  status: 'online' | 'standby'
}

const dgItems = computed<DGItem[]>(() => {
  return [
    {
      id: 'dg1',
      name: 'DG 1 (Base Load)',
      rpm: '1008.98',
      htFwPress: '3.41',
      htFwTemp: '58.45',
      loPress: '4.44',
      loTemp: '65.92',
      foTemp: '124.07',
      w1: '75.7',
      w2: '78.2',
      w3: '76.6',
      status: 'online',
    },
    {
      id: 'dg2',
      name: 'DG 2 (Synchronized)',
      rpm: '1008.98',
      htFwPress: '3.47',
      htFwTemp: '71.63',
      loPress: '4.67',
      loTemp: '81.30',
      foTemp: '110.30',
      w1: '71.8',
      w2: '74.1',
      w3: '70.6',
      status: 'online',
    },
    {
      id: 'dg3',
      name: 'DG 3 (Standby)',
      rpm: '0.00',
      htFwPress: '0.91',
      htFwTemp: '78.66',
      loPress: '0.52',
      loTemp: '70.90',
      foTemp: '68.26',
      w1: '63.7',
      w2: '64.3',
      w3: '64.3',
      status: 'standby',
    },
  ]
})

const filteredMeParams = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return meParameters.value
  return meParameters.value.filter(
    (p) => p.label.toLowerCase().includes(q) || p.group.toLowerCase().includes(q)
  )
})
</script>

<template>
  <Card class="shadow-xs">
    <CardHeader class="p-4 pb-2">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle class="text-sm font-semibold flex items-center gap-2">
            <Cpu class="size-4 text-primary" />
            <span>Machinery Diagnostics Matrix</span>
          </CardTitle>
          <CardDescription class="text-xs">
            Live sensor bus telemetry across Main Engine & Auxiliary Generators
          </CardDescription>
        </div>

        <!-- Tab Switcher & Filter -->
        <div class="flex items-center gap-2">
          <div class="flex items-center bg-muted p-0.5 rounded-lg border border-border">
            <button
              @click="currentTab = 'me'"
              :class="[
                'px-2.5 py-1 text-[11px] font-medium rounded-md transition-all flex items-center gap-1.5 cursor-pointer',
                currentTab === 'me'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              ]"
            >
              <Cpu class="size-3" />
              Main Engine
            </button>
            <button
              @click="currentTab = 'dg'"
              :class="[
                'px-2.5 py-1 text-[11px] font-medium rounded-md transition-all flex items-center gap-1.5 cursor-pointer',
                currentTab === 'dg'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              ]"
            >
              <Zap class="size-3" />
              Aux Gens (DG1-3)
            </button>
          </div>

          <!-- Search Filter -->
          <div v-if="currentTab === 'me'" class="relative">
            <Search class="size-3.5 absolute left-2.5 top-2 text-muted-foreground pointer-events-none" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Filter sensors..."
              class="h-7 w-32 md:w-40 pl-7 pr-2 rounded-md bg-muted/50 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            />
          </div>
        </div>
      </div>
    </CardHeader>

    <CardContent class="p-4 pt-2">
      <!-- Tab 1: Main Engine Parameters (2-Column Dense Grid) -->
      <div v-if="currentTab === 'me'" class="max-h-[240px] overflow-y-auto pr-1">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div
            v-for="(p, idx) in filteredMeParams"
            :key="idx"
            class="flex items-center justify-between px-3 py-2 rounded-lg bg-card/60 border border-border/80 hover:border-primary/30 transition-colors"
          >
            <div class="flex items-center gap-2 min-w-0 pr-2">
              <div class="size-1.5 rounded-full bg-primary shrink-0" />
              <span class="text-xs text-foreground truncate" :title="p.label">
                {{ p.label }}
              </span>
            </div>

            <div class="flex items-center gap-1 font-mono shrink-0">
              <span class="text-xs font-bold text-foreground tabular-nums">{{ p.value }}</span>
              <span class="text-[10px] text-muted-foreground">{{ p.unit }}</span>
            </div>
          </div>
        </div>
        <div v-if="filteredMeParams.length === 0" class="py-8 text-center text-xs text-muted-foreground">
          No telemetry sensors matching "{{ searchQuery }}"
        </div>
      </div>

      <!-- Tab 2: Auxiliary Generators (DG1–DG3) -->
      <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-3 max-h-[240px] overflow-y-auto pr-1">
        <div
          v-for="dg in dgItems"
          :key="dg.id"
          class="rounded-lg border bg-card/60 p-3 flex flex-col justify-between shadow-xs"
        >
          <div>
            <div class="flex items-center justify-between border-b border-border pb-2 mb-2">
              <span class="text-xs font-bold text-foreground">{{ dg.name }}</span>
              <Badge
                variant="outline"
                :class="[
                  'text-[9px] font-mono uppercase',
                  dg.status === 'online' ? 'text-primary border-primary/30' : 'text-muted-foreground'
                ]"
              >
                {{ dg.status }}
              </Badge>
            </div>

            <div class="space-y-1.5 text-xs">
              <div class="flex items-center justify-between text-muted-foreground">
                <span>Speed</span>
                <span class="font-mono font-bold text-foreground">{{ dg.rpm }} rpm</span>
              </div>
              <div class="flex items-center justify-between text-muted-foreground">
                <span>HT FW Press/Temp</span>
                <span class="font-mono text-foreground">{{ dg.htFwPress }}b / {{ dg.htFwTemp }}°C</span>
              </div>
              <div class="flex items-center justify-between text-muted-foreground">
                <span>LO Press/Temp</span>
                <span class="font-mono text-foreground">{{ dg.loPress }}b / {{ dg.loTemp }}°C</span>
              </div>
              <div class="flex items-center justify-between text-muted-foreground">
                <span>FO Temp</span>
                <span class="font-mono text-foreground">{{ dg.foTemp }} °C</span>
              </div>
            </div>
          </div>

          <div class="mt-3 pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Windings (U/V/W):</span>
            <span class="font-mono font-bold text-foreground">
              {{ dg.w1 }}° / {{ dg.w2 }}° / {{ dg.w3 }}°
            </span>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
