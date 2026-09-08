<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Gauge,
  Leaf,
  Ship,
  Fuel,
  TrendingDown,
  Calendar,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Anchor,
  Compass,
  FileSpreadsheet,
  ArrowDownRight,
  ShieldCheck,
} from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import AreaChart from '@/components/ui/charts/area-chart/AreaChart.vue'
import type { EmissionsCiiResponse } from '~~/server/api/emissions/cii.get'

definePageMeta({
  middleware: 'require-dispatcher',
})

useHead({
  title: 'Emissions & CII Intelligence | ShipTrack',
})

const currentYear = new Date().getFullYear()
const selectedYear = ref(currentYear)
const selectedVesselId = ref<number>(1)
const selectedVoyage = ref<string>('')
const selectedVoyageType = ref<string>('all')
const activeScenarioIndex = ref<number>(1) // Default to -10% speed reduction

// Available years from 2020 to current
const yearOptions = Array.from({ length: currentYear - 2019 }, (_, i) => currentYear - i)

// Fetch fleet vessels for vessel selector
const { data: fleetData } = await useFetch('/api/vessels/geojson')
const vesselOptions = computed(() => {
  if (fleetData.value?.vessels?.length) {
    return fleetData.value.vessels.map((v) => ({
      id: v.vesselId,
      name: v.name,
      dwt: 54000,
    }))
  }
  return [
    { id: 1, name: 'Pacific Titan', dwt: 55000 },
    { id: 2, name: 'Nordic Star', dwt: 48000 },
    { id: 3, name: 'Atlantic Pioneer', dwt: 52000 },
    { id: 4, name: 'Ocean Navigator', dwt: 61000 },
  ]
})

// Unified single API call to Nuxt server
const {
  data: ciiData,
  pending: isLoading,
  refresh: refreshCiiData,
} = await useFetch<EmissionsCiiResponse>('/api/emissions/cii', {
  query: computed(() => ({
    vesselId: selectedVesselId.value,
    year: selectedYear.value,
    voyageNumber: selectedVoyage.value || undefined,
    voyageType: selectedVoyageType.value,
  })),
})

// Rating badge colors and classes
function getRatingTone(rating?: string) {
  switch (rating) {
    case 'A':
      return {
        badge: 'bg-blue-600 text-white border-blue-500 hover:bg-blue-600',
        cardBorder: 'border-blue-500/40',
        text: 'text-blue-500',
        label: 'Superior Efficiency',
      }
    case 'B':
      return {
        badge: 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-600',
        cardBorder: 'border-emerald-500/40',
        text: 'text-emerald-500',
        label: 'Minor Superior',
      }
    case 'C':
      return {
        badge: 'bg-lime-500 text-neutral-950 font-semibold border-lime-400 hover:bg-lime-500',
        cardBorder: 'border-lime-500/40',
        text: 'text-lime-500',
        label: 'Target Compliant',
      }
    case 'D':
      return {
        badge: 'bg-amber-500 text-neutral-950 font-semibold border-amber-400 hover:bg-amber-500',
        cardBorder: 'border-amber-500/40',
        text: 'text-amber-500',
        label: 'Warning / Minor Inferior',
      }
    case 'E':
      return {
        badge: 'bg-rose-600 text-white border-rose-500 hover:bg-rose-600',
        cardBorder: 'border-rose-500/40',
        text: 'text-rose-500',
        label: 'Non-Compliant / Inferior',
      }
    default:
      return {
        badge: 'bg-muted text-muted-foreground border-border',
        cardBorder: 'border-border',
        text: 'text-muted-foreground',
        label: 'Unrated',
      }
  }
}

const currentRatingInfo = computed(() => getRatingTone(ciiData.value?.summary.attainedRating))

// Selected What-If Speed Scenario
const activeScenario = computed(() => {
  const list = ciiData.value?.speedReductionAdvisory || []
  return list[activeScenarioIndex.value] || list[0]
})

// Calculate percentage position of Attained CII on the 5-band scale for gauge visualization
const gaugePositionPercent = computed(() => {
  if (!ciiData.value?.summary) return 50
  const val = ciiData.value.summary.attainedCii
  const b = ciiData.value.summary.boundaries
  const min = Math.max(1.0, b.superior_boundary * 0.6)
  const max = b.inferior_boundary * 1.3
  const clamped = Math.min(Math.max(val, min), max)
  return Math.round(((clamped - min) / (max - min)) * 100)
})

// Format large numbers with commas
function formatNumber(n?: number, decimals = 0): string {
  if (n === undefined || n === null || isNaN(n)) return '--'
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

// Export CSV report
function exportCsv() {
  if (!ciiData.value) return
  const summary = ciiData.value.summary
  const vessel = ciiData.value.vessel

  const rows = [
    ['IMO CII & Emissions Audit Report'],
    ['Generated Date', new Date().toISOString()],
    ['Vessel Name', vessel.vesselName],
    ['Vessel ID', String(vessel.vesselId)],
    ['Deadweight (MT)', String(vessel.deadweight)],
    ['Evaluation Year', String(vessel.year)],
    ['Attained CII (gCO2/MT*NM)', String(summary.attainedCii)],
    ['Attained Rating', summary.attainedRating],
    ['Required CII', String(summary.requiredCii)],
    ['Margin %', `${summary.marginPercent}%`],
    ['Total CO2 (MT)', String(summary.totalCo2Mt)],
    ['Transport Work (MT*NM)', String(summary.totalTransportWork)],
    ['Total Distance (NM)', String(summary.totalDistanceNm)],
    ['Sea Running Hours', String(summary.runningHoursAtSea)],
    ['Port Running Hours', String(summary.runningHoursAtPort)],
    [],
    ['Fuel Breakdown', 'Sea (MT)', 'Port (MT)', 'Total (MT)', 'Carbon Coeff', 'Total CO2 (MT)'],
    ...ciiData.value.fuelBreakdown.map((f) => [
      f.fuelLabel,
      String(f.seaMt),
      String(f.portMt),
      String(f.totalMt),
      String(f.coefficient),
      String(f.co2Mt),
    ]),
    [],
    ['Monthly Rolling Trend', 'Attained CII', 'Rating', 'CO2 (MT)', 'Distance (NM)'],
    ...ciiData.value.monthlyTrend.map((m) => [
      m.month,
      String(m.attainedCii ?? '--'),
      m.rating ?? '--',
      String(m.co2Mt),
      String(m.distanceNm),
    ]),
  ]

  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n')
  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', `${vessel.vesselName.replace(/\s+/g, '_')}_CII_Report_${vessel.year}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Chart dataset prepared for AreaChart
const chartData = computed(() => {
  if (!ciiData.value?.monthlyTrend) return []
  const required = ciiData.value.summary.requiredCii
  return ciiData.value.monthlyTrend.map((m) => ({
    month: m.month,
    'Attained CII': m.attainedCii ?? required,
    'Required Limit': required,
  }))
})
</script>

<template>
  <div class="space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto">
    <!-- Header Controls & Filters -->
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-5">
      <div>
        <div class="flex items-center gap-2.5">
          <div class="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Gauge class="size-5" />
          </div>
          <div>
            <h1 class="text-xl font-bold tracking-tight text-foreground">Emissions & CII Intelligence</h1>
            <p class="text-xs text-muted-foreground">
              IMO MARPOL Annex VI Carbon Intensity Indicator compliance, fuel mix, and speed advisory
            </p>
          </div>
        </div>
      </div>

      <!-- Controls Bar -->
      <div class="flex flex-wrap items-center gap-2.5">
        <!-- Vessel Selector -->
        <div class="w-[180px]">
          <Select v-model="selectedVesselId">
            <SelectTrigger class="h-8 text-xs font-medium">
              <SelectValue placeholder="Select Vessel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="v in vesselOptions"
                :key="v.id"
                :value="v.id"
                class="text-xs cursor-pointer"
              >
                {{ v.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Year Selector -->
        <div class="w-[100px]">
          <Select v-model="selectedYear">
            <SelectTrigger class="h-8 text-xs font-medium">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="yr in yearOptions"
                :key="yr"
                :value="yr"
                class="text-xs cursor-pointer"
              >
                {{ yr }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Voyage Selector (if voyages exist) -->
        <div v-if="ciiData?.availableVoyages?.length" class="w-[160px]">
          <Select v-model="selectedVoyage">
            <SelectTrigger class="h-8 text-xs font-medium">
              <SelectValue placeholder="All Voyages (YTD)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="" class="text-xs cursor-pointer">
                All Voyages (YTD)
              </SelectItem>
              <SelectItem
                v-for="voy in ciiData.availableVoyages"
                :key="voy.voyageNumber"
                :value="voy.voyageNumber"
                class="text-xs cursor-pointer"
              >
                {{ voy.voyageNumber }} ({{ voy.destinationPort }})
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Refresh Button -->
        <Button
          variant="outline"
          size="sm"
          class="h-8 text-xs gap-1.5 cursor-pointer"
          :disabled="isLoading"
          @click="() => refreshCiiData()"
        >
          <RefreshCw class="size-3.5" :class="{ 'animate-spin': isLoading }" />
          <span>Refresh</span>
        </Button>

        <!-- CSV Export Button -->
        <Button
          variant="outline"
          size="sm"
          class="h-8 text-xs gap-1.5 cursor-pointer border-primary/30 text-primary hover:bg-primary/10"
          :disabled="isLoading || !ciiData"
          @click="exportCsv"
        >
          <FileSpreadsheet class="size-3.5" />
          <span>Export CSV</span>
        </Button>
      </div>
    </div>

    <!-- Loading Skeleton State -->
    <div v-if="isLoading && !ciiData" class="space-y-6">
      <Skeleton class="h-44 w-full rounded-xl" />
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton v-for="i in 4" :key="i" class="h-28 rounded-xl" />
      </div>
      <div class="grid gap-6 lg:grid-cols-12">
        <Skeleton class="h-80 rounded-xl lg:col-span-7" />
        <Skeleton class="h-80 rounded-xl lg:col-span-5" />
      </div>
    </div>

    <div v-else-if="ciiData" class="space-y-6">
      <!-- Hero CII Compliance Card -->
      <Card :class="['border shadow-sm transition-colors', currentRatingInfo.cardBorder]">
        <CardContent class="p-5 md:p-6">
          <div class="grid gap-6 lg:grid-cols-12 lg:items-center">
            <!-- Left: Big Grade Badge & Status -->
            <div class="lg:col-span-4 flex items-center gap-5 border-b lg:border-b-0 lg:border-r border-border/80 pb-5 lg:pb-0 lg:pr-6">
              <div
                :class="[
                  'flex size-20 shrink-0 items-center justify-center rounded-2xl text-4xl font-extrabold shadow-md border-2',
                  currentRatingInfo.badge,
                ]"
              >
                {{ ciiData.summary.attainedRating }}
              </div>
              <div class="space-y-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">IMO CII Rating</span>
                  <Badge variant="outline" class="text-[10px] font-medium px-1.5 py-0 border-border">
                    MEPC.338(76)
                  </Badge>
                </div>
                <h3 class="text-lg font-bold tracking-tight text-foreground truncate">
                  {{ currentRatingInfo.label }}
                </h3>
                <p class="text-xs text-muted-foreground leading-relaxed">
                  <template v-if="ciiData.summary.marginPercent <= 0">
                    <span class="font-semibold text-emerald-500">{{ Math.abs(ciiData.summary.marginPercent) }}% better</span> than required IMO threshold.
                  </template>
                  <template v-else>
                    <span class="font-semibold text-rose-500">{{ ciiData.summary.marginPercent }}% above</span> target emission intensity.
                  </template>
                </p>
              </div>
            </div>

            <!-- Center: Attained vs Required Metrics -->
            <div class="lg:col-span-4 grid grid-cols-2 gap-4 border-b lg:border-b-0 lg:border-r border-border/80 pb-5 lg:pb-0 lg:px-6">
              <div class="space-y-0.5">
                <span class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Attained CII</span>
                <div class="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                  {{ ciiData.summary.attainedCii.toFixed(2) }}
                </div>
                <span class="text-[10px] text-muted-foreground">gCO₂ / (MT · NM)</span>
              </div>
              <div class="space-y-0.5">
                <span class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Required CII</span>
                <div class="text-2xl font-bold tracking-tight text-muted-foreground/80 tabular-nums">
                  {{ ciiData.summary.requiredCii.toFixed(2) }}
                </div>
                <span class="text-[10px] text-muted-foreground">IMO Regulatory Cap</span>
              </div>
            </div>

            <!-- Right: Rating Boundary Scale & Marker -->
            <div class="lg:col-span-4 space-y-2">
              <div class="flex items-center justify-between text-xs">
                <span class="font-medium text-foreground">Rating Band Position</span>
                <span class="text-[11px] font-medium tabular-nums" :class="currentRatingInfo.text">
                  Rating {{ ciiData.summary.attainedRating }} ({{ ciiData.summary.attainedCii.toFixed(2) }})
                </span>
              </div>

              <!-- Multi-band visual gauge -->
              <div class="relative pt-3 pb-1">
                <!-- Pointer indicator -->
                <div
                  class="absolute top-0 -translate-x-1/2 flex flex-col items-center transition-all duration-500"
                  :style="{ left: `${gaugePositionPercent}%` }"
                >
                  <div class="size-2 rounded-full bg-foreground shadow" />
                  <div class="w-0.5 h-2 bg-foreground" />
                </div>

                <!-- Gradient Spectrum Track -->
                <div class="grid grid-cols-5 h-3 rounded-full overflow-hidden border border-border/60 shadow-inner">
                  <div class="bg-blue-600 flex items-center justify-center text-[9px] font-bold text-white">A</div>
                  <div class="bg-emerald-600 flex items-center justify-center text-[9px] font-bold text-white">B</div>
                  <div class="bg-lime-500 flex items-center justify-center text-[9px] font-bold text-neutral-900">C</div>
                  <div class="bg-amber-500 flex items-center justify-center text-[9px] font-bold text-neutral-900">D</div>
                  <div class="bg-rose-600 flex items-center justify-center text-[9px] font-bold text-white">E</div>
                </div>

                <!-- Boundary Thresholds Labels -->
                <div class="flex justify-between text-[10px] text-muted-foreground pt-1.5 tabular-nums">
                  <span>&lt; {{ ciiData.summary.boundaries.superior_boundary.toFixed(1) }}</span>
                  <span>{{ ciiData.summary.boundaries.lower_boundary.toFixed(1) }}</span>
                  <span>{{ ciiData.summary.boundaries.upper_boundary.toFixed(1) }}</span>
                  <span>&gt; {{ ciiData.summary.boundaries.inferior_boundary.toFixed(1) }}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- 4-Tile Operational KPI Grid -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <!-- Tile 1: Total CO2 -->
        <Card class="shadow-xs">
          <CardContent class="p-4 space-y-1.5">
            <div class="flex items-center justify-between text-xs text-muted-foreground">
              <span class="font-medium uppercase tracking-wider text-[10px]">Total CO₂ Emitted</span>
              <Leaf class="size-4 text-emerald-500" />
            </div>
            <div class="text-2xl font-bold tracking-tight tabular-nums text-foreground">
              {{ formatNumber(ciiData.summary.totalCo2Mt, 1) }}
              <span class="text-xs font-normal text-muted-foreground">MT</span>
            </div>
            <p class="text-[11px] text-muted-foreground">
              Across {{ ciiData.fuelBreakdown.length }} fuel types consumed
            </p>
          </CardContent>
        </Card>

        <!-- Tile 2: Transport Work -->
        <Card class="shadow-xs">
          <CardContent class="p-4 space-y-1.5">
            <div class="flex items-center justify-between text-xs text-muted-foreground">
              <span class="font-medium uppercase tracking-wider text-[10px]">Transport Work</span>
              <Compass class="size-4 text-primary" />
            </div>
            <div class="text-2xl font-bold tracking-tight tabular-nums text-foreground">
              {{ formatNumber(Math.round(ciiData.summary.totalTransportWork / 1000000), 1) }}
              <span class="text-xs font-normal text-muted-foreground">M MT·NM</span>
            </div>
            <p class="text-[11px] text-muted-foreground">
              DWT: {{ formatNumber(ciiData.vessel.deadweight) }} MT baseline
            </p>
          </CardContent>
        </Card>

        <!-- Tile 3: Distance & Time Ratio -->
        <Card class="shadow-xs">
          <CardContent class="p-4 space-y-1.5">
            <div class="flex items-center justify-between text-xs text-muted-foreground">
              <span class="font-medium uppercase tracking-wider text-[10px]">Distance Sailed</span>
              <Ship class="size-4 text-cyan-500" />
            </div>
            <div class="text-2xl font-bold tracking-tight tabular-nums text-foreground">
              {{ formatNumber(ciiData.summary.totalDistanceNm, 0) }}
              <span class="text-xs font-normal text-muted-foreground">NM</span>
            </div>
            <p class="text-[11px] text-muted-foreground">
              Sea: {{ formatNumber(ciiData.summary.runningHoursAtSea, 0) }}h · Port: {{ formatNumber(ciiData.summary.runningHoursAtPort, 0) }}h
            </p>
          </CardContent>
        </Card>

        <!-- Tile 4: Vessel Trim & Draft -->
        <Card class="shadow-xs">
          <CardContent class="p-4 space-y-1.5">
            <div class="flex items-center justify-between text-xs text-muted-foreground">
              <span class="font-medium uppercase tracking-wider text-[10px]">Mean Draft & Trim</span>
              <Anchor class="size-4 text-amber-500" />
            </div>
            <div class="text-2xl font-bold tracking-tight tabular-nums text-foreground">
              {{ ciiData.summary.averageDraftFwdMts?.toFixed(2) ?? '--' }} / {{ ciiData.summary.averageDraftAftMts?.toFixed(2) ?? '--' }}
              <span class="text-xs font-normal text-muted-foreground">mts</span>
            </div>
            <p class="text-[11px] text-muted-foreground">
              Fwd / Aft average loaded drafts
            </p>
          </CardContent>
        </Card>
      </div>

      <!-- Main Section: Fuel Breakdown & What-If Speed Reduction Advisor -->
      <div class="grid gap-6 lg:grid-cols-12">
        <!-- Fuel Mix & Emissions Table (7 cols) -->
        <Card class="lg:col-span-7 shadow-xs flex flex-col">
          <CardHeader class="pb-3">
            <div class="flex items-center justify-between">
              <div>
                <CardTitle class="text-base font-semibold">Fuel Mix & Operational Consumption</CardTitle>
                <CardDescription class="text-xs">
                  At-Sea vs. At-Port fuel consumption and resulting carbon emissions
                </CardDescription>
              </div>
              <Badge variant="outline" class="text-[10px] font-mono">
                {{ ciiData.fuelBreakdown.length }} Grades
              </Badge>
            </div>
          </CardHeader>
          <CardContent class="p-0 flex-1 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow class="hover:bg-transparent text-[11px]">
                  <TableHead class="font-semibold">Fuel Type</TableHead>
                  <TableHead class="text-right font-semibold">Sea (MT)</TableHead>
                  <TableHead class="text-right font-semibold">Port (MT)</TableHead>
                  <TableHead class="text-right font-semibold">Total (MT)</TableHead>
                  <TableHead class="text-right font-semibold">CF Factor</TableHead>
                  <TableHead class="text-right font-semibold">CO₂ (MT)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="fuel in ciiData.fuelBreakdown"
                  :key="fuel.fuelType"
                  class="text-xs hover:bg-muted/40 transition-colors"
                >
                  <TableCell class="font-medium text-foreground py-2.5">
                    <div class="flex items-center gap-2">
                      <Fuel class="size-3.5 text-primary shrink-0" />
                      <span class="truncate">{{ fuel.fuelLabel }}</span>
                    </div>
                  </TableCell>
                  <TableCell class="text-right tabular-nums py-2.5 text-muted-foreground">
                    {{ formatNumber(fuel.seaMt, 1) }}
                  </TableCell>
                  <TableCell class="text-right tabular-nums py-2.5 text-muted-foreground">
                    {{ formatNumber(fuel.portMt, 1) }}
                  </TableCell>
                  <TableCell class="text-right tabular-nums font-semibold text-foreground py-2.5">
                    {{ formatNumber(fuel.totalMt, 1) }}
                  </TableCell>
                  <TableCell class="text-right tabular-nums text-muted-foreground py-2.5">
                    {{ fuel.coefficient.toFixed(3) }}
                  </TableCell>
                  <TableCell class="text-right tabular-nums font-bold text-foreground py-2.5">
                    {{ formatNumber(fuel.co2Mt, 1) }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <!-- What-If Speed Reduction Advisor (5 cols) -->
        <Card class="lg:col-span-5 shadow-xs flex flex-col bg-card">
          <CardHeader class="pb-3">
            <div class="flex items-center justify-between">
              <div>
                <CardTitle class="text-base font-semibold flex items-center gap-2">
                  <Sliders class="size-4 text-primary" />
                  Speed Reduction Advisory
                </CardTitle>
                <CardDescription class="text-xs">
                  Simulate speed reductions to achieve higher IMO rating bands
                </CardDescription>
              </div>
              <Badge variant="outline" class="text-[10px] text-primary border-primary/40">
                Eco-Steaming
              </Badge>
            </div>
          </CardHeader>
          <CardContent class="space-y-4 flex-1 flex flex-col justify-between">
            <!-- Scenario Selector Pills -->
            <div class="space-y-1.5">
              <span class="text-[11px] font-medium text-muted-foreground">Select Speed Trim:</span>
              <div class="grid grid-cols-5 gap-1.5">
                <button
                  v-for="(scenario, idx) in ciiData.speedReductionAdvisory"
                  :key="scenario.reductionPercent"
                  type="button"
                  :class="[
                    'flex flex-col items-center py-2 px-1 rounded-md border text-center transition-all cursor-pointer text-xs',
                    activeScenarioIndex === idx
                      ? 'bg-primary/10 border-primary font-semibold text-primary shadow-xs'
                      : 'border-border/70 hover:bg-muted/50 text-muted-foreground'
                  ]"
                  @click="activeScenarioIndex = idx"
                >
                  <span class="text-xs font-bold">-{{ scenario.reductionPercent }}%</span>
                  <span class="text-[9px] opacity-75">kts</span>
                </button>
              </div>
            </div>

            <!-- Projected Outcomes Hero -->
            <div class="rounded-xl border bg-muted/20 p-4 space-y-3">
              <div class="flex items-center justify-between border-b pb-2.5">
                <div>
                  <span class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Projected Grade</span>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-2xl font-black tabular-nums text-foreground">
                      Rating {{ activeScenario.projectedRating }}
                    </span>
                    <Badge :class="getRatingTone(activeScenario.projectedRating).badge" class="text-[10px] px-1.5 py-0">
                      {{ getRatingTone(activeScenario.projectedRating).label }}
                    </Badge>
                  </div>
                </div>

                <div class="text-right">
                  <span class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Projected CII</span>
                  <div class="text-2xl font-bold tabular-nums text-foreground mt-0.5">
                    {{ activeScenario.projectedCii.toFixed(2) }}
                  </div>
                </div>
              </div>

              <!-- Savings Estimates -->
              <div class="grid grid-cols-2 gap-3 pt-1">
                <div class="space-y-0.5">
                  <span class="text-[10px] text-muted-foreground">CO₂ Avoided</span>
                  <div class="text-base font-bold text-emerald-500 tabular-nums flex items-center gap-1">
                    <ArrowDownRight class="size-3.5" />
                    {{ formatNumber(activeScenario.co2SavingsMt, 1) }} MT
                  </div>
                </div>
                <div class="space-y-0.5">
                  <span class="text-[10px] text-muted-foreground">Power Reduction Factor</span>
                  <div class="text-base font-bold text-foreground tabular-nums">
                    {{ (activeScenario.multiplier * 100).toFixed(1) }}% load
                  </div>
                </div>
              </div>
            </div>

            <p class="text-[11px] text-muted-foreground leading-relaxed">
              Trimming charter speed by <strong>{{ activeScenario.reductionPercent }}%</strong> leverages cubic resistance law to reduce propulsion demand, avoiding <strong>{{ formatNumber(activeScenario.co2SavingsMt, 1) }} MT of CO₂</strong>.
            </p>
          </CardContent>
        </Card>
      </div>

      <!-- Chronological Monthly Trend Chart -->
      <Card class="shadow-xs">
        <CardHeader class="pb-2">
          <div class="flex items-center justify-between">
            <div>
              <CardTitle class="text-base font-semibold">Monthly Rolling CII Performance</CardTitle>
              <CardDescription class="text-xs">
                Historical trajectory plotted against the annual IMO regulatory cap ({{ ciiData.summary.requiredCii.toFixed(2) }})
              </CardDescription>
            </div>
            <div class="flex items-center gap-3 text-xs">
              <span class="inline-flex items-center gap-1.5 text-muted-foreground">
                <span class="size-2 rounded-full bg-primary" /> Attained CII
              </span>
              <span class="inline-flex items-center gap-1.5 text-muted-foreground">
                <span class="size-2 rounded-full bg-destructive" /> Required Limit
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent class="pt-2">
          <ClientOnly>
            <AreaChart
              :data="chartData"
              x-field="month"
              :y-field="['Attained CII', 'Required Limit']"
              height="260"
            />
            <template #fallback>
              <div class="h-[260px] animate-pulse rounded-lg bg-muted/40 flex items-center justify-center text-xs text-muted-foreground">
                Rendering timeline chart...
              </div>
            </template>
          </ClientOnly>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
