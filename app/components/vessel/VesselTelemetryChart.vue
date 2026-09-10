<script setup lang="ts">
import { ref, computed } from 'vue'
import { Activity, Flame, Zap, Wind } from 'lucide-vue-next'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  chartTextColor,
  chartAxisColor,
  chartSplitLineColor,
  chartTooltipBg,
  chartTooltipBorder,
  chartTooltipText,
} from '@/components/ui/charts/useChartTheme'
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

// Baseline datasets
const baselineSpeed = [13.8, 14.0, 14.2, 14.1, 14.5, 14.8, 14.2, 13.9, 14.1, 14.4, 14.2, 14.0, 14.2]
const baselineFuel = [28.4, 28.9, 29.2, 29.0, 30.1, 30.8, 29.5, 28.7, 29.1, 29.8, 29.3, 28.8, 29.0]
const baselinePower = [8200, 8350, 8500, 8420, 8750, 8900, 8550, 8300, 8450, 8680, 8520, 8380, 8450]
const baselineScavenge = [1.82, 1.85, 1.88, 1.86, 1.92, 1.95, 1.89, 1.84, 1.87, 1.91, 1.88, 1.85, 1.87]
const baselineExhaust = [318, 320, 322, 321, 326, 328, 323, 319, 321, 325, 322, 320, 321]

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
    left: 45,
    right: isDual ? 45 : 20,
    top: 25,
    bottom: 25,
  }

  const tooltip = {
    trigger: 'axis',
    backgroundColor: chartTooltipBg.value,
    borderColor: chartTooltipBorder.value,
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: chartTooltipText.value, fontSize: 11 },
  }

  const xAxis = {
    type: 'category',
    data: timelineHours,
    boundaryGap: false,
    axisLine: { lineStyle: { color: chartAxisColor.value } },
    axisLabel: { color: chartTextColor.value, fontSize: 10 },
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
        textStyle: { color: chartTextColor.value, fontSize: 10 },
      },
      xAxis,
      yAxis: [
        {
          type: 'value',
          name: 'kn',
          min: 10,
          max: 18,
          nameTextStyle: { color: chartTextColor.value, fontSize: 9, align: 'right' },
          axisLabel: { color: chartTextColor.value, fontSize: 9 },
          splitLine: { lineStyle: { color: chartSplitLineColor.value, type: 'dashed' } },
        },
        {
          type: 'value',
          name: 't/day',
          min: 20,
          max: 36,
          nameTextStyle: { color: chartTextColor.value, fontSize: 9, align: 'left' },
          axisLabel: { color: chartTextColor.value, fontSize: 9 },
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
          lineStyle: { color: '#0284c7', width: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(2, 132, 199, 0.15)' },
                { offset: 1, color: 'rgba(2, 132, 199, 0.0)' },
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
          lineStyle: { color: '#64748b', width: 1.8, type: 'dashed' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(100, 116, 139, 0.08)' },
                { offset: 1, color: 'rgba(100, 116, 139, 0.0)' },
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
      nameTextStyle: { color: chartTextColor.value, fontSize: 9 },
      axisLabel: { color: chartTextColor.value, fontSize: 9 },
      splitLine: { lineStyle: { color: chartSplitLineColor.value, type: 'dashed' } },
    },
    series: [
      {
        name: cfg.name,
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#0284c7', width: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(2, 132, 199, 0.15)' },
              { offset: 1, color: 'rgba(2, 132, 199, 0.0)' },
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
  <Card class="shadow-xs flex flex-col">
    <CardHeader class="p-4 pb-2">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle class="text-sm font-semibold flex items-center gap-2">
            <Activity class="size-4 text-primary" />
            <span>24-Hour Telemetry Timeline</span>
          </CardTitle>
          <CardDescription class="text-xs">
            Dual-axis comparative speed & fuel profiles over past 24 hours
          </CardDescription>
        </div>

        <!-- Quick Switcher Pills -->
        <div class="flex items-center gap-1 bg-muted p-0.5 rounded-lg border border-border">
          <button
            v-for="m in modes"
            :key="m.key"
            @click="activeMode = m.key"
            :class="[
              'px-2.5 py-1 text-[11px] font-medium rounded-md transition-all flex items-center gap-1.5 cursor-pointer',
              activeMode === m.key
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            ]"
          >
            <component :is="m.icon" class="size-3" />
            {{ m.label }}
          </button>
        </div>
      </div>
    </CardHeader>

    <CardContent class="p-4 pt-1">
      <!-- Mini Stat Callouts -->
      <div class="flex items-center justify-end gap-4 py-1 text-xs mb-1">
        <div class="flex items-center gap-1.5">
          <span class="text-muted-foreground">{{ currentStats.label1 }}:</span>
          <span class="font-mono font-bold text-foreground">{{ currentStats.val1 }}</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-muted-foreground">{{ currentStats.label2 }}:</span>
          <span class="font-mono font-bold text-primary">{{ currentStats.val2 }}</span>
        </div>
      </div>

      <!-- ECharts Container -->
      <div class="relative w-full">
        <ClientOnly>
          <VChart
            :option="chartOption"
            autoresize
            style="height: 220px; width: 100%;"
          />
          <template #fallback>
            <Skeleton class="h-[220px] w-full rounded-xl" />
          </template>
        </ClientOnly>
      </div>
    </CardContent>
  </Card>
</template>
