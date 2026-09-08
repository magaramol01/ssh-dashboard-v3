<script setup lang="ts">
import {
  CloudRain,
  Wind,
  ShieldCheck,
  ArrowDownRight,
  Info,
  Calendar,
} from 'lucide-vue-next'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { WeatherImpactData } from '../../../../server/utils/marine/performance-widgets'

defineProps<{
  weather: WeatherImpactData
}>()
</script>

<template>
  <Card class="shadow-xs border-border/70 flex flex-col justify-between bg-card">
    <CardHeader class="pb-3 border-b border-border/40">
      <div class="flex items-center justify-between">
        <div>
          <CardTitle class="text-base font-semibold flex items-center gap-2">
            <CloudRain class="size-4 text-primary" />
            Weather Headwinds & Regulatory Exclusion
          </CardTitle>
          <CardDescription class="text-xs">
            Environmental sea-state exposure and IMO MEPC.355(78) CII correction deductions
          </CardDescription>
        </div>
        <Badge
          variant="outline"
          :class="weather.imoExclusionEligible ? 'border-emerald-500/40 text-emerald-500 bg-emerald-500/5' : 'border-border text-muted-foreground'"
          class="text-[10px] font-mono"
        >
          <ShieldCheck v-if="weather.imoExclusionEligible" class="size-3 mr-1 text-emerald-500" />
          {{ weather.imoExclusionEligible ? 'MEPC.355(78) Eligible' : 'Standard Baseline' }}
        </Badge>
      </div>
    </CardHeader>

    <CardContent class="p-5 space-y-4 flex-1 flex flex-col justify-between">
      <!-- Top Metrics Grid -->
      <div class="grid grid-cols-2 gap-3">
        <!-- Adverse Weather Exposure -->
        <div class="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-1">
          <div class="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Adverse Weather</span>
            <Wind class="size-3.5 text-primary" />
          </div>
          <div class="text-2xl font-bold tabular-nums text-foreground">
            {{ weather.badWeatherPct }}%
          </div>
          <p class="text-[10px] text-muted-foreground">
            ~{{ weather.averageBadWeatherDays }} Days in BF ≥ 6
          </p>
        </div>

        <!-- Weather Speed Loss -->
        <div class="p-3 rounded-xl border border-border/60 bg-muted/20 space-y-1">
          <div class="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Speed Deficit</span>
            <ArrowDownRight class="size-3.5 text-amber-500" />
          </div>
          <div class="text-2xl font-bold tabular-nums text-amber-500">
            -{{ weather.speedLossKnots }} <span class="text-xs font-normal text-muted-foreground">kts</span>
          </div>
          <p class="text-[10px] text-muted-foreground">
            Hull resistance from swell
          </p>
        </div>
      </div>

      <!-- Adverse Exposure Bar -->
      <div class="space-y-1.5 p-3 rounded-xl border border-border/50 bg-muted/10 text-xs">
        <div class="flex items-center justify-between text-[11px]">
          <span class="font-medium text-foreground">Environmental Sea-State Impact</span>
          <span class="font-mono text-muted-foreground">{{ weather.badWeatherPct }}% exposure</span>
        </div>
        <div class="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="weather.badWeatherPct >= 20 ? 'bg-amber-500' : 'bg-primary'"
            :style="{ width: `${Math.min(100, weather.badWeatherPct * 2)}%` }"
          />
        </div>
        <div class="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
          <span>Beaufort 0-4 (Calm)</span>
          <span class="font-semibold text-foreground">Excess CO₂: +{{ weather.excessCo2Mt }} MT</span>
          <span>Beaufort 6+ (Rough)</span>
        </div>
      </div>

      <!-- Regulatory Context Banner -->
      <div class="p-2.5 rounded-lg border border-border/40 bg-muted/15 flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed">
        <Info class="size-3.5 text-primary shrink-0 mt-0.5" />
        <span>
          Under <strong>IMO MEPC.355(78)</strong>, fuel consumed while traversing severe weather corridors is eligible for formal exclusion reporting, preventing unwarranted CII score degradation.
        </span>
      </div>
    </CardContent>
  </Card>
</template>
