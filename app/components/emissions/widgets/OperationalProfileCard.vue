<script setup lang="ts">
import {
  Ship,
  Anchor,
  Package,
} from 'lucide-vue-next'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { OperationalProfileData } from '../../../../server/utils/marine/performance-widgets'

defineProps<{
  operations: OperationalProfileData
}>()
</script>

<template>
  <Card class="shadow-xs border-border/70 flex flex-col justify-between bg-card">
    <CardHeader class="pb-3 border-b border-border/40">
      <div class="flex items-center justify-between">
        <div>
          <CardTitle class="text-base font-semibold flex items-center gap-2">
            <Ship class="size-4 text-primary" />
            Operational Profile & Idle Audit
          </CardTitle>
          <CardDescription class="text-xs">
            Laden, ballast & non-productive port stays
          </CardDescription>
        </div>
        <Badge variant="outline" class="text-[10px] font-mono border-border text-muted-foreground">
          YTD Profile
        </Badge>
      </div>
    </CardHeader>

    <CardContent class="p-5 space-y-4 flex-1 flex flex-col justify-between">
      <!-- Top Metrics Grid -->
      <div class="grid grid-cols-2 gap-3">
        <!-- Laden vs Ballast -->
        <div class="p-3 rounded-xl border border-border/60 bg-muted/20 flex flex-col justify-between gap-1">
          <div class="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Cargo Transport</span>
            <Package class="size-3.5 text-primary" />
          </div>
          <div class="flex items-baseline justify-between">
            <span class="text-2xl font-bold tabular-nums text-foreground">
              {{ Number(operations.ladenPct).toFixed(1) }}%
            </span>
            <span class="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
              Laden
            </span>
          </div>
        </div>

        <!-- Port & Anchorage Idle -->
        <div class="p-3 rounded-xl border border-border/60 bg-muted/20 flex flex-col justify-between gap-1">
          <div class="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Port / Idle Stays</span>
            <Anchor class="size-3.5 text-amber-500" />
          </div>
          <div class="flex items-baseline justify-between">
            <span class="text-2xl font-bold tabular-nums text-amber-500">
              {{ (Number(operations.portPct) + Number(operations.anchoragePct)).toFixed(1) }}%
            </span>
            <span class="text-[10px] font-mono text-amber-500/80 bg-amber-500/10 px-1.5 py-0.5 rounded">
              ~{{ Number(operations.nonProductiveFuelMt).toFixed(0) }} MT Fuel
            </span>
          </div>
        </div>
      </div>

      <!-- Segmented Profile Bar -->
      <div class="p-3 rounded-xl border border-border/50 bg-muted/10 space-y-2.5">
        <div class="flex items-center justify-between text-xs">
          <span class="text-[11px] font-medium text-foreground">Voyage Time Distribution</span>
          <span class="font-mono text-[10px] text-muted-foreground">100% Operations</span>
        </div>
        <!-- Segmented Colored Bar -->
        <div class="h-2.5 w-full rounded-full bg-muted/40 overflow-hidden flex shadow-inner gap-0.5 p-0.5">
          <div
            class="bg-emerald-500 h-full rounded-l-full transition-all duration-500"
            :style="{ width: `${operations.ladenPct}%` }"
            title="Laden"
          />
          <div
            class="bg-teal-500 h-full transition-all duration-500"
            :style="{ width: `${operations.ballastPct}%` }"
            title="Ballast"
          />
          <div
            class="bg-blue-500 h-full transition-all duration-500"
            :style="{ width: `${operations.portPct}%` }"
            title="Port"
          />
          <div
            class="bg-amber-500 h-full rounded-r-full transition-all duration-500"
            :style="{ width: `${operations.anchoragePct}%` }"
            title="Anchorage"
          />
        </div>

        <!-- Visual Pills -->
        <div class="grid grid-cols-4 gap-1 text-[10px] font-mono text-center">
          <div class="bg-muted/40 rounded px-1 py-0.5 text-foreground flex items-center justify-center gap-1">
            <span class="size-1.5 rounded-full bg-emerald-500" />
            <span>{{ Number(operations.ladenPct).toFixed(0) }}% Ldn</span>
          </div>
          <div class="bg-muted/40 rounded px-1 py-0.5 text-foreground flex items-center justify-center gap-1">
            <span class="size-1.5 rounded-full bg-teal-500" />
            <span>{{ Number(operations.ballastPct).toFixed(0) }}% Bal</span>
          </div>
          <div class="bg-muted/40 rounded px-1 py-0.5 text-foreground flex items-center justify-center gap-1">
            <span class="size-1.5 rounded-full bg-blue-500" />
            <span>{{ Number(operations.portPct).toFixed(0) }}% Prt</span>
          </div>
          <div class="bg-muted/40 rounded px-1 py-0.5 text-foreground flex items-center justify-center gap-1">
            <span class="size-1.5 rounded-full bg-amber-500" />
            <span>{{ Number(operations.anchoragePct).toFixed(0) }}% Anc</span>
          </div>
        </div>
      </div>

      <!-- Port Optimization Callout -->
      <div class="p-2.5 rounded-lg border border-border/40 bg-muted/15 flex items-center justify-between text-xs">
        <span class="text-muted-foreground text-[11px] flex items-center gap-1.5">
          <Anchor class="size-3.5 text-primary" /> Port Boiler Strategy
        </span>
        <Badge
          variant="secondary"
          class="text-[10px] font-mono px-2 py-0.5 font-semibold text-primary bg-primary/10"
        >
          Shore-Power Recommended
        </Badge>
      </div>
    </CardContent>
  </Card>
</template>
