<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  ArrowDownRight,
  TrendingDown,
  Anchor,
  Gauge,
  Flame,
  Package,
  RefreshCw,
  Copy,
  Check,
  Calendar,
  Layers,
} from 'lucide-vue-next'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { CiiImprovementPlan } from '../../../server/utils/marine/cii-improvement'

const props = defineProps<{
  improvementPlan: CiiImprovementPlan
  speedScenarios: Array<{
    reductionPercent: number
    speedKnots?: number
    projectedCii: number
    projectedRating: string
    co2SavingsMt: number
    multiplier?: number
  }>
  activeScenarioIndex: number
  vesselName: string
  isAuditing?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:activeScenarioIndex', index: number): void
  (e: 'reAudit'): void
}>()

const copied = ref(false)

const activeScenario = computed(() => {
  const scenarios = props.speedScenarios || []
  return (
    scenarios[props.activeScenarioIndex] ||
    scenarios[0] || {
      reductionPercent: 10,
      speedKnots: 12.6,
      projectedCii: 5.2,
      projectedRating: 'C',
      co2SavingsMt: 320,
      multiplier: 0.729,
    }
  )
})

function formatNumber(num: number | undefined | null, decimals = 1): string {
  if (num === null || num === undefined || isNaN(num)) return '—'
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function getRatingBadge(rating: string) {
  switch (rating) {
    case 'A':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
    case 'B':
      return 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30'
    case 'C':
      return 'bg-lime-500/10 text-lime-600 dark:text-lime-400 border-lime-500/30'
    case 'D':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
    case 'E':
      return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

function getDriverIcon(key: string) {
  switch (key) {
    case 'speed':
      return Gauge
    case 'hull':
      return Anchor
    case 'auxiliary':
      return Flame
    case 'payload':
      return Package
    default:
      return Layers
  }
}

function copyPlanToClipboard() {
  const plan = props.improvementPlan
  if (!plan) return
  const text = [
    `CII IMPROVEMENT PLAN FOR ${props.vesselName.toUpperCase()}`,
    `Status: ${plan.hasDegraded ? 'DEGRADATION ACTIVE' : 'COMPLIANT'}`,
    `Onset: ${plan.onset.month} (${plan.onset.voyageNumber}) | Surge: +${plan.onset.ciiIncrease} gCO2/tnm`,
    `Recommended Eco-Speed Trim: -${activeScenario.value.reductionPercent}% (Projected Grade ${activeScenario.value.projectedRating})`,
    `Avoided CO2: ${formatNumber(activeScenario.value.co2SavingsMt, 1)} MT`,
    '\nCorrective Actions:',
    ...plan.actionItems.map((a, i) => `${i + 1}. [${a.phase}] ${a.title} - ${a.impact}`),
    `\nTarget Recovery: Grade ${plan.recoveryTarget.targetRating} within ${plan.recoveryTarget.projectedDays} days`,
  ].join('\n')

  navigator.clipboard?.writeText(text)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2500)
}
</script>

<template>
  <Card class="shadow-xs border-border/70 overflow-hidden bg-card">
    <!-- Card Header -->
    <CardHeader class="pb-3 border-b border-border/40 bg-muted/10">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <CardTitle class="text-base font-semibold flex items-center gap-2">
              <Sparkles class="size-4 text-primary" />
              CII Improvement Plan & Root-Cause Diagnosis
            </CardTitle>
            <Badge
              variant="outline"
              :class="improvementPlan.hasDegraded ? 'border-amber-500/40 text-amber-500 bg-amber-500/5' : 'border-emerald-500/40 text-emerald-500 bg-emerald-500/5'"
              class="text-[10px] font-medium"
            >
              {{ improvementPlan.hasDegraded ? 'Degradation Detected' : 'Compliant Buffer' }}
            </Badge>
          </div>
          <CardDescription class="text-xs mt-0.5">
            Automated degradation timeline, multi-factor attribution, and prescriptive speed reduction recovery roadmap
          </CardDescription>
        </div>

        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            class="h-7 text-xs gap-1.5 px-2.5 cursor-pointer font-medium border-border hover:bg-muted/40"
            :disabled="isAuditing"
            @click="emit('reAudit')"
          >
            <RefreshCw :class="['size-3', isAuditing ? 'animate-spin text-primary' : 'text-muted-foreground']" />
            <span>{{ isAuditing ? 'Auditing...' : 'Re-run AI Audit' }}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            class="h-7 text-xs gap-1.5 px-2.5 cursor-pointer font-medium text-muted-foreground hover:text-foreground"
            @click="copyPlanToClipboard"
          >
            <component :is="copied ? Check : Copy" :class="['size-3', copied ? 'text-emerald-500' : '']" />
            <span>{{ copied ? 'Copied' : 'Copy Plan' }}</span>
          </Button>
        </div>
      </div>
    </CardHeader>

    <!-- 3-Pillar Body -->
    <CardContent class="p-5">
      <div class="grid gap-6 lg:grid-cols-12 items-stretch">
        <!-- Pillar 1: Degradation Intelligence & Onset Timeline (4 Cols) -->
        <div class="lg:col-span-4 rounded-xl border border-border/60 bg-muted/15 p-4 flex flex-col justify-between gap-4">
          <div class="space-y-3.5">
            <!-- Onset Header Callout -->
            <div
              :class="[
                'p-3 rounded-lg border text-xs space-y-1',
                improvementPlan.hasDegraded
                  ? 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300'
                  : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'
              ]"
            >
              <div class="flex items-center gap-2 font-semibold text-[11px] uppercase tracking-wider">
                <component :is="improvementPlan.hasDegraded ? AlertTriangle : CheckCircle2" class="size-4 shrink-0" />
                <span>{{ improvementPlan.hasDegraded ? 'Onset Timeline Identified' : 'Performance Stable' }}</span>
              </div>
              <div v-if="improvementPlan.hasDegraded" class="text-xs leading-relaxed text-foreground font-medium pt-0.5">
                Degradation initiated in <strong class="text-primary">{{ improvementPlan.onset.month }}</strong> during Voyage <strong class="text-foreground font-mono">{{ improvementPlan.onset.voyageNumber }}</strong>.
              </div>
              <div v-else class="text-xs leading-relaxed text-foreground font-medium pt-0.5">
                Vessel operating within regulatory CII boundaries without rating drop.
              </div>
              <div v-if="improvementPlan.hasDegraded" class="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground font-mono">
                <span>Shift: Grade {{ improvementPlan.onset.initialRating }} → {{ improvementPlan.onset.currentRating }}</span>
                <span>•</span>
                <span class="text-amber-500 font-semibold">+{{ improvementPlan.onset.ciiIncrease }} gCO₂/tnm</span>
              </div>
            </div>

            <!-- Root-Cause Drivers Breakdown -->
            <div class="space-y-2 pt-1">
              <div class="flex items-center justify-between text-xs">
                <span class="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Primary Degradation Drivers</span>
                <span class="text-[10px] text-muted-foreground font-mono">Attribution</span>
              </div>

              <div class="space-y-2">
                <div
                  v-for="driver in improvementPlan.drivers"
                  :key="driver.key"
                  class="p-2 rounded-lg bg-card border border-border/50 text-xs space-y-1.5"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1.5 font-medium text-foreground">
                      <component :is="getDriverIcon(driver.key)" class="size-3 text-primary" />
                      <span class="text-xs">{{ driver.label }}</span>
                    </div>
                    <span class="font-bold text-xs tabular-nums text-foreground">{{ driver.percentage }}%</span>
                  </div>

                  <!-- Mini Progress Bar -->
                  <div class="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-500"
                      :class="[
                        driver.percentage >= 35 ? 'bg-amber-500' : driver.percentage >= 25 ? 'bg-primary' : 'bg-muted-foreground/50'
                      ]"
                      :style="{ width: `${driver.percentage}%` }"
                    />
                  </div>
                  <p class="text-[10px] text-muted-foreground leading-tight">
                    {{ driver.description }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Executive Summary Footnote -->
          <p class="text-[11px] text-muted-foreground leading-relaxed italic border-t border-border/40 pt-2.5">
            {{ improvementPlan.summary }}
          </p>
        </div>

        <!-- Pillar 2: Interactive Speed Reduction Advisory (4 Cols) -->
        <div class="lg:col-span-4 rounded-xl border border-border/60 bg-muted/15 p-4 flex flex-col justify-between gap-4">
          <div class="space-y-3.5">
            <div class="flex items-center justify-between border-b border-border/40 pb-2">
              <div class="flex items-center gap-1.5 font-semibold text-xs text-foreground uppercase tracking-wider">
                <Sliders class="size-3.5 text-primary" />
                <span>Speed Reduction Trim Advisory</span>
              </div>
              <Badge variant="outline" class="text-[10px] text-primary border-primary/40 font-medium">
                Eco-Steaming
              </Badge>
            </div>

            <!-- Scenario Pills -->
            <div class="space-y-1.5">
              <span class="text-[11px] font-medium text-muted-foreground">Select Eco-Speed Trim:</span>
              <div class="grid grid-cols-5 gap-1.5">
                <button
                  v-for="(scenario, idx) in speedScenarios"
                  :key="scenario.reductionPercent"
                  type="button"
                  :class="[
                    'flex flex-col items-center py-2 px-1 rounded-md border text-center transition-all cursor-pointer text-xs',
                    activeScenarioIndex === idx
                      ? 'bg-primary/10 border-primary font-semibold text-primary shadow-xs'
                      : 'border-border/70 bg-card hover:bg-muted/50 text-muted-foreground'
                  ]"
                  @click="emit('update:activeScenarioIndex', idx)"
                >
                  <span class="text-xs font-bold">-{{ scenario.reductionPercent }}%</span>
                  <span class="text-[9px] opacity-75">kts</span>
                </button>
              </div>
            </div>

            <!-- Projected Outcomes Card -->
            <div class="rounded-xl border border-border/60 bg-card p-3.5 space-y-3 shadow-xs">
              <div class="flex items-center justify-between border-b border-border/40 pb-2.5">
                <div>
                  <span class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Projected Turnaround</span>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-xl font-black tabular-nums text-foreground">
                      Grade {{ activeScenario.projectedRating }}
                    </span>
                    <Badge :class="getRatingBadge(activeScenario.projectedRating)" class="text-[10px] px-1.5 py-0 font-bold">
                      Target
                    </Badge>
                  </div>
                </div>

                <div class="text-right">
                  <span class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Projected CII</span>
                  <div class="text-xl font-bold tabular-nums text-foreground mt-0.5">
                    {{ activeScenario.projectedCii.toFixed(2) }}
                  </div>
                </div>
              </div>

              <!-- Savings Estimates -->
              <div class="grid grid-cols-2 gap-3 pt-0.5">
                <div class="space-y-0.5">
                  <span class="text-[10px] text-muted-foreground">Avoided CO₂</span>
                  <div class="text-sm font-bold text-emerald-500 tabular-nums flex items-center gap-1">
                    <ArrowDownRight class="size-3.5 shrink-0" />
                    {{ formatNumber(activeScenario.co2SavingsMt, 1) }} MT
                  </div>
                </div>
                <div class="space-y-0.5">
                  <span class="text-[10px] text-muted-foreground">Power Factor</span>
                  <div class="text-sm font-bold text-foreground tabular-nums">
                    {{ ((activeScenario.multiplier ?? 0.729) * 100).toFixed(1) }}% load
                  </div>
                </div>
              </div>
            </div>

            <p class="text-[11px] text-muted-foreground leading-relaxed">
              Trimming charter speed by <strong>{{ activeScenario.reductionPercent }}%</strong> leverages cubic resistance law to curb hydrodynamic friction, avoiding <strong>{{ formatNumber(activeScenario.co2SavingsMt, 1) }} MT of CO₂</strong>.
            </p>
          </div>

          <div class="p-2.5 rounded-lg bg-card border border-border/50 flex items-center justify-between text-xs">
            <span class="text-muted-foreground">Speed Trim Setting:</span>
            <span class="font-mono font-semibold text-primary">-{{ activeScenario.reductionPercent }}% ({{ activeScenario.speedKnots ?? '12.6' }} kts)</span>
          </div>
        </div>

        <!-- Pillar 3: Corrective Action Roadmap (4 Cols) -->
        <div class="lg:col-span-4 rounded-xl border border-border/60 bg-muted/15 p-4 flex flex-col justify-between gap-4">
          <div class="space-y-3.5">
            <div class="flex items-center justify-between border-b border-border/40 pb-2">
              <div class="flex items-center gap-1.5 font-semibold text-xs text-foreground uppercase tracking-wider">
                <CheckCircle2 class="size-3.5 text-primary" />
                <span>Corrective Action Roadmap</span>
              </div>
              <Badge variant="outline" class="text-[10px] font-mono text-muted-foreground">
                3-Phase Plan
              </Badge>
            </div>

            <!-- Recovery Target Banner -->
            <div class="p-3 rounded-lg border border-primary/30 bg-primary/5 flex items-center justify-between">
              <div class="space-y-0.5">
                <span class="text-[10px] uppercase tracking-wider font-semibold text-primary">Compliance Target</span>
                <div class="text-xs font-bold text-foreground">
                  Restore Grade {{ improvementPlan.recoveryTarget.targetRating }} (≤ {{ improvementPlan.recoveryTarget.targetCii.toFixed(2) }})
                </div>
              </div>
              <div class="text-right">
                <span class="text-[10px] text-muted-foreground font-mono">Turnaround</span>
                <div class="text-xs font-semibold text-primary flex items-center gap-1">
                  <Calendar class="size-3" />
                  <span>~{{ improvementPlan.recoveryTarget.projectedDays }} Days</span>
                </div>
              </div>
            </div>

            <!-- Action Items List -->
            <div class="space-y-2">
              <div
                v-for="(item, idx) in improvementPlan.actionItems"
                :key="idx"
                class="p-2.5 rounded-lg bg-card border border-border/50 text-xs space-y-1"
              >
                <div class="flex items-center justify-between">
                  <span
                    :class="[
                      'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
                      item.phase === 'Immediate' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                      item.phase === 'Short-Term' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                      'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    ]"
                  >
                    {{ item.phase }}
                  </span>
                  <span class="text-[10px] font-medium text-muted-foreground font-mono">{{ item.impact }}</span>
                </div>
                <div class="font-semibold text-foreground text-xs pt-0.5">
                  {{ item.title }}
                </div>
                <p class="text-[10px] text-muted-foreground leading-normal">
                  {{ item.description }}
                </p>
              </div>
            </div>
          </div>

          <div class="pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
            <span>Verified against IMO G2 guidelines</span>
            <span>Deterministic Model</span>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
