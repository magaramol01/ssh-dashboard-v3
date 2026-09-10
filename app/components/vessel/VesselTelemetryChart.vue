<script setup lang="ts">
import { ref, computed } from 'vue'
import { Activity, Flame, Gauge, Zap, Wind } from 'lucide-vue-next'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { useVesselDashboard } from '~/composables/useVesselDashboard'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent])

const { rechartData } = useVesselDashboard()

type TelemetryMode = 'speed_fuel' | 'power' | 'scavenge' | 'exhaust'

const activeMode = ref<TelemetryMode>('speed_fuel')

const modes: { key: TelemetryMode; label: string; icon: any }[] = [
  { key: 'speed_fuel', label: 'Speed vs Fuel', icon: Activity },
  { key: 'power', label: 'Shaft Power', icon: Zap },
  { key: 'scavenge', label: 'Scavenge Air', icon: Wind },
  { key: 'exhaust', label: 'Exhaust Temp', icon: Flame },
]

// 24h timeline markers
const timelineHours = [
  '00:00', '02:00', '04:00', '06:00', '08:00', '10:00',
  '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '24:00'
]

// Deterministic datasets
const baselineSpeed = [13.8, 14.0, 14.2, 14.1, 14.5, 14.8, 14.2, 13.9, 14.1, 14.4, 14.2, 14.0, 14.2]
const baselineFuel = [28.4, 28.9, 29.2, 29.0, 30.1, 30.8, 29.5, 28.7, 29.1, 29.8, 29.3, 28.8, 29.0]
const baselinePower = [8200, 8350, 8500, 8420, 8750, 8900, 8550, 8300, 8450, 8680, 8520, 8380, 8450]
const baselineScavenge = [1.82, 1.85, 1.88, 1.86, 1.92, 1.95, 1.89, 1.84, 1.87, 1.91, 1.88, 1.85, 1.87]
const baselineExhaust = [318, 320, 322, 321, 326, 328, 323, 319, 321, 325, 322, 320, 321]

// Live stat callouts
const currentStats = computed(() => {
  switch (activeMode.value) {
    case 'speed_fuel':
      return {
        val1: `${baselineSpeed[baselineSpeed.length - 1]} kn`,
        label1: 'SOG',
        val2: `${baselineFuel[baselineFuel.length - 1]} t/d`,
        label2: 'Fuel',
      }
    case 'power':
      return {
        val1: `${baselinePower[baselinePower.length - 1]} kW`,
        label1: 'Live Power',
        val2: `${Math.max(...baselinePower)} kW`,
        label2: 'Peak',
      }
    case 'scavenge':
      return {
        val1: `${baselineScavenge[baselineScavenge.length - 1]} bar`,
        label1: 'Receiver',
        val2: '1.88 bar',
        label2: 'Avg',
      }
    case 'exhaust':
      return {
        val1: `${baselineExhaust[baselineExhaust.length - 1]} °C`,
        label1: 'Avg Exh',
        val2: `${Math.max(...baselineExhaust)} °C`,
        label2: 'Peak',
      }
  }
})

const chartOption = computed(() => {
  const isDual = activeMode.value === 'speed_fuel'

  const grid = {
    left: 42,
    right: isDual ? 42 : 18,
    top: 25,
    bottom: 25,
  }

  const tooltip = {
    trigger: 'axis',
    backgroundColor: '#121318',
    borderColor: '#1e2029',
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: '#f8fafc', fontSize: 11 },
    axisPointer: {
      type: 'cross',
      lineStyle: { color: '#334155', type: 'dashed' },
      crossStyle: { color: '#334155' },
    },
  }

  const xAxis = {
    type: 'category',
    data: timelineHours,
    boundaryGap: false,
    axisLine: { lineStyle: { color: '#1e2029' } },
    axisLabel: { color: '#64748b', fontSize: 10 },
    axisTick: { show: false },
  }

  if (activeMode.value === 'speed_fuel') {
    return {
      backgroundColor: 'transparent',
      grid,
      tooltip,
      legend: {
        show: true,
        top: 0,
        right: 10,
        itemWidth: 12,
        itemHeight: 4,
        textStyle: { color: '#94a3b8', fontSize: 10 },
      },
      xAxis,
      yAxis: [
        {
          type: 'value',
          name: 'kn',
          min: 10,
          max: 18,
          nameTextStyle: { color: '#64748b', fontSize: 9, align: 'right' },
          axisLabel: { color: '#64748b', fontSize: 9 },
          splitLine: { lineStyle: { color: '#1a1c24', type: 'dashed' } },
        },
        {
          type: 'value',
          name: 't/day',
          min: 20,
          max: 36,
          nameTextStyle: { color: '#64748b', fontSize: 9, align: 'left' },
          axisLabel: { color: '#64748b', fontSize: 9 },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: 'Speed (kn)',
          type: 'line',
          yAxisIndex: 0,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#38bdf8', width: 1.8 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(56, 189, 248, 0.08)' },
                { offset: 1, color: 'rgba(56, 189, 248, 0.0)' },
              ],
            },
          },
          data: baselineSpeed,
        },
        {
          name: 'Fuel (t/day)',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#94a3b8', width: 1.5, type: 'dashed' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(148, 163, 184, 0.04)' },
                { offset: 1, color: 'rgba(148, 163, 184, 0.0)' },
              ],
            },
          },
          data: baselineFuel,
        },
      ],
    }
  }

  // Single parameter modes
  const modeConfigs = {
    power: { name: 'Shaft Power (kW)', min: 6000, max: 10000, unit: 'kW', data: baselinePower },
    scavenge: { name: 'Scavenge Air (bar)', min: 1.5, max: 2.2, unit: 'bar', data: baselineScavenge },
    exhaust: { name: 'Exhaust Temp (°C)', min: 300, max: 350, unit: '°C', data: baselineExhaust },
  }

  const cfg = modeConfigs[activeMode.value]

  return {
    backgroundColor: 'transparent',
    grid,
    tooltip,
    xAxis,
    yAxis: {
      type: 'value',
      name: cfg.unit,
      min: cfg.min,
      max: cfg.max,
      nameTextStyle: { color: '#64748b', fontSize: 9 },
      axisLabel: { color: '#64748b', fontSize: 9 },
      splitLine: { lineStyle: { color: '#1a1c24', type: 'dashed' } },
    },
    series: [
      {
        name: cfg.name,
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#38bdf8', width: 1.8 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(56, 189, 248, 0.08)' },
              { offset: 1, color: 'rgba(56, 189, 248, 0.0)' },
            ],
          },
        },
        data: cfg.data,
      },
    ],
  }
})
</script>

<template>
  <div class="flex flex-col rounded-xl bg-[#121318] border border-[#1e2029] p-3.5 shadow-sm">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-2 pb-2 mb-1 border-b border-[#1e2029]">
      <div class="flex items-center gap-2">
        <Activity class="h-4 w-4 text-sky-400" />
        <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-200">
          24h Telemetry Timeline
        </h3>
      </div>

      <!-- Quick Switcher Pills -->
      <div class="flex items-center gap-1 bg-[#0a0b0e] p-0.5 rounded-lg border border-[#1e2029]">
        <button
          v-for="m in modes"
          :key="m.key"
          @click="activeMode = m.key"
          :class="[
            'px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all flex items-center gap-1.5',
            activeMode === m.key
              ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          ]"
        >
          <component :is="m.icon" class="h-3 w-3" />
          {{ m.label }}
        </button>
      </div>
    </div>

    <!-- Live Mini Stat Callouts -->
    <div class="flex items-center justify-end gap-4 py-1 text-[11px]">
      <div class="flex items-center gap-1.5">
        <span class="text-slate-500">{{ currentStats.label1 }}:</span>
        <span class="font-mono font-bold text-slate-100">{{ currentStats.val1 }}</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="text-slate-500">{{ currentStats.label2 }}:</span>
        <span class="font-mono font-bold text-sky-400">{{ currentStats.val2 }}</span>
      </div>
    </div>

    <!-- ECharts Container -->
    <div class="relative w-full">
      <ClientOnly>
        <VChart
          :option="chartOption"
          autoresize
          style="height: 190px; width: 100%;"
        />
        <template #fallback>
          <div class="h-[190px] w-full flex items-center justify-center text-xs text-slate-500 bg-black/20 rounded-lg">
            Loading telemetry chart...
          </div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>
