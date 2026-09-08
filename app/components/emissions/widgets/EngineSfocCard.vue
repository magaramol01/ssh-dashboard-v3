<script setup lang="ts">
import {
  Gauge,
  Flame,
  Zap,
  CheckCircle2,
  AlertCircle,
} from 'lucide-vue-next'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { EngineSfocData } from '../../../../server/utils/marine/performance-widgets'

defineProps<{
  engine: EngineSfocData
}>()
</script>

<template>
  <Card class="shadow-xs border-border/70 flex flex-col justify-between bg-card">
    <CardHeader class="pb-3 border-b border-border/40">
      <div class="flex items-center justify-between">
        <div>
          <CardTitle class="text-base font-semibold flex items-center gap-2">
            <Zap class="size-4 text-primary" />
            Engine Health & SFOC Efficiency
          </CardTitle>
          <CardDescription class="text-xs">
            Specific fuel oil consumption vs shop trials
          </CardDescription>
        </div>
        <Badge
          variant="outline"
          :class="engine.status === 'optimal' ? 'border-emerald-500/40 text-emerald-500 bg-emerald-500/5' : engine.status === 'normal' ? 'border-blue-500/40 text-blue-500 bg-blue-500/5' : 'border-amber-500/40 text-amber-500 bg-amber-500/5'"
          class="text-[10px] font-mono uppercase tracking-wider"
        >
          <component :is="engine.status === 'elevated' ? AlertCircle : CheckCircle2" class="size-3 mr-1" />
          {{ engine.status === 'optimal' ? 'Optimal SFOC' : engine.status === 'normal' ? 'Normal Combustion' : 'Thermal Drift' }}
        </Badge>
      </div>
    </CardHeader>

    <CardContent class="p-5 space-y-4 flex-1 flex flex-col justify-between">
      <!-- Top Metrics Grid -->
      <div class="grid grid-cols-2 gap-3">
        <!-- Current SFOC -->
        <div class="p-3 rounded-xl border border-border/60 bg-muted/20 flex flex-col justify-between gap-1">
          <div class="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Attained SFOC</span>
            <Gauge class="size-3.5 text-primary" />
          </div>
          <div class="flex items-baseline justify-between">
            <span class="text-2xl font-bold tabular-nums text-foreground">
              {{ Number(engine.currentSfoc).toFixed(1) }} <span class="text-xs font-normal text-muted-foreground">g/kWh</span>
            </span>
            <span class="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
              Target {{ Number(engine.expectedSfoc).toFixed(0) }}
            </span>
          </div>
        </div>

        <!-- Delta vs Expected -->
        <div class="p-3 rounded-xl border border-border/60 bg-muted/20 flex flex-col justify-between gap-1">
          <div class="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Thermal Variance</span>
            <Flame class="size-3.5" :class="engine.sfocDelta > 5 ? 'text-amber-500' : 'text-emerald-500'" />
          </div>
          <div class="flex items-baseline justify-between">
            <span
              class="text-2xl font-bold tabular-nums"
              :class="engine.sfocDelta > 5 ? 'text-amber-500' : 'text-emerald-500'"
            >
              {{ engine.sfocDelta > 0 ? '+' : '' }}{{ Number(engine.sfocDelta).toFixed(1) }} <span class="text-xs font-normal text-muted-foreground">g/kWh</span>
            </span>
            <span class="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
              Fleet {{ Number(engine.fleetAvgSfoc).toFixed(0) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Visual Combustion Spectrum -->
      <div class="p-3 rounded-xl border border-border/50 bg-muted/10 space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="text-[11px] font-medium text-foreground">Combustion Efficiency</span>
          <span class="font-mono text-[11px] font-semibold text-emerald-500">Benchmark: {{ Number(engine.expectedSfoc).toFixed(1) }} g/kWh</span>
        </div>
        <!-- 3-Segment Status Spectrum -->
        <div class="grid grid-cols-3 gap-1.5 text-[10px] text-center font-mono">
          <div
            :class="[
              'py-1.5 px-2 rounded-md border flex flex-col items-center gap-0.5 transition-all',
              engine.status === 'optimal'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-500 font-bold'
                : 'bg-muted/30 border-border/40 text-muted-foreground opacity-60'
            ]"
          >
            <span>Optimal</span>
            <span class="text-[9px]">&lt;175</span>
          </div>
          <div
            :class="[
              'py-1.5 px-2 rounded-md border flex flex-col items-center gap-0.5 transition-all',
              engine.status === 'normal'
                ? 'bg-blue-500/15 border-blue-500/40 text-blue-500 font-bold'
                : 'bg-muted/30 border-border/40 text-muted-foreground opacity-60'
            ]"
          >
            <span>Normal</span>
            <span class="text-[9px]">175–185</span>
          </div>
          <div
            :class="[
              'py-1.5 px-2 rounded-md border flex flex-col items-center gap-0.5 transition-all',
              engine.status === 'elevated'
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-500 font-bold'
                : 'bg-muted/30 border-border/40 text-muted-foreground opacity-60'
            ]"
          >
            <span>Elevated</span>
            <span class="text-[9px]">&gt;185</span>
          </div>
        </div>
      </div>

      <!-- Mechanical Health Note -->
      <div class="p-2.5 rounded-lg border border-border/40 bg-muted/15 flex items-center justify-between text-xs">
        <span class="text-muted-foreground text-[11px] flex items-center gap-1.5">
          <CheckCircle2 class="size-3.5 text-emerald-500" /> Scavenge & Injector Health
        </span>
        <Badge
          variant="secondary"
          :class="engine.sfocDelta <= 5 ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'"
          class="text-[10px] font-mono px-2 py-0.5 font-semibold"
        >
          {{ engine.sfocDelta <= 5 ? 'Combustion Balanced' : 'Check Scavenge' }}
        </Badge>
      </div>
    </CardContent>
  </Card>
</template>
