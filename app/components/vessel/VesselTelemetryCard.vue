<script setup lang="ts">
import { ref, computed } from 'vue'
import { Info } from 'lucide-vue-next'
import { useVesselDashboard } from '~/composables/useVesselDashboard'
import { formatShaftPower } from '~/lib/vessel-analytics'

const { dashboardState } = useVesselDashboard()
const currentCarouselIndex = ref<number>(0)

const carouselData = computed(() => {
  return dashboardState.value?.widget_1?.configuration?.body?.data || null
})

interface MetricItem {
  caption: string
  value: string | number
  unit: string
}

interface MetricGroup {
  title: string
  metrics: MetricItem[]
}

// Fallback baseline metrics matching SmartShip production screenshot
const baselineCarousel1: MetricGroup[] = [
  {
    title: 'Fuel and Vessel Speed',
    metrics: [
      { caption: 'ME FUEL CONS. RATE', value: '-4.80', unit: 'Kg/hr' },
      { caption: 'AE FUEL CONS. RATE', value: '99.69', unit: 'Kg/hr' },
      { caption: 'Speed Over Ground', value: '0.00', unit: 'kn' },
      { caption: 'Speed Through Water', value: '0.00', unit: 'knot' },
      { caption: 'ME SFOC (SPM)', value: 'NA', unit: 'g/kwhr' },
      { caption: 'ME SFOC (EST.LOAD)', value: '0.00', unit: 'g/kwhr' },
    ],
  },
  {
    title: 'Shaft Power Meter',
    metrics: [
      { caption: 'SHAFT POWER', value: '0.00', unit: 'kW' },
      { caption: 'SHAFT TORQUE', value: '0.00', unit: 'kNm' },
      { caption: '%MCR', value: '0.00', unit: '%' },
      { caption: 'SHAFT RPM', value: '0.00', unit: 'rpm' },
      { caption: 'EST.ENGINE LOAD(ME EST.POWER)', value: '0.00', unit: 'kW' },
      { caption: 'MEAN DRAFT', value: '—', unit: 'm' },
    ],
  },
]

const baselineCarousel2: MetricGroup[] = [
  {
    title: 'Fuel',
    metrics: [
      { caption: 'TOTAL FUEL CONS.', value: '2.28', unit: 't/day' },
      { caption: 'BOILER FUEL CONS. RATE', value: '-2240.00', unit: 'Kg/hr' },
      { caption: 'FUEL CONS. IN KG/NM', value: 'NA', unit: 'kg/nm' },
      { caption: 'ME SUPPLY LINE TEMP', value: '54.00', unit: '°C' },
      { caption: 'AE SUPPLY LINE TEMP', value: '70.00', unit: '°C' },
      { caption: 'FO DENSITY', value: '0.90', unit: 'T/m3' },
    ],
  },
  {
    title: 'Navigation',
    metrics: [
      { caption: 'Rel. Wind Speed', value: '7.00', unit: 'kn' },
      { caption: 'Rel. Wind Direction', value: '115.00', unit: 'deg' },
      { caption: 'Vessel Heading', value: '6.90', unit: 'deg' },
      { caption: 'Vessel Course', value: '132.70', unit: 'deg' },
      { caption: 'True Wind Speed', value: '6.80', unit: 'kn' },
      { caption: 'True Wind Direction', value: '112.00', unit: 'deg' },
    ],
  },
]

const baselineCarousel3: MetricGroup[] = [
  {
    title: 'Navigation',
    metrics: [
      { caption: 'Rate Of Turn', value: '0.00', unit: 'deg/min' },
      { caption: 'Dep. Below Draft', value: '7.30', unit: 'm' },
      { caption: 'AIS Nav Status', value: 'Moored', unit: '' },
      { caption: 'Pitch Angle', value: '0.10', unit: 'deg' },
      { caption: 'Roll Angle', value: '0.20', unit: 'deg' },
      { caption: 'Drift Speed', value: '0.00', unit: 'kn' },
    ],
  },
  {
    title: 'Sea Condition',
    metrics: [
      { caption: 'Wave Height', value: '0.65', unit: 'm' },
      { caption: 'Wave Direction', value: '220.24', unit: 'deg' },
      { caption: 'Swell Height', value: '0.66', unit: 'm' },
      { caption: 'Swell Direction', value: '207.37', unit: 'deg' },
      { caption: 'Current Speed', value: '0.03', unit: 'kn' },
      { caption: 'Current Direction', value: '156.50', unit: 'deg' },
    ],
  },
]

function extractGroup(groupObj: any, fallback: MetricGroup): MetricGroup {
  if (!groupObj?.data) return fallback
  const title = groupObj.widgetData?.caption || groupObj.caption || fallback.title
  const metrics: MetricItem[] = []

  const rows = groupObj.data
  const sortedRowKeys = Object.keys(rows).sort()

  for (const rKey of sortedRowKeys) {
    const row = rows[rKey]
    const colData = row?.colData || {}
    if (colData.col1?.widgetData?.caption) {
      const w = colData.col1.widgetData
      let val = w.value !== null && w.value !== undefined && w.value !== '' ? w.value : '0.00'
      let unit = w.unit || ''
      if (w.caption?.toUpperCase().includes('SHAFT POWER') || w.caption?.toUpperCase().includes('EST.POWER')) {
        const p = formatShaftPower(val)
        val = p.kwFormatted
        unit = 'kW'
      }
      metrics.push({
        caption: w.caption,
        value: val,
        unit,
      })
    }
    if (colData.col2?.widgetData?.caption) {
      const w = colData.col2.widgetData
      let val = w.value !== null && w.value !== undefined && w.value !== '' ? w.value : '0.00'
      let unit = w.unit || ''
      if (w.caption?.toUpperCase().includes('SHAFT POWER') || w.caption?.toUpperCase().includes('EST.POWER')) {
        const p = formatShaftPower(val)
        val = p.kwFormatted
        unit = 'kW'
      }
      metrics.push({
        caption: w.caption,
        value: val,
        unit,
      })
    }
  }

  if (metrics.length === 0) return fallback
  return { title, metrics: metrics.slice(0, 6) }
}

const currentGroups = computed<MetricGroup[]>(() => {
  const cData = carouselData.value
  const idx = currentCarouselIndex.value

  if (idx === 0) {
    const rawC1 = cData?.carousel1
    if (!rawC1) return baselineCarousel1
    const g1 = extractGroup(rawC1.group1, baselineCarousel1[0])
    const g2 = extractGroup(rawC1.group2, baselineCarousel1[1])
    return [g1, g2]
  } else if (idx === 1) {
    const rawC2 = cData?.carousel2
    if (!rawC2) return baselineCarousel2
    const g1 = extractGroup(rawC2.group1, baselineCarousel2[0])
    const g2 = extractGroup(rawC2.group2, baselineCarousel2[1])
    return [g1, g2]
  } else {
    const rawC3 = cData?.carousel3
    if (!rawC3) return baselineCarousel3
    const g1 = extractGroup(rawC3.group1, baselineCarousel3[0])
    const g2 = extractGroup(rawC3.group2, baselineCarousel3[1])
    return [g1, g2]
  }
})
</script>

<template>
  <div class="flex h-full flex-col justify-between rounded bg-[#1e1f23] border border-[#2a2b2f] p-3 text-xs shadow-md">
    <!-- Metric Groups (Top and Bottom) -->
    <div class="flex-1 space-y-3">
      <div
        v-for="(group, gIdx) in currentGroups"
        :key="gIdx"
        class="flex flex-col"
        :class="{ 'border-t border-[#2a2b2f] pt-2.5 mt-1': gIdx > 0 }"
      >
        <!-- Group Header -->
        <div class="flex items-center justify-between pb-1 mb-2 border-b border-[#282a2e]">
          <h3 class="text-[11px] font-bold uppercase tracking-wider text-[#33b5e5]">
            {{ group.title }}
          </h3>
        </div>

        <!-- 2-Column Metrics Grid -->
        <div class="grid grid-cols-2 gap-x-3 gap-y-2">
          <div
            v-for="(metric, mIdx) in group.metrics"
            :key="mIdx"
            class="flex flex-col justify-center rounded bg-[#17181b] border border-[#26272b] px-2.5 py-1.5 transition-colors hover:border-[#33b5e5]/40"
          >
            <!-- Top line: Value + Unit + Icon -->
            <div class="flex items-baseline justify-between gap-1">
              <div class="flex items-baseline gap-1 font-mono">
                <span class="text-sm font-bold text-white tracking-tight">
                  {{ metric.value }}
                </span>
                <span class="text-[10px] text-[#8e8e8e]">
                  {{ metric.unit }}
                </span>
              </div>
              <Info class="size-3 text-[#33b5e5]/60 hover:text-[#33b5e5] cursor-pointer" />
            </div>

            <!-- Bottom line: Caption -->
            <div class="mt-0.5 truncate text-[10px] font-medium uppercase tracking-tight text-[#8e8e8e]" :title="metric.caption">
              {{ metric.caption }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Carousel Pagination Indicator Dots -->
    <div class="flex items-center justify-center gap-1.5 pt-2 border-t border-[#282a2e] mt-2">
      <button
        v-for="i in 3"
        :key="i"
        type="button"
        class="size-2 rounded-full transition-all duration-200"
        :class="currentCarouselIndex === i - 1 ? 'w-4 bg-[#33b5e5]' : 'bg-[#4a4d56] hover:bg-[#6b7280]'"
        @click="currentCarouselIndex = i - 1"
      />
    </div>
  </div>
</template>
