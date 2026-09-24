<script setup lang="ts">
import { computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart as EChartsLineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { cn } from '@/lib/utils'
import { chartColors, chartTextColor, chartAxisColor, chartSplitLineColor, chartTooltipBg, chartTooltipBorder, chartTooltipText, mergeOptionBlock } from '../useChartTheme'

use([CanvasRenderer, EChartsLineChart, GridComponent, TooltipComponent, LegendComponent])

interface Props {
  data: Record<string, any>[]
  xField?: string
  yField?: string | string[]
  height?: number | string
  option?: any
  class?: string
  seriesName?: string | string[]
  unit?: string
  xAxisName?: string
  yAxisName?: string
  showLegend?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  xField: 'x',
  yField: 'y',
  height: 300,
  seriesName: undefined,
  unit: undefined,
  xAxisName: undefined,
  yAxisName: undefined,
  showLegend: undefined,
})

const mergedOption = computed(() => {
  const fields = Array.isArray(props.yField) ? props.yField : [props.yField]
  const xData = props.data.map((d) => d[props.xField!])

  const series = fields.map((field, i) => {
    let name = field
    if (Array.isArray(props.seriesName)) {
      name = props.seriesName[i] ?? field
    } else if (props.seriesName) {
      name = fields.length === 1 ? props.seriesName : `${props.seriesName} (${field})`
    } else if (field === 'y') {
      name = props.yAxisName || 'Value'
    }

    return {
      name,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      showSymbol: false,
      symbolSize: 6,
      areaStyle: { opacity: 0.18 },
      lineStyle: { width: 2.2 },
      itemStyle: { color: chartColors.value[i % chartColors.value.length] },
      data: props.data.map((d) => d[field]),
    }
  })

  // Deep-merge `series[i]` from `option` so consumers can pass partial
  // overrides (e.g. `series: [{ stack: 'r' }, ...]`) without clobbering the
  // computed `type`/`data`. Top-level option blocks (xAxis, yAxis, grid,
  // tooltip, legend) go through `mergeOptionBlock` so overrides like
  // `xAxis: { axisLabel: { fontSize: 9 } }` only replace the axisLabel
  // inner fields they touch, not the whole axisLabel (and never the data).
  const userOption: any = props.option ?? {}
  const { series: userSeries, xAxis: userXAxis, yAxis: userYAxis, grid: userGrid, tooltip: userTooltip, legend: userLegend, ...userRest } = userOption
  const mergedSeries = Array.isArray(userSeries)
    ? series.map((s, i) => ({ ...s, ...(userSeries[i] ?? {}) }))
    : series

  const shouldShowLegend = props.showLegend ?? (
    fields.length > 1 || Boolean(props.seriesName && props.seriesName !== 'y' && props.seriesName !== 'Value')
  )

  const baseLegend: any = shouldShowLegend
    ? {
        top: 0,
        right: 8,
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { fontSize: 10.5, fontWeight: 500, color: chartTextColor.value },
      }
    : { show: false }

  const topPadding = (props.yAxisName || shouldShowLegend) ? 28 : 10
  const bottomPadding = props.xAxisName ? 28 : (fields.length > 1 ? 24 : 8)

  return {
    color: chartColors.value,
    grid: mergeOptionBlock({
      left: 6,
      right: 14,
      top: topPadding,
      bottom: bottomPadding,
      containLabel: true,
    }, userGrid),
    tooltip: mergeOptionBlock({
      trigger: 'axis',
      backgroundColor: chartTooltipBg.value,
      borderColor: chartTooltipBorder.value,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: chartTooltipText.value, fontSize: 11.5 },
      extraCssText: 'border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.22);backdrop-filter:blur(4px);',
      formatter: (params: any) => {
        if (!Array.isArray(params) || !params.length) return ''
        const header = `<div style="font-weight:700;font-size:11px;margin-bottom:6px;border-bottom:1px solid rgba(125,125,125,0.2);padding-bottom:3px;color:${chartTooltipText.value}">${params[0].axisValue}</div>`
        const rows = params.map((p: any) => {
          const marker = p.marker || `<span style="display:inline-block;margin-right:6px;border-radius:50%;width:8px;height:8px;background-color:${p.color};"></span>`
          const val = p.value != null ? p.value : '—'
          const sName = p.seriesName === 'y' ? (props.yAxisName || 'Value') : p.seriesName

          let unitStr = props.unit ? ` ${props.unit}` : ''
          let extraDesc = ''
          if ((props.unit === 'Bf' || /beaufort|wind/i.test(sName)) && typeof p.value === 'number') {
            const bfTerms = ['Calm', 'Light Air', 'Light Breeze', 'Gentle Breeze', 'Moderate Breeze', 'Fresh Breeze', 'Strong Breeze', 'Near Gale', 'Gale', 'Strong Gale', 'Storm', 'Violent Storm', 'Hurricane']
            const bfVal = Math.min(12, Math.max(0, Math.round(p.value)))
            if (bfTerms[bfVal]) extraDesc = ` <span style="opacity:0.75;font-weight:normal">(${bfTerms[bfVal]})</span>`
          }

          return `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;line-height:1.5">
            <div style="display:flex;align-items:center">${marker}<span style="opacity:0.85">${sName}:</span></div>
            <div style="font-weight:700;font-family:monospace;margin-left:auto">${val}${unitStr}${extraDesc}</div>
          </div>`
        }).join('')
        return `${header}${rows}`
      },
    }, userTooltip),
    legend: userLegend?.show === false ? undefined : mergeOptionBlock(baseLegend, userLegend),
    xAxis: mergeOptionBlock({
      type: 'category',
      data: xData,
      name: props.xAxisName,
      nameLocation: 'middle',
      nameGap: 20,
      nameTextStyle: {
        color: chartTextColor.value,
        fontSize: 10,
        fontWeight: 600,
      },
      axisLine: { lineStyle: { color: chartAxisColor.value } },
      axisLabel: { color: chartTextColor.value, fontSize: 10.5 },
      axisTick: { show: false },
    }, userXAxis),
    yAxis: mergeOptionBlock({
      type: 'value',
      name: props.yAxisName ?? (props.unit ? `(${props.unit})` : undefined),
      nameLocation: 'end',
      nameGap: 8,
      nameTextStyle: {
        color: chartTextColor.value,
        fontSize: 10,
        fontWeight: 600,
        align: 'left',
      },
      splitLine: { lineStyle: { color: chartSplitLineColor.value } },
      axisLabel: { color: chartTextColor.value, fontSize: 10.5 },
      axisLine: { show: false },
      axisTick: { show: false },
    }, userYAxis),
    series: mergedSeries,
    ...userRest,
  }
})
</script>

<template>
  <div
    :style="{ height: /^\d+$/.test(String(height)) ? `${height}px` : String(height) }"
    :class="cn('w-full', props.class)"
  >
    <VChart :option="mergedOption" :autoresize="true" class="size-full" />
  </div>
</template>
