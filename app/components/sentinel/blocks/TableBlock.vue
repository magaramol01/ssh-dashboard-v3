<script setup lang="ts">
import type { SentinelBlock } from '#shared/types/sentinel'
import InteractiveTableChart from './InteractiveTableChart.vue'

type TableBlock = Extract<SentinelBlock, { type: 'table' }>
defineProps<{ block: TableBlock }>()
</script>

<template>
  <InteractiveTableChart
    :title="block.title"
    :columns="block.columns"
    :rows="block.rows"
  />
</template>
