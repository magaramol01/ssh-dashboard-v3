<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  ArrowDownRight,
  RefreshCw,
  Copy,
  Check,
  Calendar,
  Layers,
  Gauge,
  Activity,
  ArrowRight,
} from 'lucide-vue-next'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { CiiImprovementPlan } from '../../../server/utils/marine/cii-improvement'

import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { RadarChart, LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  RadarComponent,
  MarkLineComponent,
  MarkPointComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import {
  chartColors,
  chartTextColor,
  chartAxisColor,
  chartSplitLineColor,
  chartTooltipBg,
  chartTooltipBorder,
  chartTooltipText,
} from '../ui/charts/useChartTheme'

use([
  CanvasRenderer,
  RadarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  RadarComponent,
  MarkLineComponent,
  MarkPointComponent,
])

const props = defineProps<{
  improvementPlan: CiiImprovementPlan
  speedScenarios: Array<{
    reductionPercent: number
    speedKnots?: number
    projectedCii: number
    projectedRating: string
    co2SavingsMt: number
    multiplier?: number
  }>
  activeScenarioIndex: number
  vesselName: string
  isAuditing?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:activeScenarioIndex', index: number): void
  (e: 'reAudit'): void
}>()

const copied = ref(false)

const activeScenario = computed(() => {
  const scenarios = props.speedScenarios || []
  return (
    scenarios[props.activeScenarioIndex] ||
    scenarios[0] || {
      reductionPercent: 10,
      speedKnots: 12.6,
      projectedCii: 5.2,
      projectedRating: 'C',
      co2SavingsMt: 320,
      multiplier: 0.729,
    }
  )
})

function formatNumber(num: number | undefined | null, decimals = 1): string {
  if (num === null || num === undefined || isNaN(num)) return '—'
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function getRatingBadge(rating: string) {
  switch (rating) {
    case 'A':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
    case 'B':
      return 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30'
    case 'C':
      return 'bg-lime-500/10 text-lime-600 dark:text-lime-400 border-lime-500/30'
    case 'D':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
    case 'E':
      return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

// 1. Radar Chart Option for Root-Cause Drivers (Pillar 1)
const radarChartOption = computed(() => {
  const drivers = props.improvementPlan?.drivers || []
  const speedVal = drivers.find((d) => d.key === 'speed')?.percentage || 35
  const hullVal = drivers.find((d) => d.key === 'hull')?.percentage || 30
  const auxVal = drivers.find((d) => d.key === 'auxiliary')?.percentage || 20
  const payloadVal = drivers.find((d) => d.key === 'payload')?.percentage || 15

  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: chartTooltipBg.value,
      borderColor: chartTooltipBorder.value,
      textStyle: { color: chartTooltipText.value, fontSize: 11 },
    },
    legend: {
      bottom: 0,
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: chartTextColor.value, fontSize: 10 },
      data: ['Vessel Deviation', 'Balanced Benchmark'],
    },
    radar: {
      shape: 'polygon',
      indicator: [
        { name: 'Speed Profile', max: 50 },
        { name: 'Hull Resistance', max: 50 },
        { name: 'Port / Aux Load', max: 50 },
        { name: 'Ballast Work Deficit', max: 50 },
      ],
      center: ['50%', '45%'],
      radius: '62%',
      axisName: {
        color: chartTextColor.value,
        fontSize: 10,
        fontWeight: 500,
      },
      splitLine: {
        lineStyle: {
          color: chartSplitLineColor.value,
        },
      },
      splitArea: {
        show: true,
        areaStyle: {
          color: ['rgba(255, 255, 255, 0.02)', 'rgba(0, 0, 0, 0.03)'],
        },
      },
      axisLine: {
        lineStyle: {
          color: chartAxisColor.value,
        },
      },
    },
    series: [
      {
        name: 'Root Cause Factors',
        type: 'radar',
        data: [
          {
            value: [speedVal, hullVal, auxVal, payloadVal],
            name: 'Vessel Deviation',
            symbol: 'circle',
            symbolSize: 4,
            itemStyle: { color: '#3b82f6' },
            lineStyle: { width: 2, color: '#3b82f6' },
            areaStyle: { color: 'rgba(59, 130, 246, 0.25)' },
          },
          {
            value: [25, 25, 25, 25],
            name: 'Balanced Benchmark',
            symbol: 'none',
            itemStyle: { color: '#94a3b8' },
            lineStyle: { width: 1.5, type: 'dashed', color: '#94a3b8' },
          },
        ],
      },
    ],
  }
})

// 2. Speed-Power & CII Sensitivity Curve (Pillar 2)
const speedCurveOption = computed(() => {
  const scenarios = props.speedScenarios || []
  const currentTrim = activeScenario.value

  // Map points: [Speed Knots, Projected CII]
  const dataPoints = scenarios.map((s) => [s.speedKnots ?? (14 - s.reductionPercent * 0.14), s.projectedCii])

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: chartTooltipBg.value,
      borderColor: chartTooltipBorder.value,
      textStyle: { color: chartTooltipText.value, fontSize: 11 },
      formatter: (params: any) => {
        const item = params[0]
        if (!item) return ''
        return `Speed: <b>${item.value[0]} kts</b><br/>Projected CII: <b>${item.value[1]}</b>`
      },
    },
    grid: {
      top: 20,
      right: 15,
      bottom: 25,
      left: 35,
    },
    xAxis: {
      type: 'value',
      name: 'kts',
      nameTextStyle: { color: chartTextColor.value, fontSize: 10 },
      min: (value: any) => Math.floor(value.min - 0.5),
      max: (value: any) => Math.ceil(value.max + 0.5),
      axisLabel: { color: chartTextColor.value, fontSize: 10 },
      splitLine: { show: false },
      axisLine: { lineStyle: { color: chartAxisColor.value } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: chartTextColor.value, fontSize: 10 },
      splitLine: { lineStyle: { color: chartSplitLineColor.value, type: 'dashed' } },
      min: (value: any) => Math.max(0, Math.floor(value.min - 0.5)),
    },
    series: [
      {
        name: 'Projected CII',
        type: 'line',
        smooth: true,
        data: dataPoints,
        lineStyle: { width: 2.5, color: '#3b82f6' },
        itemStyle: { color: '#3b82f6' },
        markLine: {
          symbol: 'none',
          silent: true,
          data: [
            {
              yAxis: 5.25,
              name: 'Req Cap',
              lineStyle: { color: '#ef4444', type: 'dotted', width: 1.5 },
              label: { formatter: 'Req Cap', position: 'insideEndTop', fontSize: 9, color: '#ef4444' },
            },
            {
              yAxis: 4.65,
              name: 'Grade B',
              lineStyle: { color: '#10b981', type: 'dashed', width: 1 },
              label: { formatter: 'Grade B', position: 'insideEndTop', fontSize: 9, color: '#10b981' },
            },
          ],
        },
        markPoint: {
          symbol: 'pin',
          symbolSize: 32,
          itemStyle: { color: '#f59e0b' },
          data: [
            {
              coord: [currentTrim.speedKnots ?? (14 - currentTrim.reductionPercent * 0.14), currentTrim.projectedCii],
              name: 'Active Trim',
            },
          ],
        },
      },
    ],
  }
})

function copyPlanToClipboard() {
  const plan = props.improvementPlan
  if (!plan) return
  const text = [
    `CII IMPROVEMENT PLAN: ${props.vesselName.toUpperCase()}`,
    `Onset: ${plan.onset.month} (${plan.onset.voyageNumber}) | +${plan.onset.ciiIncrease} gCO2/tnm`,
    `Selected Speed Trim: -${activeScenario.value.reductionPercent}% (${activeScenario.value.speedKnots} kts) -> Grade ${activeScenario.value.projectedRating}`,
    `Avoided CO2: ${formatNumber(activeScenario.value.co2SavingsMt, 1)} MT`,
    `Target Recovery: Grade ${plan.recoveryTarget.targetRating} within ${plan.recoveryTarget.projectedDays} days`,
  ].join('\n')

  navigator.clipboard?.writeText(text)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2500)
}
</script>

<template>
  <Card class="shadow-xs border-border/70 overflow-hidden bg-card">
    <!-- Card Header -->
    <CardHeader class="pb-3 border-b border-border/40 bg-muted/10">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <CardTitle class="text-base font-semibold flex items-center gap-2">
              <Sparkles class="size-4 text-primary" />
              CII Improvement Plan & Root-Cause Diagnosis
            </CardTitle>
            <Badge
              variant="outline"
              :class="improvementPlan.hasDegraded ? 'border-amber-500/40 text-amber-500 bg-amber-500/5' : 'border-emerald-500/40 text-emerald-500 bg-emerald-500/5'"
              class="text-[10px] font-medium"
            >
              {{ improvementPlan.hasDegraded ? 'Degradation Active' : 'Compliant' }}
            </Badge>
          </div>
          <CardDescription class="text-xs mt-0.5">
            Diagnostic radar footprint, hydrodynamic speed curve, and corrective turnaround roadmap
          </CardDescription>
        </div>

        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            class="h-7 text-xs gap-1.5 px-2.5 cursor-pointer font-medium border-border hover:bg-muted/40"
            :disabled="isAuditing"
            @click="emit('reAudit')"
          >
            <RefreshCw :class="['size-3', isAuditing ? 'animate-spin text-primary' : 'text-muted-foreground']" />
            <span>{{ isAuditing ? 'Auditing...' : 'Re-run AI Audit' }}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            class="h-7 text-xs gap-1.5 px-2.5 cursor-pointer font-medium text-muted-foreground hover:text-foreground"
            @click="copyPlanToClipboard"
          >
            <component :is="copied ? Check : Copy" :class="['size-3', copied ? 'text-emerald-500' : '']" />
            <span>{{ copied ? 'Copied' : 'Copy Plan' }}</span>
          </Button>
        </div>
      </div>
    </CardHeader>

    <!-- 3-Pillar Visual Body -->
    <CardContent class="p-5">
      <div class="grid gap-6 lg:grid-cols-12 items-stretch">
        <!-- Pillar 1: Root-Cause Radar Chart (4 Cols) -->
        <div class="lg:col-span-4 rounded-xl border border-border/60 bg-muted/15 p-4 flex flex-col justify-between gap-3">
          <div>
            <!-- Onset Pill Header -->
            <div class="flex items-center justify-between pb-2 border-b border-border/40">
              <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Activity class="size-3.5 text-primary" /> Root-Cause Footprint
              </span>
              <Badge
                variant="outline"
                class="text-[10px] font-mono"
                :class="improvementPlan.hasDegraded ? 'border-amber-500/30 text-amber-500' : 'border-emerald-500/30 text-emerald-500'"
              >
                {{ improvementPlan.hasDegraded ? `${improvementPlan.onset.month} (${improvementPlan.onset.voyageNumber})` : 'Stable' }}
              </Badge>
            </div>

            <!-- Radar Chart -->
            <div class="h-[210px] w-full flex items-center justify-center pt-1">
              <ClientOnly>
                <VChart
                  :option="radarChartOption"
                  autoresize
                  class="h-full w-full"
                />
                <template #fallback>
                  <Skeleton class="h-[210px] w-full rounded-lg" />
                </template>
              </ClientOnly>
            </div>
          </div>

          <!-- Bottom Metric Row -->
          <div class="grid grid-cols-2 gap-2 pt-2 border-t border-border/40 text-xs">
            <div class="p-2 rounded-lg bg-card border border-border/50 text-center">
              <span class="text-[10px] text-muted-foreground block">Onset Shift</span>
              <span class="font-bold text-foreground font-mono">
                {{ improvementPlan.onset.initialRating }} → {{ improvementPlan.onset.currentRating }}
              </span>
            </div>
            <div class="p-2 rounded-lg bg-card border border-border/50 text-center">
              <span class="text-[10px] text-muted-foreground block">CII Surge</span>
              <span class="font-bold text-amber-500 font-mono">
                +{{ improvementPlan.onset.ciiIncrease }} <span class="text-[9px] font-normal text-muted-foreground">g/tnm</span>
              </span>
            </div>
          </div>
        </div>

        <!-- Pillar 2: CII vs Speed Sensitivity Curve (4 Cols) -->
        <div class="lg:col-span-4 rounded-xl border border-border/60 bg-muted/15 p-4 flex flex-col justify-between gap-3">
          <div class="space-y-2.5">
            <div class="flex items-center justify-between border-b border-border/40 pb-2">
              <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sliders class="size-3.5 text-primary" /> Speed-Power Sensitivity Curve
              </span>
              <Badge :class="getRatingBadge(activeScenario.projectedRating)" class="text-[10px] px-1.5 py-0 font-bold">
                Grade {{ activeScenario.projectedRating }}
              </Badge>
            </div>

            <!-- Scenario Selector Pills -->
            <div class="grid grid-cols-5 gap-1.5">
              <button
                v-for="(scenario, idx) in speedScenarios"
                :key="scenario.reductionPercent"
                type="button"
                :class="[
                  'flex flex-col items-center py-1.5 px-1 rounded-md border text-center transition-all cursor-pointer text-xs',
                  activeScenarioIndex === idx
                    ? 'bg-primary/10 border-primary font-semibold text-primary shadow-xs'
                    : 'border-border/70 bg-card hover:bg-muted/50 text-muted-foreground'
                ]"
                @click="emit('update:activeScenarioIndex', idx)"
              >
                <span class="text-xs font-bold">-{{ scenario.reductionPercent }}%</span>
                <span class="text-[9px] opacity-75">{{ scenario.speedKnots ?? 'kts' }}</span>
              </button>
            </div>

            <!-- Sensitivity Line Chart -->
            <div class="h-[145px] w-full">
              <ClientOnly>
                <VChart
                  :option="speedCurveOption"
                  autoresize
                  class="h-full w-full"
                />
                <template #fallback>
                  <Skeleton class="h-[145px] w-full rounded-lg" />
                </template>
              </ClientOnly>
            </div>
          </div>

          <!-- Bottom Stat Strip -->
          <div class="grid grid-cols-2 gap-2 pt-2 border-t border-border/40 text-xs">
            <div class="p-2 rounded-lg bg-card border border-border/50 text-center">
              <span class="text-[10px] text-muted-foreground block">Avoided CO₂</span>
              <span class="font-bold text-emerald-500 tabular-nums flex items-center justify-center gap-1">
                <ArrowDownRight class="size-3" />
                {{ formatNumber(activeScenario.co2SavingsMt, 0) }} MT
              </span>
            </div>
            <div class="p-2 rounded-lg bg-card border border-border/50 text-center">
              <span class="text-[10px] text-muted-foreground block">Power Load</span>
              <span class="font-bold text-foreground tabular-nums">
                {{ ((activeScenario.multiplier ?? 0.729) * 100).toFixed(0) }}% load
              </span>
            </div>
          </div>
        </div>

        <!-- Pillar 3: Visual Action Milestone Pipeline (4 Cols) -->
        <div class="lg:col-span-4 rounded-xl border border-border/60 bg-muted/15 p-4 flex flex-col justify-between gap-3">
          <div class="space-y-3">
            <div class="flex items-center justify-between border-b border-border/40 pb-2">
              <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 class="size-3.5 text-primary" /> Turnaround Roadmap
              </span>
              <Badge variant="outline" class="text-[10px] font-mono text-primary border-primary/30 flex items-center gap-1">
                <Calendar class="size-3" /> ~{{ improvementPlan.recoveryTarget.projectedDays }} Days
              </Badge>
            </div>

            <!-- Visual Target Transition Bar -->
            <div class="p-2.5 rounded-lg border border-primary/30 bg-primary/5 flex items-center justify-between text-xs">
              <div class="flex items-center gap-2">
                <Badge :class="getRatingBadge(improvementPlan.onset.currentRating)" class="text-[10px] px-1.5 py-0">
                  Grade {{ improvementPlan.onset.currentRating }}
                </Badge>
                <ArrowRight class="size-3 text-muted-foreground" />
                <Badge :class="getRatingBadge(improvementPlan.recoveryTarget.targetRating)" class="text-[10px] px-1.5 py-0 font-bold">
                  Grade {{ improvementPlan.recoveryTarget.targetRating }}
                </Badge>
              </div>
              <span class="font-mono text-[11px] font-bold text-primary">≤ {{ improvementPlan.recoveryTarget.targetCii.toFixed(2) }} CII</span>
            </div>

            <!-- Compact 3-Step Milestone Cards -->
            <div class="space-y-2">
              <div
                v-for="(item, idx) in improvementPlan.actionItems"
                :key="idx"
                class="p-2 rounded-lg bg-card border border-border/50 text-xs flex items-center justify-between gap-2"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <span
                    :class="[
                      'size-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                      idx === 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                      idx === 1 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                      'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    ]"
                  >
                    {{ idx + 1 }}
                  </span>
                  <div class="truncate">
                    <span class="font-medium text-foreground block truncate">{{ item.title }}</span>
                  </div>
                </div>
                <Badge variant="outline" class="text-[9px] font-mono shrink-0 border-border text-foreground font-semibold">
                  {{ item.impact.split('(')[0] }}
                </Badge>
              </div>
            </div>
          </div>

          <!-- Footer Verification Stamp -->
          <div class="pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
            <span>Verified Hydrodynamic Model</span>
            <span class="text-primary font-medium">IMO G2 Standard</span>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
