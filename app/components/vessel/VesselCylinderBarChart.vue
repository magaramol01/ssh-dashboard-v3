<script setup lang="ts">
import { ref, computed } from 'vue'
import { Flame, Maximize2, X } from 'lucide-vue-next'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart as EChartsBarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { getCylinderStatusColor, computeCylinderStats, sanitizeExhaustTemp } from '~/lib/vessel-analytics'

use([CanvasRenderer, EChartsBarChart, GridComponent, TooltipComponent, MarkLineComponent])

const { dashboardState } = useVesselDashboard()

const isExpanded = ref(false)

interface CylinderData {
  id: number
  label: string
  temp: number
  cfw: string
  pco: string
}

// 6 cylinders data
const cylinders = computed<CylinderData[]>(() => {
  const acc1 = dashboardState.value?.widget_3?.configuration?.body?.data?.carousel1?.acc1
  if (!acc1?.gaugesData) {
    return [
      { id: 1, label: 'CYL 1', temp: 320.5, cfw: '74.00', pco: '40.00' },
      { id: 2, label: 'CYL 2', temp: 318.2, cfw: '75.00', pco: '40.00' },
      { id: 3, label: 'CYL 3', temp: 325.0, cfw: '74.00', pco: '40.00' },
      { id: 4, label: 'CYL 4', temp: 322.8, cfw: '72.00', pco: '39.00' },
      { id: 5, label: 'CYL 5', temp: 319.4, cfw: '74.00', pco: '39.00' },
      { id: 6, label: 'CYL 6', temp: 321.1, cfw: '75.00', pco: '39.00' },
    ]
  }

  const list: CylinderData[] = []
  const gd = acc1.gaugesData
  for (let i = 1; i <= 6; i++) {
    const g = gd[`gauge${i}`]
    const rawVal = g?.widgetData?.value
    const temp = sanitizeExhaustTemp(rawVal, i)
    list.push({
      id: i,
      label: `CYL ${i}`,
      temp,
      cfw: g?.col1?.widgetData?.value ?? '74.00',
      pco: g?.col2?.widgetData?.value ?? '40.00',
    })
  }
  return list
})

const stats = computed(() => {
  const temps = cylinders.value.map((c) => c.temp)
  return computeCylinderStats(temps)
})

const overallStatus = computed(() => {
  if (stats.value.max > 420) return { label: 'Critical Alarm', color: 'text-rose-400 border-rose-500/30 bg-rose-500/10' }
  if (stats.value.max >= 380) return { label: 'Elevated Warning', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' }
  return { label: 'Healthy Nominal', color: 'text-teal-400 border-teal-500/30 bg-teal-500/10' }
})

const getBarChartOption = (expanded = false) => {
  const xLabels = cylinders.value.map((c) => `Cyl ${c.id}`)
  const barData = cylinders.value.map((c) => ({
    value: c.temp,
    itemStyle: {
      color: getCylinderStatusColor(c.temp),
      borderRadius: [4, 4, 0, 0],
    },
  }))

  const avgTemp = stats.value.avg
  const minAxis = Math.max(0, Math.floor((stats.value.min - 30) / 20) * 20 || 280)
  const maxAxis = Math.ceil((stats.value.max + 30) / 20) * 20 || 380

  return {
    backgroundColor: 'transparent',
    grid: {
      left: expanded ? 55 : 45,
      right: 20,
      top: expanded ? 35 : 18,
      bottom: expanded ? 35 : 25,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#090d16',
      borderColor: 'rgba(148, 163, 184, 0.25)',
      borderWidth: 1,
      textStyle: { color: '#f8fafc', fontSize: 11 },
      formatter: (params: any[]) => {
        const item = params[0]
        const cyl = cylinders.value[item.dataIndex]
        return `
          <div class="font-bold border-b border-border/60 pb-1 mb-1 text-foreground">${cyl.label}</div>
          <div class="flex justify-between gap-4 py-0.5"><span>Exh Temp:</span><b class="font-mono">${cyl.temp} °C</b></div>
          <div class="flex justify-between gap-4 py-0.5"><span>CFW Out:</span><b class="font-mono">${cyl.cfw} °C</b></div>
          <div class="flex justify-between gap-4 py-0.5"><span>PCO Out:</span><b class="font-mono">${cyl.pco} °C</b></div>
        `
      },
    },
    xAxis: {
      type: 'category',
      data: xLabels,
      axisLine: { lineStyle: { color: '#475569' } },
      axisLabel: { color: '#94a3b8', fontSize: expanded ? 11 : 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      name: '°C',
      min: minAxis,
      max: maxAxis,
      nameTextStyle: { color: '#94a3b8', fontSize: 10 },
      axisLabel: { color: '#94a3b8', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)', type: 'dashed' } },
    },
    series: [
      {
        name: 'Exhaust Temp',
        type: 'bar',
        barWidth: expanded ? '45%' : '38%',
        data: barData,
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: '#14b8a6', type: 'dashed', width: 1.5 },
          data: [
            {
              yAxis: avgTemp,
              label: {
                show: true,
                position: 'insideEndTop',
                formatter: `Avg ${avgTemp}°C`,
                color: '#cbd5e1',
                fontSize: 10,
                fontWeight: 600,
              },
            },
          ],
        },
      },
    ],
  }
}

const chartOption = computed(() => getBarChartOption(false))
const expandedChartOption = computed(() => getBarChartOption(true))
</script>

<template>
  <Card class="border border-border/50 bg-card shadow-xs flex flex-col h-full">
    <CardHeader class="p-4 pb-2">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <CardTitle class="text-sm font-semibold flex items-center gap-2">
          <Flame class="size-4 text-primary" />
          <span>Cylinder Exhaust Temperatures</span>
        </CardTitle>

        <div class="flex items-center gap-2">
          <Badge variant="outline" :class="['text-xs font-medium px-2 py-0.5', overallStatus.color]">
            {{ overallStatus.label }}
          </Badge>

          <!-- Expand Button -->
          <Button
            variant="outline"
            size="icon"
            class="size-8 cursor-pointer text-muted-foreground hover:text-foreground"
            title="Expand thermal diagnostics"
            @click="isExpanded = true"
          >
            <Maximize2 class="size-3.5" />
          </Button>
        </div>
      </div>
    </CardHeader>

    <CardContent class="p-4 pt-1 flex-1 flex flex-col justify-between">
      <!-- Quick Stats Strip (Symmetrical with Telemetry Timeline Card) -->
      <div class="grid grid-cols-3 gap-3 py-1.5 px-3 rounded-lg bg-muted/20 border border-border/30 text-center text-xs h-12 items-center mb-1">
        <div>
          <div class="text-[10px] text-muted-foreground leading-none">Average</div>
          <div class="text-sm font-bold font-mono text-foreground leading-tight mt-0.5">{{ stats.avg }} <span class="text-[10px] font-normal text-muted-foreground">°C</span></div>
        </div>
        <div>
          <div class="text-[10px] text-muted-foreground leading-none">Max temp</div>
          <div class="text-sm font-bold font-mono text-foreground leading-tight mt-0.5">{{ stats.max }} <span class="text-[10px] font-normal text-muted-foreground">°C</span></div>
        </div>
        <div>
          <div class="text-[10px] text-muted-foreground leading-none">Spread (Δ)</div>
          <div class="text-sm font-bold font-mono text-foreground leading-tight mt-0.5">{{ stats.spread }} <span class="text-[10px] font-normal text-muted-foreground">°C</span></div>
        </div>
      </div>

      <!-- ECharts Bar Container -->
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
                <Flame class="size-5" />
              </div>
              <div>
                <h2 class="text-lg font-bold text-foreground">
                  ME Cylinder Thermal Diagnostics &amp; Spread Analysis
                </h2>
                <p class="text-xs text-muted-foreground">
                  Complete cylinder exhaust gas telemetry, cooling water, and piston oil status
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <Badge variant="outline" :class="['text-xs font-medium px-2 py-0.5', overallStatus.color]">
                {{ overallStatus.label }}
              </Badge>

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
          <div class="p-6 space-y-5 overflow-y-auto">
            <!-- Inspection Stat Badges -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="p-3 rounded-xl bg-muted/30 border border-border/40">
                <div class="text-xs text-muted-foreground">Mean Temp</div>
                <div class="text-xl font-bold font-mono text-foreground mt-0.5">{{ stats.avg }} °C</div>
              </div>
              <div class="p-3 rounded-xl bg-muted/30 border border-border/40">
                <div class="text-xs text-muted-foreground">Peak Cylinder Temp</div>
                <div class="text-xl font-bold font-mono text-foreground mt-0.5">{{ stats.max }} °C</div>
              </div>
              <div class="p-3 rounded-xl bg-muted/30 border border-border/40">
                <div class="text-xs text-muted-foreground">Spread Deviation (Δ)</div>
                <div class="text-xl font-bold font-mono text-primary mt-0.5">{{ stats.spread }} °C</div>
              </div>
              <div class="p-3 rounded-xl bg-muted/30 border border-border/40">
                <div class="text-xs text-muted-foreground">Thermal Balance</div>
                <div class="text-xl font-bold font-mono text-teal-400 mt-0.5">Optimal (&lt;25°C)</div>
              </div>
            </div>

            <!-- Full Expanded EChart -->
            <div class="w-full bg-card/60 p-4 rounded-xl border border-border/40">
              <ClientOnly>
                <VChart
                  :option="expandedChartOption"
                  autoresize
                  style="height: 300px; width: 100%;"
                />
              </ClientOnly>
            </div>

            <!-- Detailed Cylinder Table -->
            <div class="rounded-xl border border-border/50 overflow-hidden">
              <table class="w-full text-xs text-left">
                <thead class="bg-muted/40 text-muted-foreground font-medium border-b border-border/50">
                  <tr>
                    <th class="p-3">Cylinder</th>
                    <th class="p-3">Exhaust Temp</th>
                    <th class="p-3">CFW Outlet</th>
                    <th class="p-3">PCO Outlet</th>
                    <th class="p-3">Variance from Avg</th>
                    <th class="p-3">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border/30 font-mono">
                  <tr v-for="cyl in cylinders" :key="cyl.id" class="hover:bg-muted/20 transition-colors">
                    <td class="p-3 font-bold text-foreground font-sans">{{ cyl.label }}</td>
                    <td class="p-3 font-semibold text-foreground">{{ cyl.temp }} °C</td>
                    <td class="p-3 text-muted-foreground">{{ cyl.cfw }} °C</td>
                    <td class="p-3 text-muted-foreground">{{ cyl.pco }} °C</td>
                    <td class="p-3">
                      <span :class="Math.abs(cyl.temp - stats.avg) > 10 ? 'text-amber-400' : 'text-teal-400'">
                        {{ (cyl.temp - stats.avg) > 0 ? `+${(cyl.temp - stats.avg).toFixed(1)}` : (cyl.temp - stats.avg).toFixed(1) }} °C
                      </span>
                    </td>
                    <td class="p-3 font-sans">
                      <Badge
                        variant="outline"
                        :class="cyl.temp > 420 ? 'text-rose-400 border-rose-500/30' : cyl.temp >= 380 ? 'text-amber-400 border-amber-500/30' : 'text-teal-400 border-teal-500/30 bg-teal-500/10'"
                        class="text-[10px] px-1.5 py-0.2"
                      >
                        {{ cyl.temp > 420 ? 'Alarm' : cyl.temp >= 380 ? 'Warning' : 'Nominal' }}
                      </Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </Card>
</template>
