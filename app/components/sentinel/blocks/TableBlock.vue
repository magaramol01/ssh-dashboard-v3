<script setup lang="ts">
import type { SentinelBlock } from '#shared/types/sentinel'

type TableBlock = Extract<SentinelBlock, { type: 'table' }>
defineProps<{ block: TableBlock }>()
</script>

<template>
  <div class="overflow-hidden rounded-md border border-border/60">
    <p class="border-b border-border/60 bg-muted/30 px-2.5 py-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">{{ block.title }}</p>
    <div class="overflow-x-auto">
      <table class="w-full text-left text-[11px]">
        <thead class="bg-muted/20 text-muted-foreground">
          <tr>
            <th v-for="column in block.columns" :key="column.key" class="whitespace-nowrap px-2.5 py-2 font-medium">{{ column.label }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border/50">
          <tr v-for="(row, index) in block.rows" :key="index" class="align-top">
            <td v-for="column in block.columns" :key="column.key" class="max-w-[180px] px-2.5 py-2 text-foreground">{{ row[column.key] ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
