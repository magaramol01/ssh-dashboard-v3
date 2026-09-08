<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Gauge,
  Leaf,
  Ship,
  Fuel,
  TrendingDown,
  TrendingUp,
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
  Coins,
  Scale,
  Award,
  BarChart3,
  Users,
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
import BarChart from '@/components/ui/charts/bar-chart/BarChart.vue'
import type { EmissionsCiiResponse } from '~~/server/api/emissions/cii.get'

definePageMeta({
  middleware: 'require-dispatcher',
})

useHead({
  title: 'Vessel Emissions & CII Intelligence | ShipTrack',
})

const currentYear = new Date().getFullYear()
const selectedYear = ref<string>(String(currentYear))
const selectedVesselId = ref<string>('1')
const selectedVoyage = ref<string>('all')
const selectedVoyageType = ref<string>('all')
const activeScenarioIndex = ref<number>(1) // Default to -10% speed reduction
const compareTargetId = ref<string>('fleet') // 'fleet' or another vesselId string

// Available years from 2020 to current
const yearOptions = Array.from({ length: currentYear - 2019 }, (_, i) => currentYear - i)

// Fetch fleet vessels for vessel selector
const { data: fleetData } = await useFetch('/api/vessels/geojson')
const vesselOptions = computed(() => {
  if (fleetData.value?.vessels?.length) {
    return fleetData.value.vessels.map((v) => ({
      id: String(v.vesselId),
      name: v.name,
      dwt: 54000,
    }))
  }
  return [
    { id: '1', name: 'Pacific Titan', dwt: 55000 },
    { id: '2', name: 'Nordic Star', dwt: 48000 },
    { id: '3', name: 'Atlantic Pioneer', dwt: 52000 },
    { id: '4', name: 'Ocean Navigator', dwt: 61000 },
    { id: '5', name: 'Southern Cross', dwt: 45000 },
    { id: '6', name: 'Baltic Wind', dwt: 58000 },
  ]
})

// Watch for fleetData to automatically select the first fleet vessel
watch(
  () => vesselOptions.value,
  (options) => {
    if (options.length && (!selectedVesselId.value || selectedVesselId.value === '1')) {
      const exists = options.some((v) => v.id === selectedVesselId.value)
      if (!exists) {
        selectedVesselId.value = options[0].id
      }
    }
  },
  { immediate: true }
)

const selectedVessel = computed(() => {
  return vesselOptions.value.find((v) => v.id === selectedVesselId.value) || vesselOptions.value[0]
})

// Unified single API call to Nuxt server for selected vessel data
const {
  data: ciiData,
  pending: isLoading,
  refresh: refreshCiiData,
} = await useFetch<EmissionsCiiResponse>('/api/emissions/cii', {
  query: computed(() => ({
    vesselId: parseInt(selectedVesselId.value, 10) || 1,
    vesselName: selectedVessel.value?.name,
    fleetVessels: JSON.stringify(
      vesselOptions.value.map((v) => ({
        vesselId: parseInt(v.id, 10),
        vesselName: v.name,
      }))
    ),
    year: parseInt(selectedYear.value, 10) || currentYear,
    voyageNumber: selectedVoyage.value !== 'all' ? selectedVoyage.value : undefined,
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

// Format numbers with commas
function formatNumber(n?: number, decimals = 0): string {
  if (n === undefined || n === null || isNaN(n)) return '--'
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

// Comparison target resolution (Fleet Average vs Selected Sister Ship)
const comparisonData = computed(() => {
  if (!ciiData.value?.benchmark) return null
  const current = ciiData.value.summary
  const bench = ciiData.value.benchmark

  if (compareTargetId.value === 'fleet') {
    const diff = current.attainedCii - bench.fleetAverageCii
    const diffPct = bench.fleetAverageCii > 0 ? (diff / bench.fleetAverageCii) * 100 : 0
    return {
      name: 'Fleet Average',
      attainedCii: bench.fleetAverageCii,
      rating: getRatingTone(getRatingToneForCii(bench.fleetAverageCii, current.boundaries)).label,
      ratingGrade: getRatingToneForCii(bench.fleetAverageCii, current.boundaries),
      diffCii: Number(diff.toFixed(2)),
      diffPct: Number(diffPct.toFixed(1)),
      isBetter: diff <= 0,
      description: `${Math.abs(Number(diffPct.toFixed(1)))}% ${diff <= 0 ? 'more fuel-efficient' : 'higher intensity'} than fleet average`,
    }
  }

  const peer = bench.peers.find((p) => String(p.vesselId) === compareTargetId.value)
  if (peer) {
    const diff = current.attainedCii - peer.attainedCii
    const diffPct = peer.attainedCii > 0 ? (diff / peer.attainedCii) * 100 : 0
    return {
      name: peer.vesselName,
      attainedCii: peer.attainedCii,
      rating: getRatingTone(peer.rating).label,
      ratingGrade: peer.rating,
      diffCii: Number(diff.toFixed(2)),
      diffPct: Number(diffPct.toFixed(1)),
      isBetter: diff <= 0,
      description: `${Math.abs(Number(diffPct.toFixed(1)))}% ${diff <= 0 ? 'more fuel-efficient' : 'higher intensity'} than ${peer.vesselName}`,
    }
  }

  return null
})

function getRatingToneForCii(cii: number, b: any) {
  if (!b) return 'C'
  if (cii <= b.superior_boundary) return 'A'
  if (cii <= b.lower_boundary) return 'B'
  if (cii <= b.upper_boundary) return 'C'
  if (cii <= b.inferior_boundary) return 'D'
  return 'E'
}

// Peer Benchmark Bar Chart Data
const peerChartData = computed(() => {
  if (!ciiData.value?.benchmark?.peers) return []
  return ciiData.value.benchmark.peers.map((p) => ({
    vessel: p.vesselName.replace('Pacific ', 'Pac. ').replace('Atlantic ', 'Atl. ').replace('Northern ', 'Nor. '),
    'Attained CII': p.attainedCii,
  }))
})

// Peer comparison chart options with threshold benchmark lines
const peerChartOption = computed(() => {
  if (!ciiData.value?.benchmark) return {}
  const fleetAvg = ciiData.value.benchmark.fleetAverageCii
  const req = ciiData.value.summary.requiredCii

  return {
    grid: { left: 8, right: 16, top: 24, bottom: 24, containLabel: true },
    yAxis: {
      name: 'gCO₂/(MT·NM)',
      nameTextStyle: { fontSize: 10, color: '#888' },
    },
    series: [
      {
        itemStyle: {
          color: (params: any) => {
            const peer = ciiData.value?.benchmark.peers[params.dataIndex]
            if (peer?.isCurrentVessel) {
              return 'var(--primary, #0ea5e9)'
            }
            return 'rgba(148, 163, 184, 0.45)'
          },
          borderRadius: [4, 4, 0, 0],
        },
        markLine: {
          symbol: 'none',
          data: [
            {
              yAxis: fleetAvg,
              name: 'Fleet Avg',
              lineStyle: { color: '#38bdf8', type: 'dashed', width: 2 },
              label: { formatter: `Fleet Avg: ${fleetAvg.toFixed(2)}`, position: 'insideEndTop', fontSize: 10 },
            },
            {
              yAxis: req,
              name: 'IMO Limit',
              lineStyle: { color: '#f43f5e', type: 'dotted', width: 2 },
              label: { formatter: `IMO Cap: ${req.toFixed(2)}`, position: 'insideStartTop', fontSize: 10 },
            },
          ],
        },
      },
    ],
  }
})

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
    ['EU ETS Cost Liability (€)', String(summary.euEtsCostEur)],
    ['EEOI Cargo Index', String(summary.eeoi)],
    ['Total CO2 (MT)', String(summary.totalCo2Mt)],
    ['Transport Work (MT*NM)', String(summary.totalTransportWork)],
    ['Total Distance (NM)', String(summary.totalDistanceNm)],
    ['Fleet Rank', `#${ciiData.value.benchmark.vesselRank} of ${ciiData.value.benchmark.fleetTotalVessels}`],
    ['Fleet Average CII', String(ciiData.value.benchmark.fleetAverageCii)],
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
            <div class="flex items-center gap-2">
              <h1 class="text-xl font-bold tracking-tight text-foreground">
                {{ ciiData?.vessel.vesselName || 'Vessel' }} Emissions & CII
              </h1>
              <Badge variant="outline" class="text-[10px] font-semibold border-primary/30 text-primary">
                Vessel Deep-Dive
              </Badge>
            </div>
            <p class="text-xs text-muted-foreground">
              IMO MARPOL Annex VI Carbon Intensity Indicator, EU ETS exposure, and fleet benchmarking
            </p>
          </div>
        </div>
      </div>

      <!-- Controls Bar -->
      <div class="flex flex-wrap items-center gap-2.5">
        <!-- Vessel Selector (Required: always one vessel selected) -->
        <div class="w-[190px]">
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
        <div class="w-[95px]">
          <Select v-model="selectedYear">
            <SelectTrigger class="h-8 text-xs font-medium">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="yr in yearOptions"
                :key="yr"
                :value="String(yr)"
                class="text-xs cursor-pointer"
              >
                {{ yr }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Voyage Selector -->
        <div class="w-[185px]">
          <Select v-model="selectedVoyage">
            <SelectTrigger class="h-8 text-xs font-medium">
              <SelectValue placeholder="All Voyages (YTD)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" class="text-xs cursor-pointer">
                All Voyages (YTD)
              </SelectItem>
              <SelectItem
                v-for="voy in ciiData?.availableVoyages || []"
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
      <Skeleton class="h-16 w-full rounded-xl" />
      <Skeleton class="h-44 w-full rounded-xl" />
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Skeleton v-for="i in 6" :key="i" class="h-28 rounded-xl" />
      </div>
      <div class="grid gap-6 lg:grid-cols-12">
        <Skeleton class="h-80 rounded-xl lg:col-span-7" />
        <Skeleton class="h-80 rounded-xl lg:col-span-5" />
      </div>
    </div>

    <div v-else-if="ciiData" class="space-y-6">
      <!-- Vessel Fleet Ranking & Context Strip -->
      <div class="bg-card/70 border rounded-xl p-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-xs">
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <span class="font-bold text-sm text-foreground">{{ ciiData.vessel.vesselName }}</span>
            <Badge variant="outline" class="text-[10px] font-mono">
              DWT: {{ formatNumber(ciiData.vessel.deadweight) }} MT
            </Badge>
          </div>
          <div class="h-4 w-px bg-border hidden sm:block" />
          <div class="flex items-center gap-1.5 text-xs">
            <Award class="size-3.5 text-primary" />
            <span class="text-muted-foreground">Fleet Position:</span>
            <span class="font-bold text-foreground">
              Rank #{{ ciiData.benchmark.vesselRank }}
            </span>
            <span class="text-[11px] text-muted-foreground">of {{ ciiData.benchmark.fleetTotalVessels }} vessels</span>
          </div>
          <div class="h-4 w-px bg-border hidden sm:block" />
          <div class="flex items-center gap-1.5 text-xs">
            <component
              :is="ciiData.benchmark.deltaVsFleetPercent <= 0 ? TrendingDown : TrendingUp"
              :class="['size-3.5', ciiData.benchmark.deltaVsFleetPercent <= 0 ? 'text-emerald-500' : 'text-amber-500']"
            />
            <span :class="['font-semibold', ciiData.benchmark.deltaVsFleetPercent <= 0 ? 'text-emerald-500' : 'text-amber-500']">
              {{ Math.abs(ciiData.benchmark.deltaVsFleetPercent) }}%
              {{ ciiData.benchmark.deltaVsFleetPercent <= 0 ? 'better' : 'higher intensity' }}
            </span>
            <span class="text-muted-foreground">than Fleet Avg ({{ ciiData.benchmark.fleetAverageCii.toFixed(2) }})</span>
          </div>
        </div>

        <!-- Comparator Switcher: Compare this vessel with Fleet Average or sister ship -->
        <div class="flex items-center gap-2 self-end md:self-auto">
          <span class="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
            <Scale class="size-3.5 text-primary" /> Compare against:
          </span>
          <div class="w-[160px]">
            <Select v-model="compareTargetId">
              <SelectTrigger class="h-7 text-xs">
                <SelectValue placeholder="Compare With" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fleet" class="text-xs cursor-pointer">
                  Fleet Average
                </SelectItem>
                <SelectItem
                  v-for="p in ciiData.benchmark.peers.filter((x) => !x.isCurrentVessel)"
                  :key="p.vesselId"
                  :value="String(p.vesselId)"
                  class="text-xs cursor-pointer"
                >
                  {{ p.vesselName }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

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

      <!-- Enhanced 6-Tile Operational KPI Grid (Vessel-Specific Metrics) -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <!-- Tile 1: Total CO2 -->
        <Card class="shadow-xs">
          <CardContent class="p-4 space-y-1.5">
            <div class="flex items-center justify-between text-xs text-muted-foreground">
              <span class="font-medium uppercase tracking-wider text-[10px]">Total CO₂ Emitted</span>
              <Leaf class="size-4 text-emerald-500" />
            </div>
            <div class="text-xl font-bold tracking-tight tabular-nums text-foreground">
              {{ formatNumber(ciiData.summary.totalCo2Mt, 1) }}
              <span class="text-xs font-normal text-muted-foreground">MT</span>
            </div>
            <p class="text-[11px] text-muted-foreground">
              Rate: {{ ciiData.summary.co2PerDistanceNm }} MT/NM
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
            <div class="text-xl font-bold tracking-tight tabular-nums text-foreground">
              {{ formatNumber(Math.round(ciiData.summary.totalTransportWork / 1000000), 1) }}
              <span class="text-xs font-normal text-muted-foreground">M MT·NM</span>
            </div>
            <p class="text-[11px] text-muted-foreground">
              DWT: {{ formatNumber(ciiData.vessel.deadweight) }} MT capacity
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
            <div class="text-xl font-bold tracking-tight tabular-nums text-foreground">
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
              <span class="font-medium uppercase tracking-wider text-[10px]">Loaded Drafts</span>
              <Anchor class="size-4 text-amber-500" />
            </div>
            <div class="text-xl font-bold tracking-tight tabular-nums text-foreground">
              {{ ciiData.summary.averageDraftFwdMts?.toFixed(2) ?? '--' }} / {{ ciiData.summary.averageDraftAftMts?.toFixed(2) ?? '--' }}
              <span class="text-xs font-normal text-muted-foreground">mts</span>
            </div>
            <p class="text-[11px] text-muted-foreground">
              Fwd / Aft loaded draft
            </p>
          </CardContent>
        </Card>

        <!-- Tile 5: EU ETS Carbon Allowance Exposure (€) -->
        <Card class="shadow-xs border-primary/20 bg-primary/5">
          <CardContent class="p-4 space-y-1.5">
            <div class="flex items-center justify-between text-xs text-muted-foreground">
              <span class="font-medium uppercase tracking-wider text-[10px] text-primary">EU ETS Cost</span>
              <Coins class="size-4 text-primary" />
            </div>
            <div class="text-xl font-bold tracking-tight tabular-nums text-foreground">
              €{{ formatNumber(ciiData.summary.euEtsCostEur, 0) }}
            </div>
            <p class="text-[11px] text-muted-foreground">
              EUA Liability @ €65/MT
            </p>
          </CardContent>
        </Card>

        <!-- Tile 6: EEOI Operational Cargo Efficiency -->
        <Card class="shadow-xs">
          <CardContent class="p-4 space-y-1.5">
            <div class="flex items-center justify-between text-xs text-muted-foreground">
              <span class="font-medium uppercase tracking-wider text-[10px]">EEOI Index</span>
              <Scale class="size-4 text-emerald-500" />
            </div>
            <div class="text-xl font-bold tracking-tight tabular-nums text-foreground">
              {{ ciiData.summary.eeoi.toFixed(2) }}
              <span class="text-xs font-normal text-muted-foreground">g/t·nm</span>
            </div>
            <p class="text-[11px] text-muted-foreground">
              Cargo payload efficiency
            </p>
          </CardContent>
        </Card>
      </div>

      <!-- Vessel Comparison Section: Selected Vessel vs Fleet / Sister Ships -->
      <Card class="shadow-xs">
        <CardHeader class="pb-3">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle class="text-base font-semibold flex items-center gap-2">
                <BarChart3 class="size-4 text-primary" />
                Vessel Performance Benchmarking (vs Fleet & Peers)
              </CardTitle>
              <CardDescription class="text-xs">
                Compare <span class="font-semibold text-foreground">{{ ciiData.vessel.vesselName }}</span> against the fleet average and sister vessels
              </CardDescription>
            </div>
            <Badge variant="outline" class="text-[11px] w-fit font-medium">
              Rank #{{ ciiData.benchmark.vesselRank }} of {{ ciiData.benchmark.fleetTotalVessels }}
            </Badge>
          </div>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="grid gap-6 lg:grid-cols-12 items-center">
            <!-- Left: Side-by-Side Target Comparison Card (4 cols) -->
            <div class="lg:col-span-4 bg-muted/20 border rounded-xl p-4 space-y-4">
              <div class="flex items-center justify-between border-b pb-2">
                <div class="space-y-0.5">
                  <span class="text-[10px] uppercase font-bold text-muted-foreground">Benchmark Comparison</span>
                  <p class="text-xs font-semibold text-foreground">
                    {{ ciiData.vessel.vesselName }} vs. {{ comparisonData?.name }}
                  </p>
                </div>
                <Badge
                  :variant="comparisonData?.isBetter ? 'default' : 'destructive'"
                  class="text-[10px] font-semibold"
                >
                  {{ comparisonData?.diffPct && comparisonData.diffPct <= 0 ? `${Math.abs(comparisonData.diffPct)}% Better` : `${comparisonData?.diffPct}% Higher` }}
                </Badge>
              </div>

              <div class="grid grid-cols-2 gap-3 text-xs">
                <div class="space-y-1 bg-card p-2.5 rounded-lg border">
                  <span class="text-[10px] text-muted-foreground block truncate">{{ ciiData.vessel.vesselName }}</span>
                  <div class="text-lg font-bold tabular-nums text-foreground">
                    {{ ciiData.summary.attainedCii.toFixed(2) }}
                  </div>
                  <Badge :class="currentRatingInfo.badge" class="text-[9px] py-0 px-1">
                    Rating {{ ciiData.summary.attainedRating }}
                  </Badge>
                </div>

                <div class="space-y-1 bg-card p-2.5 rounded-lg border">
                  <span class="text-[10px] text-muted-foreground block truncate">{{ comparisonData?.name }}</span>
                  <div class="text-lg font-bold tabular-nums text-muted-foreground">
                    {{ comparisonData?.attainedCii.toFixed(2) }}
                  </div>
                  <Badge variant="outline" class="text-[9px] py-0 px-1 border-border">
                    {{ comparisonData?.ratingGrade ? `Rating ${comparisonData.ratingGrade}` : 'Average' }}
                  </Badge>
                </div>
              </div>

              <p class="text-[11px] text-muted-foreground leading-relaxed">
                {{ comparisonData?.description }}. This vessel holds rank <strong>#{{ ciiData.benchmark.vesselRank }}</strong> among {{ ciiData.benchmark.fleetTotalVessels }} operational fleet vessels.
              </p>
            </div>

            <!-- Right: Peer Comparison Bar Chart (8 cols) -->
            <div class="lg:col-span-8">
              <div class="flex items-center justify-between text-xs text-muted-foreground pb-2">
                <span class="font-medium">Fleet Peer Ranking (Attained CII - Lower is Cleaner)</span>
                <span class="text-[11px] flex items-center gap-2">
                  <span class="size-2 rounded-full bg-primary" /> Highlighted: Selected Ship
                </span>
              </div>
              <ClientOnly>
                <BarChart
                  :data="peerChartData"
                  x-field="vessel"
                  y-field="Attained CII"
                  height="220"
                  :option="peerChartOption"
                />
                <template #fallback>
                  <div class="h-[220px] animate-pulse rounded-lg bg-muted/40 flex items-center justify-center text-xs text-muted-foreground">
                    Rendering peer comparison chart...
                  </div>
                </template>
              </ClientOnly>
            </div>
          </div>
        </CardContent>
      </Card>

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
