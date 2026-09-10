<script setup lang="ts">
import { ref, computed } from 'vue'
import { Cpu, Zap, Search, CircleDot } from 'lucide-vue-next'
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
  <div class="flex flex-col rounded-xl bg-[#17181f] border border-[#262833] p-3.5 shadow-sm">
    <!-- Top Header -->
    <div class="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-[#262833]/60">
      <div class="flex items-center gap-2">
        <Cpu class="h-4 w-4 text-emerald-400" />
        <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-200">
          Machinery Diagnostics Matrix
        </h3>
      </div>

      <!-- Tab Buttons & Search -->
      <div class="flex items-center gap-2">
        <!-- Tabs -->
        <div class="flex items-center bg-[#101116] p-0.5 rounded-lg border border-[#262833]">
          <button
            @click="currentTab = 'me'"
            :class="[
              'px-2.5 py-1 text-[11px] font-medium rounded-md transition-all flex items-center gap-1.5',
              currentTab === 'me'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            ]"
          >
            <Cpu class="h-3 w-3" />
            Main Engine
          </button>
          <button
            @click="currentTab = 'dg'"
            :class="[
              'px-2.5 py-1 text-[11px] font-medium rounded-md transition-all flex items-center gap-1.5',
              currentTab === 'dg'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            ]"
          >
            <Zap class="h-3 w-3" />
            Aux Gens (DG1-3)
          </button>
        </div>

        <!-- Search Input (Only on ME tab) -->
        <div v-if="currentTab === 'me'" class="relative">
          <Search class="h-3 w-3 absolute left-2 top-2 text-slate-500 pointer-events-none" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Filter sensors..."
            class="h-7 w-32 md:w-36 pl-6 pr-2 rounded-md bg-[#101116] border border-[#262833] text-[11px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
      </div>
    </div>

    <!-- Tab 1 Content: Main Engine Parameters (2-Column Dense Grid) -->
    <div v-if="currentTab === 'me'" class="max-h-[220px] overflow-y-auto pr-1">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-1.5">
        <div
          v-for="(p, idx) in filteredMeParams"
          :key="idx"
          class="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#101116]/80 border border-[#262833]/50 hover:border-[#383b4b] transition-colors"
        >
          <div class="flex items-center gap-2 min-w-0 pr-2">
            <div class="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
            <span class="text-[11px] text-slate-300 truncate" :title="p.label">
              {{ p.label }}
            </span>
          </div>

          <div class="flex items-center gap-1 font-mono shrink-0">
            <span class="text-[11px] font-bold text-slate-100">{{ p.value }}</span>
            <span class="text-[10px] text-slate-500">{{ p.unit }}</span>
          </div>
        </div>
      </div>
      <div v-if="filteredMeParams.length === 0" class="py-6 text-center text-xs text-slate-500">
        No sensors matching "{{ searchQuery }}"
      </div>
    </div>

    <!-- Tab 2 Content: Auxiliary Generators Comparison -->
    <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-2 max-h-[220px] overflow-y-auto pr-1">
      <div
        v-for="dg in dgItems"
        :key="dg.id"
        class="rounded-lg bg-[#101116] border border-[#262833] p-2.5 flex flex-col justify-between"
      >
        <div>
          <!-- Generator Header -->
          <div class="flex items-center justify-between border-b border-[#262833] pb-1.5 mb-2">
            <span class="text-xs font-bold text-slate-200">{{ dg.name }}</span>
            <span
              :class="[
                'px-1.5 py-0.2 text-[9px] font-bold uppercase rounded border',
                dg.status === 'online'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
              ]"
            >
              {{ dg.status }}
            </span>
          </div>

          <!-- Parameter Rows -->
          <div class="space-y-1 text-[11px]">
            <div class="flex items-center justify-between text-slate-400">
              <span>Speed</span>
              <span class="font-mono font-bold text-slate-200">{{ dg.rpm }} rpm</span>
            </div>
            <div class="flex items-center justify-between text-slate-400">
              <span>HT FW Press/Temp</span>
              <span class="font-mono text-slate-200">{{ dg.htFwPress }}b / {{ dg.htFwTemp }}°C</span>
            </div>
            <div class="flex items-center justify-between text-slate-400">
              <span>LO Press/Temp</span>
              <span class="font-mono text-slate-200">{{ dg.loPress }}b / {{ dg.loTemp }}°C</span>
            </div>
            <div class="flex items-center justify-between text-slate-400">
              <span>FO Temp</span>
              <span class="font-mono text-slate-200">{{ dg.foTemp }} °C</span>
            </div>
          </div>
        </div>

        <!-- Windings Sub-card -->
        <div class="mt-2 pt-1.5 border-t border-[#262833]/60 flex items-center justify-between text-[10px] text-slate-500">
          <span>Windings (U/V/W):</span>
          <span class="font-mono font-bold text-sky-400">
            {{ dg.w1 }}° / {{ dg.w2 }}° / {{ dg.w3 }}°
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
