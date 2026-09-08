<script setup lang="ts">
import {
  Anchor,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowUpRight,
  TrendingDown,
} from 'lucide-vue-next'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { HullPropulsionData } from '../../../../server/utils/marine/performance-widgets'

const props = defineProps<{
  propulsion: HullPropulsionData
}>()

function getStatusBadge(status: HullPropulsionData['cleaningStatus']) {
  switch (status) {
    case 'critical':
      return 'border-rose-500/40 text-rose-500 bg-rose-500/5'
    case 'recommended':
      return 'border-amber-500/40 text-amber-500 bg-amber-500/5'
    case 'monitoring':
      return 'border-blue-500/40 text-blue-500 bg-blue-500/5'
    default:
      return 'border-emerald-500/40 text-emerald-500 bg-emerald-500/5'
  }
}
</script>

<template>
  <Card class="shadow-xs border-border/70 flex flex-col justify-between bg-card">
    <CardHeader class="pb-3 border-b border-border/40">
      <div class="flex items-center justify-between">
        <div>
          <CardTitle class="text-base font-semibold flex items-center gap-2">
            <Anchor class="size-4 text-primary" />
            Hull Fouling & Propulsion Monitor
          </CardTitle>
          <CardDescription class="text-xs">
            Speed-power deterioration vs sea trial and propeller slip tracking
          </CardDescription>
        </div>
        <Badge
          variant="outline"
          :class="getStatusBadge(propulsion.cleaningStatus)"
          class="text-[10px] uppercase font-mono tracking-wider font-semibold"
        >
          <component
            :is="propulsion.cleaningStatus === 'optimal' ? CheckCircle2 : AlertTriangle"
            class="size-3 mr-1"
          />
          {{ propulsion.cleaningStatus }}
        </Badge>
      </div>
    </CardHeader>

    <CardContent class="p-5 space-y-4 flex-1 flex flex-col justify-between">
      <!-- Top Metrics Grid -->
      <div class="grid grid-cols-2 gap-3">
        <!-- Sea Trial Time Loss -->
        <div class="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-1">
          <div class="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Sea Trial Variance</span>
            <Activity class="size-3.5 text-primary" />
          </div>
          <div
            class="text-2xl font-bold tabular-nums"
            :class="propulsion.timeLossPct < 0 ? 'text-amber-500' : 'text-emerald-500'"
          >
            {{ propulsion.timeLossPct > 0 ? '+' : '' }}{{ propulsion.timeLossPct }}%
          </div>
          <p class="text-[10px] text-muted-foreground">
            % Time Loss/Gain vs Baseline
          </p>
        </div>

        <!-- Propeller Apparent Slip -->
        <div class="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-1">
          <div class="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Engine Propeller Slip</span>
            <TrendingDown class="size-3.5 text-primary" />
          </div>
          <div class="text-2xl font-bold tabular-nums text-foreground">
            {{ propulsion.engineSlipPct }}%
          </div>
          <p class="text-[10px] text-muted-foreground">
            Mean apparent slip from noon logs
          </p>
        </div>
      </div>

      <!-- Hydrodynamic Drag Penalty Bar -->
      <div class="space-y-1.5 p-3 rounded-xl border border-border/50 bg-muted/10 text-xs">
        <div class="flex items-center justify-between text-[11px]">
          <span class="font-medium text-foreground">Added Hydrodynamic Drag</span>
          <span class="font-mono font-bold" :class="propulsion.dragPenaltyPct > 10 ? 'text-amber-500' : 'text-foreground'">
            +{{ propulsion.dragPenaltyPct }}% Power Penalty
          </span>
        </div>
        <div class="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="propulsion.dragPenaltyPct >= 15 ? 'bg-rose-500' : propulsion.dragPenaltyPct >= 10 ? 'bg-amber-500' : 'bg-primary'"
            :style="{ width: `${Math.min(100, propulsion.dragPenaltyPct * 4)}%` }"
          />
        </div>
        <div class="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
          <span>Clean Hull (0%)</span>
          <span class="text-emerald-500 font-semibold flex items-center gap-1">
            <Sparkles class="size-3" /> ~{{ propulsion.powerRecoveryPotentialPct }}% recovery upon cleaning
          </span>
          <span>Heavy Fouling (25%+)</span>
        </div>
      </div>

      <!-- Action Advisory Callout -->
      <div class="p-2.5 rounded-lg border border-border/40 bg-muted/15 flex items-center justify-between text-xs">
        <span class="text-muted-foreground text-[11px]">Diver Hull Inspection Recommendation:</span>
        <span class="font-medium text-xs text-foreground font-mono">
          {{ propulsion.cleaningStatus === 'critical' ? 'Immediate Work Order' : propulsion.cleaningStatus === 'recommended' ? 'Next Port Call' : 'Routine Schedule' }}
        </span>
      </div>
    </CardContent>
  </Card>
</template>
