<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  CloudRain,
  Anchor,
  Zap,
  Ship,
  Wind,
  ShieldCheck,
  ArrowDownRight,
  TrendingDown,
  Gauge,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Package,
  Layers,
  Sparkles,
} from 'lucide-vue-next'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  chartTextColor,
  chartAxisColor,
  chartSplitLineColor,
  chartTooltipBg,
  chartTooltipBorder,
  chartTooltipText,
  toRgba,
} from '../ui/charts/useChartTheme'
import type {
  WeatherImpactData,
  HullPropulsionData,
  EngineSfocData,
  OperationalProfileData,
} from '../../../../server/utils/marine/performance-widgets'

use([
  CanvasRenderer,
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
])

const props = defineProps<{
  weather: WeatherImpactData
  propulsion: HullPropulsionData
  engine: EngineSfocData
  operations: OperationalProfileData
}>()

type TelemetryTab = 'weather' | 'propulsion' | 'engine' | 'operations'
const activeTab = ref<TelemetryTab>('weather')

const tabs = [
  { id: 'weather' as const, label: 'Weather & Sea-State', icon: CloudRain, badge: 'Sea Margin' },
  { id: 'propulsion' as const, label: 'Hull & Propulsion', icon: Anchor, badge: 'Biofouling' },
  { id: 'engine' as const, label: 'Engine SFOC', icon: Zap, badge: 'Combustion' },
  { id: 'operations' as const, label: 'Voyage Profile', icon: Ship, badge: 'Operational' },
]

// 1. Weather Chart Option: Beaufort Distribution & Speed Loss Curve
const weatherChartOption = computed(() => {
  const badWeather = Number(props.weather?.badWeatherPct ?? 28)
  const calmPct = Math.max(10, 100 - badWeather - 22)
  const moderatePct = 22
  const roughPct = Number((badWeather * 0.65).toFixed(1))
  const galePct = Number((badWeather * 0.35).toFixed(1))

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: chartTooltipBg.value,
      borderColor: chartTooltipBorder.value,
      textStyle: { color: chartTooltipText.value, fontSize: 11 },
      axisPointer: { type: 'shadow' },
    },
    grid: { top: 25, right: 40, bottom: 25, left: 35 },
    xAxis: {
      type: 'category',
      data: ['BF 0–3 (Calm)', 'BF 4–5 (Moderate)', 'BF 6 (Rough)', 'BF 7+ (Gale)'],
      axisLabel: { color: chartTextColor.value, fontSize: 10 },
      axisLine: { lineStyle: { color: chartAxisColor.value } },
    },
    yAxis: [
      {
        type: 'value',
        name: 'Days %',
        nameTextStyle: { color: chartTextColor.value, fontSize: 10 },
        axisLabel: { color: chartTextColor.value, fontSize: 10 },
        splitLine: { lineStyle: { color: chartSplitLineColor.value, type: 'dashed' } },
      },
      {
        type: 'value',
        name: 'kts loss',
        nameTextStyle: { color: chartTextColor.value, fontSize: 10 },
        axisLabel: { color: chartTextColor.value, fontSize: 10 },
        splitLine: { show: false },
        min: -2.5,
        max: 0,
      },
    ],
    series: [
      {
        name: 'Exposure %',
        type: 'bar',
        barWidth: 26,
        data: [
          { value: calmPct, itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] } },
          { value: moderatePct, itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] } },
          { value: roughPct, itemStyle: { color: '#f59e0b', borderRadius: [4, 4, 0, 0] } },
          { value: galePct, itemStyle: { color: '#ef4444', borderRadius: [4, 4, 0, 0] } },
        ],
      },
      {
        name: 'Speed Deficit (kts)',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        data: [0, -0.3, -Number(props.weather?.speedLossKnots ?? 1.2), -Number((props.weather?.speedLossKnots * 1.5).toFixed(1))],
        lineStyle: { width: 2.5, color: '#f59e0b' },
        itemStyle: { color: '#f59e0b' },
      },
    ],
  }
})

// 2. Propulsion Chart Option: Speed vs Shaft Power Curves (Baseline vs Fouled)
const propulsionChartOption = computed(() => {
  const penaltyFactor = 1 + (Number(props.propulsion?.dragPenaltyPct ?? 12.6) / 100)
  const baselinePowers = [3200, 4200, 5400, 6800, 8500, 10500]
  const currentPowers = baselinePowers.map((p) => Math.round(p * penaltyFactor))

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: chartTooltipBg.value,
      borderColor: chartTooltipBorder.value,
      textStyle: { color: chartTooltipText.value, fontSize: 11 },
      formatter: (params: any) => {
        const speed = params[0]?.axisValue
        const base = params[0]?.value
        const curr = params[1]?.value
        const diff = curr && base ? Math.round(((curr - base) / base) * 100) : 0
        return `<b>${speed}</b><br/>Sea Trial: ${base} kW<br/>Attained: <b>${curr} kW</b> (+${diff}%)`
      },
    },
    legend: {
      top: 0,
      right: 10,
      itemWidth: 12,
      itemHeight: 12,
      textStyle: { color: chartTextColor.value, fontSize: 10 },
      data: ['Clean Trial Baseline', 'Current Attained (Fouled)'],
    },
    grid: { top: 30, right: 25, bottom: 25, left: 45 },
    xAxis: {
      type: 'category',
      data: ['10 kts', '11 kts', '12 kts', '13 kts', '14 kts', '15 kts'],
      axisLabel: { color: chartTextColor.value, fontSize: 10 },
      axisLine: { lineStyle: { color: chartAxisColor.value } },
    },
    yAxis: {
      type: 'value',
      name: 'kW',
      nameTextStyle: { color: chartTextColor.value, fontSize: 10 },
      axisLabel: { color: chartTextColor.value, fontSize: 10 },
      splitLine: { lineStyle: { color: chartSplitLineColor.value, type: 'dashed' } },
    },
    series: [
      {
        name: 'Clean Trial Baseline',
        type: 'line',
        smooth: true,
        data: baselinePowers,
        lineStyle: { width: 2, type: 'dashed', color: '#94a3b8' },
        itemStyle: { color: '#94a3b8' },
      },
      {
        name: 'Current Attained (Fouled)',
        type: 'line',
        smooth: true,
        data: currentPowers,
        lineStyle: { width: 2.5, color: '#f59e0b' },
        itemStyle: { color: '#f59e0b' },
        areaStyle: { color: 'rgba(245, 158, 11, 0.12)' },
        markPoint: {
          symbol: 'pin',
          symbolSize: 32,
          itemStyle: { color: '#f59e0b' },
          data: [
            {
              coord: [3, currentPowers[3]],
              name: 'Cruising Speed',
            },
          ],
        },
      },
    ],
  }
})

// 3. Engine SFOC Chart Option: SFOC vs Engine Load Curve
const engineChartOption = computed(() => {
  const attained = Number(props.engine?.currentSfoc ?? 174.3)
  const shop = Number(props.engine?.expectedSfoc ?? 187)
  const fleet = Number(props.engine?.fleetAvgSfoc ?? 176)

  // Mathematically smooth marine diesel bathtub curves (minimum at 75-85% MCR)
  const shopCurve = [
    Math.round(shop * 1.12),
    Math.round(shop * 1.04),
    shop,
    Math.round(shop * 1.01),
    Math.round(shop * 1.08),
  ]
  const fleetCurve = [
    Math.round(fleet * 1.13),
    Math.round(fleet * 1.05),
    fleet,
    Math.round(fleet * 1.02),
    Math.round(fleet * 1.09),
  ]

  const yMin = Math.max(140, Math.floor(Math.min(attained, shop, fleet) * 0.9 / 10) * 10)
  const yMax = Math.ceil(Math.max(attained, shop * 1.12, fleet * 1.13) * 1.08 / 10) * 10

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: chartTooltipBg.value,
      borderColor: chartTooltipBorder.value,
      textStyle: { color: chartTooltipText.value, fontSize: 11 },
      formatter: (params: any) => {
        const load = params[0]?.axisValue
        return `<b>Engine Load: ${load}</b><br/>Shop Trial: ${params[0]?.value} g/kWh<br/>Fleet Benchmark: ${params[1]?.value} g/kWh`
      },
    },
    legend: {
      top: 0,
      right: 10,
      itemWidth: 12,
      itemHeight: 12,
      textStyle: { color: chartTextColor.value, fontSize: 10 },
      data: ['Shop Trial Curve', 'Fleet Benchmark'],
    },
    grid: { top: 30, right: 25, bottom: 25, left: 42 },
    xAxis: {
      type: 'category',
      data: ['25% MCR', '50% MCR', '75% MCR', '85% MCR', '100% MCR'],
      axisLabel: { color: chartTextColor.value, fontSize: 10 },
      axisLine: { lineStyle: { color: chartAxisColor.value } },
    },
    yAxis: {
      type: 'value',
      name: 'g/kWh',
      min: yMin,
      max: yMax,
      nameTextStyle: { color: chartTextColor.value, fontSize: 10 },
      axisLabel: { color: chartTextColor.value, fontSize: 10 },
      splitLine: { lineStyle: { color: chartSplitLineColor.value, type: 'dashed' } },
    },
    series: [
      {
        name: 'Shop Trial Curve',
        type: 'line',
        smooth: true,
        data: shopCurve,
        lineStyle: { width: 2, type: 'dashed', color: '#10b981' },
        itemStyle: { color: '#10b981' },
      },
      {
        name: 'Fleet Benchmark',
        type: 'line',
        smooth: true,
        data: fleetCurve,
        lineStyle: { width: 1.5, type: 'dotted', color: '#94a3b8' },
        itemStyle: { color: '#94a3b8' },
      },
      {
        name: 'Vessel Operating Point',
        type: 'line',
        data: [],
        markPoint: {
          symbol: 'circle',
          symbolSize: 13,
          itemStyle: { color: attained > shop + 5 ? '#f59e0b' : '#10b981', borderColor: '#ffffff', borderWidth: 2 },
          data: [
            {
              coord: [2, attained],
              label: {
                show: true,
                formatter: `Attained: ${attained} g/kWh`,
                position: 'top',
                fontSize: 10,
                color: chartTextColor.value,
              },
            },
          ],
        },
      },
    ],
  }
})

// 4. Operations Chart Option: Interactive Donut Chart of Voyage Status
const operationsChartOption = computed(() => {
  const ops = props.operations
  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: chartTooltipBg.value,
      borderColor: chartTooltipBorder.value,
      textStyle: { color: chartTooltipText.value, fontSize: 11 },
      formatter: '{b}: <b>{c}%</b> of annual time',
    },
    legend: {
      orient: 'vertical',
      right: 15,
      top: 'middle',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: chartTextColor.value, fontSize: 10 },
    },
    series: [
      {
        name: 'Voyage Distribution',
        type: 'pie',
        radius: ['50%', '76%'],
        center: ['40%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 6,
        },
        data: [
          { value: Number(ops?.ladenPct ?? 30.7), name: 'Laden Leg', itemStyle: { color: '#10b981' } },
          { value: Number(ops?.ballastPct ?? 30.7), name: 'Ballast Leg', itemStyle: { color: '#14b8a6' } },
          { value: Number(ops?.portPct ?? 15.2), name: 'Port Operations', itemStyle: { color: '#3b82f6' } },
          { value: Number(ops?.anchoragePct ?? 18.4), name: 'Anchorage Idle', itemStyle: { color: '#f59e0b' } },
          { value: Number(ops?.maneuveringPct ?? 5.0), name: 'Maneuvering', itemStyle: { color: '#a855f7' } },
        ],
      },
    ],
  }
})
</script>

<template>
  <Card class="shadow-xs border-border/70 bg-card overflow-hidden">
    <CardHeader class="pb-3 border-b border-border/40">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <CardTitle class="text-base font-semibold flex items-center gap-2">
            <Layers class="size-4 text-primary" />
            Technical Performance & Diagnostic Telemetry
          </CardTitle>
          <CardDescription class="text-xs">
            Interactive analytical charts across weather exposure, hull fouling, combustion efficiency, and voyage profile
          </CardDescription>
        </div>

        <!-- Telemetry Pillar Tab Buttons -->
        <div class="flex flex-wrap items-center gap-1.5 bg-muted/40 p-1 rounded-lg border border-border/50">
          <button
            v-for="t in tabs"
            :key="t.id"
            type="button"
            :class="[
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer',
              activeTab === t.id
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            ]"
            @click="activeTab = t.id"
          >
            <component :is="t.icon" class="size-3.5" :class="activeTab === t.id ? 'text-primary' : 'text-muted-foreground'" />
            <span>{{ t.label }}</span>
          </button>
        </div>
      </div>
    </CardHeader>

    <CardContent class="p-4 sm:p-5">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        <!-- Main Interactive Graph (8 cols) -->
        <div class="lg:col-span-8 rounded-xl border border-border/50 bg-muted/10 p-3 flex flex-col justify-between">
          <div class="flex items-center justify-between pb-2 border-b border-border/30 text-xs">
            <span class="font-medium text-foreground flex items-center gap-1.5">
              <span class="size-2 rounded-full bg-primary" />
              <template v-if="activeTab === 'weather'">Beaufort Sea-State Exposure & Speed Loss Trajectory</template>
              <template v-else-if="activeTab === 'propulsion'">Speed-Power Curve: Sea Trial Baseline vs Attained Fouled Hull</template>
              <template v-else-if="activeTab === 'engine'">Specific Fuel Oil Consumption vs Engine Load (% MCR)</template>
              <template v-else-if="activeTab === 'operations'">Voyage Operational Status & Port Stay Time Breakdown</template>
            </span>
            <span class="text-[10px] font-mono text-muted-foreground">High-Resolution Telemetry</span>
          </div>

          <!-- Chart Area -->
          <div class="h-[235px] w-full pt-1">
            <ClientOnly>
              <VChart
                v-if="activeTab === 'weather'"
                :option="weatherChartOption"
                autoresize
                class="size-full"
              />
              <VChart
                v-else-if="activeTab === 'propulsion'"
                :option="propulsionChartOption"
                autoresize
                class="size-full"
              />
              <VChart
                v-else-if="activeTab === 'engine'"
                :option="engineChartOption"
                autoresize
                class="size-full"
              />
              <VChart
                v-else-if="activeTab === 'operations'"
                :option="operationsChartOption"
                autoresize
                class="size-full"
              />
              <template #fallback>
                <Skeleton class="h-[235px] w-full rounded-lg" />
              </template>
            </ClientOnly>
          </div>
        </div>

        <!-- Insight & Action Sidebar (4 cols) -->
        <div class="lg:col-span-4 flex flex-col justify-between gap-3 h-full">
          <!-- 1. Weather Insight Panel -->
          <div v-if="activeTab === 'weather'" class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-foreground uppercase tracking-wider">Sea-State Telemetry</span>
              <Badge
                variant="outline"
                :class="weather.imoExclusionEligible ? 'border-emerald-500/40 text-emerald-500 bg-emerald-500/5' : 'border-border text-muted-foreground'"
                class="text-[10px] font-mono"
              >
                {{ weather.imoExclusionEligible ? 'MEPC.355 Eligible' : 'Standard Baseline' }}
              </Badge>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div class="p-2.5 rounded-lg border border-border/50 bg-muted/20">
                <span class="text-[10px] text-muted-foreground block">Adverse Weather</span>
                <span class="text-xl font-bold font-mono text-foreground">{{ Number(weather.badWeatherPct).toFixed(1) }}%</span>
                <span class="text-[9px] text-muted-foreground block mt-0.5">~{{ Number(weather.averageBadWeatherDays).toFixed(1) }}d in BF≥6</span>
              </div>
              <div class="p-2.5 rounded-lg border border-border/50 bg-muted/20">
                <span class="text-[10px] text-muted-foreground block">Speed Deficit</span>
                <span class="text-xl font-bold font-mono text-amber-500">-{{ Number(weather.speedLossKnots).toFixed(1) }} <span class="text-xs font-normal">kts</span></span>
                <span class="text-[9px] text-muted-foreground block mt-0.5">Wave & Swell Drag</span>
              </div>
            </div>

            <div class="p-2.5 rounded-lg border border-border/40 bg-muted/15 text-xs space-y-1">
              <span class="text-[10px] uppercase font-bold text-muted-foreground">Executive Assessment</span>
              <p class="text-xs text-foreground leading-relaxed">
                Adverse weather exposure accounts for <b class="font-mono text-amber-500">+{{ Number(weather.excessCo2Mt).toFixed(1) }} MT</b> excess CO₂. Because exposure exceeds regulatory thresholds, IMO MEPC.355(78) correction deductions apply.
              </p>
            </div>
          </div>

          <!-- 2. Propulsion Insight Panel -->
          <div v-else-if="activeTab === 'propulsion'" class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-foreground uppercase tracking-wider">Hydrodynamic Drag</span>
              <Badge
                variant="outline"
                class="text-[10px] font-mono uppercase"
                :class="propulsion.cleaningStatus === 'critical' ? 'border-rose-500 text-rose-500 bg-rose-500/5' : 'border-amber-500 text-amber-500 bg-amber-500/5'"
              >
                {{ propulsion.cleaningStatus }}
              </Badge>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div class="p-2.5 rounded-lg border border-border/50 bg-muted/20">
                <span class="text-[10px] text-muted-foreground block">Time Loss</span>
                <span class="text-xl font-bold font-mono text-amber-500">{{ Number(propulsion.timeLossPct).toFixed(1) }}%</span>
                <span class="text-[9px] text-muted-foreground block mt-0.5">vs Sea Trial</span>
              </div>
              <div class="p-2.5 rounded-lg border border-border/50 bg-muted/20">
                <span class="text-[10px] text-muted-foreground block">Propeller Slip</span>
                <span class="text-xl font-bold font-mono text-foreground">{{ Number(propulsion.engineSlipPct).toFixed(1) }}%</span>
                <span class="text-[9px] text-muted-foreground block mt-0.5">Apparent slip</span>
              </div>
            </div>

            <div class="p-2.5 rounded-lg border border-border/40 bg-muted/15 text-xs space-y-1">
              <span class="text-[10px] uppercase font-bold text-muted-foreground">Executive Assessment</span>
              <p class="text-xs text-foreground leading-relaxed">
                Power penalty has drifted to <b class="font-mono text-amber-500">+{{ Number(propulsion.dragPenaltyPct).toFixed(1) }}%</b>. In-water propeller polishing recovers approximately <b class="font-mono text-emerald-500">~{{ Number(propulsion.powerRecoveryPotentialPct).toFixed(1) }}%</b> shaft power.
              </p>
            </div>
          </div>

          <!-- 3. Engine SFOC Insight Panel -->
          <div v-else-if="activeTab === 'engine'" class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-foreground uppercase tracking-wider">Combustion Health</span>
              <Badge
                variant="outline"
                class="text-[10px] font-mono uppercase"
                :class="engine.status === 'optimal' ? 'border-emerald-500 text-emerald-500 bg-emerald-500/5' : 'border-amber-500 text-amber-500 bg-amber-500/5'"
              >
                {{ engine.status === 'optimal' ? 'Optimal SFOC' : 'Normal Combustion' }}
              </Badge>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div class="p-2.5 rounded-lg border border-border/50 bg-muted/20">
                <span class="text-[10px] text-muted-foreground block">Attained SFOC</span>
                <span class="text-xl font-bold font-mono text-foreground">{{ Number(engine.currentSfoc).toFixed(1) }}</span>
                <span class="text-[9px] text-muted-foreground block mt-0.5">Target: {{ Number(engine.expectedSfoc).toFixed(0) }} g/kWh</span>
              </div>
              <div class="p-2.5 rounded-lg border border-border/50 bg-muted/20">
                <span class="text-[10px] text-muted-foreground block">Thermal Delta</span>
                <span
                  class="text-xl font-bold font-mono"
                  :class="engine.sfocDelta > 5 ? 'text-amber-500' : 'text-emerald-500'"
                >
                  {{ engine.sfocDelta > 0 ? '+' : '' }}{{ Number(engine.sfocDelta).toFixed(1) }}
                </span>
                <span class="text-[9px] text-muted-foreground block mt-0.5">Fleet Avg: {{ Number(engine.fleetAvgSfoc).toFixed(0) }}</span>
              </div>
            </div>

            <div class="p-2.5 rounded-lg border border-border/40 bg-muted/15 text-xs space-y-1">
              <span class="text-[10px] uppercase font-bold text-muted-foreground">Executive Assessment</span>
              <p class="text-xs text-foreground leading-relaxed">
                <template v-if="engine.sfocDelta > 8">
                  Combustion consumption has drifted <b class="font-mono text-amber-500">+{{ Number(engine.sfocDelta).toFixed(1) }} g/kWh</b> above target. Inspect scavenge air coolers and injector nozzles.
                </template>
                <template v-else-if="engine.sfocDelta > 3">
                  Combustion operates within acceptable variance (<b class="font-mono text-foreground">+{{ Number(engine.sfocDelta).toFixed(1) }} g/kWh</b>). Thermal efficiency remains stable.
                </template>
                <template v-else>
                  Main engine thermal efficiency is optimal. Scavenge air coolers and injection timing remain aligned with shop trial specifications.
                </template>
              </p>
            </div>
          </div>

          <!-- 4. Operations Insight Panel -->
          <div v-else-if="activeTab === 'operations'" class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-foreground uppercase tracking-wider">Voyage Utilization</span>
              <Badge variant="outline" class="text-[10px] font-mono border-border text-muted-foreground">
                Annual Time
              </Badge>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div class="p-2.5 rounded-lg border border-border/50 bg-muted/20">
                <span class="text-[10px] text-muted-foreground block">Cargo Laden Ratio</span>
                <span class="text-xl font-bold font-mono text-foreground">{{ Number(operations.ladenPct).toFixed(1) }}%</span>
                <span class="text-[9px] text-muted-foreground block mt-0.5">Ballast: {{ Number(operations.ballastPct).toFixed(1) }}%</span>
              </div>
              <div class="p-2.5 rounded-lg border border-border/50 bg-muted/20">
                <span class="text-[10px] text-muted-foreground block">Port Idle Stays</span>
                <span class="text-xl font-bold font-mono text-amber-500">{{ (Number(operations.portPct) + Number(operations.anchoragePct)).toFixed(1) }}%</span>
                <span class="text-[9px] text-muted-foreground block mt-0.5">~{{ Number(operations.nonProductiveFuelMt).toFixed(0) }} MT Fuel</span>
              </div>
            </div>

            <div class="p-2.5 rounded-lg border border-border/40 bg-muted/15 text-xs space-y-1">
              <span class="text-[10px] uppercase font-bold text-muted-foreground">Executive Assessment</span>
              <p class="text-xs text-foreground leading-relaxed">
                Over 60% of vessel time is non-productive port/anchorage stay. Connecting to shore-power / cold-ironing eliminates idle auxiliary emissions.
              </p>
            </div>
          </div>

          <!-- Footer Unified Action Tag -->
          <div class="pt-2 border-t border-border/40 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
            <span class="flex items-center gap-1.5">
              <Sparkles class="size-3 text-primary" /> Recommended Action:
            </span>
            <span class="font-medium text-foreground">
              <template v-if="activeTab === 'weather'">Apply MEPC.355 Deduction</template>
              <template v-else-if="activeTab === 'propulsion'">Diver Polish at Next Port</template>
              <template v-else-if="activeTab === 'engine'">Maintain Combustion Balance</template>
              <template v-else-if="activeTab === 'operations'">Engage Cold-Ironing / Shore Power</template>
            </span>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
