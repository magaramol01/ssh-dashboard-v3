<script setup lang="ts">
import { ref } from 'vue'
import {
  Gauge,
  TrendingDown,
  Wind,
  Clock,
  Coins,
  ChevronUp,
  ChevronDown,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { useVoyageOptimization } from '~/composables/useVoyageOptimization'

const { kpiSummary, activeStrategy } = useVoyageOptimization()
const isCollapsed = ref(false)

function ciiRatingColor(rating: string): string {
  switch (rating) {
    case 'A': return 'bg-emerald-500 text-white'
    case 'B': return 'bg-teal-500 text-white'
    case 'C': return 'bg-amber-500 text-white'
    case 'D': return 'bg-orange-500 text-white'
    case 'E': return 'bg-rose-500 text-white'
    default: return 'bg-muted-foreground text-white'
  }
}
</script>

<template>
  <div class="pointer-events-none transition-all duration-300 w-full max-w-6xl mx-auto px-2 sm:px-4">
    <!-- Collapse/Expand Pill Tab -->
    <div class="flex justify-end pr-2 pointer-events-auto mb-1">
      <button
        type="button"
        class="flex items-center gap-1 text-[11px] font-medium bg-background/90 hover:bg-background text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-full border border-border shadow-xs backdrop-blur-md transition-all cursor-pointer"
        @click="isCollapsed = !isCollapsed"
      >
        <span>{{ isCollapsed ? 'Show Advisory HUD' : 'Hide HUD' }}</span>
        <component :is="isCollapsed ? ChevronDown : ChevronUp" class="w-3 h-3" />
      </button>
    </div>

    <!-- 5-Tile Floating Glass Grid -->
    <div
      v-show="!isCollapsed"
      class="pointer-events-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 bg-background/85 dark:bg-card/85 backdrop-blur-md p-2.5 sm:p-3 rounded-xl border border-border/80 shadow-md transition-all animate-in fade-in slide-in-from-top-2"
    >
      <!-- Tile 1: CII Trajectory -->
      <div class="flex flex-col justify-between p-2.5 rounded-lg bg-background/50 border border-border/60">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <Gauge class="w-3.5 h-3.5 text-primary" />
            CII Trajectory
          </span>
          <span
            class="text-[11px] font-bold px-1.5 py-0.5 rounded shadow-xs"
            :class="ciiRatingColor(kpiSummary.attainedRating)"
          >
            Band {{ kpiSummary.attainedRating }}
          </span>
        </div>
        <div class="mt-2 flex items-baseline justify-between">
          <span class="text-base sm:text-lg font-bold font-mono tracking-tight text-foreground">
            {{ kpiSummary.attainedCii }}
          </span>
          <span class="text-[10px] text-muted-foreground font-mono">
            Req. {{ kpiSummary.requiredCii }}
          </span>
        </div>
        <div class="mt-1 flex items-center gap-1 text-[10px]">
          <span :class="kpiSummary.ciiMarginPct >= 0 ? 'text-emerald-500 font-semibold' : 'text-amber-500 font-semibold'">
            {{ kpiSummary.ciiMarginPct >= 0 ? '+' : '' }}{{ kpiSummary.ciiMarginPct }}% margin
          </span>
          <span class="text-muted-foreground">vs IMO Band B</span>
        </div>
      </div>

      <!-- Tile 2: Speed Advisory -->
      <div class="flex flex-col justify-between p-2.5 rounded-lg bg-background/50 border border-border/60">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <TrendingDown class="w-3.5 h-3.5 text-emerald-500" />
            Speed Advisory
          </span>
          <span
            v-if="activeStrategy === 'lowest-fuel'"
            class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          >
            Optimized
          </span>
          <span
            v-else
            class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400"
          >
            Standard
          </span>
        </div>
        <div class="mt-2 flex items-baseline justify-between">
          <span class="text-base sm:text-lg font-bold font-mono tracking-tight text-foreground">
            {{ kpiSummary.recommendedSpeedKts }} kts
          </span>
          <span
            v-if="kpiSummary.dailyFuelSavingsMt > 0"
            class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold"
          >
            -{{ kpiSummary.dailyFuelSavingsMt }} MT/d
          </span>
          <span v-else class="text-[10px] text-muted-foreground font-semibold">
            Baseline
          </span>
        </div>
        <div class="mt-1 text-[10px] text-muted-foreground truncate">
          {{ activeStrategy === 'lowest-fuel' ? `Secures Band ${kpiSummary.targetRating}` : 'Current active speed profile' }}
        </div>
      </div>

      <!-- Tile 3: Weather Alert -->
      <div class="flex flex-col justify-between p-2.5 rounded-lg bg-background/50 border border-border/60">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <Wind class="w-3.5 h-3.5 text-cyan-500" />
            Weather Ahead
          </span>
          <span
            class="text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1"
            :class="kpiSummary.weatherRiskLevel === 'high' ? 'bg-rose-500/15 text-rose-600' : kpiSummary.weatherRiskLevel === 'moderate' ? 'bg-amber-500/15 text-amber-600' : 'bg-emerald-500/15 text-emerald-600'"
          >
            <component :is="kpiSummary.weatherRiskLevel === 'low' ? CheckCircle2 : AlertTriangle" class="w-2.5 h-2.5" />
            {{ kpiSummary.weatherRiskLevel.toUpperCase() }}
          </span>
        </div>
        <div class="mt-2 text-xs font-semibold text-foreground truncate">
          {{ kpiSummary.weatherAlertHeadline }}
        </div>
        <div class="mt-1 text-[10px] text-muted-foreground truncate">
          {{ kpiSummary.weatherAlertSubtext }}
        </div>
      </div>

      <!-- Tile 4: ETA & Charter Buffer -->
      <div class="flex flex-col justify-between p-2.5 rounded-lg bg-background/50 border border-border/60">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <Clock class="w-3.5 h-3.5 text-blue-500" />
            Charter Laycan
          </span>
          <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            Estimated
          </span>
        </div>
        <div class="mt-2 flex items-baseline justify-between">
          <span class="text-base sm:text-lg font-bold font-mono tracking-tight text-foreground">
            +{{ kpiSummary.laycanBufferHours }}h
          </span>
          <span class="text-[10px] text-muted-foreground">
            Window Buffer
          </span>
        </div>
        <div class="mt-1 text-[10px] text-muted-foreground truncate">
          Modeled — no live charter-party feed connected
        </div>
      </div>

      <!-- Tile 5: Emission & Financial Savings -->
      <div class="col-span-2 sm:col-span-1 flex flex-col justify-between p-2.5 rounded-lg bg-background/50 border border-border/60">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <Coins class="w-3.5 h-3.5 text-amber-500" />
            EU ETS / Carbon
          </span>
          <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            Estimated
          </span>
        </div>
        <div class="mt-2 flex items-baseline justify-between">
          <span class="text-base sm:text-lg font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
            €{{ kpiSummary.carbonSavingsEur.toLocaleString() }}
          </span>
          <span class="text-[10px] text-muted-foreground font-mono">
            {{ kpiSummary.projectedVoyageFuelMt }} MT
          </span>
        </div>
        <div class="mt-1 text-[10px] text-muted-foreground truncate">
          Modeled at €85/ton EU ETS — no live price feed connected
        </div>
      </div>
    </div>
  </div>
</template>
