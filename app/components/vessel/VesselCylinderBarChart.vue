<script setup lang="ts">
import { computed } from 'vue'
import { Flame } from 'lucide-vue-next'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart as EChartsBarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  if (stats.value.max > 420) return { label: 'Alarm', color: 'text-rose-500 border-rose-500/30' }
  if (stats.value.max >= 380) return { label: 'Elevated', color: 'text-amber-500 border-amber-500/30' }
  return { label: 'Nominal', color: 'text-sky-500 border-sky-500/30' }
})

const chartOption = computed(() => {
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
      left: 45,
      right: 20,
      top: 25,
      bottom: 25,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: chartTooltipBg.value,
      borderColor: chartTooltipBorder.value,
      borderWidth: 1,
      textStyle: { color: chartTooltipText.value, fontSize: 11 },
      formatter: (params: any[]) => {
        const item = params[0]
        const cyl = cylinders.value[item.dataIndex]
        return `
          <div class="font-bold border-b border-border pb-1 mb-1">${cyl.label}</div>
          <div class="flex justify-between gap-4"><span>Exh Temp:</span><b>${cyl.temp} °C</b></div>
          <div class="flex justify-between gap-4"><span>CFW Out:</span><b>${cyl.cfw} °C</b></div>
          <div class="flex justify-between gap-4"><span>PCO Out:</span><b>${cyl.pco} °C</b></div>
        `
      },
    },
    xAxis: {
      type: 'category',
      data: xLabels,
      axisLine: { lineStyle: { color: chartAxisColor.value } },
      axisLabel: { color: chartTextColor.value, fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      name: '°C',
      min: minAxis,
      max: maxAxis,
      nameTextStyle: { color: chartTextColor.value, fontSize: 9 },
      axisLabel: { color: chartTextColor.value, fontSize: 9 },
      splitLine: { lineStyle: { color: chartSplitLineColor.value, type: 'dashed' } },
    },
    series: [
      {
        name: 'Exhaust Temp',
        type: 'bar',
        barWidth: '38%',
        data: barData,
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: '#0ea5e9', type: 'dashed', width: 1.5 },
          data: [
            {
              yAxis: avgTemp,
              label: {
                show: true,
                position: 'insideEndTop',
                formatter: `Avg ${avgTemp}°C`,
                color: chartTextColor.value,
                fontSize: 9,
                fontWeight: 600,
              },
            },
          ],
        },
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
          <div class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Thermal Profile</div>
          <CardTitle class="text-sm font-semibold flex items-center gap-2">
            <Flame class="size-4 text-primary" />
            <span>ME Cylinder Exhaust Temperatures</span>
          </CardTitle>
          <CardDescription class="text-xs">
            Individual cylinder gas temperatures and spread variance
          </CardDescription>
        </div>

        <Badge variant="outline" :class="['text-[11px] font-medium', overallStatus.color]">
          {{ overallStatus.label }}
        </Badge>
      </div>
    </CardHeader>

    <CardContent class="p-4 pt-1 space-y-2">
      <!-- Quick Stats Strip -->
      <div class="grid grid-cols-3 gap-2 py-1.5 px-3 rounded-lg bg-muted/40 border border-border text-center text-xs">
        <div>
          <div class="text-xs font-normal text-muted-foreground">Average</div>
          <div class="text-base font-semibold font-mono text-foreground">{{ stats.avg }} <span class="text-xs font-normal text-muted-foreground">°C</span></div>
        </div>
        <div>
          <div class="text-xs font-normal text-muted-foreground">Max temp</div>
          <div class="text-base font-semibold font-mono text-foreground">{{ stats.max }} <span class="text-xs font-normal text-muted-foreground">°C</span></div>
        </div>
        <div>
          <div class="text-xs font-normal text-muted-foreground">Spread (Δ)</div>
          <div class="text-base font-semibold font-mono text-foreground">{{ stats.spread }} <span class="text-xs font-normal text-muted-foreground">°C</span></div>
        </div>
      </div>

      <!-- ECharts Bar Container -->
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
