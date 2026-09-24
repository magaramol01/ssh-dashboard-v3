<script setup lang="ts">
import { computed } from 'vue'
import type { SentinelBlock } from '#shared/types/sentinel'
import AreaChart from '@/components/ui/charts/area-chart/AreaChart.vue'
import { Activity } from 'lucide-vue-next'
import { cleanLatexMath } from '~/lib/utils'

type LineChartBlock = Extract<SentinelBlock, { type: 'line-chart' }>
const props = defineProps<{ block: LineChartBlock }>()

const chartMeta = computed(() => {
  const title = props.block.title || 'Telemetry'

  // Extract unit if in parentheses: e.g. "DAILY WEATHER FUEL PENALTY (MT)" -> "MT"
  const unitMatch = title.match(/\(([^)]+)\)/)
  const rawUnit = unitMatch ? unitMatch[1].trim() : ''
  const cleanTitle = title.replace(/\([^)]+\)/g, '').trim()

  // Canonical unit mapping
  let unit = rawUnit
  if (/beaufort/i.test(rawUnit)) unit = 'Bf'
  else if (/metric\s*ton|tonne|mt/i.test(rawUnit)) unit = 'MT'
  else if (/%|percent/i.test(rawUnit)) unit = '%'
  else if (/knot|kts/i.test(rawUnit)) unit = 'kts'
  else if (/rpm/i.test(rawUnit)) unit = 'RPM'
  else if (/hour|hrs/i.test(rawUnit)) unit = 'hrs'

  // X Axis Name
  const firstLabel = props.block.points[0]?.label || ''
  const isDays = /day/i.test(firstLabel)
  const isHours = /:\d\d|am|pm|h\b/i.test(firstLabel)
  const isVessel = /vessel|ship|als/i.test(firstLabel)
  const xName = isDays ? 'Voyage Day' : isHours ? 'Timeline (Hour)' : isVessel ? 'Vessel' : 'Timeline'

  // Y Axis Name
  const yName = unit ? `${unit}` : cleanTitle

  // Min, Max, Avg calculation
  const values = props.block.points.map((p) => p.value).filter((v) => Number.isFinite(v))
  const min = values.length ? Math.min(...values) : null
  const max = values.length ? Math.max(...values) : null
  const avg = values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)) : null

  return {
    title: cleanLatexMath(title),
    cleanTitle: cleanLatexMath(cleanTitle),
    unit,
    xName,
    yName,
    seriesName: cleanLatexMath(cleanTitle),
    stats: min !== null && max !== null && avg !== null ? { min, max, avg } : null,
  }
})
</script>

<template>
  <div class="rounded-lg border border-border/70 bg-card/60 p-3.5 space-y-2.5">
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
      <div class="flex items-center gap-2 min-w-0">
        <Activity class="size-3.5 text-primary shrink-0" />
        <p class="text-[11px] font-bold uppercase tracking-wider text-foreground truncate">{{ chartMeta.title }}</p>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <!-- Min / Avg / Max Quick Stats -->
        <div v-if="chartMeta.stats" class="text-[10px] text-muted-foreground font-mono">
          <span>Min: <b class="text-foreground">{{ chartMeta.stats.min }}</b>{{ chartMeta.unit ? ` ${chartMeta.unit}` : '' }}</span>
          <span class="mx-1">·</span>
          <span>Avg: <b class="text-foreground">{{ chartMeta.stats.avg }}</b>{{ chartMeta.unit ? ` ${chartMeta.unit}` : '' }}</span>
          <span class="mx-1">·</span>
          <span>Max: <b class="text-foreground">{{ chartMeta.stats.max }}</b>{{ chartMeta.unit ? ` ${chartMeta.unit}` : '' }}</span>
        </div>
        <span class="text-[10px] text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded border border-border/40 shrink-0">
          {{ block.points.length }} pts
        </span>
      </div>
    </div>

    <!-- Chart Canvas -->
    <ClientOnly>
      <AreaChart
        :data="block.points.map((point) => ({ x: point.label, y: point.value }))"
        x-field="x"
        y-field="y"
        :series-name="chartMeta.seriesName"
        :unit="chartMeta.unit"
        :x-axis-name="chartMeta.xName"
        :y-axis-name="chartMeta.yName"
        :show-legend="true"
        height="205"
      />
      <template #fallback><div class="h-[205px] animate-pulse rounded-md bg-muted/40" /></template>
    </ClientOnly>
  </div>
</template>
