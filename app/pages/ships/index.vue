<script setup lang="ts">
/**
 * Ship registry — live vessel particulars from getShipData (proxied via
 * /api/vessels/ship-data). Sortable, filterable data-table over the fleet,
 * mirroring the Movements ledger layout.
 */
import { h, computed, onMounted } from 'vue'
import type { Column, ColumnDef } from '@tanstack/vue-table'
import { Ship, Weight, Layers, Tags, SearchX } from 'lucide-vue-next'

import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { KpiGrid } from '@/components/ui/kpi-grid'
import { DataTable, DataTableColumnHeader, type FilterDefinition } from '@/components/ui/data-table'
import KpiTile from '@/components/KpiTile.vue'

import { useShipData, formatDeadweight, type ShipRecord } from '~/composables/useShipData'

definePageMeta({ middleware: 'require-dispatcher' })
useHead({ title: 'Ship Details · Smart Ship Hub' })

const { ships, isLoading, hasLoaded, fetchShips } = useShipData()

onMounted(() => {
  fetchShips()
})

const totals = computed(() => {
  const dwt = ships.value.reduce((sum, s) => sum + (Number(s.Deadweight) || 0), 0)
  const sisterGroups = new Set(ships.value.map((s) => s.SisterGroup).filter(Boolean))
  const categories = new Set(ships.value.map((s) => s.Category).filter(Boolean))
  return {
    total: ships.value.length,
    dwt,
    sisterGroups: sisterGroups.size,
    categories: categories.size,
  }
})

const categoryOptions = computed(() =>
  Array.from(new Set(ships.value.map((s) => s.Category).filter(Boolean) as string[])).map((c) => ({ value: c, label: c })),
)
const sisterGroupOptions = computed(() =>
  Array.from(new Set(ships.value.map((s) => s.SisterGroup).filter(Boolean) as string[])).map((g) => ({ value: g, label: g })),
)

function colHeader(column: Column<ShipRecord, unknown>, label: string) {
  return h(DataTableColumnHeader as never, { column, label })
}

const columns = computed<ColumnDef<ShipRecord>[]>(() => [
  {
    accessorKey: 'Name',
    header: ({ column }) => colHeader(column, 'Ship'),
    cell: ({ row }) =>
      h('div', { class: 'flex flex-col leading-tight' }, [
        h('span', { class: 'font-medium' }, row.original.Name),
        h('span', { class: 'text-muted-foreground text-xs font-mono' }, row.original.MappingName ?? '—'),
      ]),
  },
  {
    accessorKey: 'Category',
    header: ({ column }) => colHeader(column, 'Category'),
    cell: ({ row }) => h(Badge, { variant: 'outline', class: 'text-xs font-normal' }, () => row.original.Category ?? '—'),
  },
  {
    accessorKey: 'Imo',
    header: ({ column }) => colHeader(column, 'IMO'),
    cell: ({ row }) => h('span', { class: 'text-sm font-mono tabular-nums' }, row.original.Imo ?? '—'),
  },
  {
    accessorKey: 'CallSign',
    header: ({ column }) => colHeader(column, 'Call sign'),
    cell: ({ row }) => h('span', { class: 'text-muted-foreground text-sm font-mono' }, row.original.CallSign ?? '—'),
  },
  {
    accessorKey: 'Flag',
    header: ({ column }) => colHeader(column, 'Flag'),
    cell: ({ row }) => h('span', { class: 'text-sm' }, row.original.Flag ?? '—'),
  },
  {
    accessorKey: 'Deadweight',
    header: ({ column }) => colHeader(column, 'DWT'),
    cell: ({ row }) => h('span', { class: 'text-sm tabular-nums' }, formatDeadweight(row.original.Deadweight)),
  },
  {
    accessorKey: 'SisterGroup',
    header: ({ column }) => colHeader(column, 'Sister group'),
    cell: ({ row }) => h('span', { class: 'text-muted-foreground text-sm' }, row.original.SisterGroup ?? '—'),
  },
])

const filters = computed<FilterDefinition[]>(() => [
  { column: 'Category', label: 'Category', type: 'multiselect', options: categoryOptions.value },
  { column: 'SisterGroup', label: 'Sister group', type: 'multiselect', options: sisterGroupOptions.value },
])

function handleRowClick(row: ShipRecord) {
  navigateTo(`/ships/${row.id}`)
}
</script>

<template>
  <div class="space-y-5 p-4 md:p-6">
    <header>
      <h1 class="text-xl font-semibold tracking-tight">Ship Details</h1>
      <p class="text-muted-foreground text-xs">{{ totals.total }} vessels in the registry.</p>
    </header>

    <div v-if="isLoading && !hasLoaded" class="space-y-5">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton v-for="i in 4" :key="i" class="h-24 rounded-xl" />
      </div>
      <Skeleton class="h-96 w-full rounded-xl" />
    </div>

    <template v-else>
      <KpiGrid>
        <KpiTile label="Total ships" :value="totals.total" hint="In the registry" tone="info" :icon="Ship" />
        <KpiTile label="Total DWT" :value="totals.dwt.toLocaleString('en-US')" hint="Deadweight tonnage" tone="info" :icon="Weight" />
        <KpiTile label="Sister groups" :value="totals.sisterGroups" hint="Distinct groups" tone="success" :icon="Layers" />
        <KpiTile label="Categories" :value="totals.categories" hint="Vessel types" tone="warning" :icon="Tags" />
      </KpiGrid>

      <DataTable
        :columns="columns"
        :data="ships"
        filter-column="Name"
        filter-placeholder="Search by ship name…"
        :filters="filters"
        filter-mode="modal"
        sticky-header
        max-height="640px"
        density="cozy"
        :on-row-click="handleRowClick"
      >
        <template #empty>
          <EmptyState :icon="SearchX" title="No ships match" description="Try clearing filters." class="py-10" />
        </template>
      </DataTable>
    </template>
  </div>
</template>
