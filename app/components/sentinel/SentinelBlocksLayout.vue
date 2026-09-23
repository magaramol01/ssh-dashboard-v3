<script setup lang="ts">
import { computed } from 'vue'
import type { SentinelBlock } from '#shared/types/sentinel'
import KpiBlockComponent from './blocks/KpiBlock.vue'
import LineChartBlockComponent from './blocks/LineChartBlock.vue'
import BarChartBlockComponent from './blocks/BarChartBlock.vue'
import TableBlockComponent from './blocks/TableBlock.vue'

type KpiBlock = Extract<SentinelBlock, { type: 'kpi' }>
type LineChartBlock = Extract<SentinelBlock, { type: 'line-chart' }>
type BarChartBlock = Extract<SentinelBlock, { type: 'bar-chart' }>
type TableBlock = Extract<SentinelBlock, { type: 'table' }>

const props = defineProps<{
  blocks: SentinelBlock[]
}>()

// Filter out markdown blocks (rendered separately in MarkdownBlock)
const nonMarkdownBlocks = computed(() => {
  return (props.blocks || []).filter((b) => b && b.type !== 'markdown')
})

const kpiBlocks = computed(() => {
  return nonMarkdownBlocks.value.filter((b): b is KpiBlock => b.type === 'kpi')
})

const chartBlocks = computed(() => {
  return nonMarkdownBlocks.value.filter((b): b is LineChartBlock | BarChartBlock => b.type === 'line-chart' || b.type === 'bar-chart')
})

const tableBlocks = computed(() => {
  return nonMarkdownBlocks.value.filter((b): b is TableBlock => b.type === 'table')
})

// Calculate if a KPI should be highlighted with wider span
function isHighlightKpi(kpi: KpiBlock) {
  if (!kpi.detail) return false
  const lowerLabel = kpi.label.toLowerCase()
  return (
    kpi.detail.length > 60 ||
    lowerLabel.includes('feasibility') ||
    lowerLabel.includes('recommend') ||
    lowerLabel.includes('action')
  )
}

// Adaptive column styling based on KPI count
const kpiGridClass = computed(() => {
  const count = kpiBlocks.value.length
  if (count === 1) return 'grid grid-cols-1 sm:max-w-md'
  if (count === 2) return 'grid grid-cols-2 gap-2.5'
  if (count === 3) return 'grid grid-cols-1 sm:grid-cols-3 gap-2.5'
  return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5'
})
</script>

<template>
  <div v-if="nonMarkdownBlocks.length" class="space-y-3.5 pt-2">
    <!-- 1. Executive KPIs Grid (Metrics at a glance) -->
    <div v-if="kpiBlocks.length" class="space-y-1.5">
      <div :class="kpiGridClass">
        <KpiBlockComponent
          v-for="(kpi, idx) in kpiBlocks"
          :key="`kpi-${idx}-${kpi.label}`"
          :block="kpi"
          :is-highlight="isHighlightKpi(kpi)"
        />
      </div>
    </div>

    <!-- 2. Visual Charts Grid (Telemetry trends) -->
    <div v-if="chartBlocks.length" class="space-y-3">
      <div :class="chartBlocks.length > 1 ? 'grid grid-cols-1 xl:grid-cols-2 gap-3' : 'space-y-3'">
        <template v-for="(chart, idx) in chartBlocks" :key="`chart-${idx}-${chart.title}`">
          <LineChartBlockComponent v-if="chart.type === 'line-chart'" :block="chart" />
          <BarChartBlockComponent v-else-if="chart.type === 'bar-chart'" :block="chart" />
        </template>
      </div>
    </div>

    <!-- 3. Granular Operational Data (Tables) -->
    <div v-if="tableBlocks.length" class="space-y-3">
      <TableBlockComponent
        v-for="(tbl, idx) in tableBlocks"
        :key="`tbl-${idx}-${tbl.title}`"
        :block="tbl"
      />
    </div>
  </div>
</template>
