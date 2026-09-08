<script setup lang="ts">
import {
  CloudRain,
  Wind,
  ShieldCheck,
  ArrowDownRight,
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
            Sea-State & Weather Headwinds
          </CardTitle>
          <CardDescription class="text-xs">
            Beaufort sea-state exposure & speed penalty
          </CardDescription>
        </div>
        <Badge
          variant="outline"
          :class="weather.imoExclusionEligible ? 'border-emerald-500/40 text-emerald-500 bg-emerald-500/5' : 'border-border text-muted-foreground'"
          class="text-[10px] font-mono"
        >
          <ShieldCheck v-if="weather.imoExclusionEligible" class="size-3 mr-1 text-emerald-500" />
          {{ weather.imoExclusionEligible ? 'MEPC.355 Eligible' : 'Standard Baseline' }}
        </Badge>
      </div>
    </CardHeader>

    <CardContent class="p-5 space-y-4 flex-1 flex flex-col justify-between">
      <!-- Top Metrics Grid -->
      <div class="grid grid-cols-2 gap-3">
        <!-- Adverse Weather Exposure -->
        <div class="p-3 rounded-xl border border-border/60 bg-muted/20 flex flex-col justify-between gap-1">
          <div class="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Adverse Weather</span>
            <Wind class="size-3.5 text-primary" />
          </div>
          <div class="flex items-baseline justify-between">
            <span class="text-2xl font-bold tabular-nums text-foreground">
              {{ Number(weather.badWeatherPct).toFixed(1) }}%
            </span>
            <span class="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
              ~{{ Number(weather.averageBadWeatherDays).toFixed(1) }}d BF≥6
            </span>
          </div>
        </div>

        <!-- Weather Speed Loss -->
        <div class="p-3 rounded-xl border border-border/60 bg-muted/20 flex flex-col justify-between gap-1">
          <div class="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Speed Deficit</span>
            <ArrowDownRight class="size-3.5 text-amber-500" />
          </div>
          <div class="flex items-baseline justify-between">
            <span class="text-2xl font-bold tabular-nums text-amber-500">
              -{{ Number(weather.speedLossKnots).toFixed(1) }} <span class="text-xs font-normal text-muted-foreground">kts</span>
            </span>
            <span class="text-[10px] font-mono text-amber-500/80 bg-amber-500/10 px-1.5 py-0.5 rounded">
              Swell Drag
            </span>
          </div>
        </div>
      </div>

      <!-- Visual Sea-State Spectrum -->
      <div class="p-3 rounded-xl border border-border/50 bg-muted/10 space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="text-[11px] font-medium text-foreground">Sea-State Impact</span>
          <span class="font-mono text-[11px] text-amber-500 font-semibold">+{{ Number(weather.excessCo2Mt).toFixed(1) }} MT CO₂</span>
        </div>
        <!-- 3-Segment Visual Beaufort Spectrum -->
        <div class="grid grid-cols-3 gap-1.5 text-[10px] text-center font-mono">
          <div
            :class="[
              'py-1.5 px-2 rounded-md border flex flex-col items-center gap-0.5 transition-all',
              weather.badWeatherPct < 15
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-500 font-bold'
                : 'bg-muted/30 border-border/40 text-muted-foreground opacity-60'
            ]"
          >
            <span>Calm</span>
            <span class="text-[9px]">BF 0–4</span>
          </div>
          <div
            :class="[
              'py-1.5 px-2 rounded-md border flex flex-col items-center gap-0.5 transition-all',
              weather.badWeatherPct >= 15 && weather.badWeatherPct < 25
                ? 'bg-blue-500/15 border-blue-500/40 text-blue-500 font-bold'
                : 'bg-muted/30 border-border/40 text-muted-foreground opacity-60'
            ]"
          >
            <span>Moderate</span>
            <span class="text-[9px]">BF 5</span>
          </div>
          <div
            :class="[
              'py-1.5 px-2 rounded-md border flex flex-col items-center gap-0.5 transition-all',
              weather.badWeatherPct >= 25
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-500 font-bold'
                : 'bg-muted/30 border-border/40 text-muted-foreground opacity-60'
            ]"
          >
            <span>Adverse</span>
            <span class="text-[9px]">BF 6+</span>
          </div>
        </div>
      </div>

      <!-- Regulatory Context Strip -->
      <div class="p-2.5 rounded-lg border border-border/40 bg-muted/15 flex items-center justify-between text-xs">
        <span class="text-muted-foreground text-[11px] flex items-center gap-1.5">
          <ShieldCheck class="size-3.5 text-emerald-500" /> MEPC.355(78) Exclusion
        </span>
        <Badge
          variant="secondary"
          :class="weather.imoExclusionEligible ? 'bg-emerald-500/15 text-emerald-500 font-semibold' : 'text-muted-foreground'"
          class="text-[10px] font-mono px-2 py-0.5"
        >
          {{ weather.imoExclusionEligible ? 'Deduction Active' : 'Not Required' }}
        </Badge>
      </div>
    </CardContent>
  </Card>
</template>
