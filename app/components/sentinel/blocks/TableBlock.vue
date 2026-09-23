<script setup lang="ts">
import type { SentinelBlock } from '#shared/types/sentinel'
import { Table as TableIcon } from 'lucide-vue-next'

type TableBlock = Extract<SentinelBlock, { type: 'table' }>
defineProps<{ block: TableBlock }>()

function formatCell(val: unknown): string {
  if (val === null || val === undefined || val === '') return '—'
  if (typeof val === 'object') {
    if (Array.isArray(val)) {
      return val.map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item))).join('; ')
    }
    return JSON.stringify(val)
  }
  return String(val)
}
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-border/70 bg-card/60">
    <div class="flex items-center justify-between border-b border-border/60 bg-muted/30 px-3.5 py-2.5">
      <div class="flex items-center gap-2 min-w-0">
        <TableIcon class="size-3.5 text-primary shrink-0" />
        <p class="text-[11px] font-bold uppercase tracking-wider text-foreground truncate">{{ block.title }}</p>
      </div>
      <span class="text-[10px] font-medium text-muted-foreground font-mono shrink-0">
        {{ block.rows.length }} {{ block.rows.length === 1 ? 'row' : 'rows' }}
      </span>
    </div>
    <div class="overflow-x-auto max-h-[300px]">
      <table class="w-full text-left text-[11px]">
        <thead class="bg-muted/30 text-muted-foreground sticky top-0 backdrop-blur-xs z-1">
          <tr>
            <th
              v-for="column in block.columns"
              :key="column.key"
              class="whitespace-nowrap px-3 py-2 font-semibold border-b border-border/60 text-[10px] uppercase tracking-wider"
            >
              {{ column.label }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border/40">
          <tr
            v-for="(row, index) in block.rows"
            :key="index"
            class="align-top hover:bg-muted/20 transition-colors"
          >
            <td
              v-for="column in block.columns"
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
