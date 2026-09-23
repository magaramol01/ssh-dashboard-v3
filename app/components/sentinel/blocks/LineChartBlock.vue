<script setup lang="ts">
import type { SentinelBlock } from '#shared/types/sentinel'
import AreaChart from '@/components/ui/charts/area-chart/AreaChart.vue'
import { Activity } from 'lucide-vue-next'

type LineChartBlock = Extract<SentinelBlock, { type: 'line-chart' }>
defineProps<{ block: LineChartBlock }>()
</script>

<template>
  <div class="rounded-lg border border-border/70 bg-card/60 p-3.5 space-y-2.5">
    <div class="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
      <div class="flex items-center gap-2 min-w-0">
        <Activity class="size-3.5 text-primary shrink-0" />
        <p class="text-[11px] font-bold uppercase tracking-wider text-foreground truncate">{{ block.title }}</p>
      </div>
      <span class="text-[10px] text-muted-foreground font-mono shrink-0">{{ block.points.length }} pts</span>
    </div>
    <ClientOnly>
      <AreaChart
        :data="block.points.map((point) => ({ x: point.label, y: point.value }))"
        x-field="x"
        y-field="y"
        height="190"
      />
      <template #fallback><div class="h-[190px] animate-pulse rounded-md bg-muted/40" /></template>
    </ClientOnly>
  </div>
</template>
