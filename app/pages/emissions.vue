<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
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
  Sparkles,
  Table2,
  Layers,
} from 'lucide-vue-next'
import SentinelCopilotPanel from '@/components/sentinel/SentinelCopilotPanel.vue'
import CiiImprovementPlanCard from '@/components/emissions/CiiImprovementPlanCard.vue'
import TechnicalTelemetryCard from '@/components/emissions/TechnicalTelemetryCard.vue'
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
import BarChart from '@/components/ui/charts/bar-chart/BarChart.vue'
import PieChart from '@/components/ui/charts/pie-chart/PieChart.vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  MarkAreaComponent,
  MarkPointComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import {
  chartTextColor,
  chartAxisColor,
  chartSplitLineColor,
  chartTooltipBg,
  chartTooltipBorder,
  chartTooltipText,
} from '@/components/ui/charts/useChartTheme'
import type { EmissionsCiiResponse } from '~~/server/api/emissions/cii.get'

use([
  CanvasRenderer,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  MarkAreaComponent,
  MarkPointComponent,
])

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
const benchmarkViewMode = ref<'chart' | 'matrix'>('chart')
const isCopilotOpen = ref<boolean>(false)
const isCopilotFullscreen = ref<boolean>(false)
const copilotPanelRef = ref<any>(null)
const isAuditing = ref<boolean>(false)

async function handleReAudit() {
  isAuditing.value = true
  try {
    await refreshCiiData()
  } finally {
    setTimeout(() => {
      isAuditing.value = false
    }, 600)
  }
}

function askCopilotPrompt(prompt: string) {
  isCopilotOpen.value = true
  copilotPanelRef.value?.askPrompt(prompt)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (isCopilotFullscreen.value) {
      isCopilotFullscreen.value = false
      return
    }
    if (isCopilotOpen.value) {
      isCopilotOpen.value = false
    }
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
    e.preventDefault()
    isCopilotOpen.value = !isCopilotOpen.value
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeydown)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeydown)
  }
})

const emissionsQuickDirectives = computed(() => [
  {
    label: 'Audit CII & Margins',
    query: `Audit the attained CII rating, IMO grade compliance margin, and year-to-date carbon trajectory for ${selectedVessel.value?.name || 'this vessel'}.`,
    icon: Leaf,
  },
  {
    label: 'Speed Reduction to Grade C',
    query: `Simulate hydrodynamic speed reduction scenarios for ${selectedVessel.value?.name || 'this vessel'}. What is the optimal speed cut in knots and percent needed to reach compliant Grade C?`,
    icon: Gauge,
  },
  {
    label: 'Peer Benchmark Comparison',
    query: `Compare ${selectedVessel.value?.name || 'this vessel'} against the fleet average and sister container vessels. Highlight efficiency deltas and ranking.`,
    icon: Scale,
  },
  {
    label: 'EU ETS & Fuel Breakdown',
    query: `Analyze fuel consumption totals (VLSFO vs MGO), transport work, and estimated EU ETS carbon liability for ${selectedVessel.value?.name || 'this vessel'}.`,
    icon: Coins,
  },
])

function handleCopilotAction(action: any) {
  if (typeof action?.scenarioIndex === 'number') {
    activeScenarioIndex.value = action.scenarioIndex
  }
}

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
  key: computed(() => `cii-${selectedVesselId.value}-${selectedYear.value}-${selectedVoyage.value}-${selectedVoyageType.value}`),
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
  watch: [selectedVesselId, selectedYear, selectedVoyage, selectedVoyageType],
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

const ratingGradeColors: Record<string, string> = {
  A: '#2563eb', // Blue
  B: '#059669', // Emerald
  C: '#84cc16', // Lime
  D: '#f59e0b', // Amber
  E: '#e11d48', // Rose
}

const vesselPercentile = computed(() => {
  if (!ciiData.value?.benchmark) return 0
  const rank = ciiData.value.benchmark.vesselRank
  const total = ciiData.value.benchmark.fleetTotalVessels
  if (!total) return 0
  return Math.round(((total - rank + 1) / total) * 100)
})

// Peer comparison chart options with threshold benchmark lines and calm neutral palette
const peerChartOption = computed(() => {
  if (!ciiData.value?.benchmark) return {}
  const fleetAvg = ciiData.value.benchmark.fleetAverageCii
  const req = ciiData.value.summary.requiredCii
  const currentCii = ciiData.value.summary.attainedCii

  return {
    grid: { left: 8, right: 16, top: 28, bottom: 24, containLabel: true },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(15, 23, 42, 0.94)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      textStyle: { color: '#f8fafc', fontSize: 11 },
      formatter: (params: any) => {
        const peer = ciiData.value?.benchmark.peers[params.dataIndex]
        if (!peer) return ''
        const isCurrent = peer.isCurrentVessel ? ' <span style="color:#0ea5e9;font-weight:bold">(Active Ship)</span>' : ''
        const isTarget = !peer.isCurrentVessel && String(peer.vesselId) === compareTargetId.value ? ' <span style="color:#6366f1;font-weight:bold">(Target)</span>' : ''
        const diff = Number((peer.attainedCii - currentCii).toFixed(2))
        const diffPct = Number((((peer.attainedCii - currentCii) / currentCii) * 100).toFixed(1))
        const deltaText = diff === 0
          ? 'Active Vessel Baseline'
          : diff > 0
            ? `+${diff} (${diffPct}% higher intensity)`
            : `${diff} (${Math.abs(diffPct)}% cleaner)`
        return `<div style="font-weight:600;margin-bottom:3px;color:#fff">${peer.vesselName}${isCurrent}${isTarget}</div>
          <div>Attained CII: <b>${peer.attainedCii.toFixed(2)}</b> (Grade <b>${peer.rating}</b>)</div>
          <div>Deadweight: <b>${peer.deadweight.toLocaleString()} MT</b></div>
          <div style="margin-top:3px;color:#94a3b8;border-top:1px solid rgba(255,255,255,0.1);padding-top:2px;">Delta vs Active: <b>${deltaText}</b></div>`
      },
    },
    yAxis: {
      name: 'gCO₂/(MT·NM)',
      nameTextStyle: { fontSize: 10, color: '#888' },
    },
    series: [
      {
        itemStyle: {
          color: (params: any) => {
            const peer = ciiData.value?.benchmark.peers[params.dataIndex]
            if (!peer) return 'rgba(148, 163, 184, 0.28)'
            if (peer.isCurrentVessel) {
              return '#0ea5e9' // Primary blue for active vessel
            }
            if (String(peer.vesselId) === compareTargetId.value) {
              return '#6366f1' // Indigo accent for comparator vessel
            }
            return 'rgba(148, 163, 184, 0.28)' // Calm neutral slate for all fleet peers
          },
          borderRadius: [4, 4, 0, 0],
        },
        markLine: {
          symbol: 'none',
          data: [
            {
              yAxis: fleetAvg,
              name: 'Fleet Avg',
              lineStyle: { color: 'rgba(148, 163, 184, 0.8)', type: 'dashed', width: 1.5 },
              label: { formatter: `Fleet Avg: ${fleetAvg.toFixed(2)}`, position: 'insideEndTop', fontSize: 10, color: '#94a3b8' },
            },
            {
              yAxis: req,
              name: 'IMO Limit',
              lineStyle: { color: 'rgba(239, 68, 68, 0.75)', type: 'dotted', width: 1.5 },
              label: { formatter: `IMO Limit: ${req.toFixed(2)}`, position: 'insideStartTop', fontSize: 10, color: '#ef4444' },
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

// Monthly Rolling CII EChart Options with Rating Zones & Regulatory Cap
const monthlyCiiChartOption = computed(() => {
  if (!ciiData.value?.monthlyTrend || !ciiData.value?.summary?.boundaries) {
    return {}
  }

  const b = ciiData.value.summary.boundaries
  const required = Number(ciiData.value.summary.requiredCii || b.requiredCII || 5.25)
  const trend = ciiData.value.monthlyTrend || []

  // Ensure all boundary values are valid numbers with safe IMO fallback defaults
  const superior = Number(b.superior_boundary || 3.42)
  const lower = Number(b.lower_boundary || 4.65)
  const upper = Number(b.upper_boundary || 5.92)
  const inferior = Number(b.inferior_boundary || 7.35)

  // Find max value across attained values and inferior boundary for clean y-axis framing
  const validVals = trend
    .map((m) => m.attainedCii)
    .filter((v): v is number => v !== null && v !== undefined && v > 0)
  const maxAttained = validVals.length ? Math.max(...validVals) : inferior
  const yAxisMax = Number((Math.max(inferior * 1.25, maxAttained * 1.15)).toFixed(1))

  const categories = trend.map((m) => m.month)
  const seriesData = trend.map((m) => {
    const val = m.attainedCii !== null && m.attainedCii !== undefined ? Number(m.attainedCii.toFixed(2)) : null
    const color = (m.rating && ratingGradeColors[m.rating]) || '#0284c7'
    return {
      value: val,
      month: m.month,
      rating: m.rating,
      co2Mt: m.co2Mt,
      distanceNm: m.distanceNm,
      itemStyle: {
        color,
        borderColor: '#ffffff',
        borderWidth: 2,
        shadowColor: 'rgba(0, 0, 0, 0.25)',
        shadowBlur: 3,
      },
    }
  })

  return {
    grid: {
      left: 44,
      right: 32,
      top: 28,
      bottom: 26,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: chartTooltipBg.value,
      borderColor: chartTooltipBorder.value,
      textStyle: {
        color: chartTooltipText.value,
        fontSize: 11,
      },
      formatter: (params: any) => {
        const item = Array.isArray(params) ? params[0] : params
        if (!item || item.value === null || item.value === undefined) return ''
        const data = item.data || {}
        const val = Number(item.value).toFixed(2)
        const rating = data.rating || 'N/A'
        const badgeBg = ratingGradeColors[rating] || '#0ea5e9'
        const diff = Number((item.value - required).toFixed(2))
        const diffPct = Number((((item.value - required) / required) * 100).toFixed(1))
        const isBetter = diff <= 0

        return `
          <div style="font-weight:600;margin-bottom:6px;border-bottom:1px solid rgba(148,163,184,0.2);padding-bottom:4px;">
            ${data.month || item.name} Performance
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:3px;">
            <span style="opacity:0.8">Attained CII:</span>
            <span><b>${val}</b> gCO₂/(MT·NM)</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:3px;">
            <span style="opacity:0.8">IMO Rating:</span>
            <span style="display:inline-block;padding:1px 6px;border-radius:4px;background:${badgeBg};color:#fff;font-weight:bold;font-size:10px;">
              Grade ${rating}
            </span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:3px;">
            <span style="opacity:0.8">Regulatory Cap:</span>
            <span><b>${required.toFixed(2)}</b></span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:4px;">
            <span style="opacity:0.8">Compliance Delta:</span>
            <span style="color:${isBetter ? '#10b981' : '#ef4444'};font-weight:600">
              ${isBetter ? `${diff} (${Math.abs(diffPct)}% compliant)` : `+${diff} (+${diffPct}% over)`}
            </span>
          </div>
          ${data.co2Mt !== undefined ? `
            <div style="font-size:10px;opacity:0.85;border-top:1px solid rgba(148,163,184,0.2);padding-top:4px;display:flex;justify-content:space-between;gap:12px;">
              <span>CO₂: <b>${data.co2Mt.toLocaleString()} MT</b></span>
              <span>Dist: <b>${(data.distanceNm || 0).toLocaleString()} NM</b></span>
            </div>
          ` : ''}
        `
      },
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        color: chartTextColor.value,
        fontSize: 11,
      },
      axisLine: {
        lineStyle: { color: chartAxisColor.value },
      },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: yAxisMax,
      name: 'gCO₂/(MT·NM)',
      nameTextStyle: {
        fontSize: 10,
        color: chartTextColor.value,
        padding: [0, 0, 0, 8],
      },
      axisLabel: {
        color: chartTextColor.value,
        fontSize: 10,
      },
      axisLine: { show: false },
      splitLine: {
        lineStyle: {
          color: chartSplitLineColor.value,
          type: 'dashed',
          opacity: 0.5,
        },
      },
    },
    series: [
      {
        name: 'Attained CII',
        type: 'line',
        smooth: 0.25,
        data: seriesData,
        connectNulls: true,
        symbol: 'circle',
        symbolSize: 9,
        lineStyle: {
          width: 3,
          color: '#0284c7',
        },
        label: {
          show: true,
          position: 'top',
          formatter: (p: any) => (p.data?.value !== null && p.data?.rating ? `Grade ${p.data.rating}` : ''),
          fontSize: 10,
          fontWeight: 700,
          color: chartTextColor.value,
          distance: 6,
        },
        markArea: {
          silent: true,
          data: [
            // Grade A (Superior)
            [
              {
                yAxis: 0,
                itemStyle: { color: 'rgba(37, 99, 235, 0.07)' },
                label: {
                  show: true,
                  position: 'insideRight',
                  formatter: 'Grade A (Superior)',
                  color: '#2563eb',
                  fontSize: 10,
                  fontWeight: 600,
                  distance: 8,
                },
              },
              { yAxis: superior },
            ],
            // Grade B (Minor Superior)
            [
              {
                yAxis: superior,
                itemStyle: { color: 'rgba(5, 150, 105, 0.07)' },
                label: {
                  show: true,
                  position: 'insideRight',
                  formatter: 'Grade B (Minor Superior)',
                  color: '#059669',
                  fontSize: 10,
                  fontWeight: 600,
                  distance: 8,
                },
              },
              { yAxis: lower },
            ],
            // Grade C (Compliant Target)
            [
              {
                yAxis: lower,
                itemStyle: { color: 'rgba(132, 204, 22, 0.07)' },
                label: {
                  show: true,
                  position: 'insideRight',
                  formatter: 'Grade C (Target)',
                  color: '#84cc16',
                  fontSize: 10,
                  fontWeight: 600,
                  distance: 8,
                },
              },
              { yAxis: upper },
            ],
            // Grade D (Minor Inferior / Warning)
            [
              {
                yAxis: upper,
                itemStyle: { color: 'rgba(245, 158, 11, 0.08)' },
                label: {
                  show: true,
                  position: 'insideRight',
                  formatter: 'Grade D (Warning)',
                  color: '#f59e0b',
                  fontSize: 10,
                  fontWeight: 600,
                  distance: 8,
                },
              },
              { yAxis: inferior },
            ],
            // Grade E (Non-Compliant)
            [
              {
                yAxis: inferior,
                itemStyle: { color: 'rgba(225, 29, 72, 0.08)' },
                label: {
                  show: true,
                  position: 'insideRight',
                  formatter: 'Grade E (Inferior)',
                  color: '#e11d48',
                  fontSize: 10,
                  fontWeight: 600,
                  distance: 8,
                },
              },
              { yAxis: yAxisMax },
            ],
          ],
        },
        markLine: {
          symbol: 'none',
          silent: true,
          data: [
            {
              yAxis: required,
              name: 'IMO Limit',
              lineStyle: {
                color: '#ef4444',
                type: 'dashed',
                width: 2,
              },
              label: {
                formatter: `IMO Cap: ${required.toFixed(2)}`,
                position: 'insideStartTop',
                fontSize: 10,
                fontWeight: 700,
                color: '#ef4444',
                padding: [2, 4],
              },
            },
          ],
        },
      },
    ],
  }
})

// Fuel Mix Donut Chart Data & Theme
const fuelColors = [
  '#0ea5e9', // Sky blue (VLSFO / HFO)
  '#10b981', // Emerald green (LSMGO / MGO)
  '#f59e0b', // Amber (Biofuel)
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
]

const totalFuelBunkered = computed(() => {
  if (!ciiData.value?.fuelBreakdown) return 0
  return ciiData.value.fuelBreakdown.reduce((sum, f) => sum + (f.totalMt || 0), 0)
})

const totalSeaFuel = computed(() => {
  if (!ciiData.value?.fuelBreakdown) return 0
  return ciiData.value.fuelBreakdown.reduce((sum, f) => sum + (f.seaMt || 0), 0)
})

const totalPortFuel = computed(() => {
  if (!ciiData.value?.fuelBreakdown) return 0
  return ciiData.value.fuelBreakdown.reduce((sum, f) => sum + (f.portMt || 0), 0)
})

const seaFuelPercent = computed(() => {
  if (!totalFuelBunkered.value) return 0
  return Number(((totalSeaFuel.value / totalFuelBunkered.value) * 100).toFixed(1))
})

const portFuelPercent = computed(() => {
  if (!totalFuelBunkered.value) return 0
  return Number((100 - seaFuelPercent.value).toFixed(1))
})

const fuelDonutData = computed(() => {
  if (!ciiData.value?.fuelBreakdown) return []
  const total = totalFuelBunkered.value || 1
  return ciiData.value.fuelBreakdown.map((f, i) => {
    const rawPct = (f.totalMt / total) * 100
    return {
      name: f.fuelLabel,
      shortName: f.fuelLabel.split('(')[0].trim(),
      value: Number(f.totalMt.toFixed(1)),
      co2Mt: Number(f.co2Mt.toFixed(1)),
      seaMt: Number(f.seaMt.toFixed(1)),
      portMt: Number(f.portMt.toFixed(1)),
      coefficient: f.coefficient,
      pct: Number(rawPct.toFixed(1)),
      color: fuelColors[i % fuelColors.length],
    }
  })
})

const fuelDonutOption = computed(() => ({
  color: fuelDonutData.value.map((d) => d.color),
  legend: { show: false },
  tooltip: {
    trigger: 'item',
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    textStyle: { color: '#f8fafc', fontSize: 11 },
    formatter: (params: any) => {
      const item = fuelDonutData.value[params.dataIndex]
      if (!item) return ''
      return `<div style="font-weight:600;margin-bottom:4px;color:#fff">${item.name}</div>
        <div>Total Bunkers: <b>${item.value.toLocaleString()} MT</b> (${item.pct}%)</div>
        <div>At Sea: <b>${item.seaMt.toLocaleString()} MT</b></div>
        <div>In Port: <b>${item.portMt.toLocaleString()} MT</b></div>
        <div style="margin-top:3px;color:#94a3b8;border-top:1px solid rgba(255,255,255,0.1);padding-top:2px;">CO₂: <b>${item.co2Mt.toLocaleString()} MT</b></div>`
    },
  },
  series: [
    {
      radius: ['62%', '84%'],
      center: ['50%', '50%'],
      label: { show: false },
      itemStyle: {
        borderRadius: 4,
        borderColor: 'transparent',
        borderWidth: 2,
      },
    },
  ],
}))
</script>

<template>
  <div class="flex flex-1 min-h-[calc(100svh-3.5rem)] w-full relative">
    <!-- Main Dashboard Area (Contracts smoothly when Copilot Sidebar is docked) -->
    <div
      :class="[
        'flex-1 min-w-0 space-y-6 p-4 md:p-6 pb-12 transition-[margin] duration-350 ease-[cubic-bezier(0.16,1,0.3,1)]',
        isCopilotOpen && !isCopilotFullscreen ? 'lg:mr-[440px] xl:mr-[480px]' : ''
      ]"
    >
      <!-- Header Controls & Filters -->
      <div class="sticky top-14 z-20 -mx-4 md:-mx-6 -mt-4 md:-mt-6 px-4 md:px-6 py-3.5 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border shadow-xs flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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

          <!-- AI Copilot Button -->
          <Button
            variant="outline"
            size="sm"
            :class="[
              'h-8 text-xs gap-1.5 cursor-pointer font-medium transition-colors',
              isCopilotOpen ? 'bg-primary/10 border-primary/50 text-primary font-semibold' : 'text-foreground'
            ]"
            title="Toggle AI Marine Copilot (⌘J)"
            @click="isCopilotOpen = !isCopilotOpen"
          >
            <Sparkles class="size-3.5 text-primary" />
            <span>Copilot</span>
            <span class="text-[10px] font-mono opacity-70 border border-current/30 rounded px-1 hidden sm:inline">⌘J</span>
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
        <CardHeader class="pb-3 border-b border-border/40">
          <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <CardTitle class="text-base font-semibold flex items-center gap-2">
                  <BarChart3 class="size-4 text-primary" />
                  Vessel Performance Benchmarking
                </CardTitle>
                <Badge variant="outline" class="text-[10px] font-mono border-border text-muted-foreground">
                  Rank #{{ ciiData.benchmark.vesselRank }} of {{ ciiData.benchmark.fleetTotalVessels }} (Top {{ vesselPercentile }}%)
                </Badge>
              </div>
              <CardDescription class="text-xs mt-0.5">
                Benchmark <span class="font-medium text-foreground">{{ ciiData.vessel.vesselName }}</span> against fleet distribution and sister vessels
              </CardDescription>
            </div>

            <!-- Header Controls: View Toggle -->
            <div class="flex items-center gap-2.5">

              <!-- View Mode Toggle Buttons -->
              <div class="flex items-center rounded-lg border border-border/60 bg-muted/30 p-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  :class="[
                    'h-7 px-2.5 text-xs gap-1.5 cursor-pointer font-medium transition-colors',
                    benchmarkViewMode === 'chart' ? 'bg-card text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'
                  ]"
                  @click="benchmarkViewMode = 'chart'"
                >
                  <BarChart3 class="size-3.5" />
                  <span class="hidden sm:inline">Chart</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  :class="[
                    'h-7 px-2.5 text-xs gap-1.5 cursor-pointer font-medium transition-colors',
                    benchmarkViewMode === 'matrix' ? 'bg-card text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'
                  ]"
                  @click="benchmarkViewMode = 'matrix'"
                >
                  <Table2 class="size-3.5" />
                  <span class="hidden sm:inline">Peer Matrix</span>
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent class="p-5 space-y-6">
          <div class="grid gap-6 lg:grid-cols-12 items-stretch">
            <!-- Left: Side-by-Side Target Comparison Card (4 cols) -->
            <div class="lg:col-span-4 rounded-xl border border-border/60 bg-muted/15 p-4 sm:p-5 flex flex-col justify-between gap-4">
              <div class="space-y-4">
                <div class="flex items-center justify-between gap-2">
                  <div>
                    <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Head-to-Head Delta</span>
                    <div class="text-xs font-medium text-foreground truncate max-w-[200px]">
                      vs. {{ comparisonData?.name }}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    class="text-[10px] font-medium"
                    :class="comparisonData?.isBetter ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5' : 'border-amber-500/30 text-amber-500 bg-amber-500/5'"
                  >
                    {{ comparisonData?.diffPct && comparisonData.diffPct <= 0 ? `${Math.abs(comparisonData.diffPct)}% Cleaner` : `+${comparisonData?.diffPct}% Intensity` }}
                  </Badge>
                </div>

                <!-- Side-by-side metric display -->
                <div class="grid grid-cols-2 gap-3">
                  <div class="rounded-lg border border-border/50 bg-card p-3 space-y-1">
                    <div class="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span class="truncate font-medium">{{ ciiData.vessel.vesselName }}</span>
                      <span class="size-1.5 rounded-full bg-primary" />
                    </div>
                    <div class="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                      {{ ciiData.summary.attainedCii.toFixed(2) }}
                    </div>
                    <div class="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span class="font-semibold text-foreground">Grade {{ ciiData.summary.attainedRating }}</span>
                      <span>•</span>
                      <span>{{ formatNumber(ciiData.vessel.deadweight, 0) }} DWT</span>
                    </div>
                  </div>

                  <div class="rounded-lg border border-border/50 bg-card p-3 space-y-1">
                    <div class="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span class="truncate font-medium">{{ comparisonData?.name }}</span>
                      <span class="size-1.5 rounded-full" :class="compareTargetId === 'fleet' ? 'bg-muted-foreground' : 'bg-indigo-500'" />
                    </div>
                    <div class="text-2xl font-bold tracking-tight text-muted-foreground tabular-nums">
                      {{ comparisonData?.attainedCii.toFixed(2) }}
                    </div>
                    <div class="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span class="font-semibold text-foreground">{{ comparisonData?.ratingGrade ? `Grade ${comparisonData.ratingGrade}` : 'Benchmark' }}</span>
                      <span>•</span>
                      <span>Target</span>
                    </div>
                  </div>
                </div>

                <!-- Variance Details -->
                <div class="text-xs space-y-1 pt-1">
                  <div class="flex items-center justify-between text-[11px]">
                    <span class="text-muted-foreground">Intensity Gap</span>
                    <span
                      class="font-mono font-semibold"
                      :class="comparisonData?.isBetter ? 'text-emerald-500' : 'text-amber-500'"
                    >
                      {{ comparisonData?.diffCii && comparisonData.diffCii > 0 ? '+' : '' }}{{ comparisonData?.diffCii }} gCO₂/(MT·NM)
                    </span>
                  </div>
                  <p class="text-[11px] text-muted-foreground leading-relaxed pt-0.5">
                    {{ comparisonData?.description }}.
                  </p>
                </div>
              </div>

              <!-- Ask Copilot CTA -->
              <Button
                variant="outline"
                size="sm"
                class="w-full text-xs gap-1.5 h-8 border-border text-foreground hover:bg-muted/50 cursor-pointer font-medium"
                @click="askCopilotPrompt(`Compare ${ciiData?.vessel.vesselName} against ${comparisonData?.name}. Analyze the efficiency gap, rating variance, and suggest operational adjustments.`)"
              >
                <Sparkles class="size-3.5 text-primary" />
                <span>Ask Copilot to Audit Delta</span>
              </Button>
            </div>

            <!-- Right: Peer Comparison Bar Chart OR Peer Matrix Table (8 cols) -->
            <div class="lg:col-span-8 flex flex-col justify-between">
              <!-- Bar Chart View -->
              <div v-if="benchmarkViewMode === 'chart'" class="space-y-2">
                <div class="flex flex-wrap items-center justify-between text-xs text-muted-foreground pb-1 gap-2">
                  <span class="font-medium text-[11px]">Fleet Carbon Intensity Distribution</span>
                  <div class="flex items-center gap-3.5 text-[11px]">
                    <span class="inline-flex items-center gap-1.5 text-foreground font-medium">
                      <span class="size-2 rounded-full bg-primary" /> Active Vessel
                    </span>
                    <span v-if="compareTargetId !== 'fleet'" class="inline-flex items-center gap-1.5 text-indigo-500 font-medium">
                      <span class="size-2 rounded-full bg-indigo-500" /> Target
                    </span>
                    <span class="inline-flex items-center gap-1.5 text-muted-foreground">
                      <span class="w-3 h-0.5 border-b border-dashed border-muted-foreground" /> Fleet Avg
                    </span>
                    <span class="inline-flex items-center gap-1.5 text-destructive font-medium">
                      <span class="w-3 h-0.5 border-b border-dotted border-destructive" /> IMO Limit
                    </span>
                  </div>
                </div>
                <ClientOnly>
                  <BarChart
                    :data="peerChartData"
                    x-field="vessel"
                    y-field="Attained CII"
                    height="260"
                    :option="peerChartOption"
                  />
                  <template #fallback>
                    <div class="h-[260px] animate-pulse rounded-lg bg-muted/40 flex items-center justify-center text-xs text-muted-foreground">
                      Rendering peer comparison chart...
                    </div>
                  </template>
                </ClientOnly>
              </div>

              <!-- Peer Matrix Table View -->
              <div v-else class="border rounded-xl overflow-hidden">
                <div class="max-h-[280px] overflow-y-auto">
                  <Table>
                    <TableHeader class="sticky top-0 bg-muted/80 backdrop-blur-xs z-10">
                      <TableRow class="hover:bg-transparent text-[11px]">
                        <TableHead class="w-12 font-semibold">Rank</TableHead>
                        <TableHead class="font-semibold">Vessel Name</TableHead>
                        <TableHead class="text-right font-semibold">DWT (MT)</TableHead>
                        <TableHead class="text-right font-semibold">Attained CII</TableHead>
                        <TableHead class="text-center font-semibold">Rating</TableHead>
                        <TableHead class="text-right font-semibold">Delta vs Active</TableHead>
                        <TableHead class="text-right font-semibold w-24">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow
                        v-for="(peer, pIdx) in ciiData.benchmark.peers"
                        :key="peer.vesselId"
                        :class="[
                          'text-xs transition-colors',
                          peer.isCurrentVessel ? 'bg-primary/10 font-semibold hover:bg-primary/15' : 'hover:bg-muted/40'
                        ]"
                      >
                        <TableCell class="py-2 font-mono text-muted-foreground">
                          #{{ pIdx + 1 }}
                        </TableCell>
                        <TableCell class="py-2 font-medium">
                          <div class="flex items-center gap-1.5">
                            <span
                              class="size-2 rounded-full shrink-0"
                              :class="peer.isCurrentVessel ? 'bg-primary' : 'bg-muted-foreground/40'"
                            />
                            <span class="truncate">{{ peer.vesselName }}</span>
                            <Badge v-if="peer.isCurrentVessel" variant="outline" class="text-[9px] px-1 py-0 border-primary/50 text-primary">
                              Active
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell class="text-right tabular-nums py-2 text-muted-foreground">
                          {{ formatNumber(peer.deadweight, 0) }}
                        </TableCell>
                        <TableCell class="text-right tabular-nums py-2 font-semibold">
                          {{ peer.attainedCii.toFixed(2) }}
                        </TableCell>
                        <TableCell class="text-center py-2">
                          <Badge
                            variant="outline"
                            class="text-[9px] px-1.5 py-0 font-semibold border-border"
                          >
                            {{ peer.rating }}
                          </Badge>
                        </TableCell>
                        <TableCell class="text-right tabular-nums py-2">
                          <span
                            v-if="!peer.isCurrentVessel"
                            :class="peer.attainedCii <= ciiData.summary.attainedCii ? 'text-emerald-500 font-medium' : 'text-amber-500 font-medium'"
                          >
                            {{ (peer.attainedCii - ciiData.summary.attainedCii) > 0 ? '+' : '' }}{{ (peer.attainedCii - ciiData.summary.attainedCii).toFixed(2) }}
                          </span>
                          <span v-else class="text-muted-foreground">—</span>
                        </TableCell>
                        <TableCell class="text-right py-2">
                          <Button
                            v-if="!peer.isCurrentVessel"
                            variant="ghost"
                            size="sm"
                            class="h-6 px-2 text-[10px] cursor-pointer"
                            :class="String(peer.vesselId) === compareTargetId ? 'bg-primary/10 text-primary font-semibold' : ''"
                            @click="compareTargetId = String(peer.vesselId)"
                          >
                            {{ String(peer.vesselId) === compareTargetId ? 'Comparing' : 'Compare' }}
                          </Button>
                          <span v-else class="text-[10px] text-primary font-medium">Selected</span>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Sentinel Decarbonization Triage Advisory -->
      <div
        v-if="ciiData?.summary"
        :class="[
          'rounded-xl border p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 transition-colors',
          ciiData.summary.attainedRating === 'E' || ciiData.summary.attainedRating === 'D'
            ? 'border-amber-500/30 bg-amber-500/5'
            : 'border-border/80 bg-card/60'
        ]"
      >
        <div class="flex items-start sm:items-center gap-3 min-w-0">
          <div
            :class="[
              'size-8 rounded-lg flex items-center justify-center shrink-0 border',
              ciiData.summary.attainedRating === 'E' || ciiData.summary.attainedRating === 'D'
                ? 'bg-amber-500/10 border-amber-500/25 text-amber-500'
                : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-500'
            ]"
          >
            <Sparkles class="size-4" />
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs font-semibold tracking-tight text-foreground">
                Sentinel Marine Copilot · Decarbonization Advisory
              </span>
              <Badge
                variant="outline"
                :class="[
                  'text-[9px] font-mono px-1.5 py-0 uppercase',
                  ciiData.summary.attainedRating === 'E' || ciiData.summary.attainedRating === 'D'
                    ? 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10'
                    : 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                ]"
              >
                {{ ciiData.summary.attainedRating === 'E' || ciiData.summary.attainedRating === 'D' ? 'Advisory Active' : 'Compliant Run-Rate' }}
              </Badge>
            </div>
            <p class="text-xs text-muted-foreground mt-0.5 leading-normal">
              {{ ciiData.summary.attainedRating === 'E' || ciiData.summary.attainedRating === 'D'
                ? `${ciiData.vessel.vesselName} is ${ciiData.summary.marginPercent > 0 ? '+' + ciiData.summary.marginPercent + '%' : ''} over regulatory threshold (Grade ${ciiData.summary.attainedRating}). Copilot projects a 10% speed reduction achieves Grade C compliance with ~${Math.round(ciiData.summary.totalCo2Mt * 0.27)} MT CO₂ saved.`
                : `${ciiData.vessel.vesselName} is operating in superior Grade ${ciiData.summary.attainedRating} (${Math.abs(ciiData.summary.marginPercent)}% better than IMO target). EU ETS exposure estimated at €${ciiData.summary.euEtsCostEur.toLocaleString()}.`
              }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <Button
            size="sm"
            variant="outline"
            class="h-7 text-xs gap-1.5 border-border hover:bg-muted/60 text-foreground cursor-pointer font-medium"
            @click="askCopilotPrompt(`Provide a comprehensive decarbonization audit and speed reduction advisory for ${ciiData?.vessel.vesselName}. Explain how to reach Grade C and reduce EU ETS exposure.`)"
          >
            <Sparkles class="size-3.5 text-primary" />
            <span>Ask Copilot to Triage</span>
          </Button>
        </div>
      </div>

      <!-- CII Improvement Plan & Root-Cause Diagnosis Section -->
      <CiiImprovementPlanCard
        v-if="ciiData?.improvementPlan"
        :improvement-plan="ciiData.improvementPlan"
        :speed-scenarios="ciiData.speedReductionAdvisory"
        :active-scenario-index="activeScenarioIndex"
        :vessel-name="ciiData.vessel.vesselName"
        :is-auditing="isAuditing"
        @update:active-scenario-index="activeScenarioIndex = $event"
        @re-audit="handleReAudit"
      />

      <!-- Fuel Mix & Operational Consumption Card -->
      <Card class="shadow-xs flex flex-col">
          <CardHeader class="pb-3 border-b border-border/40">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle class="text-base font-semibold flex items-center gap-2">
                  <Fuel class="size-4 text-primary" />
                  Fuel Mix & Operational Consumption
                </CardTitle>
                <CardDescription class="text-xs">
                  At-Sea vs. At-Port fuel consumption and resulting carbon emissions
                </CardDescription>
              </div>
              <div class="flex items-center gap-2">
                <Badge variant="outline" class="text-[10px] font-mono border-primary/30 text-primary">
                  {{ ciiData.fuelBreakdown.length }} Grades
                </Badge>
                <Badge variant="outline" class="text-[10px] font-mono">
                  {{ seaFuelPercent }}% Sea / {{ portFuelPercent }}% Port
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent class="p-4 pt-4 flex-1 flex flex-col justify-between space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <!-- Donut Chart Left Column (5 cols) -->
              <div class="md:col-span-5 flex flex-col items-center justify-center relative">
                <div class="relative w-full max-w-[200px] aspect-square flex items-center justify-center">
                  <ClientOnly>
                    <PieChart
                      :data="fuelDonutData"
                      :donut="true"
                      name-field="name"
                      value-field="value"
                      height="190"
                      :option="fuelDonutOption"
                    />
                    <template #fallback>
                      <div class="size-[190px] rounded-full border-8 border-muted/40 animate-pulse flex items-center justify-center" />
                    </template>
                  </ClientOnly>
                  <!-- Total Fuel in Center -->
                  <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span class="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Total Fuel</span>
                    <span class="text-lg font-extrabold tracking-tight text-foreground tabular-nums">
                      {{ formatNumber(totalFuelBunkered, 0) }}
                    </span>
                    <span class="text-[10px] text-muted-foreground font-medium">MT Bunkered</span>
                  </div>
                </div>

                <!-- Structured Fuel Legend -->
                <div class="w-full space-y-1.5 mt-2">
                  <div
                    v-for="item in fuelDonutData"
                    :key="item.name"
                    class="flex items-center justify-between text-xs px-2.5 py-1 rounded-md bg-muted/30 border border-border/50"
                  >
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="size-2 rounded-full shrink-0" :style="{ backgroundColor: item.color }" />
                      <span class="font-medium text-foreground truncate text-xs">{{ item.name }}</span>
                    </div>
                    <div class="flex items-center gap-2 shrink-0 tabular-nums">
                      <span class="text-muted-foreground text-xs">{{ formatNumber(item.value, 1) }} MT</span>
                      <Badge variant="secondary" class="text-[10px] px-1.5 py-0 font-semibold font-mono">
                        {{ item.pct }}%
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Fuel & Emissions Breakdown Table Right Column (7 cols) -->
              <div class="md:col-span-7 flex flex-col justify-between space-y-3 overflow-x-auto border-t md:border-t-0 md:border-l border-border/60 pt-4 md:pt-0 md:pl-5">
                <Table>
                  <TableHeader>
                    <TableRow class="hover:bg-transparent text-[11px] border-b border-border/70">
                      <TableHead class="font-semibold">Fuel Grade</TableHead>
                      <TableHead class="text-right font-semibold">Sea (MT)</TableHead>
                      <TableHead class="text-right font-semibold">Port (MT)</TableHead>
                      <TableHead class="text-right font-semibold">Total (MT)</TableHead>
                      <TableHead class="text-right font-semibold hidden sm:table-cell">CF</TableHead>
                      <TableHead class="text-right font-semibold">CO₂ (MT)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow
                      v-for="(fuel, idx) in ciiData.fuelBreakdown"
                      :key="fuel.fuelType"
                      class="text-xs hover:bg-muted/40 transition-colors"
                    >
                      <TableCell class="font-medium text-foreground py-2.5">
                        <div class="flex items-center gap-2">
                          <span
                            class="size-2 rounded-full shrink-0"
                            :style="{ backgroundColor: fuelColors[idx % fuelColors.length] }"
                          />
                          <span class="truncate font-medium">{{ fuel.fuelLabel }}</span>
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
                      <TableCell class="text-right tabular-nums text-muted-foreground py-2.5 hidden sm:table-cell">
                        {{ fuel.coefficient.toFixed(3) }}
                      </TableCell>
                      <TableCell class="text-right tabular-nums font-bold text-foreground py-2.5">
                        {{ formatNumber(fuel.co2Mt, 1) }}
                      </TableCell>
                    </TableRow>
                    <!-- Total Summary Row -->
                    <TableRow class="border-t-2 border-border/80 bg-muted/20 font-semibold text-xs">
                      <TableCell class="py-2.5 text-foreground">
                        Total
                      </TableCell>
                      <TableCell class="text-right tabular-nums py-2.5 text-foreground/90">
                        {{ formatNumber(totalSeaFuel, 1) }}
                      </TableCell>
                      <TableCell class="text-right tabular-nums py-2.5 text-foreground/90">
                        {{ formatNumber(totalPortFuel, 1) }}
                      </TableCell>
                      <TableCell class="text-right tabular-nums py-2.5 text-foreground font-bold">
                        {{ formatNumber(totalFuelBunkered, 1) }}
                      </TableCell>
                      <TableCell class="text-right tabular-nums py-2.5 text-muted-foreground hidden sm:table-cell">
                        —
                      </TableCell>
                      <TableCell class="text-right tabular-nums py-2.5 text-primary font-bold">
                        {{ formatNumber(ciiData.summary.totalCo2Mt, 1) }}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                <!-- Operational Mode Segmented Progress Bar -->
                <div class="p-3 rounded-xl bg-muted/30 border border-border/50 space-y-2 mt-2">
                  <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center gap-2">
                      <span class="size-2 rounded-full bg-primary" />
                      <span class="font-medium text-foreground">At Sea (Propulsion)</span>
                      <span class="text-muted-foreground tabular-nums text-[11px]">({{ formatNumber(totalSeaFuel, 1) }} MT)</span>
                    </div>
                    <span class="font-bold text-primary tabular-nums">{{ seaFuelPercent }}%</span>
                  </div>
                  <div class="h-2 w-full rounded-full bg-muted overflow-hidden flex shadow-inner">
                    <div
                      class="bg-primary h-full transition-all duration-500 rounded-l-full"
                      :style="{ width: `${seaFuelPercent}%` }"
                    />
                    <div
                      class="bg-amber-500 h-full transition-all duration-500 rounded-r-full"
                      :style="{ width: `${portFuelPercent}%` }"
                    />
                  </div>
                  <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center gap-2">
                      <span class="size-2 rounded-full bg-amber-500" />
                      <span class="font-medium text-foreground">In Port (Auxiliary / Boiler)</span>
                      <span class="text-muted-foreground tabular-nums text-[11px]">({{ formatNumber(totalPortFuel, 1) }} MT)</span>
                    </div>
                    <span class="font-bold text-amber-500 tabular-nums">{{ portFuelPercent }}%</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      <!-- Technical Performance & Diagnostic Telemetry (Unified Tabbed Studio) -->
      <TechnicalTelemetryCard
        v-if="ciiData?.performanceWidgets"
        :key="`telemetry-${selectedVesselId}-${selectedYear}`"
        :vessel-id="parseInt(selectedVesselId, 10)"
        :vessel-name="ciiData.vessel.vesselName"
        :deadweight="ciiData.vessel.deadweight"
        :weather="ciiData.performanceWidgets.weather"
        :propulsion="ciiData.performanceWidgets.propulsion"
        :engine="ciiData.performanceWidgets.engine"
        :operations="ciiData.performanceWidgets.operations"
      />

      <!-- Chronological Monthly Trend Chart with IMO Rating Zones -->
      <Card class="shadow-xs">
        <CardHeader class="pb-2">
          <div class="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div class="flex items-center gap-2">
                <CardTitle class="text-base font-semibold">Monthly Rolling CII Performance</CardTitle>
                <Badge variant="outline" class="text-[10px] font-medium border-border">
                  IMO MEPC.338(76) Bands
                </Badge>
              </div>
              <CardDescription class="text-xs mt-0.5">
                Monthly attained intensity plotted against IMO Rating Zones (A–E) and regulatory cap ({{ ciiData.summary.requiredCii.toFixed(2) }})
              </CardDescription>
            </div>
            
            <!-- Rating Zones & Cap Legend Badges -->
            <div class="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                <span class="size-2 rounded-full bg-blue-500" /> Grade A &le; {{ ciiData.summary.boundaries?.superior_boundary?.toFixed(2) }}
              </span>
              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                <span class="size-2 rounded-full bg-emerald-500" /> Grade B &le; {{ ciiData.summary.boundaries?.lower_boundary?.toFixed(2) }}
              </span>
              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-lime-500/10 text-lime-700 dark:text-lime-400 font-medium">
                <span class="size-2 rounded-full bg-lime-500" /> Grade C &le; {{ ciiData.summary.boundaries?.upper_boundary?.toFixed(2) }}
              </span>
              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                <span class="size-2 rounded-full bg-amber-500" /> Grade D &le; {{ ciiData.summary.boundaries?.inferior_boundary?.toFixed(2) }}
              </span>
              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium">
                <span class="size-2 rounded-full bg-rose-500" /> Grade E &gt; {{ ciiData.summary.boundaries?.inferior_boundary?.toFixed(2) }}
              </span>
              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-destructive/40 text-destructive font-medium ml-0.5">
                <span class="w-2.5 border-t-2 border-dashed border-destructive" /> Cap: {{ ciiData.summary.requiredCii?.toFixed(2) }}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent class="pt-1">
          <div class="h-[280px] w-full" :style="{ height: '280px', minHeight: '280px' }">
            <ClientOnly>
              <VChart
                :option="monthlyCiiChartOption"
                autoresize
                class="size-full"
                :style="{ height: '280px', width: '100%' }"
              />
              <template #fallback>
                <div class="h-[280px] animate-pulse rounded-lg bg-muted/40 flex items-center justify-center text-xs text-muted-foreground">
                  Rendering timeline chart...
                </div>
              </template>
            </ClientOnly>
          </div>
        </CardContent>
      </Card>
    </div>
    </div>

    <!-- AI Emissions Copilot Panel -->
    <SentinelCopilotPanel
      ref="copilotPanelRef"
      v-model="isCopilotOpen"
      v-model:fullscreen="isCopilotFullscreen"
      :title="`${selectedVessel?.name || 'Vessel'} Emissions Copilot`"
      subtitle="CII Compliance & Speed Advisory"
      badge-text="AI Decarb"
      :quick-directives="emissionsQuickDirectives"
      :active-context="{
        vesselId: parseInt(selectedVesselId, 10),
        vesselName: selectedVessel?.name,
        year: parseInt(selectedYear, 10),
        attainedCii: ciiData?.summary?.attainedCii,
        requiredCii: ciiData?.summary?.requiredCii,
        rating: ciiData?.summary?.attainedRating,
        rank: ciiData?.benchmark?.vesselRank,
        totalVessels: ciiData?.benchmark?.fleetTotalVessels,
        fleetAverageCii: ciiData?.benchmark?.fleetAverageCii,
      }"
      placeholder="Ask about CII rating, speed reduction to reach Grade C, or EU ETS..."
      initial-message="Emissions & CII Copilot ready. Ask questions about vessel compliance, simulate speed reduction scenarios, or choose an advisory directive below."
      @apply-action="handleCopilotAction"
    />
  </div>
</template>
