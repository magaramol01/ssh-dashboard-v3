<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  X,
  Calendar,
  Gauge,
  Fuel,
  Wind,
  Navigation,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sliders,
  Sparkles,
  Layers,
  Zap,
  ShieldAlert,
  Leaf,
  Compass,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useVoyageOptimization } from '~/composables/useVoyageOptimization'
import type { DailyNoonReport } from '~/lib/voyage-optimization'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const {
  selectedDay,
  dailyNoons,
  routeStrategies,
  activeStrategy,
  advisories,
  currentVoyage,
  isCiiLoading,
  ciiLoadError,
  setStrategy,
  applyAdvisory,
  selectDay,
} = useVoyageOptimization()

const activeTab = ref<'noon' | 'strategies'>('noon')

// If a day is selected from the map, switch to the noon log tab automatically
watch(selectedDay, (day) => {
  if (day) {
    activeTab.value = 'noon'
  }
})

// Current day to display (selected day or latest day)
const currentNoon = computed<DailyNoonReport | null>(() => {
  if (selectedDay.value) return selectedDay.value
  return dailyNoons.value[dailyNoons.value.length - 1] || null
})

function ciiRatingBadge(rating: string): { bg: string; text: string } {
  switch (rating) {
    case 'A': return { bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400', text: 'IMO Band A (Superior)' }
    case 'B': return { bg: 'bg-teal-500/15 border-teal-500/30 text-teal-600 dark:text-teal-400', text: 'IMO Band B (Compliant)' }
    case 'C': return { bg: 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400', text: 'IMO Band C (Standard)' }
    case 'D': return { bg: 'bg-orange-500/15 border-orange-500/30 text-orange-600 dark:text-orange-400', text: 'IMO Band D (Corrective Action)' }
    case 'E': return { bg: 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400', text: 'IMO Band E (Non-Compliant)' }
    default: return { bg: 'bg-muted border-border text-muted-foreground', text: 'Band C' }
  }
}
</script>

<template>
  <aside
    v-show="isOpen"
    class="w-full lg:w-[420px] shrink-0 border-l border-border bg-background/95 backdrop-blur-md shadow-xl flex flex-col h-full overflow-hidden transition-all duration-300 z-30"
  >
    <!-- Drawer Header -->
    <div class="h-14 px-4 border-b border-border flex items-center justify-between shrink-0 bg-muted/40">
      <div class="flex items-center gap-2">
        <div class="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
          <Sliders class="w-4 h-4" />
        </div>
        <div>
          <div class="flex items-center gap-1.5">
            <h3 class="text-sm font-semibold text-foreground leading-tight">Voyage Inspection</h3>
            <Badge v-if="currentVoyage" variant="outline" class="text-[10px] font-mono px-1.5 py-0">
              Voy. {{ currentVoyage }}
            </Badge>
          </div>
          <p class="text-[11px] text-muted-foreground">Daily telemetry & route optimization</p>
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        class="h-8 w-8 text-muted-foreground hover:text-foreground"
        @click="emit('close')"
      >
        <X class="w-4 h-4" />
      </Button>
    </div>

    <!-- Navigation Tabs -->
    <div class="px-4 pt-3 pb-2 border-b border-border/70 shrink-0">
      <Tabs v-model="activeTab" class="w-full">
        <TabsList class="grid grid-cols-2 w-full h-9">
          <TabsTrigger value="noon" class="text-xs">
            Daily Noon Log
            <span v-if="currentNoon" class="ml-1 px-1.5 py-0.2 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
              D{{ currentNoon.dayNumber }}
            </span>
          </TabsTrigger>
          <TabsTrigger value="strategies" class="text-xs">
            Route Advisories
            <span class="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
              {{ advisories.length }}
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>

    <!-- Scrollable Drawer Body -->
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      <!-- TAB 1: DAILY NOON REPORT LOG -->
      <div v-if="activeTab === 'noon'" class="space-y-4">
        <!-- Day Selector Pill Strip -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <span class="font-medium">Voyage Progress Days:</span>
            <span>Click to inspect</span>
          </div>
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              v-for="d in dailyNoons"
              :key="d.dayNumber"
              type="button"
              class="px-2 py-1 rounded-md text-xs font-mono font-semibold transition-all shrink-0 border"
              :class="currentNoon?.dayNumber === d.dayNumber ? 'bg-primary text-primary-foreground border-primary shadow-xs' : 'bg-muted/70 text-foreground border-border hover:bg-muted'"
              @click="selectDay(d)"
            >
              D{{ d.dayNumber }}
            </button>
          </div>
        </div>

        <template v-if="currentNoon">
          <!-- Active Noon Card -->
          <Card class="bg-card border-border/80 shadow-xs">
            <CardHeader class="p-3 pb-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar class="w-3.5 h-3.5" />
                  <span>{{ currentNoon.dateFormatted }}</span>
                </div>
                <Badge variant="outline" class="font-mono text-[10px]">
                  {{ currentNoon.coords[0].toFixed(2) }}°, {{ currentNoon.coords[1].toFixed(2) }}°
                </Badge>
              </div>

              <!-- IMO CII Attained Badge Banner -->
              <div class="mt-3 p-2.5 rounded-lg border flex items-center justify-between" :class="ciiRatingBadge(currentNoon.rating).bg">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-md bg-background/80 flex items-center justify-center font-bold text-sm shadow-xs">
                    {{ currentNoon.rating }}
                  </div>
                  <div>
                    <div class="text-xs font-semibold">{{ ciiRatingBadge(currentNoon.rating).text }}</div>
                    <div class="text-[10px] opacity-80">Attained CII: {{ currentNoon.attainedCii }} g/MT·NM</div>
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-[10px] font-medium opacity-80">Total Work</div>
                  <div class="text-xs font-mono font-bold">{{ (currentNoon.transportWork / 1e6).toFixed(1) }}M MT·NM</div>
                </div>
              </div>
            </CardHeader>

            <CardContent class="p-3 pt-1 space-y-3">
              <!-- 24h Distance & Speed -->
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="p-2 rounded bg-muted/40 border border-border/60">
                  <span class="text-muted-foreground text-[10px] block">24h Run Distance</span>
                  <span class="font-bold text-foreground font-mono text-sm">{{ currentNoon.distanceRunNm }} NM</span>
                  <span class="text-[10px] text-muted-foreground block">Cumul: {{ currentNoon.cumulativeDistanceNm }} NM</span>
                </div>
                <div class="p-2 rounded bg-muted/40 border border-border/60">
                  <span class="text-muted-foreground text-[10px] block">Average 24h SOG</span>
                  <span class="font-bold text-foreground font-mono text-sm">{{ currentNoon.sog }} kts</span>
                  <span class="text-[10px] text-muted-foreground block">Draft: {{ currentNoon.draftFwdM }}m / {{ currentNoon.draftAftM }}m</span>
                </div>
              </div>

              <!-- Fuel Consumption Breakdown (real per-fuel-type data from the CII API) -->
              <div class="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-2">
                <div class="flex items-center justify-between text-xs font-semibold">
                  <span class="flex items-center gap-1.5 text-foreground">
                    <Fuel class="w-3.5 h-3.5 text-amber-500" />
                    24h Fuel Consumed
                  </span>
                  <span class="font-mono text-primary font-bold">{{ currentNoon.fuelConsumedMt.total }} MT</span>
                </div>
                <div class="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1 border-t border-border/60">
                  <div v-for="(fuel, key) in currentNoon.fuelConsumedMt.byType" :key="key">
                    {{ fuel.label }}: <strong class="text-foreground font-mono">{{ fuel.value }} MT</strong>
                  </div>
                  <div>24h CO₂: <strong class="text-foreground font-mono">{{ currentNoon.totalCo2Mt }} MT</strong></div>
                  <div>Voyage Total: <strong class="text-foreground font-mono">{{ currentNoon.cumulativeFuelMt }} MT</strong></div>
                </div>
              </div>

              <!-- Recorded Weather at Position -->
              <div class="p-3 rounded-lg bg-muted/30 border border-border/60 space-y-2">
                <div class="flex items-center justify-between text-xs font-semibold">
                  <span class="flex items-center gap-1.5 text-foreground">
                    <Wind class="w-3.5 h-3.5 text-cyan-500" />
                    Noon Position Weather
                  </span>
                  <Badge variant="outline" class="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold border-cyan-500/30">
                    Beaufort {{ currentNoon.weather.beaufort }}
                  </Badge>
                </div>
                <div class="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1 border-t border-border/60">
                  <div>Wind: <strong class="text-foreground">{{ currentNoon.weather.windSpeedKts }} kts ({{ currentNoon.weather.windDirectionDeg }}°)</strong></div>
                  <div>Seas: <strong class="text-foreground">{{ currentNoon.weather.waveHeightM }}m wave</strong></div>
                  <div class="col-span-2">Swell: <strong class="text-foreground">{{ currentNoon.weather.swellDirection }} · {{ currentNoon.weather.shortForecast }}</strong></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </template>
        <div
          v-else-if="!isCiiLoading"
          class="p-4 rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground"
        >
          {{ ciiLoadError ? 'Live CII data unavailable — upstream request failed.' : 'No noon report data for this vessel in the selected window.' }}
        </div>
        <div v-else class="p-4 text-center text-xs text-muted-foreground">
          Loading live noon report data…
        </div>
      </div>

      <!-- TAB 2: ROUTE STRATEGIES & ADVISORIES -->
      <div v-else class="space-y-4">
        <!-- Route Alternatives Comparison -->
        <div class="space-y-2">
          <div class="text-xs font-semibold text-foreground flex items-center justify-between">
            <span class="flex items-center gap-1.5">
              <Layers class="w-3.5 h-3.5 text-primary" />
              Route Strategies Comparison
            </span>
            <span class="text-[10px] text-muted-foreground">Select to simulate</span>
          </div>
          <div class="text-[10px] text-muted-foreground">
            "Current" reflects live voyage data; alternates are modeled estimates.
          </div>

          <div class="space-y-2">
            <div
              v-for="strat in routeStrategies"
              :key="strat.id"
              class="p-3 rounded-lg border transition-all cursor-pointer"
              :class="activeStrategy === strat.id ? 'bg-primary/5 border-primary shadow-xs ring-1 ring-primary/30' : 'bg-card border-border hover:border-border/80'"
              @click="setStrategy(strat.id)"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: strat.colorHex }"></span>
                  <span class="text-xs font-bold text-foreground">{{ strat.name }}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span v-if="strat.basis === 'modeled-estimate'" class="text-[9px] uppercase font-bold text-muted-foreground/70">Est.</span>
                  <Badge
                    variant="outline"
                    class="font-mono text-[10px] font-bold"
                    :class="strat.fuelSavingsMt > 0 ? 'text-emerald-600 border-emerald-500/40 bg-emerald-500/10' : 'text-muted-foreground'"
                  >
                    {{ strat.fuelSavingsMt > 0 ? `-${strat.fuelSavingsMt} MT Fuel` : `${strat.totalFuelMt} MT` }}
                  </Badge>
                </div>
              </div>

              <p class="text-[11px] text-muted-foreground mt-1">{{ strat.description }}</p>

              <div class="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-border/50 text-[10px]">
                <div>
                  <span class="text-muted-foreground block">Speed / Dist</span>
                  <span class="font-semibold text-foreground font-mono">{{ strat.avgSpeedKts }} kts · {{ strat.distanceNm }} NM</span>
                </div>
                <div>
                  <span class="text-muted-foreground block">Projected CII</span>
                  <span class="font-bold text-foreground font-mono">Band {{ strat.projectedRating }} ({{ strat.projectedCii }})</span>
                </div>
                <div>
                  <span class="text-muted-foreground block">Arrival</span>
                  <span class="font-semibold text-foreground truncate block">{{ strat.etaFormatted.slice(5, 16) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Actionable Dispatch Advisories -->
        <div class="space-y-2 pt-2 border-t border-border">
          <div class="text-xs font-semibold text-foreground flex items-center justify-between">
            <span class="flex items-center gap-1.5">
              <Sparkles class="w-3.5 h-3.5 text-amber-500" />
              Actionable Dispatch Advisories
            </span>
          </div>

          <div class="space-y-2">
            <div
              v-for="adv in advisories"
              :key="adv.id"
              class="p-3 rounded-lg border bg-card space-y-2 text-xs"
              :class="adv.applied ? 'opacity-70 border-emerald-500/30' : 'border-border'"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="font-semibold text-foreground leading-tight">
                  {{ adv.title }}
                </div>
                <Badge
                  variant="outline"
                  class="text-[9px] uppercase font-bold shrink-0"
                  :class="adv.priority === 'critical' ? 'text-rose-600 border-rose-500/30' : adv.priority === 'warning' ? 'text-amber-600 border-amber-500/30' : 'text-blue-600 border-blue-500/30'"
                >
                  {{ adv.priority }}
                </Badge>
              </div>

              <p class="text-[11px] text-muted-foreground leading-relaxed">
                {{ adv.description }}
              </p>

              <div v-if="adv.actionLabel" class="pt-1 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  class="h-7 text-[11px] gap-1.5"
                  :disabled="adv.applied"
                  @click="applyAdvisory(adv.id)"
                >
                  <CheckCircle2 v-if="adv.applied" class="w-3 h-3 text-emerald-500" />
                  <span>{{ adv.applied ? 'Applied to Plan' : adv.actionLabel }}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>
