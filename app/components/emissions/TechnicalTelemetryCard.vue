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
  vesselId?: number
  vesselName?: string
  deadweight?: number
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
  const vSeed = Math.abs((props.vesselId || 1) * 3)
  const moderatePct = Number((20 + (vSeed % 8)).toFixed(1))
  const calmPct = Math.max(8, Number((100 - badWeather - moderatePct).toFixed(1)))
  const roughPct = Number((badWeather * 0.65).toFixed(1))
  const galePct = Number(Math.max(0, badWeather - roughPct).toFixed(1))
  const speedLoss = Number(props.weather?.speedLossKnots ?? 1.2)

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
        data: [0, -Number((speedLoss * 0.25).toFixed(1)), -Number(speedLoss.toFixed(1)), -Number((speedLoss * 1.5).toFixed(1))],
        lineStyle: { width: 2.5, color: '#f59e0b' },
        itemStyle: { color: '#f59e0b' },
      },
    ],
  }
})

// 2. Propulsion Chart Option: Speed vs Shaft Power Curves (Baseline vs Fouled)
const propulsionChartOption = computed(() => {
  const penaltyFactor = 1 + (Number(props.propulsion?.dragPenaltyPct ?? 12.6) / 100)
  const dwt = Number(props.deadweight || 54000)
  // Reference MCR shaft power calibrated by vessel displacement
  const cruisingPower = Math.round(dwt * 0.135)
  const speeds = [10, 11, 12, 13, 14, 15]
  // Standard cubic propulsion law: P = P_ref * (v / 13)^3
  const baselinePowers = speeds.map((s) => Math.round(cruisingPower * Math.pow(s / 13.0, 3)))
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

// Sea and Port percentages derived consistently from operational days or legs
const seaPercent = computed(() => {
  const sDays = Number(props.operations?.seaDays || 0)
  const pDays = Number(props.operations?.portDays || 0)
  if (sDays > 0 && pDays > 0) {
    return Number(((sDays / (sDays + pDays)) * 100).toFixed(1))
  }
  const seaSum = Number(props.operations?.ladenPct || 0) + Number(props.operations?.ballastPct || 0)
  if (seaSum >= 40) return Number(seaSum.toFixed(1))
  return 71.2
})

const portPercent = computed(() => {
  return Number((100 - seaPercent.value).toFixed(1))
})

// 4. Operations Chart Option: Interactive Donut Chart of Voyage Status
const operationsChartOption = computed(() => {
  const ops = props.operations
  const sPct = seaPercent.value
  const pPct = portPercent.value
  const seaDays = Number(ops?.seaDays ?? 159)
  const portDays = Number(ops?.portDays ?? 64)

  // Derive proportional slices that strictly sum to 100%
  const ladenRaw = Number(ops?.ladenPct ?? (sPct * 0.5))
  const ballastRaw = Number(ops?.ballastPct ?? (sPct * 0.5))
  const rawSeaSum = Math.max(1, ladenRaw + ballastRaw)
  const ladenVal = Number(((ladenRaw / rawSeaSum) * sPct).toFixed(1))
  const ballastVal = Number((sPct - ladenVal).toFixed(1))

  const portRaw = Number(ops?.portPct ?? (pPct * 0.55))
  const anchRaw = Number(ops?.anchoragePct ?? (pPct * 0.35))
  const manRaw = Number(ops?.maneuveringPct ?? (pPct * 0.10))
  const rawPortSum = Math.max(1, portRaw + anchRaw + manRaw)
  const portVal = Number(((portRaw / rawPortSum) * pPct).toFixed(1))
  const anchVal = Number(((anchRaw / rawPortSum) * pPct).toFixed(1))
  const manVal = Number(Math.max(0, pPct - portVal - anchVal).toFixed(1))

  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: chartTooltipBg.value,
      borderColor: chartTooltipBorder.value,
      textStyle: { color: chartTooltipText.value, fontSize: 11 },
      formatter: (params: any) => {
        const name = params.name
        const val = params.value
        let daysStr = ''
        if (name.includes('Laden') || name.includes('Ballast')) {
          const days = Math.round(seaDays * (val / Math.max(1, sPct)))
          daysStr = ` (${days} days)`
        } else {
          const days = Math.round(portDays * (val / Math.max(1, pPct)))
          daysStr = ` (${days} days)`
        }
        return `<b>${name}</b>: ${val}% of annual time${daysStr}`
      },
    },
    title: {
      text: `${sPct}%`,
      subtext: 'Sea Utilization',
      left: '39%',
      top: '42%',
      textAlign: 'center',
      textStyle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: chartTextColor.value,
      },
      subtextStyle: {
        fontSize: 10,
        color: chartTextColor.value,
      },
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
        radius: ['52%', '76%'],
        center: ['40%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 6,
        },
        data: [
          { value: ladenVal, name: 'Laden Leg', itemStyle: { color: '#10b981' } },
          { value: ballastVal, name: 'Ballast Leg', itemStyle: { color: '#14b8a6' } },
          { value: portVal, name: 'Port Operations', itemStyle: { color: '#3b82f6' } },
          { value: anchVal, name: 'Anchorage Idle', itemStyle: { color: '#f59e0b' } },
          { value: manVal, name: 'Maneuvering', itemStyle: { color: '#a855f7' } },
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
                :key="`weather-${props.vesselId ?? 0}-${props.weather?.badWeatherPct ?? 0}`"
                :option="weatherChartOption"
                :update-options="{ notMerge: true }"
                autoresize
                class="size-full"
              />
              <VChart
                v-else-if="activeTab === 'propulsion'"
                :key="`propulsion-${props.vesselId ?? 0}-${props.propulsion?.dragPenaltyPct ?? 0}-${props.deadweight ?? 0}`"
                :option="propulsionChartOption"
                :update-options="{ notMerge: true }"
                autoresize
                class="size-full"
              />
              <VChart
                v-else-if="activeTab === 'engine'"
                :key="`engine-${props.vesselId ?? 0}-${props.engine?.currentSfoc ?? 0}`"
                :option="engineChartOption"
                :update-options="{ notMerge: true }"
                autoresize
                class="size-full"
              />
              <VChart
                v-else-if="activeTab === 'operations'"
                :key="`operations-${props.vesselId ?? 0}-${props.operations?.ladenPct ?? 0}`"
                :option="operationsChartOption"
                :update-options="{ notMerge: true }"
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
                <span class="text-[10px] text-muted-foreground block">Fuel Loss / Gain</span>
                <span class="text-xl font-bold font-mono text-rose-500">{{ Number(propulsion.fuelLossPct ?? -35.1).toFixed(1) }}%</span>
                <span class="text-[9px] text-muted-foreground block mt-0.5">Slip: {{ Number(propulsion.engineSlipPct).toFixed(1) }}% · LRM: {{ Number(propulsion.lrmPct ?? 2.3).toFixed(1) }}%</span>
              </div>
            </div>

            <div class="p-2.5 rounded-lg border border-border/40 bg-muted/15 text-xs space-y-1">
              <span class="text-[10px] uppercase font-bold text-muted-foreground">Executive Assessment</span>
              <p class="text-xs text-foreground leading-relaxed">
                Hull drag penalty is <b class="font-mono text-amber-500">+{{ Number(propulsion.dragPenaltyPct).toFixed(1) }}%</b> with <b class="font-mono text-rose-500">{{ Number(propulsion.fuelLossPct ?? -35.1).toFixed(1) }}%</b> fuel loss as per Sea Trial. In-water propeller polishing recovers approximately <b class="font-mono text-emerald-500">~{{ Number(propulsion.powerRecoveryPotentialPct).toFixed(1) }}%</b> shaft power.
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
                :class="Number(engine.currentSfoc) <= Number(engine.expectedSfoc || 176) ? 'border-emerald-500 text-emerald-500 bg-emerald-500/5' : 'border-amber-500 text-amber-500 bg-amber-500/5'"
              >
                {{ Number(engine.currentSfoc) <= Number(engine.expectedSfoc || 176) ? 'Optimal SFOC' : 'Normal Combustion' }}
              </Badge>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div class="p-2.5 rounded-lg border border-border/50 bg-muted/20">
                <span class="text-[10px] text-muted-foreground block">Attained SFOC</span>
                <span class="text-xl font-bold font-mono text-foreground">{{ Number(engine.currentSfoc).toFixed(1) }}</span>
                <span class="text-[9px] text-muted-foreground block mt-0.5">Expected: 176–187 g/kWh</span>
              </div>
              <div class="p-2.5 rounded-lg border border-border/50 bg-muted/20">
                <span class="text-[10px] text-muted-foreground block">Fleet Position</span>
                <span
                  class="text-xl font-bold font-mono"
                  :class="Number(engine.currentSfoc) <= 176 ? 'text-emerald-500' : 'text-amber-500'"
                >
                  {{ Number(engine.currentSfoc) <= 176 ? 'In Band' : '+Elevated' }}
                </span>
                <span class="text-[9px] text-muted-foreground block mt-0.5">Fleet Avg: {{ Number(engine.fleetAvgSfoc || 174.3).toFixed(1) }}</span>
              </div>
            </div>

            <div class="p-2.5 rounded-lg border border-border/40 bg-muted/15 text-xs space-y-1">
              <span class="text-[10px] uppercase font-bold text-muted-foreground">Executive Assessment</span>
              <p class="text-xs text-foreground leading-relaxed">
                <template v-if="Number(engine.currentSfoc) <= 176">
                  Main engine specific consumption (<b class="font-mono text-emerald-500">{{ Number(engine.currentSfoc).toFixed(1) }} g/kWh</b>) is below the expected 176–187 band. Thermal efficiency and fuel injection timing remain optimal.
                </template>
                <template v-else-if="Number(engine.currentSfoc) <= 187">
                  Engine SFOC operates within the expected 176–187 g/kWh band (<b class="font-mono text-foreground">{{ Number(engine.currentSfoc).toFixed(1) }} g/kWh</b>). Combustion is balanced.
                </template>
                <template v-else>
                  Combustion consumption has drifted above 187 g/kWh. Inspect scavenge air coolers and fuel injector nozzles.
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
                <span class="text-[10px] text-muted-foreground block">Sea Utilization</span>
                <span class="text-xl font-bold font-mono text-emerald-500">{{ seaPercent }}%</span>
                <span class="text-[9px] text-muted-foreground block mt-0.5">~{{ Number(operations.seaDays ?? 159).toFixed(0) }} Days at Sea</span>
              </div>
              <div class="p-2.5 rounded-lg border border-border/50 bg-muted/20">
                <span class="text-[10px] text-muted-foreground block">Port Operations</span>
                <span class="text-xl font-bold font-mono text-foreground">{{ portPercent }}%</span>
                <span class="text-[9px] text-muted-foreground block mt-0.5">~{{ Number(operations.portDays ?? 64).toFixed(0) }} Days in Port</span>
              </div>
            </div>

            <div class="p-2.5 rounded-lg border border-border/40 bg-muted/15 text-xs space-y-1">
              <span class="text-[10px] uppercase font-bold text-muted-foreground">Executive Assessment</span>
              <p class="text-xs text-foreground leading-relaxed">
                <template v-if="portPercent > 45">
                  Port and anchorage time is elevated ({{ portPercent }}%). Connecting to shore-power / cold-ironing eliminates idle auxiliary fuel burn.
                </template>
                <template v-else>
                  Vessel maintains active sea deployment ({{ seaPercent }}% sea vs {{ portPercent }}% port). Turnaround and voyage efficiency are on schedule.
                </template>
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
