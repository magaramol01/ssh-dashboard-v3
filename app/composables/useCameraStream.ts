import { ref, computed, shallowRef } from 'vue'
import type { Socket } from 'socket.io-client'
import type { CameraInfo } from '#shared/types/camera'
import { buildHlsStreamUrl, buildStreamId } from '~/utils/camera-stream'

// Known baseline cameras for vessels with CCTV installed
const DEFAULT_VESSEL_CAMERAS: Record<string, CameraInfo[]> = {
  '28': [
    { id: '1', name: 'Bridge Forward (Nav)', status: 'ONLINE' },
    { id: '2', name: 'Aft Deck & Mooring', status: 'ONLINE' },
    { id: '3', name: 'Main Engine Control', status: 'ONLINE' },
  ],
  '58': [
    { id: '1', name: 'Bridge Port Cam', status: 'ONLINE' },
    { id: '2', name: 'Cargo Hold 1', status: 'ONLINE' },
  ],
  '122': [
    { id: '1', name: 'Forward Mast 360°', status: 'ONLINE' },
    { id: '2', name: 'Engine Room Starboard', status: 'ONLINE' },
  ],
  'VESSEL-28': [
    { id: '1', name: 'Bridge Forward (Nav)', status: 'ONLINE' },
    { id: '2', name: 'Aft Deck & Mooring', status: 'ONLINE' },
    { id: '3', name: 'Main Engine Control', status: 'ONLINE' },
  ],
  'VESSEL-58': [
    { id: '1', name: 'Bridge Port Cam', status: 'ONLINE' },
    { id: '2', name: 'Cargo Hold 1', status: 'ONLINE' },
  ],
  'VESSEL-122': [
    { id: '1', name: 'Forward Mast 360°', status: 'ONLINE' },
    { id: '2', name: 'Engine Room Starboard', status: 'ONLINE' },
  ],
}

// Global singleton state so all components (Map, PiP, Drawer) share stream status
const isSocketConnected = ref(false)
const shipCamerasMap = ref<Map<string, CameraInfo[]>>(new Map())
const onlineShips = ref<Set<string>>(new Set())
const activeStreams = ref<Map<string, string>>(new Map()) // key: shipId-cameraId -> streamId
const vesselUploadSpeeds = ref<Map<string, number>>(new Map())
const socketInstance = shallowRef<Socket | null>(null)
let isInitialized = false

export function useCameraStream() {
  const { tenant } = useTenant()

  function getActiveTenant(): string {
    return tenant.value || 'aesm'
  }

  function getAuthToken(): string {
    if (import.meta.server) return ''
    const cookieMatch = document.cookie.match(/(?:^|;\s*)auth_token=([^;]*)/)
    if (cookieMatch && cookieMatch[1]) return decodeURIComponent(cookieMatch[1])
    try {
      return localStorage.getItem('rduin_auth') || localStorage.getItem('auth_token') || ''
    } catch {
      return ''
    }
  }

  function getCorrelationId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  // Pre-seed default cameras into shipCamerasMap
  if (shipCamerasMap.value.size === 0) {
    for (const [vId, cams] of Object.entries(DEFAULT_VESSEL_CAMERAS)) {
      shipCamerasMap.value.set(vId, cams)
    }
  }

  async function initSocket(socketBaseUrl = 'wss://smartshipweb.com/realtimeDataProviderDevBe') {
    if (import.meta.server || isInitialized || socketInstance.value) return

    try {
      const { io } = await import('socket.io-client')
      const activeTenant = getActiveTenant()
      const authToken = getAuthToken()
      const correlationId = getCorrelationId()

      const socket = io(socketBaseUrl, {
        path: '/socket.io',
        transports: ['websocket'],
        query: {
          tenantId: activeTenant,
          'X-Request-ID': correlationId,
          'X-Auth-ID': authToken,
        },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
      })

      socketInstance.value = socket
      isInitialized = true

      socket.on('connect', () => {
        isSocketConnected.value = true
        socket.emit('register-client')
      })

      socket.on('disconnect', () => {
        isSocketConnected.value = false
      })

      socket.on('available-ships', (ships: string[]) => {
        if (Array.isArray(ships)) {
          onlineShips.value = new Set(ships)
        }
      })

      socket.on('ship-cameras', (payload: any) => {
        if (!payload || !payload.shipId) return
        const shipIdKey = String(payload.shipId)
        if (Array.isArray(payload.cameras)) {
          const formatted: CameraInfo[] = payload.cameras.map((c: any) => ({
            id: String(c.id || c.cameraId),
            name: c.name || c.cameraName || `Camera ${c.id || c.cameraId}`,
            status: c.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE',
            lastUpdatedAt: c.lastUpdatedAt || c.lastUpdatedTime,
          }))
          shipCamerasMap.value.set(shipIdKey, formatted)
          shipCamerasMap.value.set(`VESSEL-${shipIdKey}`, formatted)
        }
        if (payload.speedInKibips || payload.uploadSpeed) {
          vesselUploadSpeeds.value.set(shipIdKey, Number(payload.speedInKibips || payload.uploadSpeed))
        }
      })

      socket.on('vessel-health-update', (payload: any) => {
        if (!payload || (!payload.vesselId && !payload.shipId)) return
        const vId = String(payload.vesselId || payload.shipId)
        if (Array.isArray(payload.cameras)) {
          const formatted: CameraInfo[] = payload.cameras.map((c: any) => ({
            id: String(c.cameraId || c.id),
            name: c.cameraName || c.name || `Camera ${c.cameraId || c.id}`,
            status: c.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE',
            lastUpdatedAt: c.lastUpdatedTime || c.lastUpdatedAt,
          }))
          shipCamerasMap.value.set(vId, formatted)
          shipCamerasMap.value.set(`VESSEL-${vId}`, formatted)
        }
        const speed = payload.uploadSpeed ?? payload.speedInKibips ?? payload.networkInformation?.uploadSpeed
        if (speed !== undefined) {
          vesselUploadSpeeds.value.set(vId, Number(speed))
        }
      })

      socket.on('stream-started', ({ streamId, shipId }: { streamId: string; shipId?: string }) => {
        if (!streamId) return
        const cleanStreamId = streamId.replace(/-(sd|hd)$/, '')
        activeStreams.value.set(cleanStreamId, streamId)
      })

      socket.on('stream-ended', (endedStreamId: string) => {
        for (const [key, val] of activeStreams.value.entries()) {
          if (val === endedStreamId || key === endedStreamId) {
            activeStreams.value.delete(key)
          }
        }
      })
    } catch (err) {
      console.warn('[useCameraStream] Socket initialization skipped or failed:', err)
    }
  }

  function getVesselCameras(vesselId: string | number): CameraInfo[] {
    const rawId = String(vesselId)
    const normalized = rawId.replace(/^VESSEL-/, '')
    const fromMap = shipCamerasMap.value.get(rawId) || shipCamerasMap.value.get(normalized)
    if (fromMap && fromMap.length > 0) return fromMap

    const defaultCams = DEFAULT_VESSEL_CAMERAS[rawId] || DEFAULT_VESSEL_CAMERAS[normalized]
    if (defaultCams) return defaultCams

    return []
  }

  function hasCameras(vesselId: string | number): boolean {
    return getVesselCameras(vesselId).length > 0
  }

  function getVesselUploadSpeed(vesselId: string | number): number | null {
    const rawId = String(vesselId)
    const normalized = rawId.replace(/^VESSEL-/, '')
    return vesselUploadSpeeds.value.get(rawId) ?? vesselUploadSpeeds.value.get(normalized) ?? null
  }

  async function requestVesselStream(
    shipId: string | number,
    cameraId: string | number,
    quality: 'sd' | 'hd' = 'sd'
  ): Promise<{ streamId: string; streamUrl: string }> {
    const cleanShip = String(shipId).replace(/^VESSEL-/, '')
    const cleanCam = String(cameraId)
    const deterministicStreamId = buildStreamId(cleanShip, cleanCam, quality)
    const streamKey = `${cleanShip}-${cleanCam}`

    // Emit stream request if socket is open
    if (socketInstance.value && isSocketConnected.value) {
      socketInstance.value.emit('request-stream', {
        shipId: cleanShip,
        cameraId: [cleanCam],
        tenantId: getActiveTenant(),
        quality,
      })
    }

    activeStreams.value.set(streamKey, deterministicStreamId)
    const streamUrl = buildHlsStreamUrl(deterministicStreamId)
    return { streamId: deterministicStreamId, streamUrl }
  }

  function stopVesselStream(streamId: string) {
    if (!streamId) return
    if (socketInstance.value && isSocketConnected.value) {
      socketInstance.value.emit('stop-stream', {
        streamId,
        tenantId: getActiveTenant(),
      })
    }
    for (const [key, val] of activeStreams.value.entries()) {
      if (val === streamId || key === streamId) {
        activeStreams.value.delete(key)
      }
    }
  }

  return {
    isSocketConnected,
    shipCamerasMap,
    onlineShips,
    activeStreams,
    initSocket,
    getVesselCameras,
    hasCameras,
    getVesselUploadSpeed,
    requestVesselStream,
    stopVesselStream,
  }
}
