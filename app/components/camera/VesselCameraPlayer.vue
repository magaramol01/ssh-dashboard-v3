<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RefreshCw,
  AlertTriangle,
  Radio,
  Video,
  ArrowRight,
} from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    streamUrl: string
    cameraName?: string
    vesselName?: string
    isLive?: boolean
    autoPlay?: boolean
  }>(),
  {
    cameraName: 'CCTV Camera',
    vesselName: '',
    isLive: true,
    autoPlay: true,
  }
)

const emit = defineEmits<{
  (e: 'ready'): void
  (e: 'error', error: any): void
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const playerContainerRef = ref<HTMLElement | null>(null)



const isPlaying = ref(false)
const isMuted = ref(true)
const isFullscreen = ref(false)
const isLoading = ref(true)
const hasError = ref(false)
const retryCount = ref(0)
const maxRetries = 6

let hlsInstance: any = null
let retryTimeout: any = null

const loadingMessages = [
  'Connecting to ship satellite uplink...',
  'Handshaking RTSP & HLS transcoder...',
  'Buffering video stream...',
]
const currentLoadingMessageIndex = ref(0)
let messageInterval: any = null

function cycleLoadingMessages() {
  if (messageInterval) clearInterval(messageInterval)
  currentLoadingMessageIndex.value = 0
  messageInterval = setInterval(() => {
    currentLoadingMessageIndex.value =
      (currentLoadingMessageIndex.value + 1) % loadingMessages.length
  }, 2200)
}

function stopLoadingMessages() {
  if (messageInterval) {
    clearInterval(messageInterval)
    messageInterval = null
  }
}

async function initHls() {
  if (import.meta.server) return
  if (!props.streamUrl) {
    isLoading.value = false
    return
  }

  destroyHls()
  isLoading.value = true
  hasError.value = false
  cycleLoadingMessages()

  await nextTick()
  const video = videoRef.value
  if (!video) return

  try {
    const HlsModule = (await import('hls.js')).default

    if (HlsModule.isSupported()) {
      const hls = new HlsModule({
        debug: false,
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 10,
        maxBufferLength: 20,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
        manifestLoadingTimeOut: 15000,
        manifestLoadingMaxRetry: 8,
        manifestLoadingRetryDelay: 1500,
        manifestLoadingMaxRetryTimeout: 20000,
        levelLoadingTimeOut: 15000,
        levelLoadingMaxRetry: 8,
        levelLoadingRetryDelay: 1500,
        levelLoadingMaxRetryTimeout: 20000,
        fragLoadingTimeOut: 15000,
        fragLoadingMaxRetry: 8,
        fragLoadingRetryDelay: 1500,
        fragLoadingMaxRetryTimeout: 20000,
      })
      hlsInstance = hls

      hls.on(HlsModule.Events.MANIFEST_PARSED, () => {
        stopLoadingMessages()
        isLoading.value = false
        hasError.value = false
        retryCount.value = 0
        emit('ready')
        if (props.autoPlay) {
          video.play().then(() => {
            isPlaying.value = true
          }).catch(() => {
            isPlaying.value = false
          })
        }
      })

      hls.on(HlsModule.Events.ERROR, (_event: any, data: any) => {
        if (data.fatal) {
          if (data.type === HlsModule.ErrorTypes.NETWORK_ERROR && retryCount.value < maxRetries) {
            retryCount.value++
            clearTimeout(retryTimeout)
            retryTimeout = setTimeout(() => {
              if (hlsInstance) {
                hlsInstance.startLoad()
              }
            }, 1800)
            return
          }
          stopLoadingMessages()
          isLoading.value = false
          hasError.value = true
          emit('error', data)
        }
      })

      hls.attachMedia(video)
      hls.loadSource(props.streamUrl)
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = props.streamUrl
      video.addEventListener('loadedmetadata', () => {
        stopLoadingMessages()
        isLoading.value = false
        hasError.value = false
        if (props.autoPlay) {
          video.play().catch(() => {})
        }
      })
      video.addEventListener('error', (e) => {
        stopLoadingMessages()
        isLoading.value = false
        hasError.value = true
        emit('error', e)
      })
    } else {
      stopLoadingMessages()
      isLoading.value = false
      hasError.value = true
      emit('error', new Error('HLS not supported in browser'))
    }
  } catch (err) {
    stopLoadingMessages()
    isLoading.value = false
    hasError.value = true
    emit('error', err)
  }
}

function destroyHls() {
  if (retryTimeout) {
    clearTimeout(retryTimeout)
    retryTimeout = null
  }
  stopLoadingMessages()
  if (hlsInstance) {
    hlsInstance.destroy()
    hlsInstance = null
  }
  if (videoRef.value) {
    videoRef.value.src = ''
    videoRef.value.load()
  }
}

function togglePlay() {
  const video = videoRef.value
  if (!video) return
  if (video.paused) {
    video.play().then(() => {
      isPlaying.value = true
    }).catch(() => {})
  } else {
    video.pause()
    isPlaying.value = false
  }
}

function toggleMute() {
  const video = videoRef.value
  if (!video) return
  video.muted = !video.muted
  isMuted.value = video.muted
}

function toggleFullscreen() {
  const el = playerContainerRef.value
  if (!el) return
  if (!document.fullscreenElement) {
    el.requestFullscreen().then(() => {
      isFullscreen.value = true
    }).catch(() => {})
  } else {
    document.exitFullscreen().then(() => {
      isFullscreen.value = false
    }).catch(() => {})
  }
}

function retryStream() {
  retryCount.value = 0
  initHls()
}

watch(() => props.streamUrl, () => {
  initHls()
})

onMounted(() => {
  initHls()
})

onBeforeUnmount(() => {
  destroyHls()
})
</script>

<template>
  <div
    ref="playerContainerRef"
    class="relative w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center select-none group border border-border/40 shadow-inner"
  >
    <!-- HTML5 Video Element (Live HLS Video Stream) -->
    <video
      ref="videoRef"
      class="w-full h-full object-cover"
      playsinline
      :muted="isMuted"
      @play="isPlaying = true"
      @pause="isPlaying = false"
    />

    <!-- Tactical scanlines overlay -->
    <div class="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.35)_51%)] bg-[length:100%_4px] pointer-events-none z-10 opacity-50" />

    <!-- Live Satellite Search / Standby HUD when waiting for camera signal -->
    <div
      v-if="hasError"
      class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 px-4 text-center select-none backdrop-blur-xs"
    >
      <div class="relative flex items-center justify-center size-12 mb-2.5">
        <div class="absolute inset-0 rounded-full border border-amber-500/30 animate-ping" />
        <div class="size-9 rounded-full border border-amber-500/60 flex items-center justify-center bg-amber-500/10">
          <AlertTriangle class="size-4 text-amber-400" />
        </div>
      </div>
      <p class="text-xs font-semibold text-white/90">
        Camera Signal Offline on Vessel
      </p>
      <p class="text-[10px] text-white/60 mt-0.5 max-w-[260px]">
        {{ cameraName }} unreachable. Attempting transponder failover...
      </p>

      <button
        type="button"
        class="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded bg-primary/25 hover:bg-primary/40 border border-primary/40 text-[11px] font-medium text-primary-foreground transition-colors cursor-pointer"
        @click="emit('error', { type: 'NEXT_CAMERA_REQUESTED' })"
      >
        <span>Try Next Camera</span>
        <ArrowRight class="size-3" />
      </button>
    </div>



    <!-- Top Status Overlay (Always Visible) -->
    <div class="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-none">
      <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-xs border border-white/10 text-[11px] font-medium text-white shadow-sm">
        <span class="size-2 rounded-full bg-destructive animate-pulse" />
        <span class="tracking-wide uppercase text-[10px] font-semibold text-destructive">LIVE</span>
        <span class="text-white/40">·</span>
        <span class="truncate max-w-[140px] text-white/90">{{ cameraName }}</span>
      </div>

      <div class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-xs border border-white/10 text-[10px] font-mono text-emerald-400 shadow-sm">
        <Radio class="size-3 animate-pulse" />
        <span>HLS SAT</span>
      </div>
    </div>

    <!-- Loading State Overlay -->
    <div
      v-if="isLoading"
      class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 backdrop-blur-xs px-4 text-center"
    >
      <div class="relative flex items-center justify-center size-12 mb-3">
        <div class="absolute inset-0 rounded-full border-2 border-primary/20" />
        <div class="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <Video class="size-4 text-primary absolute" />
      </div>
      <p class="text-xs font-medium text-white/90 transition-opacity duration-300">
        {{ loadingMessages[currentLoadingMessageIndex] }}
      </p>
      <p class="text-[10px] text-white/50 mt-1">
        Satellite bandwidth optimization active
      </p>
    </div>

    <!-- Interactive Control Bar (Appears on Hover) -->
    <div
      v-if="!isLoading && !hasError"
      class="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 flex items-center justify-between"
    >
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="size-7 rounded-md bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer"
          :title="isPlaying ? 'Pause' : 'Play'"
          @click="togglePlay"
        >
          <Pause v-if="isPlaying" class="size-3.5" />
          <Play v-else class="size-3.5 fill-white" />
        </button>

        <button
          type="button"
          class="size-7 rounded-md bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer"
          :title="isMuted ? 'Unmute' : 'Mute'"
          @click="toggleMute"
        >
          <VolumeX v-if="isMuted" class="size-3.5" />
          <Volume2 v-else class="size-3.5" />
        </button>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="size-7 rounded-md bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer"
          title="Refresh Stream"
          @click="retryStream"
        >
          <RefreshCw class="size-3.5" />
        </button>

        <button
          type="button"
          class="size-7 rounded-md bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer"
          :title="isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'"
          @click="toggleFullscreen"
        >
          <Minimize2 v-if="isFullscreen" class="size-3.5" />
          <Maximize2 v-else class="size-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>
