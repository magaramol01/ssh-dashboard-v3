<script setup lang="ts">
import type { SentinelBlock } from '#shared/types/sentinel'
import AreaChart from '@/components/ui/charts/area-chart/AreaChart.vue'

type LineChartBlock = Extract<SentinelBlock, { type: 'line-chart' }>
defineProps<{ block: LineChartBlock }>()
</script>

<template>
  <div class="space-y-2">
    <p class="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">{{ block.title }}</p>
    <ClientOnly>
      <AreaChart :data="block.points.map((point) => ({ x: point.label, y: point.value }))" x-field="x" y-field="y" height="180" />
      <template #fallback><div class="h-[180px] animate-pulse rounded-md bg-muted/40" /></template>
    </ClientOnly>
  </div>
</template>
