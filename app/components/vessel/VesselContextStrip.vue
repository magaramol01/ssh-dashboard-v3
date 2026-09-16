<script setup lang="ts">
import { computed } from 'vue'
import {
  Ship,
  Compass,
  Radio,
  Clock,
  ArrowRight,
} from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { useVesselDashboard } from '~/composables/useVesselDashboard'

const { selectedVessel, mrvData, connectivity } = useVesselDashboard()

const isOnline = computed(() => connectivity.value?.status !== false && connectivity.value?.code !== 'red')

const formattedTime = computed(() => {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`
})
</script>

<template>
  <div class="bg-card/50 border border-border/50 rounded-xl px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-xs">
    <!-- Left: Vessel and Voyage Metadata -->
    <div class="flex flex-wrap items-center gap-3">
      <!-- Vessel Name & Sister Group -->
      <div class="flex items-center gap-2">
        <Ship class="size-4 text-primary" />
        <span class="font-bold text-sm text-foreground tracking-tight">{{ selectedVessel?.name || 'Avery Point' }}</span>
        <Badge variant="outline" class="text-xs font-mono font-medium px-1.5 py-0.2 border-border/70 text-muted-foreground">
          {{ selectedVessel?.sistergroup || 'CX 5.0' }}
        </Badge>
      </div>

      <div class="h-4 w-px bg-border/60 hidden sm:block" />

      <!-- Route: Source -> Destination -->
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <span class="font-semibold text-foreground font-mono">{{ mrvData.scr || 'AUBNE' }}</span>
        <ArrowRight class="size-3 text-muted-foreground" />
        <span class="font-semibold text-foreground font-mono">{{ mrvData.destination || 'CNTAO' }}</span>
        <span class="text-xs text-muted-foreground font-medium">({{ mrvData.voyage || '635N' }})</span>
      </div>

      <div class="h-4 w-px bg-border/60 hidden sm:block" />

      <!-- ETA & Distance -->
      <div class="flex items-center gap-2 text-xs">
        <Compass class="size-3.5 text-primary shrink-0" />
        <span class="text-muted-foreground font-normal">ETA</span>
        <span class="font-semibold text-foreground font-mono">{{ mrvData.etanextport || '2026-09-18 11:00 UTC' }}</span>
        <span class="text-muted-foreground font-mono text-xs">· {{ mrvData.totaldistrun || '403' }} / {{ mrvData.disttogo || '4,063' }} NM</span>
      </div>
    </div>

    <!-- Right: VSAT Connectivity & UTC Clock -->
    <div class="flex items-center gap-3 text-xs self-end md:self-auto">
      <div class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/30">
        <Radio class="size-3.5" :class="isOnline ? 'text-teal-400' : 'text-rose-500'" />
        <span class="text-muted-foreground font-normal">VSAT</span>
        <span class="font-semibold" :class="isOnline ? 'text-teal-400' : 'text-rose-500'">
          {{ isOnline ? 'Connected' : 'Offline' }}
        </span>
      </div>

      <div class="h-4 w-px bg-border/60 hidden sm:block" />

      <div class="flex items-center gap-1.5 text-muted-foreground font-mono text-xs">
        <Clock class="size-3 text-muted-foreground" />
        <span>{{ formattedTime }}</span>
      </div>
    </div>
  </div>
</template>
