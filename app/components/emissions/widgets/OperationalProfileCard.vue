<script setup lang="ts">
import {
  Ship,
  Anchor,
  Package,
  Fuel,
  Clock,
  Layers,
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
            Operational Profile & Port Idle Audit
          </CardTitle>
          <CardDescription class="text-xs">
            Voyage status breakdown across Laden, Ballast, and non-productive idle stays
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
        <div class="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-1">
          <div class="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Cargo Transport Ratio</span>
            <Package class="size-3.5 text-primary" />
          </div>
          <div class="text-2xl font-bold tabular-nums text-foreground">
            {{ operations.ladenPct }}% <span class="text-xs font-normal text-muted-foreground">Laden</span>
          </div>
          <p class="text-[10px] text-muted-foreground">
            Ballast legs: <span class="font-mono text-foreground font-medium">{{ operations.ballastPct }}%</span>
          </p>
        </div>

        <!-- Port & Anchorage Idle -->
        <div class="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-1">
          <div class="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Non-Productive Idle</span>
            <Anchor class="size-3.5 text-amber-500" />
          </div>
          <div class="text-2xl font-bold tabular-nums text-amber-500">
            {{ (operations.portPct + operations.anchoragePct).toFixed(1) }}%
          </div>
          <p class="text-[10px] text-muted-foreground">
            Idle fuel: <span class="font-mono text-foreground font-medium">~{{ operations.nonProductiveFuelMt }} MT</span>
          </p>
        </div>
      </div>

      <!-- Segmented Profile Bar -->
      <div class="space-y-1.5 p-3 rounded-xl border border-border/50 bg-muted/10 text-xs">
        <div class="flex items-center justify-between text-[11px]">
          <span class="font-medium text-foreground">Operational Time Distribution</span>
          <span class="font-mono text-muted-foreground">100% Total Days</span>
        </div>
        <!-- Segmented Colored Bar -->
        <div class="h-2 w-full rounded-full bg-muted overflow-hidden flex shadow-inner">
          <div
            class="bg-emerald-500 h-full transition-all duration-500"
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
            title="Port Operation"
          />
          <div
            class="bg-amber-500 h-full transition-all duration-500"
            :style="{ width: `${operations.anchoragePct}%` }"
            title="Anchorage"
          />
          <div
            class="bg-purple-500 h-full transition-all duration-500"
            :style="{ width: `${operations.maneuveringPct}%` }"
            title="Maneuvering"
          />
        </div>

        <!-- Legend Pills -->
        <div class="flex flex-wrap items-center gap-3 pt-1 text-[10px] text-muted-foreground">
          <span class="flex items-center gap-1">
            <span class="size-1.5 rounded-full bg-emerald-500" /> Laden ({{ operations.ladenPct }}%)
          </span>
          <span class="flex items-center gap-1">
            <span class="size-1.5 rounded-full bg-teal-500" /> Ballast ({{ operations.ballastPct }}%)
          </span>
          <span class="flex items-center gap-1">
            <span class="size-1.5 rounded-full bg-blue-500" /> Port ({{ operations.portPct }}%)
          </span>
          <span class="flex items-center gap-1">
            <span class="size-1.5 rounded-full bg-amber-500" /> Anchorage ({{ operations.anchoragePct }}%)
          </span>
        </div>
      </div>

      <!-- Efficiency Takeaway -->
      <div class="p-2.5 rounded-lg border border-border/40 bg-muted/15 flex items-center justify-between text-xs">
        <span class="text-muted-foreground text-[11px]">Auxiliary / Boiler Port Optimization:</span>
        <span class="font-mono text-xs font-medium text-foreground">
          Shore-Power / Cold-Ironing Recommended
        </span>
      </div>
    </CardContent>
  </Card>
</template>
