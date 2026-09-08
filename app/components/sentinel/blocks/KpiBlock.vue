<script setup lang="ts">
import type { SentinelBlock } from '#shared/types/sentinel'

type KpiBlock = Extract<SentinelBlock, { type: 'kpi' }>
defineProps<{ block: KpiBlock }>()
</script>

<template>
  <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
    <p class="text-[10px] uppercase font-medium tracking-wider text-muted-foreground">{{ block.label }}</p>
    <p class="mt-1 text-sm font-semibold" :class="block.tone === 'destructive' ? 'text-destructive' : block.tone === 'warning' ? 'text-warning' : block.tone === 'success' ? 'text-success' : 'text-foreground'">{{ block.value }}</p>
    <p v-if="block.detail" class="mt-0.5 text-[10px] text-muted-foreground">{{ block.detail }}</p>
  </div>
</template>
