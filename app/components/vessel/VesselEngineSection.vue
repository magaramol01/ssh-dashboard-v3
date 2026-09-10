<script setup lang="ts">
import { ref, computed } from 'vue'
import { ChevronLeft, ChevronRight, Info } from 'lucide-vue-next'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { useVesselDashboard } from '~/composables/useVesselDashboard'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent])

const { dashboardState, activeEngineTab, selectedTelemetryParam } = useVesselDashboard()

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
    return [
      { id: 1, name: 'CYL 1 EXH GAS TEMP', temp: '320.50', cfw: '74.00', pco: '40.00', param: 'AM21' },
      { id: 2, name: 'CYL 2 EXH GAS TEMP', temp: '318.20', cfw: '75.00', pco: '40.00', param: 'AM22' },
      { id: 3, name: 'CYL 3 EXH GAS TEMP', temp: '325.00', cfw: '74.00', pco: '40.00', param: 'AM23' },
      { id: 4, name: 'CYL 4 EXH GAS TEMP', temp: '322.80', cfw: '72.00', pco: '39.00', param: 'AM24' },
      { id: 5, name: 'CYL 5 EXH GAS TEMP', temp: '319.40', cfw: '74.00', pco: '39.00', param: 'AM25' },
      { id: 6, name: 'CYL 6 EXH GAS TEMP', temp: '321.10', cfw: '75.00', pco: '39.00', param: 'AM26' },
    ]
  }

  const list = []
  const gd = acc1.gaugesData
  for (let i = 1; i <= 6; i++) {
    const g = gd[`gauge${i}`]
    const rawVal = g?.widgetData?.value
    const val = rawVal !== null && rawVal !== undefined && rawVal !== '' ? String(rawVal) : '320.00'
    list.push({
      id: i,
      name: g?.widgetData?.caption || `CYL ${i} EXH GAS TEMP`,
      temp: val === '0.00' ? '320.50' : val,
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
    return [
      { id: 1, title: 'DG1 RPM', rpm: '1008.98', w1: '75.73', w2: '78.22', w3: '76.61', fo: '6.87', lo: '4.44', param: 'DG1_RPM' },
      { id: 2, title: 'DG2 RPM', rpm: '1008.98', w1: '71.78', w2: '74.12', w3: '70.61', fo: '6.48', lo: '4.67', param: 'DG2_RPM' },
      { id: 3, title: 'DG3 RPM', rpm: '0.00', w1: '63.72', w2: '64.31', w3: '64.31', fo: '5.40', lo: '0.52', param: 'DG3_RPM' },
    ]
  }

  const list = []
  const gd = acc2.gaugesData
  for (let i = 1; i <= 3; i++) {
    const g = gd[`gauge${i}`]
    list.push({
      id: i,
      title: g?.widgetData?.caption || `DG${i} RPM`,
      rpm: g?.widgetData?.value ?? '1008.00',
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

// ── Operating Data Table (3 Columns) ───────────────────────────────
const tableColumns = computed(() => {
  if (activeEngineTab.value === 0) {
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
const selectedMetricName = computed(() => {
  if (activeEngineTab.value === 0) {
    return cylinders.value[selectedDialIndex.value]?.name || 'CYL 1 EXH GAS TEMP'
  }
  return generators.value[selectedDialIndex.value]?.title || 'DG1 RPM'
})

const chartOption = computed(() => {
  const isMainEngine = activeEngineTab.value === 0
  const yMin = isMainEngine ? 200 : 0
  const yMax = isMainEngine ? 500 : 1500
  const yUnit = isMainEngine ? '°C' : 'rpm'

  const timelineHours = [
    '00', '02', '04', '06', '08', '10', '12', '14', '16', '18', '20', '22', '24'
  ]

  const values = isMainEngine
    ? [315, 318, 320, 322, 321, 324, 320, 325, 322, 326, 324, 321, 320]
    : [1008, 1008, 1008, 1008, 1008, 1008, 1008, 1008, 1008, 1008, 950, 750, 0]

  return {
    backgroundColor: 'transparent',
    grid: {
      left: 45,
      right: 15,
      top: 10,
      bottom: 22,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#17181b',
      borderColor: '#ffb900',
      borderWidth: 1,
      textStyle: { color: '#ffffff', fontSize: 11 },
      formatter: (params: any) => {
        const p = params[0]
        return `${p.name}:00 — <b style="color:#ffb900">${p.value} ${yUnit}</b>`
      },
    },
    xAxis: {
      type: 'category',
      data: timelineHours,
      axisLine: { lineStyle: { color: '#33353b' } },
      axisLabel: { color: '#8e8e8e', fontSize: 9 },
      axisTick: { show: true, lineStyle: { color: '#33353b' } },
    },
    yAxis: {
      type: 'value',
      min: yMin,
      max: yMax,
      interval: (yMax - yMin) / 2,
      axisLine: { show: true, lineStyle: { color: '#33353b' } },
      axisLabel: {
        color: '#8e8e8e',
        fontSize: 9,
        formatter: `{value}${yUnit}`,
      },
      splitLine: { lineStyle: { color: '#242529', type: 'dashed' } },
    },
    series: [
      {
        name: selectedMetricName.value,
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#ffb900', width: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(255, 185, 0, 0.25)' },
              { offset: 1, color: 'rgba(255, 185, 0, 0.0)' },
            ],
          },
        },
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
  <div class="rounded bg-[#1e1f23] border border-[#2a2b2f] p-3 shadow-md text-xs">
    <!-- Header with Title and Carousel Arrows -->
    <div class="flex items-center justify-between border-b border-[#282a2e] pb-2 mb-3">
      <div class="flex items-center gap-2">
        <h2 class="text-xs font-bold uppercase tracking-wider text-[#33b5e5]">
          {{ currentTab.name }}
        </h2>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="rounded p-1 text-[#8e8e8e] hover:bg-[#282a2f] hover:text-white transition-colors"
          @click="prevTab"
        >
          <ChevronLeft class="size-4" />
        </button>
        <span class="font-mono text-[11px] text-[#8e8e8e]">
          {{ activeEngineTab + 1 }} / {{ tabs.length }}
        </span>
        <button
          type="button"
          class="rounded p-1 text-[#8e8e8e] hover:bg-[#282a2f] hover:text-white transition-colors"
          @click="nextTab"
        >
          <ChevronRight class="size-4" />
        </button>
      </div>
    </div>

    <!-- Main Engine 6 Cylinders Row -->
    <div v-if="activeEngineTab === 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
      <div
        v-for="(cyl, idx) in cylinders"
        :key="cyl.id"
        class="cursor-pointer rounded bg-[#17181b] border p-2 transition-all duration-200 hover:border-[#7eb26d]"
        :class="selectedDialIndex === idx ? 'border-[#7eb26d] bg-[#1a231d]/30 ring-1 ring-[#7eb26d]/60' : 'border-[#282a2e]'"
        @click="selectDial(idx, cyl.param)"
      >
        <!-- Card Header -->
        <div class="flex items-center justify-between text-[10px] font-bold text-[#d8d9da] pb-1 border-b border-[#242529]">
          <span class="truncate">{{ cyl.name }}</span>
          <Info class="size-3 text-[#33b5e5]/70" />
        </div>

        <!-- Semicircular Arc Gauge (SVG) -->
        <div class="relative flex flex-col items-center justify-center my-1">
          <svg class="h-16 w-28" viewBox="0 0 100 55">
            <!-- Background Arc -->
            <path
              d="M 12,50 A 38,38 0 0,1 88,50"
              fill="none"
              stroke="#25272c"
              stroke-width="7"
              stroke-linecap="round"
            />
            <!-- Progress Arc (Cyan/Green Gradient) -->
            <path
              d="M 12,50 A 38,38 0 0,1 88,50"
              fill="none"
              stroke="#00e5ff"
              stroke-width="7"
              stroke-linecap="round"
              stroke-dasharray="119.4"
              :stroke-dashoffset="119.4 * (1 - Math.min(1, Math.max(0, (parseFloat(cyl.temp) - 100) / 400)))"
            />
          </svg>
          <div class="absolute bottom-0 flex flex-col items-center">
            <span class="font-mono text-sm font-bold text-white tracking-tight">{{ cyl.temp }}</span>
            <span class="text-[9px] text-[#8e8e8e]">°C</span>
          </div>
        </div>

        <!-- Sub-metrics -->
        <div class="grid grid-cols-2 gap-1 pt-1.5 border-t border-[#242529] text-[9px]">
          <div>
            <div class="font-mono font-bold text-white">{{ cyl.cfw }} °C</div>
            <div class="truncate text-[8px] text-[#8e8e8e] uppercase">CFW OUT</div>
          </div>
          <div>
            <div class="font-mono font-bold text-white">{{ cyl.pco }} °C</div>
            <div class="truncate text-[8px] text-[#8e8e8e] uppercase">PCO OUT</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Aux Engine (Generators DG1, DG2, DG3) Row -->
    <div v-else-if="activeEngineTab === 1" class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div
        v-for="(dg, idx) in generators"
        :key="dg.id"
        class="cursor-pointer rounded bg-[#17181b] border p-2.5 transition-all duration-200 hover:border-[#7eb26d]"
        :class="selectedDialIndex === idx ? 'border-[#7eb26d] bg-[#1a231d]/30 ring-1 ring-[#7eb26d]/60' : 'border-[#282a2e]'"
        @click="selectDial(idx, dg.param)"
      >
        <div class="flex items-center justify-between text-xs font-bold text-[#33b5e5] pb-1 border-b border-[#242529]">
          <span>{{ dg.title }}</span>
          <Info class="size-3 text-[#33b5e5]/70" />
        </div>

        <div class="grid grid-cols-12 items-center gap-3 my-2">
          <!-- Left Arc Gauge -->
          <div class="col-span-5 relative flex flex-col items-center justify-center">
            <svg class="h-16 w-28" viewBox="0 0 100 55">
              <path
                d="M 12,50 A 38,38 0 0,1 88,50"
                fill="none"
                stroke="#25272c"
                stroke-width="7"
                stroke-linecap="round"
              />
              <path
                d="M 12,50 A 38,38 0 0,1 88,50"
                fill="none"
                stroke="#00e5ff"
                stroke-width="7"
                stroke-linecap="round"
                stroke-dasharray="119.4"
                :stroke-dashoffset="119.4 * (1 - Math.min(1, Math.max(0, parseFloat(dg.rpm) / 1200)))"
              />
            </svg>
            <div class="absolute bottom-0 flex flex-col items-center">
              <span class="font-mono text-xs font-bold text-white">{{ dg.rpm }}</span>
              <span class="text-[8px] text-[#8e8e8e]">rpm</span>
            </div>
          </div>

          <!-- Right Winding Temps -->
          <div class="col-span-7 flex flex-col gap-1 text-[10px]">
            <div>
              <span class="font-mono font-bold text-white">{{ dg.w1 }} °C </span>
              <span class="text-[9px] text-[#8e8e8e] uppercase">WINDING 1</span>
            </div>
            <div>
              <span class="font-mono font-bold text-white">{{ dg.w2 }} °C </span>
              <span class="text-[9px] text-[#8e8e8e] uppercase">WINDING 2</span>
            </div>
            <div>
              <span class="font-mono font-bold text-white">{{ dg.w3 }} °C </span>
              <span class="text-[9px] text-[#8e8e8e] uppercase">WINDING 3</span>
            </div>
          </div>
        </div>

        <!-- Bottom FO / LO Pressures -->
        <div class="grid grid-cols-2 gap-2 border-t border-[#242529] pt-1.5 text-[9px]">
          <div>
            <span class="font-mono font-bold text-white">{{ dg.fo }} bar </span>
            <span class="text-[8px] text-[#8e8e8e] uppercase">FO IN PRESS</span>
          </div>
          <div>
            <span class="font-mono font-bold text-white">{{ dg.lo }} bar </span>
            <span class="text-[8px] text-[#8e8e8e] uppercase">LO IN PRESS</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Auxiliaries tab fallback -->
    <div v-else class="flex h-24 items-center justify-center rounded bg-[#17181b] border border-dashed border-[#282a2e] text-xs text-[#8e8e8e]">
      Auxiliaries Sub-Systems & Pumps Nominal
    </div>

    <!-- Historical Timeline Chart Strip -->
    <div class="my-2.5 rounded bg-[#17181b] border border-[#282a2e] p-2">
      <div class="flex items-center justify-between pb-1 px-2 border-b border-[#242529] text-[10px]">
        <div class="flex items-center gap-2">
          <span class="size-2 rounded-full bg-[#ffb900]"></span>
          <span class="font-bold text-[#ffb900]">{{ selectedMetricName }} (24h Trend)</span>
        </div>
        <div class="text-[#8e8e8e] font-mono text-[9px]">
          <span>2026-09-09</span> &rarr; <span>2026-09-10</span>
        </div>
      </div>
      <div class="relative w-full h-[100px] pt-1">
        <ClientOnly>
          <VChart :option="chartOption" autoresize style="height: 100px; width: 100%;" />
        </ClientOnly>
      </div>
    </div>

    <!-- Operating Data Tables (3 Columns) -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-2.5">
      <div
        v-for="(col, cIdx) in tableColumns"
        :key="cIdx"
        class="flex flex-col gap-1 rounded bg-[#17181b] border border-[#282a2e] p-2 text-xs"
      >
        <div
          v-for="(row, rIdx) in col"
          :key="rIdx"
          class="flex items-center justify-between border-b border-[#242529] pb-1 last:border-none last:pb-0"
        >
          <div class="flex items-center gap-1">
            <span class="text-[10px] text-[#8e8e8e] truncate max-w-[190px]">
              {{ row.label }}
            </span>
            <Info class="size-2.5 text-[#33b5e5]/50" />
          </div>
          <div class="flex items-baseline gap-1 font-mono">
            <span class="font-bold text-white text-[11px]">{{ row.val }}</span>
            <span class="text-[9px] text-[#8e8e8e]">{{ row.unit }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
