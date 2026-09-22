<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  X,
  Calendar,
  Gauge,
  Fuel,
  Wind,
  Navigation,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sliders,
  SlidersHorizontal,
  Layers,
  Zap,
  ShieldAlert,
  Leaf,
  Compass,
  AlertTriangle,
  BarChart3,
  PieChart as PieIcon,
  Activity,
  Maximize2,
  Minimize2,
  TrendingUp,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useVoyageOptimization } from '~/composables/useVoyageOptimization'
import type { DailyNoonReport } from '~/lib/voyage-optimization'

import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import {
  BarChart as EChartsBarChart,
  PieChart as EChartsPieChart,
  LineChart as EChartsLineChart,
  ScatterChart as EChartsScatterChart,
} from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import {
  chartTextColor,
  chartAxisColor,
  chartSplitLineColor,
  chartTooltipBg,
  chartTooltipBorder,
  chartTooltipText,
} from '@/components/ui/charts/useChartTheme'

use([
  CanvasRenderer,
  EChartsBarChart,
  EChartsPieChart,
  EChartsLineChart,
  EChartsScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
])

const isExpanded = ref(false)

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'ask-copilot', prompt: string): void
}>()

const {
  selectedDay,
  dailyNoons,
  routeStrategies,
  activeStrategy,
  advisories,
  currentVoyage,
  isCiiLoading,
  ciiLoadError,
  setStrategy,
  applyAdvisory,
  selectDay,
} = useVoyageOptimization()

const activeTab = ref<'noon' | 'sea-trial' | 'shop-trial' | 'strategies'>('noon')

// If a day is selected from the map, switch to noon log tab if currently on strategies
watch(selectedDay, (day) => {
  if (day && activeTab.value === 'strategies') {
    activeTab.value = 'noon'
  }
})

// Current day to display (selected day or latest day)
const currentNoon = computed<DailyNoonReport | null>(() => {
  if (selectedDay.value) return selectedDay.value
  return dailyNoons.value[dailyNoons.value.length - 1] || null
})

// Summary of degraded days across the voyage
const degradationSummary = computed(() => {
  const degraded = dailyNoons.value.filter((d) => d.rating === 'D' || d.rating === 'E')
  if (degraded.length === 0) return null
  const worstDay = [...degraded].sort((a, b) => b.attainedCii - a.attainedCii)[0]!
  const minDay = Math.min(...degraded.map((d) => d.dayNumber))
  const maxDay = Math.max(...degraded.map((d) => d.dayNumber))
  return {
    count: degraded.length,
    dayRange: minDay === maxDay ? `Day ${minDay}` : `D${minDay}–D${maxDay}`,
    worstDay,
  }
})

function ciiDotClass(rating: string): string {
  switch (rating) {
    case 'A': return 'bg-emerald-400'
    case 'B': return 'bg-teal-400'
    case 'C': return 'bg-amber-400'
    case 'D': return 'bg-orange-500'
    case 'E': return 'bg-rose-500'
    default: return 'bg-muted-foreground'
  }
}

function ciiRatingBadge(rating: string): { bg: string; text: string } {
  switch (rating) {
    case 'A': return { bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400', text: 'IMO Band A (Superior)' }
    case 'B': return { bg: 'bg-teal-500/15 border-teal-500/30 text-teal-600 dark:text-teal-400', text: 'IMO Band B (Compliant)' }
    case 'C': return { bg: 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400', text: 'IMO Band C (Standard)' }
    case 'D': return { bg: 'bg-orange-500/15 border-orange-500/30 text-orange-600 dark:text-orange-400', text: 'IMO Band D (Corrective Action)' }
    case 'E': return { bg: 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400', text: 'IMO Band E (Non-Compliant)' }
    default: return { bg: 'bg-muted border-border text-muted-foreground', text: 'Band C' }
  }
}

// 1. Interactive 26-Day Voyage CII Trajectory Bar Chart
const ciiTrajectoryChartOption = computed(() => {
  const noons = dailyNoons.value
  if (noons.length === 0) return null

  const xData = noons.map((n) => `D${n.dayNumber}`)
  const requiredCii = noons[0]?.requiredCii || 3.65

  const ratingColors: Record<string, string> = {
    A: '#10b981',
    B: '#14b8a6',
    C: '#f59e0b',
    D: '#f97316',
    E: '#f43f5e',
  }

  // Dynamic clamping: prevents extreme outlier days (e.g. Day 8 = 165) from flattening normal days (3-8)
  const yAxisMax = Math.max(16, Math.min(25, Math.ceil(requiredCii * 2.2)))

  const seriesData = noons.map((n) => {
    const isSelected = currentNoon.value?.dayNumber === n.dayNumber
    const color = ratingColors[n.rating] || '#94a3b8'
    const isOutlier = n.attainedCii > yAxisMax
    const displayValue = isOutlier ? yAxisMax : n.attainedCii
    return {
      value: displayValue,
      actualCii: n.attainedCii,
      isOutlier,
      itemStyle: {
        color: isOutlier ? '#f43f5e' : color,
        borderRadius: [3, 3, 0, 0],
        borderColor: isSelected ? '#ffffff' : (isOutlier ? '#fda4af' : 'transparent'),
        borderWidth: isSelected ? 2 : (isOutlier ? 1 : 0),
        shadowBlur: isSelected ? 6 : 0,
        shadowColor: color,
      },
      label: isOutlier ? {
        show: true,
        position: 'top',
        formatter: `▲ ${Math.round(n.attainedCii)}`,
        fontSize: 8,
        fontWeight: 'bold',
        color: '#f43f5e',
      } : undefined,
    }
  })

  return {
    grid: {
      top: 18,
      right: 12,
      bottom: 22,
      left: 36,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: chartTooltipBg.value,
      borderColor: chartTooltipBorder.value,
      borderWidth: 1,
      padding: [6, 10],
      textStyle: { color: chartTooltipText.value, fontSize: 11 },
      formatter: (params: any) => {
        const item = params[0]
        if (!item) return ''
        const index = item.dataIndex
        const noon = noons[index]
        if (!noon) return ''
        const color = ratingColors[noon.rating] || '#94a3b8'
        const isOutlier = noon.attainedCii > yAxisMax
        return `
          <div class="space-y-0.5 text-xs">
            <div class="font-bold flex items-center justify-between gap-3">
              <span>Day ${noon.dayNumber} · ${noon.dateFormatted.slice(0, 10)}</span>
              <span class="px-1 py-0.2 rounded font-mono text-[10px]" style="background:${color}22;color:${color};border:1px solid ${color}44;">Band ${noon.rating}</span>
            </div>
            <div>Attained CII: <b>${noon.attainedCii}</b> g/MT·NM ${isOutlier ? '<span style="color:#f43f5e;font-weight:bold;">(Outlier)</span>' : ''}</div>
            <div>Req. Baseline: <b>${noon.requiredCii}</b></div>
            <div style="opacity:0.75;font-size:10px;">24h Run: ${noon.distanceRunNm} NM · ${noon.sog} kts</div>
          </div>
        `
      },
      extraCssText: 'border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,0.2);',
    },
    xAxis: {
      type: 'category',
      data: xData,
      axisLabel: {
        color: chartTextColor.value,
        fontSize: 10,
        interval: noons.length > 20 ? 2 : 1,
      },
      axisLine: { lineStyle: { color: chartAxisColor.value } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      name: 'CII',
      max: yAxisMax,
      nameTextStyle: { color: chartTextColor.value, fontSize: 9, padding: [0, 14, 0, 0] },
      axisLabel: { color: chartTextColor.value, fontSize: 9 },
      splitLine: { lineStyle: { color: chartSplitLineColor.value, type: 'dashed' } },
    },
    series: [
      {
        name: 'Attained CII',
        type: 'bar',
        barMaxWidth: 16,
        data: seriesData,
        markLine: {
          symbol: 'none',
          data: [
            {
              yAxis: requiredCii,
              lineStyle: { color: '#f59e0b', type: 'dashed', width: 1.5 },
              label: {
                show: true,
                position: 'insideEndTop',
                formatter: `Req ${requiredCii}`,
                fontSize: 9,
                color: '#f59e0b',
              },
            },
          ],
        },
      },
    ],
  }
})

function handleChartClick(params: any) {
  if (params && typeof params.dataIndex === 'number') {
    const noon = dailyNoons.value[params.dataIndex]
    if (noon) {
      selectDay(noon)
    }
  }
}

// 2. AI Factor Attribution Donut Chart for the selected day
const factorDonutChartOption = computed(() => {
  const diag = currentNoon.value?.aiDiagnostics
  if (!diag || !diag.factors) return null

  const factorColors: Record<string, string> = {
    weather: '#38bdf8', // sky
    slip: '#f43f5e',    // rose
    distance: '#f59e0b',// amber
    fuel_rate: '#a855f7', // purple
  }

  const chartData = diag.factors.map((f) => ({
    name: f.name,
    value: f.scorePercent,
    metric: f.metric,
    severity: f.severity,
    itemStyle: {
      color: factorColors[f.key] || '#94a3b8',
    },
  }))

  const attained = currentNoon.value?.attainedCii || 0
  const rating = currentNoon.value?.rating || 'C'

  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: chartTooltipBg.value,
      borderColor: chartTooltipBorder.value,
      borderWidth: 1,
      padding: [6, 10],
      textStyle: { color: chartTooltipText.value, fontSize: 11 },
      formatter: (params: any) => {
        const d = params.data
        return `
          <div class="space-y-0.5 text-xs">
            <div class="font-semibold">${d.name}</div>
            <div>Attribution Impact: <b>${d.value}%</b></div>
            <div style="opacity:0.75;font-size:10px;">Metric: ${d.metric} (${d.severity})</div>
          </div>
        `
      },
      extraCssText: 'border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,0.2);',
    },
    series: [
      {
        type: 'pie',
        radius: ['52%', '78%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 4,
          borderColor: chartTooltipBg.value || '#18181b',
          borderWidth: 2,
        },
        label: {
          show: true,
          position: 'center',
          formatter: `{val|${attained}}\n{band|Band ${rating}}`,
          rich: {
            val: {
              fontSize: 15,
              fontWeight: 'bold',
              color: chartTextColor.value,
              lineHeight: 18,
            },
            band: {
              fontSize: 10,
              fontWeight: '600',
              color: rating === 'E' ? '#f43f5e' : rating === 'D' ? '#f97316' : rating === 'C' ? '#f59e0b' : '#10b981',
              lineHeight: 13,
            },
          },
        },
        data: chartData,
      },
    ],
  }
})

// 3. Sea Trial Speed vs. Power Reference Curve
const seaTrialChartOption = computed(() => {
  const noons = dailyNoons.value
  if (!noons.length) return null

  const baseSpeedData: [number, number][] = []
  for (let s = 9; s <= 17; s += 0.5) {
    const p = Math.round(4200 * Math.pow(s / 14, 3))
    baseSpeedData.push([s, p])
  }

  const scatterData = noons.map((n) => {
    const power = n.shaftPowerKw > 0 ? n.shaftPowerKw : Math.round(4200 * Math.pow(Math.max(n.sog, 8) / 14, 3))
    const color =
      n.rating === 'E'
        ? '#f43f5e'
        : n.rating === 'D'
        ? '#f97316'
        : n.rating === 'C'
        ? '#f59e0b'
        : '#10b981'
    return {
      name: `D${n.dayNumber}`,
      value: [n.sog, power],
      itemStyle: { color },
      noon: n,
    }
  })

  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: chartTooltipBg.value,
      borderColor: chartTooltipBorder.value,
      borderWidth: 1,
      padding: [6, 10],
      textStyle: { color: chartTooltipText.value, fontSize: 11 },
      formatter: (params: any) => {
        if (params.seriesName === 'Sea Trial Baseline') {
          return `<div class="text-xs font-sans"><b>Sea Trial Baseline:</b> ${params.value[0]} kts @ ${params.value[1]} kW</div>`
        }
        const d = params.data
        const n = d.noon as DailyNoonReport
        return `
          <div class="space-y-1 text-xs font-sans">
            <div class="font-bold flex items-center justify-between gap-2">
              <span>Day D${n.dayNumber} · Band ${n.rating}</span>
              <span class="text-[10px] text-muted-foreground">${n.dateFormatted.slice(0, 10)}</span>
            </div>
            <div>Speed: <b>${d.value[0]} kts</b> | Power: <b>${d.value[1]} kW</b></div>
            <div>Slip: <b>${n.slipPct ? n.slipPct + '%' : 'Unrecorded'}</b></div>
            <div>Fuel: <b>${n.fuelConsumedMt.total} MT/day</b> (${n.distanceRunNm} NM)</div>
          </div>
        `
      },
    },
    legend: {
      data: ['Sea Trial Baseline', 'Actual Daily Fixes'],
      textStyle: { color: chartTextColor.value, fontSize: 10 },
      top: 0,
      right: 10,
    },
    grid: { left: 45, right: 20, top: 30, bottom: 25 },
    xAxis: {
      type: 'value',
      name: 'Speed (kts)',
      min: 8,
      max: 18,
      axisLabel: { color: chartTextColor.value, fontSize: 10 },
      axisLine: { lineStyle: { color: chartAxisColor.value } },
      splitLine: { lineStyle: { color: chartSplitLineColor.value, type: 'dashed' } },
    },
    yAxis: {
      type: 'value',
      name: 'Power (kW)',
      min: 0,
      max: 8500,
      axisLabel: { color: chartTextColor.value, fontSize: 9 },
      axisLine: { lineStyle: { color: chartAxisColor.value } },
      splitLine: { lineStyle: { color: chartSplitLineColor.value, type: 'dashed' } },
    },
    series: [
      {
        name: 'Sea Trial Baseline',
        type: 'line',
        smooth: true,
        data: baseSpeedData,
        lineStyle: { color: '#38bdf8', width: 2 },
        showSymbol: false,
      },
      {
        name: 'Actual Daily Fixes',
        type: 'scatter',
        symbolSize: 10,
        data: scatterData,
      },
    ],
  }
})

// 4. Shop Trial SFOC Reference Curve
const shopTrialChartOption = computed(() => {
  const noons = dailyNoons.value
  if (!noons.length) return null

  const shopTrialBase: [number, number][] = [
    [40, 182],
    [50, 174],
    [65, 168],
    [75, 166],
    [85, 165],
    [100, 171],
  ]

  const scatterData = noons.map((n) => {
    const power = n.shaftPowerKw > 0 ? n.shaftPowerKw : Math.round(4200 * Math.pow(Math.max(n.sog, 8) / 14, 3))
    const loadPct = Math.min(100, Math.max(35, Math.round((power / 5200) * 100)))
    const sfoc = power > 0 ? Math.round((n.fuelConsumedMt.total * 1e6) / (power * 24)) : 172
    const color =
      sfoc > 185
        ? '#f43f5e'
        : sfoc > 175
        ? '#f59e0b'
        : '#10b981'
    return {
      name: `D${n.dayNumber}`,
      value: [loadPct, Math.min(220, Math.max(150, sfoc))],
      itemStyle: { color },
      noon: n,
      sfoc,
    }
  })

  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: chartTooltipBg.value,
      borderColor: chartTooltipBorder.value,
      borderWidth: 1,
      padding: [6, 10],
      textStyle: { color: chartTooltipText.value, fontSize: 11 },
      formatter: (params: any) => {
        if (params.seriesName === 'Shop Trial Baseline') {
          return `<div class="text-xs font-sans"><b>Shop Trial Testbed:</b> ${params.value[0]}% Load @ ${params.value[1]} g/kWh</div>`
        }
        const d = params.data
        const n = d.noon as DailyNoonReport
        return `
          <div class="space-y-1 text-xs font-sans">
            <div class="font-bold flex items-center justify-between gap-2">
              <span>Day D${n.dayNumber} · SFOC</span>
              <span class="text-[10px] text-muted-foreground">${n.dateFormatted.slice(0, 10)}</span>
            </div>
            <div>ME Load: <b>${d.value[0]}% MCR</b> | SFOC: <b>${d.sfoc} g/kWh</b></div>
            <div>Benchmark: ~165 g/kWh @ 85% MCR</div>
            <div>Delta: <b class="${d.sfoc > 175 ? 'text-rose-400' : 'text-emerald-400'}">${d.sfoc > 165 ? '+' : ''}${Math.round(((d.sfoc - 165) / 165) * 1000) / 10}%</b></div>
          </div>
        `
      },
    },
    legend: {
      data: ['Shop Trial Baseline', 'Actual Daily SFOC'],
      textStyle: { color: chartTextColor.value, fontSize: 10 },
      top: 0,
      right: 10,
    },
    grid: { left: 45, right: 20, top: 30, bottom: 25 },
    xAxis: {
      type: 'value',
      name: 'Load (% MCR)',
      min: 30,
      max: 105,
      axisLabel: { color: chartTextColor.value, fontSize: 10 },
      axisLine: { lineStyle: { color: chartAxisColor.value } },
      splitLine: { lineStyle: { color: chartSplitLineColor.value, type: 'dashed' } },
    },
    yAxis: {
      type: 'value',
      name: 'SFOC (g/kWh)',
      min: 150,
      max: 215,
      axisLabel: { color: chartTextColor.value, fontSize: 9 },
      axisLine: { lineStyle: { color: chartAxisColor.value } },
      splitLine: { lineStyle: { color: chartSplitLineColor.value, type: 'dashed' } },
    },
    series: [
      {
        name: 'Shop Trial Baseline',
        type: 'line',
        smooth: true,
        data: shopTrialBase,
        lineStyle: { color: '#f59e0b', width: 2, type: 'dashed' },
        showSymbol: true,
        symbolSize: 6,
      },
      {
        name: 'Actual Daily SFOC',
        type: 'scatter',
        symbolSize: 10,
        data: scatterData,
      },
    ],
  }
})

// 5. Sea Trial Benchmark Summary Stats
const seaTrialStats = computed(() => {
  const noons = dailyNoons.value
  if (!noons.length) return null
  const totalSog = noons.reduce((acc, n) => acc + n.sog, 0)
  const avgSog = Math.round((totalSog / noons.length) * 10) / 10

  const totalPower = noons.reduce((acc, n) => {
    const p = n.shaftPowerKw && n.shaftPowerKw > 0 ? n.shaftPowerKw : Math.round(4200 * Math.pow(Math.max(n.sog, 8) / 14, 3))
    return acc + p
  }, 0)
  const avgPower = Math.round(totalPower / noons.length)

  // Sea trial contract baseline: 14.0 kts @ 4,200 kW -> P = 4200 * (V/14)^3 => V = 14 * (P/4200)^(1/3)
  const baselineSpeed = Math.round(14 * Math.cbrt(avgPower / 4200) * 10) / 10
  const speedLoss = Math.round((avgSog - baselineSpeed) * 10) / 10

  const slipNoons = noons.filter((n) => typeof n.slipPct === 'number' && n.slipPct > 0)
  const avgSlip = slipNoons.length
    ? Math.round((slipNoons.reduce((acc, n) => acc + (n.slipPct || 0), 0) / slipNoons.length) * 10) / 10
    : 14.2

  return {
    avgSog,
    avgPower,
    baselineSpeed,
    speedLoss,
    avgSlip,
  }
})

// 6. Shop Trial Benchmark Summary Stats
const shopTrialStats = computed(() => {
  const noons = dailyNoons.value
  if (!noons.length) return null

  let totalSfoc = 0
  let totalLoad = 0
  noons.forEach((n) => {
    const power = n.shaftPowerKw && n.shaftPowerKw > 0 ? n.shaftPowerKw : Math.round(4200 * Math.pow(Math.max(n.sog, 8) / 14, 3))
    const loadPct = Math.min(100, Math.max(35, Math.round((power / 5200) * 100)))
    const sfoc = power > 0 ? Math.round((n.fuelConsumedMt.total * 1e6) / (power * 24)) : 172
    totalSfoc += sfoc
    totalLoad += loadPct
  })

  const avgSfoc = Math.round(totalSfoc / noons.length)
  const avgLoad = Math.round(totalLoad / noons.length)
  const baselineSfoc = 165 // Manufacturer testbed optimum SFOC @ 85% MCR
  const deltaPct = Math.round(((avgSfoc - baselineSfoc) / baselineSfoc) * 1000) / 10

  return {
    avgSfoc,
    avgLoad,
    baselineSfoc,
    deltaPct,
  }
})

function handleScatterClick(params: any) {
  if (params?.data?.noon) {
    selectDay(params.data.noon)
  }
}

// Only display fuels with nonzero consumption to avoid cluttered 0 MT rows
const activeFuelTypes = computed(() => {
  if (!currentNoon.value) return []
  const byType = currentNoon.value.fuelConsumedMt.byType || {}
  const list = Object.entries(byType)
    .filter(([_, f]) => f && f.value > 0)
    .map(([key, f]) => ({ key, label: f.label, value: f.value }))
  if (list.length === 0 && currentNoon.value.fuelConsumedMt.total > 0) {
    list.push({ key: 'total', label: 'Fuel Consumed', value: currentNoon.value.fuelConsumedMt.total })
  }
  return list
})
</script>

<template>
  <aside
    v-show="isOpen"
    :class="[
      'h-full shrink-0 border-l border-border bg-background/98 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden transition-all duration-300 z-30',
      isExpanded ? 'w-full sm:w-[720px] xl:w-[840px]' : 'w-full sm:w-[520px] xl:w-[580px]'
    ]"
  >
    <!-- Drawer Header Bar with Inline Tab Controls -->
    <div class="h-12 px-3.5 border-b border-border flex items-center justify-between shrink-0 bg-muted/40 gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <div class="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
          <Sliders class="w-3.5 h-3.5" />
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <h3 class="text-xs font-bold text-foreground leading-tight hidden sm:inline">Voyage Analytics</h3>
          <Badge v-if="currentVoyage" variant="outline" class="text-[10px] font-mono px-1.5 py-0">
            Voy. {{ currentVoyage }}
          </Badge>
        </div>

        <!-- Inline Navigation Tabs in the Header -->
        <Tabs v-model="activeTab" class="w-auto">
          <TabsList class="h-8 bg-background/80 border border-border/70 p-0.5">
            <TabsTrigger value="noon" class="text-[11px] px-2 h-7 cursor-pointer">
              <span>Noon</span>
              <span v-if="currentNoon" class="ml-1 px-1 py-0 rounded bg-primary/15 text-primary text-[9px] font-bold">
                D{{ currentNoon.dayNumber }}
              </span>
            </TabsTrigger>
            <TabsTrigger value="sea-trial" class="text-[11px] px-2 h-7 cursor-pointer">
              <span>Sea Trial</span>
            </TabsTrigger>
            <TabsTrigger value="shop-trial" class="text-[11px] px-2 h-7 cursor-pointer">
              <span>Shop Trial</span>
            </TabsTrigger>
            <TabsTrigger value="strategies" class="text-[11px] px-2 h-7 cursor-pointer">
              <span>Advisories</span>
              <span v-if="advisories.length" class="ml-1 px-1 py-0 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold">
                {{ advisories.length }}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7 text-muted-foreground hover:text-foreground hidden sm:flex cursor-pointer"
          :title="isExpanded ? 'Dock to 580px width' : 'Expand to 840px width for charts'"
          @click="isExpanded = !isExpanded"
        >
          <Minimize2 v-if="isExpanded" class="w-3.5 h-3.5" />
          <Maximize2 v-else class="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
          title="Close Drawer"
          @click="emit('close')"
        >
          <X class="w-4 h-4" />
        </Button>
      </div>
    </div>

    <!-- Drawer Body -->
    <div class="flex-1 min-h-0 overflow-hidden">
      <!-- TAB 1: DAILY NOON REPORT LOG -->
      <div v-if="activeTab === 'noon'" class="h-full overflow-y-auto p-3.5 space-y-3.5">
        <!-- AI Degradation Voyage Alert Banner -->
        <div
          v-if="degradationSummary"
          class="p-2.5 rounded-lg border border-orange-500/30 bg-orange-500/10 flex items-center justify-between text-xs text-orange-600 dark:text-orange-400 shadow-2xs animate-in fade-in"
        >
          <div class="flex items-center gap-2 min-w-0 pr-2">
            <AlertTriangle class="w-4 h-4 shrink-0 text-orange-500" />
            <span class="truncate">
              <strong>{{ degradationSummary.count }} degraded day(s)</strong> ({{ degradationSummary.dayRange }})
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            class="h-6 text-[11px] px-2 shrink-0 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 font-medium cursor-pointer"
            @click="selectDay(degradationSummary.worstDay)"
          >
            Jump to D{{ degradationSummary.worstDay.dayNumber }}
          </Button>
        </div>

        <!-- Day Selector Pill Strip -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <span class="font-medium">Voyage Progress Days:</span>
            <span class="text-[10px]">Click day to inspect</span>
          </div>
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
            <button
              v-for="noon in dailyNoons"
              :key="noon.dayNumber"
              type="button"
              class="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer shrink-0 select-none"
              :class="[
                currentNoon?.dayNumber === noon.dayNumber
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs ring-1 ring-primary/40'
                  : 'bg-muted/30 hover:bg-muted/70 text-foreground border-border/80'
              ]"
              @click="selectDay(noon)"
            >
              <span>D{{ noon.dayNumber }}</span>
              <span
                class="w-1.5 h-1.5 rounded-full"
                :class="currentNoon?.dayNumber === noon.dayNumber ? 'bg-white' : ciiDotClass(noon.rating)"
              />
            </button>
          </div>
        </div>

        <!-- Active Day Telemetry Card -->
        <template v-if="currentNoon">
          <Card class="border-border/80 shadow-2xs overflow-hidden">
            <CardHeader class="p-3 pb-2 border-b border-border/50 bg-muted/20">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <Calendar class="w-3.5 h-3.5 text-muted-foreground" />
                  <span class="text-xs font-mono font-bold text-foreground">
                    {{ currentNoon.dateFormatted }}
                  </span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="text-[10px] text-muted-foreground font-mono">
                    {{ currentNoon.coords[0].toFixed(2) }}°, {{ currentNoon.coords[1].toFixed(2) }}°
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent class="p-3 space-y-2.5">
              <!-- IMO Rating Band & Diagnostic Chips -->
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="flex items-center gap-2">
                  <div
                    class="w-8 h-8 rounded-md flex items-center justify-center font-bold text-sm font-mono shadow-xs border"
                    :class="[
                      currentNoon.rating === 'A' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400' :
                      currentNoon.rating === 'B' ? 'bg-teal-500/15 border-teal-500/40 text-teal-600 dark:text-teal-400' :
                      currentNoon.rating === 'C' ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400' :
                      currentNoon.rating === 'D' ? 'bg-orange-500/15 border-orange-500/40 text-orange-600 dark:text-orange-400' :
                      'bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400'
                    ]"
                  >
                    {{ currentNoon.rating }}
                  </div>
                  <div>
                    <div class="text-xs font-bold text-foreground">{{ ciiRatingBadge(currentNoon.rating).text }}</div>
                    <div class="text-[10px] text-muted-foreground font-mono">
                      Attained CII: <strong class="text-foreground">{{ currentNoon.attainedCii }}</strong> g/MT·NM · Req: {{ currentNoon.requiredCii }}
                    </div>
                  </div>
                </div>
                <Badge variant="outline" class="text-[10px] font-mono">
                  Work: {{ (currentNoon.transportWork / 1e6).toFixed(1) }}M MT·NM
                </Badge>
              </div>

              <!-- Diagnostic Chips (Replaces Text Bloat) -->
              <div class="flex flex-wrap gap-1.5 pt-0.5">
                <span
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border"
                  :class="currentNoon.weather.beaufort >= 6 ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 font-semibold' : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30'"
                >
                  <Wind class="w-3 h-3" />
                  BF {{ currentNoon.weather.beaufort }} · {{ currentNoon.weather.waveHeightM }}m seas
                </span>
                <span
                  v-if="currentNoon.slipPct !== undefined"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border"
                  :class="currentNoon.slipPct > 25 ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 font-semibold' : currentNoon.slipPct > 15 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'"
                >
                  <Activity class="w-3 h-3" />
                  Propeller Slip: {{ currentNoon.slipPct }}%
                </span>
                <span
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border"
                  :class="currentNoon.sog < 11 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'"
                >
                  <Gauge class="w-3 h-3" />
                  SOG {{ currentNoon.sog }} kts
                </span>
              </div>

              <!-- 24h Distance, Speed, & Propulsion Telemetry -->
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="p-2 rounded bg-muted/40 border border-border/60">
                  <span class="text-muted-foreground text-[10px] block">24h Run Distance</span>
                  <span class="font-bold text-foreground font-mono text-sm">{{ currentNoon.distanceRunNm }} NM</span>
                  <span class="text-[10px] text-muted-foreground block">Cumul: {{ currentNoon.cumulativeDistanceNm }} NM</span>
                </div>
                <div class="p-2 rounded bg-muted/40 border border-border/60">
                  <span class="text-muted-foreground text-[10px] block">Average 24h SOG</span>
                  <span class="font-bold text-foreground font-mono text-sm">{{ currentNoon.sog }} kts</span>
                  <span class="text-[10px] text-muted-foreground block">
                    {{ currentNoon.slipPct !== undefined && currentNoon.slipPct > 0 ? `Slip: ${currentNoon.slipPct}%` : `Draft: ${currentNoon.draftFwdM}m / ${currentNoon.draftAftM}m` }}
                  </span>
                </div>
              </div>

              <!-- Operational Guidance Callout -->
              <div
                v-if="currentNoon.aiDiagnostics"
                class="p-2.5 rounded bg-muted/40 border border-border/70 flex items-start gap-2 text-[11px] text-foreground"
              >
                <Compass class="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <div class="leading-tight">
                  <strong class="font-semibold text-foreground">Guidance:</strong>
                  <span class="ml-1 text-muted-foreground">{{ currentNoon.aiDiagnostics.recommendation }}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </template>
        <div
          v-else-if="!isCiiLoading"
          class="p-4 rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground"
        >
          {{ ciiLoadError ? 'Live CII data unavailable — upstream request failed.' : 'No noon report data for this vessel in the selected window.' }}
        </div>
        <div v-else class="p-4 text-center text-xs text-muted-foreground">
          Loading live noon report data…
        </div>

        <!-- Voyage CII Trajectory Chart (Clamped to prevent outlier distortion) -->
        <div v-if="dailyNoons.length > 0" class="p-3 rounded-lg border border-border/80 bg-card space-y-2 shadow-2xs">
          <div class="flex items-center justify-between text-xs font-semibold">
            <span class="flex items-center gap-1.5 text-foreground">
              <BarChart3 class="w-3.5 h-3.5 text-primary" />
              Voyage CII Trajectory
            </span>
            <span class="text-[10px] text-muted-foreground font-normal">
              Click bar to inspect · Target Band B
            </span>
          </div>
          <div class="w-full h-[140px]">
            <ClientOnly>
              <VChart
                v-if="ciiTrajectoryChartOption"
                :option="ciiTrajectoryChartOption"
                :autoresize="true"
                class="w-full h-full cursor-pointer"
                @click="handleChartClick"
              />
              <template #fallback>
                <Skeleton class="w-full h-full rounded" />
              </template>
            </ClientOnly>
          </div>
        </div>

        <!-- Factor Attribution Breakdown Card (NO REDUNDANT TEXT PROSE) -->
        <div
          v-if="currentNoon?.aiDiagnostics"
          class="p-3 rounded-lg border border-border/70 bg-card space-y-2.5 shadow-2xs"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5 min-w-0">
              <div class="w-5 h-5 rounded bg-muted flex items-center justify-center shrink-0">
                <Activity class="w-3.5 h-3.5 text-foreground" />
              </div>
              <span class="text-xs font-bold text-foreground truncate">Factor Attribution</span>
              <Badge variant="outline" class="text-[9px] uppercase font-mono px-1.5 py-0 border-border text-foreground shrink-0">
                {{ currentNoon.aiDiagnostics.driverLabel }}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              class="h-6 px-2 text-[10px] gap-1 font-medium bg-background hover:bg-muted border-border shrink-0 cursor-pointer"
              title="Audit telemetry with Operations Copilot"
              @click="emit('ask-copilot', currentNoon.aiDiagnostics.promptContext)"
            >
              <Sliders class="w-3 h-3 text-muted-foreground" />
              <span>Audit</span>
            </Button>
          </div>

          <!-- Donut & Breakdown Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center pt-1 border-t border-border/60">
            <!-- Donut Chart -->
            <div class="sm:col-span-5 flex items-center justify-center h-[120px]">
              <ClientOnly>
                <VChart
                  v-if="factorDonutChartOption"
                  :option="factorDonutChartOption"
                  :autoresize="true"
                  class="w-full h-full"
                />
                <template #fallback>
                  <Skeleton class="w-24 h-24 rounded-full mx-auto" />
                </template>
              </ClientOnly>
            </div>

            <!-- Factor Detail Metric Progress Bars -->
            <div class="sm:col-span-7 space-y-1.5">
              <div
                v-for="factor in currentNoon.aiDiagnostics.factors"
                :key="factor.key"
                class="p-1.5 px-2 rounded bg-muted/40 border border-border/60 space-y-1"
              >
                <div class="flex items-center justify-between text-[10px]">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span
                      class="w-2 h-2 rounded-full shrink-0"
                      :class="factor.key === 'weather' ? 'bg-sky-400' : factor.key === 'slip' ? 'bg-rose-500' : factor.key === 'distance' ? 'bg-amber-500' : 'bg-purple-500'"
                    />
                    <span class="font-medium text-foreground truncate">{{ factor.name }}</span>
                  </div>
                  <span
                    class="px-1 py-0.2 rounded font-mono font-bold text-[9px] shrink-0"
                    :class="factor.severity === 'critical' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : factor.severity === 'moderate' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'"
                  >
                    {{ factor.scorePercent }}%
                  </span>
                </div>
                <div class="w-full bg-muted/60 rounded-full h-1 overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all"
                    :class="factor.severity === 'critical' ? 'bg-rose-500' : factor.severity === 'moderate' ? 'bg-amber-500' : 'bg-emerald-500'"
                    :style="{ width: `${factor.scorePercent}%` }"
                  />
                </div>
                <div class="flex items-center justify-between text-[9px] text-muted-foreground">
                  <span class="font-mono font-semibold truncate pr-1">{{ factor.metric }}</span>
                  <span class="capitalize text-[9px] shrink-0 font-medium" :class="factor.severity === 'critical' ? 'text-rose-500' : factor.severity === 'moderate' ? 'text-amber-500' : 'text-emerald-500'">
                    {{ factor.severity }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Fuel Consumption Breakdown & Recorded Weather Grid (Only active fuels shown!) -->
        <div v-if="currentNoon" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <!-- Fuel Consumption -->
          <div class="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-2">
            <div class="flex items-center justify-between text-xs font-semibold">
              <span class="flex items-center gap-1.5 text-foreground">
                <Fuel class="w-3.5 h-3.5 text-amber-500" />
                24h Fuel Consumed
              </span>
              <span class="font-mono text-primary font-bold">{{ currentNoon.fuelConsumedMt.total }} MT</span>
            </div>
            <div class="space-y-1 text-[11px] text-muted-foreground pt-1 border-t border-border/60">
              <div v-for="fuel in activeFuelTypes" :key="fuel.key">
                {{ fuel.label }}: <strong class="text-foreground font-mono">{{ fuel.value }} MT</strong>
              </div>
              <div class="flex justify-between pt-1 border-t border-border/40 text-[10px]">
                <span>24h CO₂: <strong class="text-foreground font-mono">{{ currentNoon.totalCo2Mt }} MT</strong></span>
                <span>Voyage: <strong class="text-foreground font-mono">{{ currentNoon.cumulativeFuelMt }} MT</strong></span>
              </div>
            </div>
          </div>

          <!-- Recorded Weather at Position -->
          <div class="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-2">
            <div class="flex items-center justify-between text-xs font-semibold">
              <span class="flex items-center gap-1.5 text-foreground">
                <Wind class="w-3.5 h-3.5 text-cyan-500" />
                Recorded Weather
              </span>
              <Badge variant="outline" class="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold border-cyan-500/30">
                BF {{ currentNoon.weather.beaufort }}
              </Badge>
            </div>
            <div class="space-y-1 text-[11px] text-muted-foreground pt-1 border-t border-border/60">
              <div>Wind: <strong class="text-foreground">{{ currentNoon.weather.windSpeedKts }} kts ({{ currentNoon.weather.windDirectionDeg }}°)</strong></div>
              <div>Seas: <strong class="text-foreground">{{ currentNoon.weather.waveHeightM }}m wave</strong></div>
              <div class="text-[10px] text-muted-foreground truncate">{{ currentNoon.weather.swellDirection }} · {{ currentNoon.weather.shortForecast }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 2: SEA TRIAL (SPEED VS POWER BENCHMARK) -->
      <div v-else-if="activeTab === 'sea-trial'" class="h-full overflow-y-auto p-3.5 space-y-3.5">
        <!-- Benchmark Summary Card -->
        <div class="p-3 rounded-lg border border-border/80 bg-card space-y-2.5 shadow-2xs">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-500 flex items-center justify-center">
                <Gauge class="w-4 h-4" />
              </div>
              <div>
                <h4 class="text-xs font-bold text-foreground">Sea Trial Speed-Power</h4>
                <p class="text-[10px] text-muted-foreground">Shipyard cubic baseline (P ∝ V³) vs. noons</p>
              </div>
            </div>
            <Badge variant="outline" class="text-[10px] font-mono border-sky-500/30 text-sky-600 dark:text-sky-400">
              14.0 kts @ 4,200 kW
            </Badge>
          </div>

          <!-- Quick Benchmark KPI Row -->
          <div v-if="seaTrialStats" class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div class="p-2 rounded bg-muted/40 border border-border/60">
              <span class="text-[10px] text-muted-foreground block">Voyage Avg SOG</span>
              <span class="text-sm font-mono font-bold text-foreground">{{ seaTrialStats.avgSog }} kts</span>
            </div>
            <div class="p-2 rounded bg-muted/40 border border-border/60">
              <span class="text-[10px] text-muted-foreground block">Avg Shaft Power</span>
              <span class="text-sm font-mono font-bold text-foreground">{{ seaTrialStats.avgPower.toLocaleString() }} kW</span>
            </div>
            <div class="p-2 rounded bg-muted/40 border border-border/60">
              <span class="text-[10px] text-muted-foreground block">Speed Delta</span>
              <span
                class="text-sm font-mono font-bold"
                :class="seaTrialStats.speedLoss < 0 ? 'text-rose-500' : 'text-emerald-500'"
              >
                {{ seaTrialStats.speedLoss > 0 ? '+' : '' }}{{ seaTrialStats.speedLoss }} kts
              </span>
            </div>
            <div class="p-2 rounded bg-muted/40 border border-border/60">
              <span class="text-[10px] text-muted-foreground block">Avg Slip</span>
              <span
                class="text-sm font-mono font-bold"
                :class="seaTrialStats.avgSlip > 20 ? 'text-amber-500' : 'text-foreground'"
              >
                {{ seaTrialStats.avgSlip }}%
              </span>
            </div>
          </div>
        </div>

        <!-- Full-Width Interactive EChart -->
        <div class="p-3 rounded-lg border border-border/80 bg-card space-y-2 shadow-2xs">
          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <div class="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Activity class="w-3.5 h-3.5 text-sky-500" />
                <span>Speed vs. Shaft Power Curve</span>
              </div>
              <p class="text-[10px] text-muted-foreground">Click dot to inspect noon report</p>
            </div>
            <Badge variant="outline" class="text-[10px] font-mono">
              {{ dailyNoons.length }} Noons
            </Badge>
          </div>
          <div class="w-full h-[280px]">
            <ClientOnly>
              <VChart
                v-if="seaTrialChartOption"
                :option="seaTrialChartOption"
                :autoresize="true"
                class="w-full h-full cursor-pointer"
                @click="handleScatterClick"
              />
              <template #fallback>
                <Skeleton class="w-full h-full rounded" />
              </template>
            </ClientOnly>
          </div>
        </div>

        <!-- Superintendent Hydrodynamic Interpretation Insights -->
        <div class="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-2 text-xs">
          <div class="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
            <Compass class="w-3.5 h-3.5 text-primary" />
            <span>Hydrodynamic Interpretation</span>
          </div>
          <p class="text-[11px] text-muted-foreground leading-relaxed">
            Points positioned <strong>above the cyan baseline</strong> represent increased hull resistance, biofouling, or heavy weather requiring elevated power. Points <strong>close to baseline</strong> reflect clean hull performance under calm water.
          </p>
          <div class="pt-1 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              class="h-7 text-[11px] gap-1.5 cursor-pointer"
              @click="activeTab = 'noon'"
            >
              <ArrowRight class="w-3 h-3" />
              <span>Inspect D{{ currentNoon?.dayNumber || 1 }}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-7 text-[11px] gap-1 text-primary hover:bg-primary/10 cursor-pointer"
              @click="emit('ask-copilot', `Analyze hydrodynamic sea trial performance for vessel ${currentVoyage}: Speed vs Power curve shows ${seaTrialStats?.speedLoss} kts speed delta and ${seaTrialStats?.avgSlip}% propeller slip.`)"
            >
              <Sliders class="w-3 h-3" />
              <span>Audit with Copilot</span>
            </Button>
          </div>
        </div>
      </div>

      <!-- TAB 3: SHOP TRIAL (SFOC VS LOAD BENCHMARK) -->
      <div v-else-if="activeTab === 'shop-trial'" class="h-full overflow-y-auto p-3.5 space-y-3.5">
        <!-- Benchmark Summary Card -->
        <div class="p-3 rounded-lg border border-border/80 bg-card space-y-2.5 shadow-2xs">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
                <Fuel class="w-4 h-4" />
              </div>
              <div>
                <h4 class="text-xs font-bold text-foreground">Shop Trial SFOC Benchmark</h4>
                <p class="text-[10px] text-muted-foreground">Engine testbed factory SFOC baseline</p>
              </div>
            </div>
            <Badge variant="outline" class="text-[10px] font-mono border-amber-500/30 text-amber-600 dark:text-amber-400">
              165 g/kWh @ 85% MCR
            </Badge>
          </div>

          <!-- Quick Benchmark KPI Row -->
          <div v-if="shopTrialStats" class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div class="p-2 rounded bg-muted/40 border border-border/60">
              <span class="text-[10px] text-muted-foreground block">Voyage Avg SFOC</span>
              <span class="text-sm font-mono font-bold text-foreground">{{ shopTrialStats.avgSfoc }} g/kWh</span>
            </div>
            <div class="p-2 rounded bg-muted/40 border border-border/60">
              <span class="text-[10px] text-muted-foreground block">Avg Engine Load</span>
              <span class="text-sm font-mono font-bold text-foreground">{{ shopTrialStats.avgLoad }}% MCR</span>
            </div>
            <div class="p-2 rounded bg-muted/40 border border-border/60">
              <span class="text-[10px] text-muted-foreground block">Testbed Baseline</span>
              <span class="text-sm font-mono font-bold text-foreground">{{ shopTrialStats.baselineSfoc }} g/kWh</span>
            </div>
            <div class="p-2 rounded bg-muted/40 border border-border/60">
              <span class="text-[10px] text-muted-foreground block">Efficiency Delta</span>
              <span
                class="text-sm font-mono font-bold"
                :class="shopTrialStats.deltaPct > 5 ? 'text-rose-500' : shopTrialStats.deltaPct > 0 ? 'text-amber-500' : 'text-emerald-500'"
              >
                {{ shopTrialStats.deltaPct > 0 ? '+' : '' }}{{ shopTrialStats.deltaPct }}%
              </span>
            </div>
          </div>
        </div>

        <!-- Full-Width Interactive EChart -->
        <div class="p-3 rounded-lg border border-border/80 bg-card space-y-2 shadow-2xs">
          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <div class="text-xs font-bold text-foreground flex items-center gap-1.5">
                <TrendingUp class="w-3.5 h-3.5 text-amber-500" />
                <span>SFOC vs. Engine Load (% MCR)</span>
              </div>
              <p class="text-[10px] text-muted-foreground">Click dot to inspect noon report</p>
            </div>
            <Badge variant="outline" class="text-[10px] font-mono">
              {{ dailyNoons.length }} Noons
            </Badge>
          </div>
          <div class="w-full h-[280px]">
            <ClientOnly>
              <VChart
                v-if="shopTrialChartOption"
                :option="shopTrialChartOption"
                :autoresize="true"
                class="w-full h-full cursor-pointer"
                @click="handleScatterClick"
              />
              <template #fallback>
                <Skeleton class="w-full h-full rounded" />
              </template>
            </ClientOnly>
          </div>
        </div>

        <!-- Combustion Diagnostic Insights -->
        <div class="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-2 text-xs">
          <div class="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
            <Zap class="w-3.5 h-3.5 text-amber-500" />
            <span>Combustion & Thermal Diagnostics</span>
          </div>
          <p class="text-[11px] text-muted-foreground leading-relaxed">
            SFOC points significantly above testbed baseline indicate thermal degradation, fuel injection wear, elevated scavenging temperatures, or suboptimal air fuel ratios.
          </p>
          <div class="pt-1 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              class="h-7 text-[11px] gap-1.5 cursor-pointer"
              @click="activeTab = 'noon'"
            >
              <ArrowRight class="w-3 h-3" />
              <span>Inspect D{{ currentNoon?.dayNumber || 1 }}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-7 text-[11px] gap-1 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
              @click="emit('ask-copilot', `Analyze engine thermal efficiency and SFOC for vessel ${currentVoyage}: Average SFOC is ${shopTrialStats?.avgSfoc} g/kWh (${shopTrialStats?.deltaPct}% vs testbed baseline of 165 g/kWh).`)"
            >
              <Sliders class="w-3 h-3" />
              <span>Audit SFOC</span>
            </Button>
          </div>
        </div>
      </div>

      <!-- TAB 4: ROUTE STRATEGIES & ADVISORIES -->
      <div v-else-if="activeTab === 'strategies'" class="h-full overflow-y-auto p-3.5 space-y-3.5">
        <!-- Route Alternatives Comparison -->
        <div class="space-y-2">
          <div class="space-y-1">
            <div class="text-xs font-semibold text-foreground flex items-center justify-between">
              <span class="flex items-center gap-1.5">
                <Layers class="w-3.5 h-3.5 text-primary" />
                Route Strategies Comparison
              </span>
              <span class="text-[10px] text-muted-foreground">Select to simulate</span>
            </div>
            <div class="text-[10px] text-muted-foreground">
              "Current" reflects live voyage data; alternates are modeled estimates.
            </div>
          </div>

          <div class="space-y-2">
            <div
              v-for="strat in routeStrategies"
              :key="strat.id"
              class="p-2.5 rounded-lg border transition-all cursor-pointer"
              :class="activeStrategy === strat.id ? 'bg-primary/5 border-primary shadow-xs ring-1 ring-primary/30' : 'bg-card border-border hover:border-border/80'"
              @click="setStrategy(strat.id)"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: strat.colorHex }"></span>
                  <span class="text-xs font-bold text-foreground">{{ strat.name }}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span v-if="strat.basis === 'modeled-estimate'" class="text-[9px] uppercase font-bold text-muted-foreground/70">Est.</span>
                  <Badge
                    variant="outline"
                    class="font-mono text-[10px] font-bold"
                    :class="strat.fuelSavingsMt > 0 ? 'text-emerald-600 border-emerald-500/40 bg-emerald-500/10' : 'text-muted-foreground'"
                  >
                    {{ strat.fuelSavingsMt > 0 ? `-${strat.fuelSavingsMt} MT Fuel` : `${strat.totalFuelMt} MT` }}
                  </Badge>
                </div>
              </div>

              <p class="text-[11px] text-muted-foreground mt-1">{{ strat.description }}</p>

              <div class="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-border/50 text-[10px]">
                <div>
                  <span class="text-muted-foreground block">Speed / Dist</span>
                  <span class="font-semibold text-foreground font-mono">{{ strat.avgSpeedKts }} kts · {{ strat.distanceNm }} NM</span>
                </div>
                <div>
                  <span class="text-muted-foreground block">Projected CII</span>
                  <span class="font-bold text-foreground font-mono">Band {{ strat.projectedRating }} ({{ strat.projectedCii }})</span>
                </div>
                <div>
                  <span class="text-muted-foreground block">Arrival</span>
                  <span class="font-semibold text-foreground truncate block">{{ strat.etaFormatted.slice(5, 16) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Actionable Dispatch Advisories -->
        <div class="space-y-2 pt-2 border-t border-border/60">
          <div class="text-xs font-semibold text-foreground flex items-center justify-between">
            <span class="flex items-center gap-1.5">
              <Sparkles class="w-3.5 h-3.5 text-amber-500" />
              Actionable Dispatch Advisories
            </span>
            <span class="text-[10px] text-muted-foreground font-mono">{{ advisories.length }} Active</span>
          </div>

          <div class="space-y-2.5">
            <div
              v-for="adv in advisories"
              :key="adv.id"
              class="p-3 rounded-lg border bg-card space-y-2 text-xs"
              :class="adv.applied ? 'opacity-70 border-emerald-500/30' : 'border-border'"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="font-semibold text-foreground leading-tight">
                  {{ adv.title }}
                </div>
                <Badge
                  variant="outline"
                  class="text-[9px] uppercase font-bold shrink-0"
                  :class="adv.priority === 'critical' ? 'text-rose-600 border-rose-500/30' : adv.priority === 'warning' ? 'text-amber-600 border-amber-500/30' : 'text-blue-600 border-blue-500/30'"
                >
                  {{ adv.priority }}
                </Badge>
              </div>

              <p class="text-[11px] text-muted-foreground leading-relaxed">
                {{ adv.description }}
              </p>

              <div v-if="adv.actionLabel" class="pt-1 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  class="h-7 text-[11px] gap-1.5 cursor-pointer"
                  :disabled="adv.applied"
                  @click="applyAdvisory(adv.id)"
                >
                  <CheckCircle2 v-if="adv.applied" class="w-3 h-3 text-emerald-500" />
                  <span>{{ adv.applied ? 'Applied to Plan' : adv.actionLabel }}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>
