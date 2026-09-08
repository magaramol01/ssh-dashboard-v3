<script setup lang="ts">
import type { SentinelBlock } from '#shared/types/sentinel'
import BarChart from '@/components/ui/charts/bar-chart/BarChart.vue'

type BarChartBlock = Extract<SentinelBlock, { type: 'bar-chart' }>
defineProps<{ block: BarChartBlock }>()
</script>

<template>
  <div class="space-y-2 rounded-lg border border-border/60 bg-muted/10 p-3">
    <p class="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">{{ block.title }}</p>
    <ClientOnly>
      <BarChart :data="block.points.map((point) => ({ x: point.label, y: point.value }))" x-field="x" y-field="y" height="200" />
      <template #fallback><div class="h-[200px] animate-pulse rounded-md bg-muted/40" /></template>
    </ClientOnly>
  </div>
</template>
