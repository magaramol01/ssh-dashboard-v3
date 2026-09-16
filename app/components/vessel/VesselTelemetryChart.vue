<script setup lang="ts">
import { ref, computed } from 'vue'
import { Activity, Flame, Zap, Wind, Maximize2, Minimize2, X } from 'lucide-vue-next'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent])

const { rechartData } = useVesselDashboard()

type TelemetryMode = 'speed_fuel' | 'power' | 'scavenge' | 'exhaust'

const activeMode = ref<TelemetryMode>('speed_fuel')
const isExpanded = ref(false)

const modes: { key: TelemetryMode; label: string; icon: any }[] = [
  { key: 'speed_fuel', label: 'Speed vs Fuel', icon: Activity },
  { key: 'power', label: 'Shaft Power', icon: Zap },
  { key: 'scavenge', label: 'Scavenge Air', icon: Wind },
  { key: 'exhaust', label: 'Exhaust Temp', icon: Flame },
]

const modeDescriptions: Record<TelemetryMode, string> = {
  speed_fuel: 'Dual-axis comparative speed and fuel profiles over past 24 hours',
  power: 'Continuous shaft power output over past 24 hours',
  scavenge: 'Scavenge air receiver pressure over past 24 hours',
  exhaust: 'Main engine cylinder exhaust temperatures over past 24 hours',
}

function selectMode(key: TelemetryMode) {
  activeMode.value = key
}

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
        label1: 'Speed (SOG)',
        val2: `${baselineFuel[baselineFuel.length - 1]} t/d`,
        label2: 'Fuel rate',
      }
    case 'power':
      return {
        val1: `${baselinePower[baselinePower.length - 1]} kW`,
        label1: 'Live power',
        val2: `${Math.max(...baselinePower)} kW`,
        label2: 'Peak load',
      }
    case 'scavenge':
      return {
        val1: `${baselineScavenge[baselineScavenge.length - 1]} bar`,
        label1: 'Receiver pressure',
        val2: '1.88 bar',
        label2: 'Average',
      }
    case 'exhaust':
      return {
        val1: `${baselineExhaust[baselineExhaust.length - 1]} °C`,
        label1: 'Average exhaust',
        val2: `${Math.max(...baselineExhaust)} °C`,
        label2: 'Peak temperature',
      }
  }
})

const getChartConfig = (expanded = false) => {
  const isDual = activeMode.value === 'speed_fuel'

  const grid = {
    left: expanded ? 55 : 45,
    right: isDual ? (expanded ? 55 : 45) : 20,
    top: expanded ? 35 : 18,
    bottom: expanded ? 45 : 25,
  }

  const tooltip = {
    trigger: 'axis',
    backgroundColor: '#090d16',
    borderColor: 'rgba(148, 163, 184, 0.25)',
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: '#f8fafc', fontSize: 11 },
  }

  const xAxis = {
    type: 'category',
    data: timelineHours,
    boundaryGap: false,
    axisLine: { lineStyle: { color: '#475569' } },
    axisLabel: { color: '#94a3b8', fontSize: expanded ? 11 : 10 },
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
        itemWidth: 14,
        itemHeight: 4,
        textStyle: { color: '#cbd5e1', fontSize: 11 },
      },
      xAxis,
      yAxis: [
        {
          type: 'value',
          name: 'kn',
          min: 10,
          max: 18,
          nameTextStyle: { color: '#94a3b8', fontSize: 10, align: 'right' },
          axisLabel: { color: '#94a3b8', fontSize: 10 },
          splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)', type: 'dashed' } },
        },
        {
          type: 'value',
          name: 't/day',
          min: 20,
          max: 36,
          nameTextStyle: { color: '#94a3b8', fontSize: 10, align: 'left' },
          axisLabel: { color: '#94a3b8', fontSize: 10 },
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
          lineStyle: { color: '#0ea5e9', width: 2.2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(14, 165, 233, 0.20)' },
                { offset: 1, color: 'rgba(14, 165, 233, 0.0)' },
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
          lineStyle: { color: '#94a3b8', width: 1.8, type: 'dashed' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(148, 163, 184, 0.10)' },
                { offset: 1, color: 'rgba(148, 163, 184, 0.0)' },
              ],
            },
          },
          data: baselineFuel,
        },
      ],
    }
  }

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
      nameTextStyle: { color: '#94a3b8', fontSize: 10 },
      axisLabel: { color: '#94a3b8', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)', type: 'dashed' } },
    },
    series: [
      {
        name: cfg.name,
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#0ea5e9', width: 2.2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(14, 165, 233, 0.20)' },
              { offset: 1, color: 'rgba(14, 165, 233, 0.0)' },
            ],
          },
        },
        data: cfg.data,
      },
    ],
  }
}

const chartOption = computed(() => getChartConfig(false))
const expandedChartOption = computed(() => getChartConfig(true))
</script>

<template>
  <Card class="border border-border/50 bg-card shadow-xs flex flex-col h-full">
    <CardHeader class="p-4 pb-2">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Telemetry Timeline</div>
          <CardTitle class="text-sm font-semibold flex items-center gap-2">
            <Activity class="size-4 text-primary" />
            <span>24-Hour Trends & Profiles</span>
          </CardTitle>
          <CardDescription class="text-xs">
            {{ modeDescriptions[activeMode] }}
          </CardDescription>
        </div>

        <!-- Quick Switcher Pills & Controls -->
        <div class="flex items-center gap-2">
          <div class="h-8 flex items-center bg-muted/50 p-1 rounded-lg border border-border/40">
            <button
              v-for="m in modes"
              :key="m.key"
              @click="selectMode(m.key)"
              :class="[
                'h-6 px-2.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 cursor-pointer',
                activeMode === m.key
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              ]"
            >
              <component :is="m.icon" class="size-3" />
              {{ m.label }}
            </button>
          </div>

          <!-- Expand Chart Button -->
          <Button
            variant="outline"
            size="icon"
            class="size-8 cursor-pointer text-muted-foreground hover:text-foreground"
            title="Expand chart for deep inspection"
            @click="isExpanded = true"
          >
            <Maximize2 class="size-3.5" />
          </Button>
        </div>
      </div>
    </CardHeader>

    <CardContent class="p-4 pt-1 flex-1 flex flex-col justify-between">
      <!-- Symmetrical Stat Strip (Synchronized with Cylinder Bar Chart) -->
      <div class="grid grid-cols-3 gap-3 py-1.5 px-3 rounded-lg bg-muted/20 border border-border/30 text-center text-xs h-12 items-center mb-1">
        <div>
          <div class="text-[10px] text-muted-foreground leading-none">{{ currentStats.label1 }}</div>
          <div class="text-sm font-bold font-mono text-foreground leading-tight mt-0.5">{{ currentStats.val1 }}</div>
        </div>
        <div>
          <div class="text-[10px] text-muted-foreground leading-none">{{ currentStats.label2 }}</div>
          <div class="text-sm font-bold font-mono text-primary leading-tight mt-0.5">{{ currentStats.val2 }}</div>
        </div>
        <div>
          <div class="text-[10px] text-muted-foreground leading-none">Observation</div>
          <div class="text-xs font-mono font-medium text-muted-foreground leading-tight mt-0.5">24h Nominal</div>
        </div>
      </div>

      <!-- ECharts Container -->
      <div class="relative w-full">
        <ClientOnly>
          <VChart
            :option="chartOption"
            :update-options="{ notMerge: true }"
            autoresize
            style="height: 220px; width: 100%;"
          />
          <template #fallback>
            <Skeleton class="h-[220px] w-full rounded-xl" />
          </template>
        </ClientOnly>
      </div>
    </CardContent>

    <!-- Deep Inspection Modal Overlay -->
    <Teleport to="body">
      <div
        v-if="isExpanded"
        class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 sm:p-6 md:p-10 animate-in fade-in-0 duration-200"
      >
        <div
          class="relative w-full max-w-5xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <!-- Modal Header -->
          <div class="flex items-center justify-between p-5 border-b border-border bg-muted/20">
            <div class="flex items-center gap-3">
              <div class="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Activity class="size-5" />
              </div>
              <div>
                <h2 class="text-lg font-bold text-foreground">
                  24-Hour Telemetry Inspection &amp; Profiles
                </h2>
                <p class="text-xs text-muted-foreground">
                  {{ modeDescriptions[activeMode] }}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <!-- Mode Tabs inside modal -->
              <div class="h-8 flex items-center bg-muted/50 p-1 rounded-lg border border-border/40">
                <button
                  v-for="m in modes"
                  :key="m.key"
                  @click="selectMode(m.key)"
                  :class="[
                    'h-6 px-3 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 cursor-pointer',
                    activeMode === m.key
                      ? 'bg-background text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  ]"
                >
                  <component :is="m.icon" class="size-3" />
                  {{ m.label }}
                </button>
              </div>

              <!-- Close Button -->
              <Button
                variant="ghost"
                size="icon"
                class="size-8 cursor-pointer"
                @click="isExpanded = false"
              >
                <X class="size-4" />
              </Button>
            </div>
          </div>

          <!-- Modal Body -->
          <div class="p-6 space-y-4 overflow-y-auto">
            <!-- Inspection Stat Badges -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="p-3 rounded-xl bg-muted/30 border border-border/40">
                <div class="text-xs text-muted-foreground">{{ currentStats.label1 }}</div>
                <div class="text-xl font-bold font-mono text-foreground mt-0.5">{{ currentStats.val1 }}</div>
              </div>
              <div class="p-3 rounded-xl bg-muted/30 border border-border/40">
                <div class="text-xs text-muted-foreground">{{ currentStats.label2 }}</div>
                <div class="text-xl font-bold font-mono text-primary mt-0.5">{{ currentStats.val2 }}</div>
              </div>
              <div class="p-3 rounded-xl bg-muted/30 border border-border/40">
                <div class="text-xs text-muted-foreground">Resolution</div>
                <div class="text-xl font-bold font-mono text-foreground mt-0.5">2-hour intervals</div>
              </div>
              <div class="p-3 rounded-xl bg-muted/30 border border-border/40">
                <div class="text-xs text-muted-foreground">Operating Regime</div>
                <div class="text-xl font-bold font-mono text-teal-400 mt-0.5">Steady Transit</div>
              </div>
            </div>

            <!-- Full Expanded EChart -->
            <div class="w-full bg-card/60 p-4 rounded-xl border border-border/40">
              <ClientOnly>
                <VChart
                  :option="expandedChartOption"
                  autoresize
                  style="height: 380px; width: 100%;"
                />
              </ClientOnly>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </Card>
</template>
