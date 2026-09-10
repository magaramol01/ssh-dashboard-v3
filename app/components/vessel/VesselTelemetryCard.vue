<script setup lang="ts">
import { ref, computed } from 'vue'
import { useVesselDashboard } from '~/composables/useVesselDashboard'

const { dashboardState } = useVesselDashboard()
const currentCarouselIndex = ref<number>(0)

const carouselData = computed(() => {
  return dashboardState.value?.widget_1?.configuration?.body?.data || null
})

const activeCarouselKey = computed(() => {
  const keys = ['carousel1', 'carousel2', 'carousel3']
  return keys[currentCarouselIndex.value] || 'carousel1'
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

function parseGroup(groupObj: any, fallbackTitle: string): MetricGroup {
  if (!groupObj) {
    return { title: fallbackTitle, metrics: [] }
  }
  const title = groupObj.widgetData?.caption || fallbackTitle
  const metrics: MetricItem[] = []

  const rows = groupObj.data || {}
  const sortedRowKeys = Object.keys(rows).sort()

  for (const rKey of sortedRowKeys) {
    const row = rows[rKey]
    const colData = row?.colData || {}
    if (colData.col1?.widgetData) {
      const w = colData.col1.widgetData
      metrics.push({
        caption: w.caption || '',
        value: w.value !== null && w.value !== undefined && w.value !== '' ? w.value : '0.00',
        unit: w.unit || '',
      })
    }
    if (colData.col2?.widgetData) {
      const w = colData.col2.widgetData
      metrics.push({
        caption: w.caption || '',
        value: w.value !== null && w.value !== undefined && w.value !== '' ? w.value : '0.00',
        unit: w.unit || '',
      })
    }
  }

  return { title, metrics }
}

const currentGroups = computed<MetricGroup[]>(() => {
  const activeObj = carouselData.value?.[activeCarouselKey.value]
  if (!activeObj) {
    // Return standard defaults matching screenshot
    return [
      {
        title: 'Fuel and Vessel Speed',
        metrics: [
          { caption: 'ME FUEL CONS. RATE', value: '-5.83', unit: 'Kg/hr' },
          { caption: 'AE FUEL CONS. RATE', value: '97.69', unit: 'Kg/hr' },
          { caption: 'Speed Over Ground', value: '0.00', unit: 'kn' },
          { caption: 'Speed Through Water', value: '-0.10', unit: 'knot' },
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
  }

  const g1 = parseGroup(activeObj.group1, 'Fuel and Vessel Speed')
  const g2 = parseGroup(activeObj.group2, 'Shaft Power Meter')
  return [g1, g2]
})
</script>

<template>
  <div class="flex h-full flex-col justify-between rounded-lg border border-border/40 bg-card/70 p-4 backdrop-blur-md">
    <div class="space-y-4">
      <div v-for="(group, gIdx) in currentGroups" :key="gIdx" class="space-y-2">
        <!-- Section Header -->
        <h3 class="text-xs font-semibold tracking-wide text-cyan-400/90 uppercase">
          {{ group.title }}
        </h3>

        <!-- Metrics 2-column grid -->
        <div class="grid grid-cols-2 gap-x-4 gap-y-3">
          <div
            v-for="(item, idx) in group.metrics"
            :key="idx"
            class="flex flex-col justify-start"
          >
            <div class="flex items-baseline gap-1.5">
              <span class="font-mono text-base font-bold text-foreground">
                {{ item.value }}
              </span>
              <span v-if="item.unit" class="text-[10px] text-muted-foreground font-mono">
                {{ item.unit }}
              </span>
            </div>
            <span class="text-[11px] leading-tight text-muted-foreground uppercase">
              {{ item.caption }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Carousel Dots Pagination -->
    <div class="flex items-center justify-center gap-2 pt-3">
      <button
        v-for="i in 3"
        :key="i"
        type="button"
        class="h-1 rounded-full transition-all duration-300"
        :class="currentCarouselIndex === i - 1 ? 'w-6 bg-cyan-400' : 'w-3 bg-muted hover:bg-muted-foreground/50'"
        @click="currentCarouselIndex = i - 1"
      />
    </div>
  </div>
</template>
