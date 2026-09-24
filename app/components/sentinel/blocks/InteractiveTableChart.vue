<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Table as TableIcon, LineChart as ChartIcon, BarChart3 } from 'lucide-vue-next'
import AreaChart from '@/components/ui/charts/area-chart/AreaChart.vue'
import BarChart from '@/components/ui/charts/bar-chart/BarChart.vue'
import { cleanLatexMath } from '~/lib/utils'

interface Column {
  key: string
  label: string
}

const props = withDefaults(
  defineProps<{
    title?: string
    columns: Column[]
    rows: Array<Record<string, any>>
    initialMode?: 'table' | 'chart' | 'auto'
  }>(),
  {
    title: '',
    initialMode: 'auto',
  }
)

function parseNumericValue(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') return Number.isFinite(val) ? val : null
  const cleaned = String(val).replace(/[^0-9.-]/g, '')
  if (!cleaned || cleaned === '-' || cleaned === '.') return null
  const num = parseFloat(cleaned)
  return Number.isFinite(num) ? num : null
}

// Discover which columns are numeric
const numericColumns = computed(() => {
  if (!props.columns?.length || !props.rows?.length) return []
  const list: Column[] = []

  // Check columns starting from index 1 (column 0 is typically the X-axis label: Day, Date, Vessel, etc.)
  const candidateIndices = props.columns.length > 1
    ? props.columns.slice(1)
    : props.columns

  for (const col of candidateIndices) {
    let numericCount = 0
    for (const r of props.rows) {
      if (parseNumericValue(r[col.key]) !== null) {
        numericCount++
      }
    }
    // If at least 50% of rows have numeric values, treat as graphable metric
    if (numericCount >= Math.ceil(props.rows.length * 0.5)) {
      list.push(col)
    }
  }

  return list
})

const hasGraphableData = computed(() => {
  return numericColumns.value.length > 0 && props.rows.length >= 2
})

// Detect if dataset represents a trend / time-series
const isLikelyTrend = computed(() => {
  if (!props.columns?.length || !hasGraphableData.value) return false
  const firstColLabel = (props.columns[0]?.label || '').toLowerCase()
  return /day|date|time|timeline|period|hour|month|year|voyage|step|leg|interval|sample|trend/i.test(firstColLabel)
})

// Current display mode: 'table' or 'chart'
const mode = ref<'table' | 'chart'>('table')

// Synchronize initial mode
watch(
  () => [props.initialMode, isLikelyTrend.value, hasGraphableData.value] as const,
  ([initialMode, isTrend, hasGraph]) => {
    if (initialMode === 'chart') {
      mode.value = 'chart'
    } else if (initialMode === 'table') {
      mode.value = 'table'
    } else if (isTrend && hasGraph) {
      mode.value = 'chart'
    } else {
      mode.value = 'table'
    }
  },
  { immediate: true }
)

// Currently selected metric column for charting
const selectedMetricKey = ref<string>('')

watch(
  numericColumns,
  (cols) => {
    if (!selectedMetricKey.value || !cols.some((c) => c.key === selectedMetricKey.value)) {
      selectedMetricKey.value = cols[0]?.key || ''
    }
  },
  { immediate: true }
)

// Selected chart presentation style: 'area' (smooth line) or 'bar'
const chartStyle = ref<'area' | 'bar'>('area')

const activeMetricColumn = computed(() => {
  return numericColumns.value.find((c) => c.key === selectedMetricKey.value) || numericColumns.value[0]
})

const activeChartMeta = computed(() => {
  if (!activeMetricColumn.value) {
    return { seriesName: 'Value', unit: '', xName: 'Timeline', yName: 'Value' }
  }
  const label = activeMetricColumn.value.label || 'Metric'
  const unitMatch = label.match(/\(([^)]+)\)/)
  const rawUnit = unitMatch ? unitMatch[1].trim() : ''
  const cleanLabel = label.replace(/\([^)]+\)/g, '').trim()

  const xColLabel = props.columns[0]?.label || 'Timeline'
  const isDays = /day/i.test(xColLabel)
  const xName = isDays ? 'Voyage Day' : cleanLatexMath(xColLabel)

  let unit = rawUnit
  if (/beaufort|bf/i.test(rawUnit)) unit = 'Bf'
  else if (/metric\s*ton|tonne|mt/i.test(rawUnit)) unit = 'MT'
  else if (/%|percent/i.test(rawUnit)) unit = '%'
  else if (/knot|kts/i.test(rawUnit)) unit = 'kts'
  else if (/rpm/i.test(rawUnit)) unit = 'RPM'

  return {
    seriesName: cleanLatexMath(cleanLabel),
    unit,
    xName,
    yName: unit ? `${unit}` : cleanLatexMath(cleanLabel),
  }
})

function cleanDisplayText(val: unknown): string {
  if (val === null || val === undefined || val === '') return '—'
  const str = typeof val === 'object'
    ? (Array.isArray(val) ? val.join('; ') : JSON.stringify(val))
    : String(val)
  const stripped = str.replace(/^\*{1,2}(.*?)\*{1,2}$/, '$1').replace(/^`(.*?)`$/, '$1').trim()
  return cleanLatexMath(stripped)
}

// Generate data points for ECharts
const chartPoints = computed(() => {
  if (!activeMetricColumn.value || !props.rows?.length) return []
  const xColKey = props.columns[0]?.key || 'col_0'

  return props.rows
    .map((r, idx) => {
      const rawX = r[xColKey] ?? `Row ${idx + 1}`
      const cleanX = cleanDisplayText(rawX)
      const rawY = parseNumericValue(r[activeMetricColumn.value!.key])
      return {
        x: cleanX,
        y: rawY ?? 0,
      }
    })
    .filter((pt) => Boolean(pt.x))
})

// Statistics for selected metric
const metricStats = computed(() => {
  const values = chartPoints.value.map((p) => p.y)
  if (!values.length) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const avg = Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2))
  return { min, max, avg }
})

function formatCell(val: unknown): string {
  return cleanDisplayText(val)
}
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-border/70 bg-card/60 my-2.5">
    <!-- Header with View Toggle & Metric Selector -->
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-3.5 py-2">
      <!-- Title & Badges -->
      <div class="flex items-center gap-2 min-w-0">
        <component :is="mode === 'chart' ? ChartIcon : TableIcon" class="size-3.5 text-primary shrink-0" />
        <p v-if="title" class="text-[11px] font-bold uppercase tracking-wider text-foreground truncate">
          {{ cleanLatexMath(title) }}
        </p>
        <span v-else class="text-[11px] font-bold uppercase tracking-wider text-foreground truncate">
          {{ mode === 'chart' ? (activeMetricColumn ? cleanLatexMath(activeMetricColumn.label) : 'Dynamic Trend') : 'Data Table' }}
        </span>
        <span class="text-[10px] font-mono text-muted-foreground shrink-0">
          {{ rows.length }} {{ rows.length === 1 ? 'row' : 'rows' }}
        </span>
      </div>

      <!-- Controls: Table / Chart Mode Switch -->
      <div class="flex items-center gap-1.5 shrink-0">
        <div v-if="hasGraphableData" class="inline-flex rounded-md border border-border/70 bg-background/80 p-0.5 shadow-2xs">
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold transition-colors cursor-pointer"
            :class="mode === 'table' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'"
            @click="mode = 'table'"
          >
            <TableIcon class="size-2.5" />
            <span>Table</span>
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold transition-colors cursor-pointer"
            :class="mode === 'chart' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'"
            @click="mode = 'chart'"
          >
            <ChartIcon class="size-2.5" />
            <span>Chart</span>
          </button>
        </div>

        <!-- Chart Style Toggle (Area / Bar) -->
        <div v-if="mode === 'chart' && hasGraphableData" class="inline-flex rounded-md border border-border/70 bg-background/80 p-0.5 shadow-2xs">
          <button
            type="button"
            class="p-1 rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            :class="chartStyle === 'area' ? 'bg-muted text-foreground' : ''"
            title="Area / Line Curve"
            @click="chartStyle = 'area'"
          >
            <ChartIcon class="size-2.5" />
          </button>
          <button
            type="button"
            class="p-1 rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            :class="chartStyle === 'bar' ? 'bg-muted text-foreground' : ''"
            title="Bar Histogram"
            @click="chartStyle = 'bar'"
          >
            <BarChart3 class="size-2.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Chart Controls: Metric Column Selector Pills (when in Chart mode) -->
    <div
      v-if="mode === 'chart' && hasGraphableData && numericColumns.length > 1"
      class="flex flex-wrap items-center justify-between gap-1.5 border-b border-border/40 bg-muted/15 px-3 py-1.5"
    >
      <div class="flex flex-wrap items-center gap-1">
        <span class="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">Plot:</span>
        <button
          v-for="col in numericColumns"
          :key="col.key"
          type="button"
          class="px-2 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer"
          :class="
            selectedMetricKey === col.key
              ? 'bg-primary/15 border-primary/50 text-primary font-semibold'
              : 'border-border/60 bg-background/60 text-muted-foreground hover:text-foreground hover:border-border'
          "
          @click="selectedMetricKey = col.key"
        >
          {{ cleanLatexMath(col.label) }}
        </button>
      </div>

      <!-- Quick Stats Chip -->
      <div v-if="metricStats" class="text-[9.5px] text-muted-foreground font-mono">
        <span>Min: <b class="text-foreground">{{ metricStats.min }}</b></span>
        <span class="mx-1">·</span>
        <span>Avg: <b class="text-foreground">{{ metricStats.avg }}</b></span>
        <span class="mx-1">·</span>
        <span>Max: <b class="text-foreground">{{ metricStats.max }}</b></span>
      </div>
    </div>

    <!-- 1. DYNAMIC CHART VIEW -->
    <div v-if="mode === 'chart' && hasGraphableData" class="p-3">
      <ClientOnly>
        <AreaChart
          v-if="chartStyle === 'area'"
          :data="chartPoints"
          x-field="x"
          y-field="y"
          :series-name="activeChartMeta.seriesName"
          :unit="activeChartMeta.unit"
          :x-axis-name="activeChartMeta.xName"
          :y-axis-name="activeChartMeta.yName"
          :show-legend="true"
          height="220"
        />
        <BarChart
          v-else
          :data="chartPoints"
          x-field="x"
          y-field="y"
          :series-name="activeChartMeta.seriesName"
          :unit="activeChartMeta.unit"
          :x-axis-name="activeChartMeta.xName"
          :y-axis-name="activeChartMeta.yName"
          :show-legend="true"
          height="220"
        />
        <template #fallback>
          <div class="h-[220px] animate-pulse rounded-md bg-muted/40" />
        </template>
      </ClientOnly>
    </div>

    <!-- 2. DATA TABLE VIEW -->
    <div v-else class="overflow-x-auto max-h-[340px]">
      <table class="w-full text-left text-[11px]">
        <thead class="bg-muted/30 text-muted-foreground sticky top-0 backdrop-blur-xs z-1">
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              class="whitespace-nowrap px-3 py-2 font-semibold border-b border-border/60 text-[10px] uppercase tracking-wider"
            >
              {{ cleanLatexMath(column.label) }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border/40">
          <tr
            v-for="(row, index) in rows"
            :key="index"
            class="align-top hover:bg-muted/20 transition-colors"
          >
            <td
              v-for="column in columns"
              :key="column.key"
              class="max-w-[240px] px-3 py-2 text-foreground/90 font-medium leading-relaxed"
            >
              {{ formatCell(row[column.key]) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
