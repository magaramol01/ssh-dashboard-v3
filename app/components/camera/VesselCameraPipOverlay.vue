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
  ChevronLeft,
  ChevronRight,
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
  lastStreamError,
  latestStartedStream,
} = useCameraStream()

const isMinimized = ref(false)
const selectedCameraId = ref<string>('1')
const activeStreamUrl = ref<string>('')
const activeStreamId = ref<string>('')
const failoverNotice = ref<string>('')
const failedCameraIds = ref<Set<string>>(new Set())
let failoverTimer: any = null

// Position dragging state - defaults to top-right on desktop over map
const hasDragged = ref(false)
const overlayPosition = ref({
  x: typeof window !== 'undefined' && window.innerWidth > 1024 ? Math.max(380, window.innerWidth - 430) : 24,
  y: 76,
})
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })

const cameras = computed<CameraInfo[]>(() => {
  if (!props.vessel) return []
  return getVesselCameras(props.vessel)
})

const onlineCameras = computed(() => cameras.value.filter((c) => c.status === 'ONLINE'))
const offlineCameras = computed(() => cameras.value.filter((c) => c.status === 'OFFLINE'))

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
  failedCameraIds.value.delete(camId)
  const targetCam = cameras.value.find((c) => c.id === camId)
  if (targetCam?.status === 'OFFLINE') {
    failoverNotice.value = `${targetCam.name} is OFFLINE · Requesting onboard wake-up...`
  } else {
    failoverNotice.value = ''
  }
  selectedCameraId.value = camId
  startCurrentStream()
}

function goToPrevCamera() {
  if (cameras.value.length <= 1) return
  const currentIndex = cameras.value.findIndex((c) => c.id === selectedCameraId.value)
  const prevIndex = (currentIndex - 1 + cameras.value.length) % cameras.value.length
  const prevCam = cameras.value[prevIndex]
  if (prevCam) {
    handleSelectCamera(prevCam.id)
  }
}

function goToNextCamera() {
  if (cameras.value.length <= 1) return
  const currentIndex = cameras.value.findIndex((c) => c.id === selectedCameraId.value)
  const nextIndex = (currentIndex + 1) % cameras.value.length
  const nextCam = cameras.value[nextIndex]
  if (nextCam) {
    handleSelectCamera(nextCam.id)
  }
}

function switchToNextCamera(reason = 'Camera offline') {
  if (!props.vessel || cameras.value.length <= 1) return
  const currentCam = activeCamera.value
  if (currentCam) {
    failedCameraIds.value.add(currentCam.id)
  }

  const currentIndex = cameras.value.findIndex((c) => c.id === selectedCameraId.value)
  let nextCam = cameras.value.slice(currentIndex + 1).find((c) => !failedCameraIds.value.has(c.id))
  
  if (!nextCam) {
    nextCam = cameras.value.find((c) => !failedCameraIds.value.has(c.id))
  }

  if (nextCam) {
    const currentName = currentCam?.name || 'Camera'
    failoverNotice.value = `${currentName} offline · Switching to ${nextCam.name}...`
    clearTimeout(failoverTimer)
    failoverTimer = setTimeout(() => {
      failoverNotice.value = ''
    }, 4500)

    selectedCameraId.value = nextCam.id
    startCurrentStream()
  } else {
    failoverNotice.value = `All ${cameras.value.length} vessel cameras queried. Satellite uplink in standby.`
  }
}

function handleCameraReady() {
  failoverNotice.value = ''
}

function handlePlayerError(_err: any) {
  switchToNextCamera('HLS stream unreachable')
}

// Watch socket-level stream errors
watch(lastStreamError, (err) => {
  if (!err || !props.isOpen || !props.vessel) return
  const currentCam = activeCamera.value
  if (
    currentCam &&
    (err.cameraId === currentCam.id ||
      (err.streamId && err.streamId.includes(currentCam.id)))
  ) {
    switchToNextCamera(err.message || 'Satellite transponder error')
  }
})

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
  hasDragged.value = true
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

watch(latestStartedStream, (started) => {
  if (!started || !props.isOpen || !props.vessel) return
  const vName = props.vessel.name || props.vessel.id || ''
  if (
    started.shipId === vName ||
    started.streamId.startsWith(String(vName).replace(/[\s\-_]+/g, '').toUpperCase())
  ) {
    activeStreamId.value = started.streamId
    activeStreamUrl.value = started.url
  }
})

watch(
  () => props.vessel,
  (newVessel) => {
    if (newVessel) {
      failedCameraIds.value.clear()
      failoverNotice.value = ''
      const cams = getVesselCameras(newVessel)
      if (cams.length > 0) {
        const preferred = cams.find((c) => c.status === 'ONLINE') || cams[0]
        selectedCameraId.value = preferred?.id || '1'
      }
      if (props.isOpen) {
        startCurrentStream()
      }
    }
  },
  { immediate: true }
)

watch(
  cameras,
  (newCams) => {
    if (!newCams || newCams.length === 0) return
    const currentCam = newCams.find((c) => c.id === selectedCameraId.value)
    if (!currentCam || currentCam.status === 'OFFLINE') {
      const firstOnline = newCams.find((c) => c.status === 'ONLINE')
      if (firstOnline && firstOnline.id !== selectedCameraId.value) {
        selectedCameraId.value = firstOnline.id
        if (props.isOpen) {
          startCurrentStream()
        }
      }
    }
  }
)

watch(
  () => props.isOpen,
  (open) => {
    if (open && props.vessel) {
      failedCameraIds.value.clear()
      failoverNotice.value = ''
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
    v-if="isOpen && vessel && cameras.length > 0"
    class="fixed z-[1050] transition-all duration-150 select-none shadow-2xl"
    :style="hasDragged ? {
      left: `${overlayPosition.x}px`,
      top: `${overlayPosition.y}px`,
      width: isMinimized ? 'auto' : '410px',
    } : {
      right: '20px',
      top: '76px',
      width: isMinimized ? 'auto' : '410px',
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

      <!-- Camera Health & Quick Navigation Ribbon -->
      <div class="flex items-center justify-between px-3 py-1.5 bg-muted/40 border-b border-border/50 text-[10px] font-mono">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="text-muted-foreground uppercase tracking-wider text-[9px] font-semibold shrink-0">Cams:</span>
          <span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 font-bold shrink-0">
            <span class="size-1.5 rounded-full bg-emerald-400"></span>
            {{ onlineCameras.length }} Online
          </span>
          <span v-if="offlineCameras.length > 0" class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-400 font-bold shrink-0">
            <span class="size-1.5 rounded-full bg-rose-400"></span>
            {{ offlineCameras.length }} Offline
          </span>
        </div>

        <div v-if="cameras.length > 1" class="flex items-center gap-1 shrink-0 ml-2">
          <button
            type="button"
            class="size-5 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            title="Previous Camera"
            @click="goToPrevCamera"
          >
            <ChevronLeft class="size-3" />
          </button>
          <span class="text-[9px] text-muted-foreground tabular-nums">
            {{ (cameras.findIndex((c) => c.id === selectedCameraId) + 1) || 1 }}/{{ cameras.length }}
          </span>
          <button
            type="button"
            class="size-5 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            title="Next Camera"
            @click="goToNextCamera"
          >
            <ChevronRight class="size-3" />
          </button>
        </div>
      </div>

      <!-- Multi-Camera Selector Pills -->
      <div
        v-if="cameras.length > 1"
        class="flex items-center gap-1 px-2.5 py-1.5 bg-background/80 border-b border-border/40 overflow-x-auto"
      >
        <button
          v-for="cam in cameras"
          :key="cam.id"
          type="button"
          class="text-[10.5px] font-medium px-2 py-0.5 rounded-md transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border"
          :class="
            selectedCameraId === cam.id
              ? 'bg-primary text-primary-foreground font-semibold shadow-xs border-primary'
              : cam.status === 'OFFLINE'
              ? 'bg-muted/20 text-muted-foreground/60 border-border/30 hover:border-border/60'
              : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border-border/40'
          "
          :title="`${cam.name} · ${cam.status === 'ONLINE' ? 'Online' : 'Offline'}`"
          @click="handleSelectCamera(cam.id)"
        >
          <span
            class="size-1.5 rounded-full shrink-0"
            :class="
              selectedCameraId === cam.id
                ? 'bg-white animate-pulse'
                : cam.status === 'ONLINE'
                ? 'bg-emerald-400'
                : 'bg-rose-500'
            "
          />
          <span>{{ cam.name }}</span>
          <span
            v-if="cam.status === 'OFFLINE'"
            class="text-[8.5px] uppercase px-1 py-0 rounded bg-rose-500/20 text-rose-300 font-mono font-bold leading-tight"
          >
            OFF
          </span>
        </button>
      </div>

      <!-- Realtime Camera Failover Notice Banner -->
      <div
        v-if="failoverNotice"
        class="flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 border-b border-amber-500/30 text-[10px] text-amber-300 font-medium"
      >
        <span class="size-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
        <span class="truncate">{{ failoverNotice }}</span>
      </div>

      <!-- Main Video Feed Stage -->
      <div class="p-2 bg-black/90">
        <VesselCameraPlayer
          :stream-url="activeStreamUrl"
          :camera-name="activeCamera?.name || 'Vessel Camera'"
          :vessel-name="vessel?.name || ''"
          :is-live="true"
          :auto-play="true"
          @ready="handleCameraReady"
          @error="handlePlayerError"
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
