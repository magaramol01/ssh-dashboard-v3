<script setup lang="ts">
import {
  Anchor,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
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
            Hull Fouling & Propulsion
          </CardTitle>
          <CardDescription class="text-xs">
            Speed loss vs trial & propeller slip
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
        <div class="p-3 rounded-xl border border-border/60 bg-muted/20 flex flex-col justify-between gap-1">
          <div class="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Sea Trial Variance</span>
            <Activity class="size-3.5 text-primary" />
          </div>
          <div class="flex items-baseline justify-between">
            <span
              class="text-2xl font-bold tabular-nums"
              :class="propulsion.timeLossPct < 0 ? 'text-amber-500' : 'text-emerald-500'"
            >
              {{ propulsion.timeLossPct > 0 ? '+' : '' }}{{ Number(propulsion.timeLossPct).toFixed(1) }}%
            </span>
            <span class="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
              vs Baseline
            </span>
          </div>
        </div>

        <!-- Propeller Apparent Slip -->
        <div class="p-3 rounded-xl border border-border/60 bg-muted/20 flex flex-col justify-between gap-1">
          <div class="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Engine Slip</span>
            <TrendingDown class="size-3.5 text-primary" />
          </div>
          <div class="flex items-baseline justify-between">
            <span class="text-2xl font-bold tabular-nums text-foreground">
              {{ Number(propulsion.engineSlipPct).toFixed(1) }}%
            </span>
            <span class="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
              Apparent
            </span>
          </div>
        </div>
      </div>

      <!-- Visual Hull Drag Severity Meter -->
      <div class="p-3 rounded-xl border border-border/50 bg-muted/10 space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="text-[11px] font-medium text-foreground">Hydrodynamic Drag Penalty</span>
          <span class="font-mono text-[11px] font-bold text-amber-500">+{{ Number(propulsion.dragPenaltyPct).toFixed(1) }}% Power</span>
        </div>
        <!-- 3-Segment Hull Status Spectrum -->
        <div class="grid grid-cols-3 gap-1.5 text-[10px] text-center font-mono">
          <div
            :class="[
              'py-1.5 px-2 rounded-md border flex flex-col items-center gap-0.5 transition-all',
              propulsion.dragPenaltyPct < 7
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-500 font-bold'
                : 'bg-muted/30 border-border/40 text-muted-foreground opacity-60'
            ]"
          >
            <span>Clean Hull</span>
            <span class="text-[9px]">&lt;7%</span>
          </div>
          <div
            :class="[
              'py-1.5 px-2 rounded-md border flex flex-col items-center gap-0.5 transition-all',
              propulsion.dragPenaltyPct >= 7 && propulsion.dragPenaltyPct < 15
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-500 font-bold'
                : 'bg-muted/30 border-border/40 text-muted-foreground opacity-60'
            ]"
          >
            <span>Moderate</span>
            <span class="text-[9px]">7–15%</span>
          </div>
          <div
            :class="[
              'py-1.5 px-2 rounded-md border flex flex-col items-center gap-0.5 transition-all',
              propulsion.dragPenaltyPct >= 15
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-500 font-bold'
                : 'bg-muted/30 border-border/40 text-muted-foreground opacity-60'
            ]"
          >
            <span>Heavy Fouling</span>
            <span class="text-[9px]">&gt;15%</span>
          </div>
        </div>
      </div>

      <!-- Action Advisory Callout -->
      <div class="p-2.5 rounded-lg border border-border/40 bg-muted/15 flex items-center justify-between text-xs">
        <span class="text-muted-foreground text-[11px] flex items-center gap-1.5">
          <Sparkles class="size-3.5 text-emerald-500" /> ~{{ Number(propulsion.powerRecoveryPotentialPct).toFixed(1) }}% Cleaning Recovery
        </span>
        <Badge
          variant="secondary"
          :class="propulsion.cleaningStatus === 'critical' ? 'bg-rose-500/15 text-rose-500' : 'bg-amber-500/15 text-amber-500'"
          class="text-[10px] font-mono px-2 py-0.5 font-semibold"
        >
          {{ propulsion.cleaningStatus === 'critical' ? 'Immediate Polish' : 'Polish at Next Port' }}
        </Badge>
      </div>
    </CardContent>
  </Card>
</template>
