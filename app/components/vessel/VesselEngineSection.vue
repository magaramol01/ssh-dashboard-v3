<script setup lang="ts">
import { ref, computed } from 'vue'
import { ChevronLeft, ChevronRight, Info } from 'lucide-vue-next'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { useVesselDashboard } from '~/composables/useVesselDashboard'
import { useTheme } from '~/composables/useTheme'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent])

const { dashboardState, activeEngineTab, selectedTelemetryParam } = useVesselDashboard()
const { isDark } = useTheme()

const selectedDialIndex = ref<number>(0)

const tabs = [
  { key: 'carousel1', name: 'Main Engine' },
  { key: 'carousel2', name: 'Auxiliary Engines' },
  { key: 'carousel3', name: 'Auxiliaries' },
]

const currentTab = computed(() => tabs[activeEngineTab.value] || tabs[0])

function prevTab() {
  activeEngineTab.value = (activeEngineTab.value - 1 + tabs.length) % tabs.length
  selectedDialIndex.value = 0
}

function nextTab() {
  activeEngineTab.value = (activeEngineTab.value + 1) % tabs.length
  selectedDialIndex.value = 0
}

// ── Main Engine Cylinders Data ──────────────────────────────────────
const cylinders = computed(() => {
  const acc1 = dashboardState.value?.widget_3?.configuration?.body?.data?.carousel1?.acc1
  if (!acc1?.gaugesData) {
    // Default fallback matching screenshot 1
    return [
      { id: 1, name: 'ME EXH.GAS OUT T.CYL.1', temp: '45.00', cfw: '74.00', pco: '40.00', param: 'AM21' },
      { id: 2, name: 'ME EXH.GAS OUT T.CYL.2', temp: '39.00', cfw: '75.00', pco: '40.00', param: 'AM22' },
      { id: 3, name: 'ME EXH.GAS OUT T.CYL.3', temp: '36.00', cfw: '74.00', pco: '40.00', param: 'AM23' },
      { id: 4, name: 'ME EXH.GAS OUT T.CYL.4', temp: '46.00', cfw: '72.00', pco: '39.00', param: 'AM24' },
      { id: 5, name: 'ME EXH.GAS OUT T.CYL.5', temp: '40.00', cfw: '74.00', pco: '39.00', param: 'AM25' },
      { id: 6, name: 'ME EXH.GAS OUT T.CYL.6', temp: '42.00', cfw: '75.00', pco: '39.00', param: 'AM26' },
    ]
  }

  const list = []
  const gd = acc1.gaugesData
  for (let i = 1; i <= 6; i++) {
    const g = gd[`gauge${i}`]
    list.push({
      id: i,
      name: g?.widgetData?.caption || `ME EXH.GAS OUT T.CYL.${i}`,
      temp: g?.widgetData?.value ?? '40.00',
      cfw: g?.col1?.widgetData?.value ?? '74.00',
      pco: g?.col2?.widgetData?.value ?? '40.00',
      param: g?.widgetData?.modbusParameterIdentifier || `AM2${i}`,
    })
  }
  return list
})

// ── Auxiliary Engines (Generators) Data ─────────────────────────────
const generators = computed(() => {
  const acc2 = dashboardState.value?.widget_3?.configuration?.body?.data?.carousel2?.acc2
  if (!acc2?.gaugesData) {
    // Default fallback matching screenshot 2
    return [
      {
        id: 1,
        title: 'DG1 RPM',
        rpm: '1008.98',
        w1: '75.73',
        w2: '78.22',
        w3: '76.61',
        fo: '6.87',
        lo: '4.44',
        param: 'DG1_RPM',
      },
      {
        id: 2,
        title: 'DG2 RPM',
        rpm: '1008.98',
        w1: '71.78',
        w2: '74.12',
        w3: '70.61',
        fo: '6.48',
        lo: '4.67',
        param: 'DG2_RPM',
      },
      {
        id: 3,
        title: 'DG3 RPM',
        rpm: '0.00',
        w1: '63.72',
        w2: '64.31',
        w3: '64.31',
        fo: '5.40',
        lo: '0.52',
        param: 'DG3_RPM',
      },
    ]
  }

  const list = []
  const gd = acc2.gaugesData
  for (let i = 1; i <= 3; i++) {
    const g = gd[`gauge${i}`]
    list.push({
      id: i,
      title: g?.widgetData?.caption || `DG${i} RPM`,
      rpm: g?.widgetData?.value ?? '0.00',
      w1: g?.col1?.widgetData?.value ?? '70.00',
      w2: g?.col2?.widgetData?.value ?? '70.00',
      w3: g?.col3?.widgetData?.value ?? '70.00',
      fo: g?.col4?.widgetData?.value ?? '6.00',
      lo: g?.col5?.widgetData?.value ?? '4.00',
      param: g?.widgetData?.modbusParameterIdentifier || `DG${i}_RPM`,
    })
  }
  return list
})

// ── Operating Data Table ───────────────────────────────────────────
const tableColumns = computed(() => {
  if (activeEngineTab.value === 0) {
    // Main Engine 3-column parameters matching screenshot 1
    return [
      [
        { val: '0.00', unit: 'rpm', label: 'ME Shaft Rpm' },
        { val: '7.44', unit: 'bar', label: 'ME CONTROL AIR IN PRESS.' },
        { val: '0.24', unit: 'bar', label: 'ME START AIR IN PRESS.' },
        { val: '0.85', unit: 'bar', label: 'ME JCW IN PRESS.' },
        { val: '0.00', unit: 'bar', label: 'ME LO INLET PRESS.' },
        { val: '7.66', unit: 'bar', label: 'ME FO IN PRESS.' },
      ],
      [
        { val: '107.00', unit: '°C', label: 'ME FO IN TEMP.' },
        { val: '0.00', unit: 'bar', label: 'ME SCAV.AIR RECEIVER PRESS.' },
        { val: '0.06', unit: 'bar', label: 'ME PCO IN PRESS.' },
        { val: '0.03', unit: 'bar', label: 'ME TC LO IN PRESS.' },
        { val: '0.00', unit: 'bar', label: 'MAIN L.O. INLET PRESS.' },
        { val: '50.00', unit: '°C', label: 'ME TC EXH. GAS INLET TEMP' },
      ],
      [
        { val: '27.00', unit: '°C', label: 'ME TC EXH. GAS OUTLET TEMP' },
        { val: '37.00', unit: '°C', label: 'ME THRUST BRG TEMP.' },
        { val: '32.00', unit: '°C', label: 'STERN TUBE AFT. BEAR. TEMP' },
        { val: '39.00', unit: '°C', label: 'ME LO IN TEMP.' },
        { val: '46.00', unit: '°C', label: 'ME TC L O INLET TEMP' },
        { val: '39.00', unit: '°C', label: 'ME TC LO OUTLET TEMP' },
      ],
    ]
  } else {
    // Aux Engine 3-column parameters matching screenshot 2
    return [
      [
        { val: '0.00', unit: 'bar', label: 'DG1 START AIR IN PRESS.' },
        { val: '3.41', unit: 'bar', label: 'DG1 HT FW IN PRESS.' },
        { val: '58.45', unit: '°C', label: 'DG1 HT FW OUT TEMP.' },
        { val: '65.92', unit: '°C', label: 'DG1 LO IN TEMP.' },
        { val: '124.07', unit: '°C', label: 'DG1 FO IN TEMP.' },
        { val: '0.86', unit: 'bar', label: 'DG1 LO TC press' },
      ],
      [
        { val: '0.00', unit: 'bar', label: 'DG2 START AIR IN PRESS.' },
        { val: '3.47', unit: 'bar', label: 'DG2 HT FW IN PRESS.' },
        { val: '71.63', unit: '°C', label: 'DG2 HT FW OUT TEMP.' },
        { val: '81.30', unit: '°C', label: 'DG2 LO IN TEMP.' },
        { val: '110.30', unit: '°C', label: 'DG2 FO IN TEMP.' },
        { val: '1.21', unit: 'bar', label: 'DG2 LO TC press' },
      ],
      [
        { val: '0.00', unit: 'bar', label: 'DG3 START AIR IN PRESS.' },
        { val: '0.91', unit: 'bar', label: 'DG3 HT FW IN PRESS.' },
        { val: '78.66', unit: '°C', label: 'DG3 HT FW OUT TEMP.' },
        { val: '70.90', unit: '°C', label: 'DG3 LO IN TEMP.' },
        { val: '68.26', unit: '°C', label: 'DG3 FO IN TEMP.' },
        { val: '0.27', unit: 'bar', label: 'DG3 LO TC press' },
      ],
    ]
  }
})

// ── ECharts Time-Series Strip Chart Option ─────────────────────────
const chartOption = computed(() => {
  const isMainEngine = activeEngineTab.value === 0
  const yMin = isMainEngine ? 150 : 750
  const yMax = isMainEngine ? 600 : 3000
  const yUnit = isMainEngine ? '°C' : 'rpm'

  // Generate 24 hourly timestamps matching screenshot timeline
  const timelineHours = [
    '2026-09-09 05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16',
    '17', '18', '19', '20', '21', '22', '23', '00', '01', '02', '03', '04', '05', '2026-09-10',
  ]

  // Synthetic baseline data matching the subtle steady line in screenshot
  const values = isMainEngine
    ? [210, 212, 215, 214, 216, 218, 220, 219, 221, 220, 222, 221, 224, 225, 223, 222, 224, 226, 225, 227, 226, 224, 225, 223, 221, 220]
    : [1008, 1008, 1008, 1008, 1008, 1008, 1008, 1008, 1008, 1008, 1008, 1008, 1008, 1008, 1008, 1008, 1008, 1008, 1008, 1008, 1008, 1008, 800, 750, 750, 750]

  return {
    backgroundColor: 'transparent',
    grid: {
      left: 60,
      right: 20,
      top: 10,
      bottom: 25,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#f8fafc', fontSize: 11 },
    },
    xAxis: {
      type: 'category',
      data: timelineHours,
      axisLine: { lineStyle: { color: '#475569' } },
      axisLabel: { color: '#94a3b8', fontSize: 9 },
      axisTick: { show: true },
    },
    yAxis: {
      type: 'value',
      min: yMin,
      max: yMax,
      interval: (yMax - yMin) / 3,
      axisLine: { show: true, lineStyle: { color: '#475569' } },
      axisLabel: {
        color: '#94a3b8',
        fontSize: 9,
        formatter: `{value}${yUnit}`,
      },
      splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } },
    },
    series: [
      {
        name: 'Telemetry',
        type: 'line',
        smooth: false,
        symbol: 'none',
        lineStyle: { color: '#22d3ee', width: 1.5 },
        data: values,
      },
    ],
  }
})

function selectDial(idx: number, param: string) {
  selectedDialIndex.value = idx
  selectedTelemetryParam.value = param
}
</script>

<template>
  <div class="rounded-lg border border-border/40 bg-card/70 p-4 backdrop-blur-md">
    <!-- Header with Tabs and Navigation Arrows -->
    <div class="flex items-center justify-between border-b border-border/40 pb-2.5">
      <div class="flex items-center gap-2">
        <h2 class="text-sm font-bold tracking-wide text-cyan-400">
          {{ currentTab.name }}
        </h2>
      </div>

      <div class="flex items-center gap-1.5">
        <button
          type="button"
          class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          @click="prevTab"
        >
          <ChevronLeft class="size-4" />
        </button>
        <span class="font-mono text-[11px] text-muted-foreground">
          {{ activeEngineTab + 1 }} / {{ tabs.length }}
        </span>
        <button
          type="button"
          class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          @click="nextTab"
        >
          <ChevronRight class="size-4" />
        </button>
      </div>
    </div>

    <!-- Dials / Arc Gauges Section -->
    <div class="relative py-4">
      <!-- Main Engine 6 Cylinders Gauges -->
      <div v-if="activeEngineTab === 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div
          v-for="(cyl, idx) in cylinders"
          :key="cyl.id"
          class="cursor-pointer rounded-lg border p-2.5 transition-all duration-200"
          :class="selectedDialIndex === idx ? 'border-cyan-400/80 bg-cyan-950/20 shadow-sm' : 'border-border/40 bg-background/50 hover:border-border'"
          @click="selectDial(idx, cyl.param)"
        >
          <div class="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
            <span class="truncate">{{ cyl.name }}</span>
            <Info class="size-3 text-cyan-400/70" />
          </div>

          <!-- Semicircular Arc Gauge (SVG) -->
          <div class="relative flex flex-col items-center justify-center my-1">
            <svg class="h-20 w-32" viewBox="0 0 100 55">
              <!-- Background Arc -->
              <path
                d="M 10,50 A 40,40 0 0,1 90,50"
                fill="none"
                stroke="#1e293b"
                stroke-width="6"
                stroke-linecap="round"
              />
              <!-- Progress Arc -->
              <path
                d="M 10,50 A 40,40 0 0,1 90,50"
                fill="none"
                stroke="#22d3ee"
                stroke-width="6"
                stroke-linecap="round"
                stroke-dasharray="125.6"
                :stroke-dashoffset="125.6 * (1 - Math.min(1, Math.max(0, parseFloat(cyl.temp) / 600)))"
              />
            </svg>
            <div class="absolute bottom-1 flex flex-col items-center">
              <span class="font-mono text-sm font-bold text-foreground">{{ cyl.temp }}</span>
              <span class="text-[10px] text-muted-foreground">°C</span>
            </div>
          </div>

          <!-- Sub-metrics -->
          <div class="grid grid-cols-2 gap-1 pt-1 border-t border-border/30 text-[10px]">
            <div>
              <div class="font-mono font-bold text-foreground">{{ cyl.cfw }} °C</div>
              <div class="truncate text-[9px] text-muted-foreground uppercase">ME CFW OUTLET</div>
            </div>
            <div>
              <div class="font-mono font-bold text-foreground">{{ cyl.pco }} °C</div>
              <div class="truncate text-[9px] text-muted-foreground uppercase">ME PCO OUTLET</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Aux Engine (Generators DG1, DG2, DG3) -->
      <div v-else-if="activeEngineTab === 1" class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          v-for="(dg, idx) in generators"
          :key="dg.id"
          class="cursor-pointer rounded-lg border p-3 transition-all duration-200"
          :class="selectedDialIndex === idx ? 'border-cyan-400/80 bg-cyan-950/20 shadow-sm' : 'border-border/40 bg-background/50 hover:border-border'"
          @click="selectDial(idx, dg.param)"
        >
          <div class="flex items-center justify-between text-xs font-semibold text-cyan-400">
            <span>{{ dg.title }}</span>
          </div>

          <div class="grid grid-cols-12 gap-3 items-center my-2">
            <!-- Left Dial -->
            <div class="col-span-5 relative flex flex-col items-center justify-center">
              <svg class="h-20 w-32" viewBox="0 0 100 55">
                <path
                  d="M 10,50 A 40,40 0 0,1 90,50"
                  fill="none"
                  stroke="#1e293b"
                  stroke-width="6"
                  stroke-linecap="round"
                />
                <path
                  d="M 10,50 A 40,40 0 0,1 90,50"
                  fill="none"
                  stroke="#22d3ee"
                  stroke-width="6"
                  stroke-linecap="round"
                  stroke-dasharray="125.6"
                  :stroke-dashoffset="125.6 * (1 - Math.min(1, Math.max(0, parseFloat(dg.rpm) / 1800)))"
                />
              </svg>
              <div class="absolute bottom-1 flex flex-col items-center">
                <span class="font-mono text-sm font-bold text-foreground">{{ dg.rpm }}</span>
                <span class="text-[9px] text-muted-foreground">rpm</span>
              </div>
            </div>

            <!-- Right Winding Temps -->
            <div class="col-span-7 flex flex-col gap-1 text-[11px]">
              <div>
                <span class="font-mono font-bold text-foreground">{{ dg.w1 }} °C </span>
                <span class="text-[10px] text-muted-foreground uppercase">DG{{ dg.id }} WINDING 1 T...</span>
              </div>
              <div>
                <span class="font-mono font-bold text-foreground">{{ dg.w2 }} °C </span>
                <span class="text-[10px] text-muted-foreground uppercase">DG{{ dg.id }} WINDING 2 T...</span>
              </div>
              <div>
                <span class="font-mono font-bold text-foreground">{{ dg.w3 }} °C </span>
                <span class="text-[10px] text-muted-foreground uppercase">DG{{ dg.id }} WINDING 3 T...</span>
              </div>
            </div>
          </div>

          <!-- Bottom FO / LO Pressures -->
          <div class="grid grid-cols-2 gap-2 border-t border-border/30 pt-1.5 text-[10px]">
            <div>
              <span class="font-mono font-bold text-foreground">{{ dg.fo }} bar </span>
              <span class="text-[9px] text-muted-foreground uppercase">DG{{ dg.id }} FO IN PRESS.</span>
            </div>
            <div>
              <span class="font-mono font-bold text-foreground">{{ dg.lo }} bar </span>
              <span class="text-[9px] text-muted-foreground uppercase">DG{{ dg.id }} LO IN PRESS.</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Auxiliaries tab fallback -->
      <div v-else class="flex h-32 items-center justify-center rounded border border-dashed border-border/40 text-xs text-muted-foreground">
        Auxiliaries Sub-Systems & Pumps Nominal
      </div>
    </div>

    <!-- Timeline Chart Strip -->
    <div class="my-2 rounded border border-border/30 bg-background/40 p-2">
      <ClientOnly>
        <VChart :option="chartOption" autoresize class="h-20 w-full" />
      </ClientOnly>
    </div>

    <!-- Operating Data Tables (3 Columns) -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-border/40 pt-3">
      <div
        v-for="(col, cIdx) in tableColumns"
        :key="cIdx"
        class="flex flex-col gap-1.5 rounded border border-border/30 bg-background/40 p-2.5 text-xs"
      >
        <div
          v-for="(row, rIdx) in col"
          :key="rIdx"
          class="flex items-center justify-between border-b border-border/20 pb-1 last:border-none last:pb-0"
        >
          <div class="flex items-center gap-1">
            <span class="text-[11px] text-muted-foreground truncate max-w-[190px]">
              {{ row.label }}
            </span>
            <Info class="size-2.5 text-cyan-400/60" />
          </div>
          <div class="flex items-baseline gap-1 font-mono">
            <span class="font-bold text-foreground">{{ row.val }}</span>
            <span class="text-[10px] text-muted-foreground">{{ row.unit }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
