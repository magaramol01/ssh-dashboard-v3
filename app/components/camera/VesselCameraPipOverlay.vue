<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import {
  Video,
  X,
  Minus,
  Maximize2,
  Navigation,
  Gauge,
  Wifi,
  GripHorizontal,
} from 'lucide-vue-next'
import VesselCameraPlayer from './VesselCameraPlayer.vue'
import { useCameraStream } from '~/composables/useCameraStream'
import type { CameraInfo } from '#shared/types/camera'

const props = defineProps<{
  vessel: any
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const {
  getVesselCameras,
  getVesselUploadSpeed,
  requestVesselStream,
  stopVesselStream,
} = useCameraStream()

const isMinimized = ref(false)
const selectedCameraId = ref<string>('1')
const activeStreamUrl = ref<string>('')
const activeStreamId = ref<string>('')

// Position dragging state
const overlayPosition = ref({ x: 24, y: 70 })
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })

const cameras = computed<CameraInfo[]>(() => {
  if (!props.vessel) return []
  return getVesselCameras(props.vessel)
})

const activeCamera = computed<CameraInfo | undefined>(() => {
  return (
    cameras.value.find((c) => c.id === selectedCameraId.value) ||
    cameras.value[0]
  )
})

const uploadSpeed = computed<number | null>(() => {
  if (!props.vessel) return null
  return getVesselUploadSpeed(props.vessel)
})

async function startCurrentStream() {
  if (!props.vessel || cameras.value.length === 0) return
  const camId = selectedCameraId.value || cameras.value[0]?.id || '1'

  // Stop previous stream if different
  if (activeStreamId.value) {
    stopVesselStream(activeStreamId.value)
  }

  const { streamId, streamUrl } = await requestVesselStream(props.vessel, camId, 'sd')
  activeStreamId.value = streamId
  activeStreamUrl.value = streamUrl
}

function handleSelectCamera(camId: string) {
  selectedCameraId.value = camId
  startCurrentStream()
}

function handleClose() {
  if (activeStreamId.value) {
    stopVesselStream(activeStreamId.value)
    activeStreamId.value = ''
    activeStreamUrl.value = ''
  }
  emit('close')
}

// Dragging handlers
function onMouseDown(e: MouseEvent) {
  isDragging.value = true
  dragOffset.value = {
    x: e.clientX - overlayPosition.value.x,
    y: e.clientY - overlayPosition.value.y,
  }
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value) return
  const newX = Math.max(10, Math.min(window.innerWidth - 380, e.clientX - dragOffset.value.x))
  const newY = Math.max(60, Math.min(window.innerHeight - 250, e.clientY - dragOffset.value.y))
  overlayPosition.value = { x: newX, y: newY }
}

function onMouseUp() {
  isDragging.value = false
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
}

watch(
  () => props.vessel,
  (newVessel) => {
    if (newVessel) {
      const cams = getVesselCameras(newVessel.vesselId || newVessel.id)
      if (cams.length > 0) {
        selectedCameraId.value = cams[0]?.id || '1'
      }
      if (props.isOpen) {
        startCurrentStream()
      }
    }
  },
  { immediate: true }
)

watch(
  () => props.isOpen,
  (open) => {
    if (open && props.vessel) {
      startCurrentStream()
    } else if (!open && activeStreamId.value) {
      stopVesselStream(activeStreamId.value)
      activeStreamId.value = ''
    }
  }
)
</script>

<template>
  <div
    v-if="isOpen && vessel"
    class="fixed z-[1050] transition-all duration-150 select-none shadow-2xl"
    :style="{
      left: `${overlayPosition.x}px`,
      top: `${overlayPosition.y}px`,
      width: isMinimized ? 'auto' : '380px',
    }"
  >
    <!-- Minimized Compact Badge View -->
    <div
      v-if="isMinimized"
      class="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card/95 backdrop-blur-md border border-border shadow-xl cursor-pointer hover:border-primary/50 transition-colors"
      @click="isMinimized = false"
    >
      <span class="size-2 rounded-full bg-destructive animate-pulse" />
      <Video class="size-4 text-primary" />
      <span class="text-xs font-semibold text-foreground tracking-tight">{{ vessel.name }}</span>
      <span class="text-[10px] text-muted-foreground uppercase font-mono">CCTV LIVE</span>
      <button
        type="button"
        class="size-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground ml-1"
        @click.stop="handleClose"
      >
        <X class="size-3.5" />
      </button>
    </div>

    <!-- Full Floating "God's Eye View" HUD Window -->
    <div
      v-else
      class="flex flex-col rounded-xl overflow-hidden bg-card/95 backdrop-blur-md border border-border shadow-2xl ring-1 ring-white/10"
    >
      <!-- Draggable Window Header -->
      <div
        class="flex items-center justify-between px-3 py-2 bg-muted/60 border-b border-border/80 cursor-grab active:cursor-grabbing"
        @mousedown="onMouseDown"
      >
        <div class="flex items-center gap-2 min-w-0">
          <GripHorizontal class="size-3.5 text-muted-foreground/60 shrink-0" />
          <div class="flex items-center gap-1.5 min-w-0">
            <Video class="size-3.5 text-primary shrink-0" />
            <span class="text-xs font-bold text-foreground tracking-tight truncate">
              {{ vessel.name }}
            </span>
          </div>
          <span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-destructive/15 text-destructive text-[9px] font-bold uppercase tracking-wider shrink-0">
            <span class="size-1.5 rounded-full bg-destructive animate-pulse" />
            Live
          </span>
        </div>

        <div class="flex items-center gap-1 shrink-0">
          <button
            type="button"
            class="size-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Minimize"
            @click="isMinimized = true"
          >
            <Minus class="size-3" />
          </button>
          <button
            type="button"
            class="size-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Close CCTV"
            @click="handleClose"
          >
            <X class="size-3.5" />
          </button>
        </div>
      </div>

      <!-- Multi-Camera Selector Pills (If multiple cameras available) -->
      <div
        v-if="cameras.length > 1"
        class="flex items-center gap-1.5 px-3 py-1.5 bg-background/80 border-b border-border/40 overflow-x-auto"
      >
        <button
          v-for="cam in cameras"
          :key="cam.id"
          type="button"
          class="text-[11px] font-medium px-2 py-0.5 rounded-md transition-all shrink-0 cursor-pointer"
          :class="
            selectedCameraId === cam.id
              ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
              : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
          "
          @click="handleSelectCamera(cam.id)"
        >
          {{ cam.name }}
        </button>
      </div>

      <!-- Main Video Feed Canvas -->
      <div class="p-2 bg-black/90">
        <VesselCameraPlayer
          :stream-url="activeStreamUrl"
          :camera-name="activeCamera?.name || 'Vessel Camera'"
          :is-live="true"
          :auto-play="true"
        />
      </div>

      <!-- Bottom Telemetry HUD Ribbon -->
      <div class="grid grid-cols-3 divide-x divide-border/60 bg-muted/40 border-t border-border/80 px-2 py-1.5 text-center text-[10px]">
        <div class="flex flex-col items-center">
          <span class="text-muted-foreground font-medium flex items-center gap-0.5">
            <Gauge class="size-2.5 text-primary" /> SOG
          </span>
          <span class="font-bold text-foreground tabular-nums">
            {{ vessel.sog ?? 0 }} kts
          </span>
        </div>

        <div class="flex flex-col items-center">
          <span class="text-muted-foreground font-medium flex items-center gap-0.5">
            <Navigation class="size-2.5 text-info" /> Heading
          </span>
          <span class="font-bold text-foreground tabular-nums truncate max-w-[90px]">
            {{ vessel.heading || 'N' }}
          </span>
        </div>

        <div class="flex flex-col items-center">
          <span class="text-muted-foreground font-medium flex items-center gap-0.5">
            <Wifi class="size-2.5 text-success" /> Uplink
          </span>
          <span class="font-bold text-foreground tabular-nums">
            {{ uploadSpeed ? `${uploadSpeed.toFixed(1)} Mbps` : 'Sat Nominal' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
