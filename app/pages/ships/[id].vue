<script setup lang="ts">
/**
 * Ship detail — full particulars for a single vessel from the live ship
 * registry (getShipData, proxied via /api/vessels/ship-data).
 */
import { computed, onMounted } from 'vue'
import {
  ArrowLeft, Hash, Radio, Flag, Anchor, Building2, Calendar, ShoppingCart,
  Weight, Layers, Zap, Users,
} from 'lucide-vue-next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

import { useShipData, formatShipDate, formatDeadweight } from '~/composables/useShipData'

const route = useRoute()
const id = computed(() => String(route.params.id))

const { hasLoaded, isLoading, fetchShips, findShip } = useShipData()

onMounted(() => {
  fetchShips()
})

const ship = computed(() => findShip(id.value))

useHead(() => ({ title: ship.value ? `${ship.value.Name} · Smart Ship Hub` : 'Ship Details · Smart Ship Hub' }))

function fallback(value?: string | null): string {
  return value && value.trim() ? value : '—'
}

const specGroups = computed(() => {
  const s = ship.value
  if (!s) return []
  return [
    {
      title: 'Identity',
      items: [
        { label: 'IMO number', value: fallback(s.Imo), icon: Hash },
        { label: 'MMSI', value: fallback(s.Mmsi), icon: Radio },
        { label: 'Call sign', value: fallback(s.CallSign), icon: Radio },
        { label: 'Flag', value: fallback(s.Flag), icon: Flag },
      ],
    },
    {
      title: 'Registry',
      items: [
        { label: 'Registered country', value: fallback(s.RegisteredCountry), icon: Flag },
        { label: 'Home port', value: fallback(s.HomePort), icon: Anchor },
        { label: 'Registered company', value: fallback(s.RegisteredCompany), icon: Building2 },
      ],
    },
    {
      title: 'Build',
      items: [
        { label: 'Making yard', value: fallback(s.MakingYard), icon: Building2 },
        { label: 'Making date', value: formatShipDate(s.MakingDate), icon: Calendar },
        { label: 'Purchase date', value: formatShipDate(s.PurchaseDate), icon: ShoppingCart },
      ],
    },
    {
      title: 'Specifications',
      items: [
        { label: 'Deadweight', value: formatDeadweight(s.Deadweight), icon: Weight },
        { label: 'Gross tonnage', value: fallback(s.GrossTonnage), icon: Layers },
        { label: 'Net tonnage', value: fallback(s.NetTonnage), icon: Layers },
        { label: 'Aux engine rated power', value: fallback(s.AuxEngineRatedPower), icon: Zap },
        { label: 'Main propulsion rated power', value: fallback(s.MainPropulsionRatedPower), icon: Zap },
      ],
    },
  ]
})
</script>

<template>
  <div v-if="isLoading && !hasLoaded" class="space-y-5 p-4 md:p-6">
    <Skeleton class="h-9 w-40" />
    <Skeleton class="h-28 w-full rounded-xl" />
    <div class="grid gap-4 sm:grid-cols-2">
      <Skeleton v-for="i in 4" :key="i" class="h-40 rounded-xl" />
    </div>
  </div>

  <div v-else-if="!ship" class="p-6">
    <Card>
      <CardContent class="space-y-3 p-8 text-center">
        <p class="text-foreground text-lg font-semibold">Ship not found</p>
        <p class="text-muted-foreground text-sm">No ship matching “{{ id }}” in the registry.</p>
        <Button variant="outline" as-child class="mt-2">
          <NuxtLink to="/ships"><ArrowLeft class="mr-2 size-4" />Back to ship details</NuxtLink>
        </Button>
      </CardContent>
    </Card>
  </div>

  <div v-else class="space-y-5 p-4 md:p-6">
    <Button variant="ghost" size="sm" class="text-muted-foreground -ml-2" as-child>
      <NuxtLink to="/ships"><ArrowLeft class="mr-2 size-4" />Back to ship details</NuxtLink>
    </Button>

    <!-- Hero -->
    <Card>
      <CardContent class="p-5">
        <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div class="min-w-0 space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-2xl font-semibold tracking-tight">{{ ship.Name }}</h1>
              <Badge variant="outline" class="text-xs font-normal">{{ fallback(ship.Category) }}</Badge>
            </div>
            <p class="text-muted-foreground font-mono text-sm">{{ fallback(ship.MappingName) }}</p>
            <div v-if="ship.SisterGroup" class="flex items-center gap-1.5 text-sm">
              <Users class="text-muted-foreground size-3.5" />
              <span class="text-muted-foreground">Sister group</span>
              <span class="font-medium">{{ ship.SisterGroup }}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Particulars -->
    <div class="grid gap-4 sm:grid-cols-2">
      <Card v-for="group in specGroups" :key="group.title">
        <CardHeader class="pb-2">
          <CardTitle class="text-base">{{ group.title }}</CardTitle>
        </CardHeader>
        <CardContent class="space-y-2.5 text-sm">
          <div v-for="item in group.items" :key="item.label" class="flex items-center justify-between gap-2">
            <span class="text-muted-foreground flex items-center gap-1.5">
              <component :is="item.icon" class="size-3.5 shrink-0" />{{ item.label }}
            </span>
            <span class="font-medium">{{ item.value }}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
