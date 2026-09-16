<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Cpu,
  Zap,
  Search,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-vue-next'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DEFAULT_ME_PARAMETERS,
  DEFAULT_DG_GENERATORS,
  calculateRangePercentages,
  filterTelemetryParameters,
  calculateTelemetryHealth,
  calculateWindingVariance,
  type SubsystemCategory,
  type TelemetryParameter,
  type DGGenerator,
} from '~/lib/vessel-telemetry'

type DiagnosticsTab = 'me' | 'dg'
const currentTab = ref<DiagnosticsTab>('me')
const searchQuery = ref<string>('')
const selectedCategory = ref<SubsystemCategory>('All')

const meParameters = ref<TelemetryParameter[]>(DEFAULT_ME_PARAMETERS)
const dgGenerators = ref<DGGenerator[]>(DEFAULT_DG_GENERATORS)

const subsystemCategories: SubsystemCategory[] = [
  'All',
  'Air System',
  'Cooling & LO',
  'Fuel Oil',
  'Turbocharger',
  'Bearings',
]

const health = computed(() => calculateTelemetryHealth(meParameters.value))

function getCategoryCount(cat: SubsystemCategory): number {
  if (cat === 'All') return meParameters.value.length
  return meParameters.value.filter((p) => p.subsystem === cat).length
}

const filteredMeParams = computed(() => {
  return filterTelemetryParameters(
    meParameters.value,
    selectedCategory.value,
    searchQuery.value
  )
})

function clearFilters() {
  searchQuery.value = ''
  selectedCategory.value = 'All'
}

function getStatusBadgeClass(status: TelemetryParameter['status']) {
  switch (status) {
    case 'nominal':
      return 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
    case 'warning':
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
    case 'critical':
      return 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
    default:
      return 'bg-muted/40 text-muted-foreground border border-border/30'
  }
}
</script>

<template>
  <Card class="border border-border/40 bg-card shadow-xs">
    <!-- Card Header -->
    <CardHeader class="p-4 pb-2 space-y-2.5">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <!-- Eyebrow with Pulsing Live Telemetry Indicator Dot and Health Summary Tally Badge -->
          <div class="flex items-center gap-2 mb-1">
            <span class="relative flex size-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span class="relative inline-flex rounded-full size-2 bg-emerald-500" />
            </span>
            <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              SENSOR BUS TELEMETRY
            </span>
            <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border border-teal-500/30 bg-teal-500/10 text-teal-400">
              <span class="font-semibold">{{ health.nominalCount }} Nominal</span>
              <span class="text-teal-400/40">•</span>
              <span :class="health.warningCount > 0 ? 'text-amber-400 font-semibold' : 'text-teal-400/80'">
                {{ health.warningCount }} Warnings
              </span>
            </div>
          </div>

          <CardTitle class="text-sm font-semibold flex items-center gap-2">
            <Cpu class="size-4 text-primary" />
            <span>Machinery Diagnostics Matrix</span>
          </CardTitle>
          <CardDescription class="text-xs text-muted-foreground">
            Live sensor bus telemetry across Main Engine and Auxiliary Generators
          </CardDescription>
        </div>

        <!-- Primary Tab Switcher & Search Filter -->
        <div class="flex flex-wrap items-center gap-2">
          <div class="h-8 flex items-center bg-muted/50 p-1 rounded-lg border border-border/40">
            <button
              type="button"
              @click="currentTab = 'me'"
              :class="[
                'h-6 px-3 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 cursor-pointer',
                currentTab === 'me'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground',
              ]"
            >
              <Cpu class="size-3" />
              <span>Main Engine ({{ meParameters.length }})</span>
            </button>
            <button
              type="button"
              @click="currentTab = 'dg'"
              :class="[
                'h-6 px-3 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 cursor-pointer',
                currentTab === 'dg'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground',
              ]"
            >
              <Zap class="size-3" />
              <span>Aux Gens ({{ dgGenerators.length }})</span>
            </button>
          </div>

          <!-- Search Filter Input (with clear button) -->
          <div v-if="currentTab === 'me'" class="relative flex items-center">
            <Search class="size-3.5 absolute left-2.5 text-muted-foreground pointer-events-none" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Filter sensors..."
              class="h-8 w-36 sm:w-48 pl-8 pr-7 rounded-lg bg-muted/30 border border-border/40 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
            <button
              v-if="searchQuery"
              type="button"
              @click="searchQuery = ''"
              class="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
              title="Clear search"
            >
              <X class="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </CardHeader>

    <CardContent class="p-4 pt-2">
      <!-- Tab 1: Main Engine Parameters -->
      <div v-if="currentTab === 'me'">
        <!-- Horizontal Subsystem Category Filter Pills -->
        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 mb-3 text-xs scrollbar-none">
          <button
            v-for="cat in subsystemCategories"
            :key="cat"
            type="button"
            @click="selectedCategory = cat"
            :class="[
              'px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shrink-0',
              selectedCategory === cat
                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                : 'bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground border border-border/40',
            ]"
          >
            <span>{{ cat }}</span>
            <span
              class="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-normal"
              :class="
                selectedCategory === cat
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-muted/60 text-muted-foreground'
              "
            >
              {{ getCategoryCount(cat) }}
            </span>
          </button>
        </div>

        <!-- Responsive 2-Column Grid with Scrollable Container -->
        <div class="max-h-[320px] overflow-y-auto pr-1">
          <div
            v-if="filteredMeParams.length > 0"
            class="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            <div
              v-for="p in filteredMeParams"
              :key="p.id"
              class="rounded-lg bg-muted/20 hover:bg-muted/30 border border-border/40 p-3 flex flex-col justify-between transition-colors gap-2"
            >
              <!-- Sensor Header Row -->
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0">
                  <Badge
                    variant="outline"
                    class="text-[9px] px-1.5 py-0 font-medium tracking-wide uppercase bg-muted/50 text-muted-foreground border-border/40 shrink-0"
                  >
                    {{ p.subsystem }}
                  </Badge>
                  <span
                    class="size-1.5 rounded-full shrink-0"
                    :class="
                      p.status === 'nominal'
                        ? 'bg-teal-400'
                        : p.status === 'warning'
                          ? 'bg-amber-400 animate-pulse'
                          : 'bg-rose-500 animate-ping'
                    "
                  />
                  <span
                    class="text-xs font-medium text-foreground truncate"
                    :title="p.label"
                  >
                    {{ p.label }}
                  </span>
                </div>

                <div class="flex items-center gap-1.5 shrink-0">
                  <span
                    class="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded capitalize font-medium"
                    :class="getStatusBadgeClass(p.status)"
                  >
                    {{ p.status }}
                  </span>
                  <TrendingUp
                    v-if="p.trend === 'up'"
                    class="size-3.5 text-teal-400 shrink-0"
                    title="Trending Up"
                  />
                  <TrendingDown
                    v-else-if="p.trend === 'down'"
                    class="size-3.5 text-sky-400 shrink-0"
                    title="Trending Down"
                  />
                  <Minus
                    v-else
                    class="size-3.5 text-muted-foreground shrink-0"
                    title="Stable"
                  />
                </div>
              </div>

              <!-- Value Readout -->
              <div class="flex items-baseline gap-1.5 font-mono">
                <span class="text-base font-bold tabular-nums text-foreground leading-none">
                  {{ p.value.toFixed(2) }}
                </span>
                <span class="text-xs text-muted-foreground">
                  {{ p.unit }}
                </span>
              </div>

              <!-- Visual Range Bar -->
              <div class="space-y-1 pt-1">
                <div class="relative h-2 w-full bg-muted/40 rounded-full border border-border/30">
                  <!-- Safe envelope band -->
                  <div
                    class="absolute top-0 bottom-0 bg-teal-500/20 border-x border-teal-500/40 rounded-xs"
                    :style="{
                      left: `${calculateRangePercentages(p.value, p.nominalMin, p.nominalMax, p.absMin, p.absMax).safeStartPct}%`,
                      width: `${calculateRangePercentages(p.value, p.nominalMin, p.nominalMax, p.absMin, p.absMax).safeWidthPct}%`,
                    }"
                    title="Safe Operating Envelope"
                  />
                  <!-- Current value marker pin -->
                  <div
                    class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-2.5 rounded-full shadow-xs ring-1 ring-background z-10 transition-all duration-300"
                    :class="
                      p.status === 'nominal'
                        ? 'bg-teal-400 border border-teal-200'
                        : p.status === 'warning'
                          ? 'bg-amber-400 border border-amber-200'
                          : 'bg-rose-500 border border-rose-200'
                    "
                    :style="{
                      left: `${calculateRangePercentages(p.value, p.nominalMin, p.nominalMax, p.absMin, p.absMax).markerPct}%`,
                    }"
                    :title="`Current: ${p.value} ${p.unit}`"
                  />
                </div>
                <!-- Operating range text below the bar -->
                <div class="flex items-center justify-between text-[10px] font-mono text-muted-foreground/80">
                  <span>Min: {{ p.nominalMin }}</span>
                  <span class="text-[9px] uppercase tracking-wider text-muted-foreground/60">Safe Target</span>
                  <span>Max: {{ p.nominalMax }} {{ p.unit }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="py-12 text-center space-y-3">
            <div class="size-9 rounded-full bg-muted/50 flex items-center justify-center mx-auto text-muted-foreground">
              <Search class="size-4" />
            </div>
            <div class="space-y-1">
              <div class="text-xs font-semibold text-foreground">No telemetry sensors match your filter</div>
              <div class="text-xs text-muted-foreground">
                No sensors found for "{{ searchQuery }}" in {{ selectedCategory }}
              </div>
            </div>
            <button
              type="button"
              @click="clearFilters"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/40 hover:bg-muted/70 border border-border/40 text-xs font-medium text-foreground cursor-pointer transition-colors"
            >
              <X class="size-3" />
              <span>Clear Filter</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Tab 2: Auxiliary Generators (DG1–3) -->
      <div v-else class="max-h-[320px] overflow-y-auto pr-1">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div
            v-for="dg in dgGenerators"
            :key="dg.id"
            class="rounded-lg border border-border/40 bg-muted/20 hover:bg-muted/30 p-3.5 flex flex-col justify-between transition-colors space-y-3"
          >
            <!-- DG Header: Name, Role, Status -->
            <div class="flex items-center justify-between border-b border-border/40 pb-2">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-foreground">{{ dg.name }}</span>
                <Badge
                  variant="outline"
                  class="text-[9px] px-1.5 py-0 font-medium border-border/50 bg-muted/30 text-muted-foreground"
                >
                  {{ dg.role }}
                </Badge>
              </div>
              <Badge
                variant="outline"
                :class="[
                  'text-[10px] font-medium capitalize px-2 py-0.5 flex items-center gap-1',
                  dg.status === 'online'
                    ? 'text-teal-400 border-teal-500/30 bg-teal-500/10'
                    : dg.status === 'standby'
                      ? 'text-muted-foreground border-border/50 bg-muted/40'
                      : 'text-rose-400 border-rose-500/30 bg-rose-500/10',
                ]"
              >
                <span
                  class="size-1.5 rounded-full"
                  :class="dg.status === 'online' ? 'bg-teal-400' : 'bg-muted-foreground'"
                />
                {{ dg.status }}
              </Badge>
            </div>

            <!-- Electrical Generation Metrics -->
            <div class="space-y-1.5 bg-muted/30 rounded-lg p-2.5 border border-border/30">
              <div class="flex items-center justify-between text-xs">
                <span class="text-muted-foreground font-medium flex items-center gap-1.5">
                  <Zap class="size-3 text-primary" />
                  Active Power
                </span>
                <div class="font-mono text-xs">
                  <span class="font-bold text-foreground">{{ dg.electrical.activePowerKw.toLocaleString() }} kW</span>
                  <span class="text-muted-foreground/70 font-normal"> / {{ dg.electrical.maxPowerKw.toLocaleString() }} kW</span>
                </div>
              </div>
              <!-- Animated load percentage progress bar -->
              <div class="relative h-2 w-full bg-muted/50 rounded-full overflow-hidden border border-border/30">
                <div
                  class="h-full rounded-full transition-all duration-300"
                  :class="[
                    dg.electrical.loadPercentage > 85
                      ? 'bg-amber-400'
                      : dg.electrical.loadPercentage > 0
                        ? 'bg-teal-400'
                        : 'bg-muted-foreground/30',
                  ]"
                  :style="{ width: `${Math.min(100, Math.max(0, dg.electrical.loadPercentage))}%` }"
                />
              </div>
              <div class="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                <span>Load Factor</span>
                <span
                  class="font-semibold"
                  :class="dg.electrical.loadPercentage > 0 ? 'text-teal-400' : 'text-muted-foreground'"
                >
                  {{ dg.electrical.loadPercentage.toFixed(1) }}%
                </span>
              </div>
              <!-- Quick Stats -->
              <div class="flex items-center justify-between pt-1 border-t border-border/20 text-[11px] font-mono">
                <span class="text-foreground font-medium">{{ dg.electrical.voltage }} V</span>
                <span class="text-muted-foreground/40">•</span>
                <span class="text-foreground font-medium">{{ dg.electrical.frequency.toFixed(1) }} Hz</span>
                <span class="text-muted-foreground/40">•</span>
                <span class="text-foreground font-medium">cos φ {{ dg.electrical.powerFactor.toFixed(2) }}</span>
              </div>
            </div>

            <!-- Mechanical Telemetry Section -->
            <div class="space-y-1.5 text-xs">
              <div class="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground/80">
                Mechanical Telemetry
              </div>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="bg-muted/20 p-2 rounded-md border border-border/30 space-y-0.5">
                  <div class="text-[10px] text-muted-foreground">Engine Speed</div>
                  <div class="font-mono font-semibold text-foreground">
                    {{ dg.mechanical.rpm.toLocaleString() }} <span class="text-[10px] text-muted-foreground font-normal">rpm</span>
                  </div>
                </div>
                <div class="bg-muted/20 p-2 rounded-md border border-border/30 space-y-0.5">
                  <div class="text-[10px] text-muted-foreground">Fuel Oil Temp</div>
                  <div class="font-mono font-semibold text-foreground">
                    {{ dg.mechanical.foTemp.toFixed(1) }} <span class="text-[10px] text-muted-foreground font-normal">°C</span>
                  </div>
                </div>
                <div class="bg-muted/20 p-2 rounded-md border border-border/30 space-y-0.5">
                  <div class="text-[10px] text-muted-foreground">HT Fresh Water</div>
                  <div class="font-mono font-semibold text-foreground text-[11px]">
                    {{ dg.mechanical.htFwPress.toFixed(2) }}b / {{ dg.mechanical.htFwTemp.toFixed(1) }}°C
                  </div>
                </div>
                <div class="bg-muted/20 p-2 rounded-md border border-border/30 space-y-0.5">
                  <div class="text-[10px] text-muted-foreground">Lube Oil</div>
                  <div class="font-mono font-semibold text-foreground text-[11px]">
                    {{ dg.mechanical.loPress.toFixed(2) }}b / {{ dg.mechanical.loTemp.toFixed(1) }}°C
                  </div>
                </div>
              </div>
            </div>

            <!-- 3-Phase Stator Windings Section -->
            <div class="pt-2 border-t border-border/40 space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <span class="text-xs text-muted-foreground font-medium">Stator Windings (U/V/W)</span>
                <span class="font-mono text-xs font-semibold text-foreground">
                  {{ dg.windings.u.toFixed(1) }}° / {{ dg.windings.v.toFixed(1) }}° / {{ dg.windings.w.toFixed(1) }}°
                </span>
              </div>
              <div class="flex items-center justify-between text-[11px] font-mono">
                <span class="text-muted-foreground">Thermal Variance</span>
                <span
                  class="font-medium"
                  :class="
                    calculateWindingVariance(dg.windings.u, dg.windings.v, dg.windings.w).isBalanced
                      ? 'text-teal-400'
                      : 'text-amber-400'
                  "
                >
                  Δ {{ calculateWindingVariance(dg.windings.u, dg.windings.v, dg.windings.w).spread.toFixed(1) }}°C • {{ calculateWindingVariance(dg.windings.u, dg.windings.v, dg.windings.w).isBalanced ? 'Balanced' : 'Imbalanced' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
