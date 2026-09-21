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
import { BarChart as EChartsBarChart, PieChart as EChartsPieChart } from 'echarts/charts'
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
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
])

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

const activeTab = ref<'noon' | 'strategies'>('noon')

// If a day is selected from the map, switch to the noon log tab automatically
watch(selectedDay, (day) => {
  if (day) {
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

  const seriesData = noons.map((n) => {
    const isSelected = currentNoon.value?.dayNumber === n.dayNumber
    const color = ratingColors[n.rating] || '#94a3b8'
    return {
      value: n.attainedCii,
      itemStyle: {
        color,
        borderRadius: [3, 3, 0, 0],
        borderColor: isSelected ? '#ffffff' : 'transparent',
        borderWidth: isSelected ? 2 : 0,
        shadowBlur: isSelected ? 6 : 0,
        shadowColor: color,
      },
    }
  })

  return {
    grid: {
      top: 16,
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
        return `
          <div class="space-y-0.5 text-xs">
            <div class="font-bold flex items-center justify-between gap-3">
              <span>Day ${noon.dayNumber} · ${noon.dateFormatted.slice(0, 10)}</span>
              <span class="px-1 py-0.2 rounded font-mono text-[10px]" style="background:${color}22;color:${color};border:1px solid ${color}44;">Band ${noon.rating}</span>
            </div>
            <div>Attained CII: <b>${noon.attainedCii}</b> g/MT·NM</div>
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
</script>

<template>
  <aside
    v-show="isOpen"
    class="w-full lg:w-[490px] xl:w-[540px] shrink-0 border-l border-border bg-background/95 backdrop-blur-md shadow-xl flex flex-col h-full overflow-hidden transition-all duration-300 z-30"
  >
    <!-- Drawer Header -->
    <div class="h-14 px-4 border-b border-border flex items-center justify-between shrink-0 bg-muted/40">
      <div class="flex items-center gap-2">
        <div class="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
          <Sliders class="w-4 h-4" />
        </div>
        <div>
          <div class="flex items-center gap-1.5">
            <h3 class="text-sm font-semibold text-foreground leading-tight">Voyage Inspection</h3>
            <Badge v-if="currentVoyage" variant="outline" class="text-[10px] font-mono px-1.5 py-0">
              Voy. {{ currentVoyage }}
            </Badge>
          </div>
          <p class="text-[11px] text-muted-foreground">Daily telemetry & route optimization</p>
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        class="h-8 w-8 text-muted-foreground hover:text-foreground"
        @click="emit('close')"
      >
        <X class="w-4 h-4" />
      </Button>
    </div>

    <!-- Navigation Tabs -->
    <div class="px-4 pt-3 pb-2 border-b border-border/70 shrink-0">
      <Tabs v-model="activeTab" class="w-full">
        <TabsList class="grid grid-cols-2 w-full h-9">
          <TabsTrigger value="noon" class="text-xs">
            Daily Noon Log
            <span v-if="currentNoon" class="ml-1 px-1.5 py-0.2 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
              D{{ currentNoon.dayNumber }}
            </span>
          </TabsTrigger>
          <TabsTrigger value="strategies" class="text-xs">
            Route Advisories
            <span class="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
              {{ advisories.length }}
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>

    <!-- Scrollable Drawer Body -->
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      <!-- TAB 1: DAILY NOON REPORT LOG -->
      <div v-if="activeTab === 'noon'" class="space-y-4">
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
            class="h-6 text-[11px] px-2 shrink-0 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 font-medium"
            @click="selectDay(degradationSummary.worstDay)"
          >
            Jump to D{{ degradationSummary.worstDay.dayNumber }}
          </Button>
        </div>

        <!-- Interactive Voyage CII Trajectory Chart -->
        <div v-if="dailyNoons.length > 0" class="p-3 rounded-lg border border-border/80 bg-card space-y-2 shadow-2xs">
          <div class="flex items-center justify-between text-xs font-semibold">
            <span class="flex items-center gap-1.5 text-foreground">
              <BarChart3 class="w-3.5 h-3.5 text-primary" />
              Voyage CII Trajectory
            </span>
            <span class="text-[10px] text-muted-foreground font-normal">
              Click bar to inspect day · Target Band B
            </span>
          </div>
          <div class="w-full h-[125px]">
            <ClientOnly>
              <VChart
                v-if="ciiTrajectoryChartOption"
                :option="ciiTrajectoryChartOption"
                :autoresize="true"
                class="w-full h-full"
                @click="handleChartClick"
              />
              <template #fallback>
                <Skeleton class="w-full h-full rounded" />
              </template>
            </ClientOnly>
          </div>
        </div>

        <!-- Day Selector Pill Strip -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <span class="font-medium">Voyage Progress Days:</span>
            <span>Click to inspect</span>
          </div>
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              v-for="d in dailyNoons"
              :key="d.dayNumber"
              type="button"
              class="px-2 py-1 rounded-md text-xs font-mono font-semibold transition-all shrink-0 border flex items-center gap-1"
              :class="currentNoon?.dayNumber === d.dayNumber ? 'bg-primary text-primary-foreground border-primary shadow-xs' : 'bg-muted/70 text-foreground border-border hover:bg-muted'"
              @click="selectDay(d)"
            >
              <span>D{{ d.dayNumber }}</span>
              <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="ciiDotClass(d.rating)" />
            </button>
          </div>
        </div>

        <template v-if="currentNoon">
          <!-- Active Noon Card -->
          <Card class="bg-card border-border/80 shadow-xs">
            <CardHeader class="p-3 pb-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar class="w-3.5 h-3.5" />
                  <span>{{ currentNoon.dateFormatted }}</span>
                </div>
                <Badge variant="outline" class="font-mono text-[10px]">
                  {{ currentNoon.coords[0].toFixed(2) }}°, {{ currentNoon.coords[1].toFixed(2) }}°
                </Badge>
              </div>

              <!-- Report Type + Event Type (utilizationCategory) pills -->
              <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                <div v-if="currentNoon.reportType" class="flex items-center gap-1">
                  <span class="text-[10px] text-muted-foreground">Report Type:</span>
                  <Badge variant="outline" class="text-[10px] font-mono uppercase tracking-wide px-1.5 py-0 border-primary/30 text-primary">
                    {{ currentNoon.reportType }}
                  </Badge>
                </div>
                <div class="flex items-center gap-1">
                  <span class="text-[10px] text-muted-foreground">Event:</span>
                  <Badge
                    variant="outline"
                    class="text-[10px] font-semibold uppercase px-1.5 py-0"
                    :class="currentNoon.utilizationCategory === 'sea'
                      ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                      : currentNoon.utilizationCategory === 'port'
                        ? 'border-orange-500/40 text-orange-600 dark:text-orange-400'
                        : 'border-border text-muted-foreground'"
                  >
                    {{ currentNoon.utilizationCategory === 'sea' ? '⛵ Sea' : currentNoon.utilizationCategory === 'port' ? '⚓ Port' : 'Unknown' }}
                  </Badge>
                </div>
              </div>

              <!-- IMO CII Attained Badge Banner -->
              <div class="mt-3 p-2.5 rounded-lg border flex items-center justify-between" :class="ciiRatingBadge(currentNoon.rating).bg">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-md bg-background/80 flex items-center justify-center font-bold text-sm shadow-xs">
                    {{ currentNoon.rating }}
                  </div>
                  <div>
                    <div class="text-xs font-semibold">{{ ciiRatingBadge(currentNoon.rating).text }}</div>
                    <div class="text-[10px] opacity-80">Attained CII: {{ currentNoon.attainedCii }} g/MT·NM</div>
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-[10px] font-medium opacity-80">Total Work</div>
                  <div class="text-xs font-mono font-bold">{{ (currentNoon.transportWork / 1e6).toFixed(1) }}M MT·NM</div>
                </div>
              </div>
            </CardHeader>

            <CardContent class="p-3 pt-1 space-y-3">
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

              <!-- Hydrodynamic & Resistance Breakdown Card -->
              <div
                v-if="currentNoon.aiDiagnostics"
                class="p-3.5 rounded-lg border border-border/70 bg-card space-y-3"
              >
                <!-- Card Header -->
                <div class="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <div class="w-5 h-5 rounded bg-muted flex items-center justify-center shrink-0">
                      <Activity class="w-3.5 h-3.5 text-foreground" />
                    </div>
                    <span class="text-xs font-bold text-foreground">Hydrodynamic & Resistance Breakdown</span>
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
                    <span>Audit Telemetry</span>
                  </Button>
                </div>

                <!-- Diagnostic Headline & Narrative -->
                <div class="space-y-1">
                  <div class="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span
                      class="w-2 h-2 rounded-full shrink-0"
                      :class="currentNoon.rating === 'E' ? 'bg-rose-500' : currentNoon.rating === 'D' ? 'bg-orange-500' : currentNoon.rating === 'C' ? 'bg-amber-500' : 'bg-emerald-500'"
                    />
                    <span>{{ currentNoon.aiDiagnostics.headline }}</span>
                  </div>
                  <p class="text-[11px] leading-relaxed text-muted-foreground">
                    {{ currentNoon.aiDiagnostics.summary }}
                  </p>
                </div>

                <!-- Factor Attribution Chart & Breakdown -->
                <div class="space-y-2 pt-2 border-t border-border/60">
                  <div class="flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                    <span class="flex items-center gap-1">
                      <PieIcon class="w-3 h-3 text-foreground" />
                      Variance Factor Attribution:
                    </span>
                    <span class="font-mono text-[9px]">Variance Weight</span>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <!-- Donut Chart -->
                    <div class="sm:col-span-5 flex items-center justify-center h-[135px]">
                      <ClientOnly>
                        <VChart
                          v-if="factorDonutChartOption"
                          :option="factorDonutChartOption"
                          :autoresize="true"
                          class="w-full h-full"
                        />
                        <template #fallback>
                          <Skeleton class="w-28 h-28 rounded-full mx-auto" />
                        </template>
                      </ClientOnly>
                    </div>

                    <!-- Factor Detail Metric Cards -->
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
                        <!-- Progress bar -->
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

                <!-- Operational Guidance Callout -->
                <div class="p-2.5 rounded bg-muted/40 border border-border/70 flex items-start gap-2 text-[11px] text-foreground">
                  <Compass class="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <div class="leading-tight">
                    <strong class="font-semibold text-foreground">Operational Guidance:</strong>
                    <span class="ml-1 text-muted-foreground">{{ currentNoon.aiDiagnostics.recommendation }}</span>
                  </div>
                </div>
              </div>

              <!-- Fuel Consumption Breakdown (real per-fuel-type data from the CII API) -->
              <div class="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-2">
                <div class="flex items-center justify-between text-xs font-semibold">
                  <span class="flex items-center gap-1.5 text-foreground">
                    <Fuel class="w-3.5 h-3.5 text-amber-500" />
                    24h Fuel Consumed
                  </span>
                  <span class="font-mono text-primary font-bold">{{ currentNoon.fuelConsumedMt.total }} MT</span>
                </div>
                <div class="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1 border-t border-border/60">
                  <div v-for="(fuel, key) in currentNoon.fuelConsumedMt.byType" :key="key">
                    {{ fuel.label }}: <strong class="text-foreground font-mono">{{ fuel.value }} MT</strong>
                  </div>
                  <div>24h CO₂: <strong class="text-foreground font-mono">{{ currentNoon.totalCo2Mt }} MT</strong></div>
                  <div>Voyage Total: <strong class="text-foreground font-mono">{{ currentNoon.cumulativeFuelMt }} MT</strong></div>
                </div>
              </div>

              <!-- Recorded Weather at Position -->
              <div class="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-2">
                <div class="flex items-center justify-between text-xs font-semibold">
                  <span class="flex items-center gap-1.5 text-foreground">
                    <Wind class="w-3.5 h-3.5 text-cyan-500" />
                    Noon Position Weather
                  </span>
                  <Badge variant="outline" class="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold border-cyan-500/30">
                    Beaufort {{ currentNoon.weather.beaufort }}
                  </Badge>
                </div>
                <div class="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1 border-t border-border/60">
                  <div>Wind: <strong class="text-foreground">{{ currentNoon.weather.windSpeedKts }} kts ({{ currentNoon.weather.windDirectionDeg }}°)</strong></div>
                  <div>Seas: <strong class="text-foreground">{{ currentNoon.weather.waveHeightM }}m wave</strong></div>
                  <div class="col-span-2">Swell: <strong class="text-foreground">{{ currentNoon.weather.swellDirection }} · {{ currentNoon.weather.shortForecast }}</strong></div>
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
      </div>

      <!-- TAB 2: ROUTE STRATEGIES & ADVISORIES -->
      <div v-else class="space-y-4">
        <!-- Route Alternatives Comparison -->
        <div class="space-y-2">
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

          <div class="space-y-2">
            <div
              v-for="strat in routeStrategies"
              :key="strat.id"
              class="p-3 rounded-lg border transition-all cursor-pointer"
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
        <div class="space-y-2 pt-2 border-t border-border">
          <div class="text-xs font-semibold text-foreground flex items-center justify-between">
            <span class="flex items-center gap-1.5">
              <Sparkles class="w-3.5 h-3.5 text-amber-500" />
              Actionable Dispatch Advisories
            </span>
          </div>

          <div class="space-y-2">
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
                  class="h-7 text-[11px] gap-1.5"
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
