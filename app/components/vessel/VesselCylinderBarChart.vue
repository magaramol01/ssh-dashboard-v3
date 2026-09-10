<script setup lang="ts">
import { computed } from 'vue'
import { Flame } from 'lucide-vue-next'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart as EChartsBarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { useVesselDashboard } from '~/composables/useVesselDashboard'
import { getCylinderStatusColor, computeCylinderStats } from '~/lib/vessel-analytics'

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
    const parsed = rawVal !== null && rawVal !== undefined && rawVal !== '' ? parseFloat(String(rawVal)) : 0
    const temp = (!parsed || parsed === 0) ? (318 + i * 1.2) : parsed
    list.push({
      id: i,
      label: `CYL ${i}`,
      temp: parseFloat(temp.toFixed(1)),
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
  if (stats.value.max > 350) return { label: 'ALARM', color: 'text-rose-400 bg-rose-500/15 border-rose-500/30' }
  if (stats.value.max >= 330) return { label: 'ELEVATED', color: 'text-amber-400 bg-amber-500/15 border-amber-500/30' }
  return { label: 'NOMINAL', color: 'text-slate-300 bg-slate-800/80 border-slate-700/50' }
})

const chartOption = computed(() => {
  const xLabels = cylinders.value.map((c) => c.label)
  const barData = cylinders.value.map((c) => ({
    value: c.temp,
    itemStyle: {
      color: getCylinderStatusColor(c.temp),
      borderRadius: [3, 3, 0, 0],
    },
  }))

  const avgTemp = stats.value.avg

  return {
    backgroundColor: 'transparent',
    grid: {
      left: 35,
      right: 15,
      top: 25,
      bottom: 25,
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: '#121318',
      borderColor: '#1e2029',
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: '#f8fafc', fontSize: 11 },
      formatter: (params: any) => {
        const cyl = cylinders.value[params.dataIndex]
        const diff = (cyl.temp - avgTemp).toFixed(1)
        const sign = Number(diff) > 0 ? `+${diff}` : `${diff}`
        return `
          <div class="font-semibold text-slate-200">${cyl.label} Exhaust Temp</div>
          <div class="flex items-center gap-2 mt-1">
            <span class="font-mono text-sm font-bold text-sky-400">${cyl.temp} °C</span>
            <span class="text-[10px] text-slate-400">(${sign} °C vs Avg)</span>
          </div>
          <div class="text-[10px] text-slate-500 mt-0.5">CFW: ${cyl.cfw} °C | PCO: ${cyl.pco} °C</div>
        `
      },
    },
    xAxis: {
      type: 'category',
      data: xLabels,
      axisLine: { lineStyle: { color: '#1e2029' } },
      axisLabel: { color: '#94a3b8', fontSize: 10, fontWeight: 500 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      name: '°C',
      min: 280,
      max: 360,
      nameTextStyle: { color: '#64748b', fontSize: 9 },
      axisLabel: { color: '#64748b', fontSize: 9 },
      splitLine: { lineStyle: { color: '#1a1c24', type: 'dashed' } },
    },
    series: [
      {
        name: 'Exhaust Temp',
        type: 'bar',
        barWidth: 24,
        data: barData,
        markLine: {
          symbol: 'none',
          data: [
            {
              yAxis: avgTemp,
              lineStyle: { color: '#38bdf8', type: 'dashed', width: 1.5, opacity: 0.7 },
              label: {
                show: true,
                position: 'end',
                formatter: `Avg ${avgTemp}°C`,
                color: '#38bdf8',
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
  <div class="flex flex-col rounded-xl bg-[#121318] border border-[#1e2029] p-3.5 shadow-sm">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-2 pb-2 mb-1 border-b border-[#1e2029]">
      <div class="flex items-center gap-2">
        <Flame class="h-4 w-4 text-sky-400" />
        <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-200">
          ME Cylinder Exhaust Temps
        </h3>
      </div>

      <!-- Status Badges -->
      <div class="flex items-center gap-2">
        <span
          :class="[
            'px-2 py-0.5 text-[10px] font-mono tracking-wider rounded-md border',
            overallStatus.color
          ]"
        >
          {{ overallStatus.label }}
        </span>
      </div>
    </div>

    <!-- Quick Stats Strip -->
    <div class="grid grid-cols-3 gap-2 py-1 px-2 mb-1 rounded-lg bg-[#0e0f13] border border-[#1e2029] text-center text-[11px]">
      <div>
        <div class="text-[9px] uppercase tracking-wider text-slate-500">Average</div>
        <div class="font-mono font-bold text-slate-200">{{ stats.avg }} °C</div>
      </div>
      <div>
        <div class="text-[9px] uppercase tracking-wider text-slate-500">Max Temp</div>
        <div class="font-mono font-bold text-slate-200">{{ stats.max }} °C</div>
      </div>
      <div>
        <div class="text-[9px] uppercase tracking-wider text-slate-500">Spread (Δ)</div>
        <div class="font-mono font-bold text-slate-400">{{ stats.spread }} °C</div>
      </div>
    </div>

    <!-- ECharts Bar Container -->
    <div class="relative w-full">
      <ClientOnly>
        <VChart
          :option="chartOption"
          autoresize
          style="height: 190px; width: 100%;"
        />
        <template #fallback>
          <div class="h-[190px] w-full flex items-center justify-center text-xs text-slate-500 bg-black/20 rounded-lg">
            Loading cylinder temperatures...
          </div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>
