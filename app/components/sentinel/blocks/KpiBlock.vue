<script setup lang="ts">
import type { SentinelBlock } from '#shared/types/sentinel'

type KpiBlock = Extract<SentinelBlock, { type: 'kpi' }>
defineProps<{
  block: KpiBlock
  isHighlight?: boolean
}>()
</script>

<template>
  <div
    class="group relative flex flex-col justify-between overflow-hidden rounded-lg border p-3 transition-all hover:border-primary/50 hover:bg-card/95 hover:shadow-xs"
    :class="[
      block.tone === 'destructive'
        ? 'border-destructive/40 bg-destructive/10 text-destructive'
        : block.tone === 'warning'
          ? 'border-warning/40 bg-warning/10 text-warning'
          : block.tone === 'success'
            ? 'border-success/40 bg-success/10 text-success'
            : 'border-border/70 bg-card/60 text-foreground',
      isHighlight ? 'sm:col-span-2 ring-1 ring-primary/20 bg-primary/5' : ''
    ]"
  >
    <div>
      <div class="flex items-center justify-between gap-1.5">
        <p class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
          {{ block.label }}
        </p>
        <span
          v-if="block.tone && block.tone !== 'default'"
          class="size-1.5 rounded-full shrink-0"
          :class="
            block.tone === 'destructive'
              ? 'bg-destructive shadow-xs shadow-destructive/50'
              : block.tone === 'warning'
                ? 'bg-warning shadow-xs shadow-warning/50'
                : 'bg-success shadow-xs shadow-success/50'
          "
        />
      </div>

      <p
        class="mt-1.5 text-base sm:text-lg font-bold tracking-tight tabular-nums"
        :class="
          block.tone === 'destructive'
            ? 'text-destructive'
            : block.tone === 'warning'
              ? 'text-warning'
              : block.tone === 'success'
                ? 'text-success'
                : 'text-foreground'
        "
      >
        {{ block.value }}
      </p>
    </div>

    <p
      v-if="block.detail"
      class="mt-1.5 text-[11px] leading-snug text-muted-foreground/90 font-normal"
      :class="isHighlight ? 'line-clamp-3' : 'line-clamp-2'"
      :title="block.detail"
    >
      {{ block.detail }}
    </p>
  </div>
</template>
