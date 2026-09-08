<script setup lang="ts">
import {
  Gauge,
  Flame,
  Zap,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
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
            Specific Fuel Oil Consumption benchmarked against engine shop trial curves
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
        <div class="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-1">
          <div class="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Attained SFOC</span>
            <Gauge class="size-3.5 text-primary" />
          </div>
          <div class="text-2xl font-bold tabular-nums text-foreground">
            {{ engine.currentSfoc }} <span class="text-xs font-normal text-muted-foreground">g/kWh</span>
          </div>
          <p class="text-[10px] text-muted-foreground">
            Shop Expected: <span class="font-mono text-foreground font-medium">{{ engine.expectedSfoc }}</span> g/kWh
          </p>
        </div>

        <!-- Delta vs Expected -->
        <div class="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-1">
          <div class="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Thermal Variance</span>
            <Flame class="size-3.5" :class="engine.sfocDelta > 5 ? 'text-amber-500' : 'text-emerald-500'" />
          </div>
          <div
            class="text-2xl font-bold tabular-nums"
            :class="engine.sfocDelta > 5 ? 'text-amber-500' : 'text-emerald-500'"
          >
            {{ engine.sfocDelta > 0 ? '+' : '' }}{{ engine.sfocDelta }} <span class="text-xs font-normal text-muted-foreground">g/kWh</span>
          </div>
          <p class="text-[10px] text-muted-foreground">
            Fleet Avg: <span class="font-mono text-foreground font-medium">{{ engine.fleetAvgSfoc }}</span> g/kWh
          </p>
        </div>
      </div>

      <!-- SFOC Gauge Bar -->
      <div class="space-y-1.5 p-3 rounded-xl border border-border/50 bg-muted/10 text-xs">
        <div class="flex items-center justify-between text-[11px]">
          <span class="font-medium text-foreground">Combustion Efficiency Band (150 - 250 g/kWh)</span>
          <span class="font-mono text-muted-foreground font-semibold">{{ engine.currentSfoc }} g/kWh</span>
        </div>
        <div class="h-2 w-full rounded-full bg-muted overflow-hidden relative">
          <!-- Expected Marker -->
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="engine.sfocDelta > 8 ? 'bg-amber-500' : 'bg-primary'"
            :style="{ width: `${Math.min(100, Math.max(10, ((engine.currentSfoc - 150) / 100) * 100))}%` }"
          />
        </div>
        <div class="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
          <span>150 (Ideal)</span>
          <span class="text-foreground font-medium">Target: {{ engine.expectedSfoc }}</span>
          <span>250 (Degraded)</span>
        </div>
      </div>

      <!-- Mechanical Health Note -->
      <div class="p-2.5 rounded-lg border border-border/40 bg-muted/15 flex items-center justify-between text-xs">
        <span class="text-muted-foreground text-[11px]">Main Engine & Scavenge Status:</span>
        <span class="font-mono text-xs font-medium text-foreground">
          {{ engine.sfocDelta <= 5 ? 'Combustion Balanced' : 'Check Scavenge & Air Coolers' }}
        </span>
      </div>
    </CardContent>
  </Card>
</template>
