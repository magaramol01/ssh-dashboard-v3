import { ref, computed, shallowRef } from 'vue'
import type { Socket } from 'socket.io-client'
import type { CameraInfo } from '#shared/types/camera'
import { buildHlsStreamUrl, buildStreamId } from '~/utils/camera-stream'

// Dynamic camera registry - populated via socket events or real backend data
const DEFAULT_VESSEL_CAMERAS: Record<string, CameraInfo[]> = {}

// Vessel name to ID mapping dynamically populated
const VESSEL_NAME_TO_ID: Record<string, string> = {}

function normalizeKey(str: string | number): string {
  return String(str).trim().toUpperCase().replace(/[\s\-_]+/g, '')
}

// Global singleton state so all components (Map, PiP, Drawer) share stream status
export interface StreamErrorEvent {
  streamId?: string
  shipId?: string
  cameraId?: string
  message: string
  timestamp: number
}

const isSocketConnected = ref(false)
const shipCamerasMap = ref<Map<string, CameraInfo[]>>(new Map())
const onlineShips = ref<Set<string>>(new Set())
const activeStreams = ref<Map<string, string>>(new Map()) // key: shipId-cameraId -> streamId
const vesselUploadSpeeds = ref<Map<string, number>>(new Map())
const lastStreamError = ref<StreamErrorEvent | null>(null)
const latestStartedStream = ref<{ streamId: string; shipId?: string; url: string; timestamp: number } | null>(null)
const socketInstance = shallowRef<Socket | null>(null)
let isInitialized = false

function indexCameras(key: string, cams: CameraInfo[]) {
  if (!key || !Array.isArray(cams)) return
  const raw = key.trim()
  const norm = normalizeKey(raw)
  const next = new Map(shipCamerasMap.value)
  next.set(raw, cams)
  next.set(norm, cams)
  next.set(raw.toLowerCase(), cams)

  // Map known vessel IDs
  const vId = VESSEL_NAME_TO_ID[raw] || VESSEL_NAME_TO_ID[raw.toUpperCase()]
  if (vId) {
    next.set(vId, cams)
    next.set(`VESSEL-${vId}`, cams)
  }
  if (/^\d+$/.test(raw)) {
    next.set(`VESSEL-${raw}`, cams)
  }
  shipCamerasMap.value = next
}

// Initialize map with default cameras
for (const [vId, cams] of Object.entries(DEFAULT_VESSEL_CAMERAS)) {
  indexCameras(vId, cams)
}

export function useCameraStream() {
  const { tenant } = useTenant()

  function getActiveTenant(): string {
    return tenant.value || 'aesm'
  }

  function getAuthToken(): string {
    if (import.meta.server) return ''
    const cookieMatch = document.cookie.match(/(?:^|;\s*)(?:auth_token|authToken|token)=([^;]*)/)
    if (cookieMatch && cookieMatch[1]) return decodeURIComponent(cookieMatch[1])
    try {
      return (
        localStorage.getItem('authToken') ||
        localStorage.getItem('auth_token') ||
        localStorage.getItem('rduin_auth') ||
        localStorage.getItem('token') ||
        ''
      )
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

  async function initSocket(socketNamespaceUrl = 'https://smartshipweb.com/live-stream-client') {
    if (import.meta.server || isInitialized || socketInstance.value) return

    try {
      const { io } = await import('socket.io-client')
      const activeTenant = getActiveTenant()
      const authToken = getAuthToken()
      const correlationId = getCorrelationId()

      const socket = io(socketNamespaceUrl, {
        path: '/realtimeDataProviderDevBe/socket.io',
        transports: ['websocket'],
        query: {
          tenantId: activeTenant,
          'X-Request-ID': correlationId,
          'X-Auth-ID': authToken,
        },
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1500,
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
        const shipKey = String(payload.shipId)
        if (Array.isArray(payload.cameras)) {
          const formatted: CameraInfo[] = payload.cameras.map((c: any) => ({
            id: String(c.id || c.cameraId),
            name: c.name || c.cameraName || `Camera ${c.id || c.cameraId}`,
            status: c.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE',
            lastUpdatedAt: c.lastUpdatedAt || c.lastUpdatedTime,
          }))
          indexCameras(shipKey, formatted)
        }
        const speed = payload.uploadSpeed ?? payload.speedInKibips
        if (speed !== undefined) {
          const nextSpeeds = new Map(vesselUploadSpeeds.value)
          nextSpeeds.set(shipKey, Number(speed))
          nextSpeeds.set(normalizeKey(shipKey), Number(speed))
          vesselUploadSpeeds.value = nextSpeeds
        }
      })

      socket.on('vessel-health-update', (payload: any) => {
        if (!payload || (!payload.vesselId && !payload.shipId)) return
        const vKey = String(payload.vesselId || payload.shipId)
        if (Array.isArray(payload.cameras)) {
          const formatted: CameraInfo[] = payload.cameras.map((c: any) => ({
            id: String(c.cameraId || c.id),
            name: c.cameraName || c.name || `Camera ${c.cameraId || c.id}`,
            status: c.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE',
            lastUpdatedAt: c.lastUpdatedTime || c.lastUpdatedAt,
          }))
          indexCameras(vKey, formatted)
        }
        const speed = payload.uploadSpeed ?? payload.speedInKibips ?? payload.networkInformation?.uploadSpeed
        if (speed !== undefined) {
          const nextSpeeds = new Map(vesselUploadSpeeds.value)
          nextSpeeds.set(vKey, Number(speed))
          nextSpeeds.set(normalizeKey(vKey), Number(speed))
          vesselUploadSpeeds.value = nextSpeeds
        }
      })

      socket.on('stream-started', ({ streamId, shipId }: { streamId: string; shipId?: string }) => {
        if (!streamId) return
        const cleanStreamId = streamId.replace(/-(sd|hd)$/, '')
        activeStreams.value.set(cleanStreamId, streamId)
        if (shipId) {
          activeStreams.value.set(`${shipId}`, streamId)
        }
        latestStartedStream.value = {
          streamId,
          shipId,
          url: buildHlsStreamUrl(streamId),
          timestamp: Date.now(),
        }
      })

      socket.on('stream-ended', (endedStreamId: string) => {
        for (const [key, val] of activeStreams.value.entries()) {
          if (val === endedStreamId || key === endedStreamId) {
            activeStreams.value.delete(key)
          }
        }
      })

      socket.on('stream-error', (payload: any) => {
        lastStreamError.value = {
          streamId: payload?.streamId,
          shipId: payload?.shipId,
          cameraId: payload?.cameraId ? String(payload.cameraId) : undefined,
          message: payload?.error?.message || 'Camera stream offline or unreachable from vessel transponder',
          timestamp: Date.now(),
        }
      })
    } catch (err) {
      console.warn('[useCameraStream] Socket initialization skipped or failed:', err)
    }
  }

  function getVesselCameras(vesselOrId: any): CameraInfo[] {
    if (!vesselOrId) return []

    // If vessel explicitly has has_camera_ai: false from shipping_db.ship, return []
    if (typeof vesselOrId === 'object' && vesselOrId !== null) {
      if (vesselOrId.hasCameraAi === false || vesselOrId.has_camera_ai === false) {
        return []
      }
    }

    const candidates: string[] = []
    if (typeof vesselOrId === 'object' && vesselOrId !== null) {
      if (vesselOrId.name) {
        candidates.push(vesselOrId.name, normalizeKey(vesselOrId.name), vesselOrId.name.toLowerCase())
      }
      if (vesselOrId.shipId) {
        candidates.push(String(vesselOrId.shipId), normalizeKey(vesselOrId.shipId))
      }
      if (vesselOrId.vesselId) {
        candidates.push(String(vesselOrId.vesselId), `VESSEL-${vesselOrId.vesselId}`)
      }
      if (vesselOrId.id) {
        const rawId = String(vesselOrId.id)
        candidates.push(rawId, rawId.replace(/^VESSEL-/, ''), `VESSEL-${rawId.replace(/^VESSEL-/, '')}`)
      }
    } else {
      const raw = String(vesselOrId)
      candidates.push(
        raw,
        normalizeKey(raw),
        raw.toLowerCase(),
        raw.replace(/^VESSEL-/, ''),
        `VESSEL-${raw.replace(/^VESSEL-/, '')}`
      )
    }

    for (const cand of candidates) {
      const fromMap = shipCamerasMap.value.get(cand)
      if (fromMap && fromMap.length > 0) return fromMap

      const defaultCams = DEFAULT_VESSEL_CAMERAS[cand]
      if (defaultCams && defaultCams.length > 0) return defaultCams
    }

    // Return empty array if vessel has no real or configured cameras
    return []
  }

  function hasCameras(vesselOrId: any): boolean {
    return getVesselCameras(vesselOrId).length > 0
  }

  function getVesselUploadSpeed(vesselOrId: any): number | null {
    if (!vesselOrId) return null
    const candidates: string[] = []
    if (typeof vesselOrId === 'object' && vesselOrId !== null) {
      if (vesselOrId.name) candidates.push(vesselOrId.name, normalizeKey(vesselOrId.name))
      if (vesselOrId.vesselId) candidates.push(String(vesselOrId.vesselId))
      if (vesselOrId.id) candidates.push(String(vesselOrId.id))
    } else {
      const raw = String(vesselOrId)
      candidates.push(raw, normalizeKey(raw), raw.replace(/^VESSEL-/, ''))
    }

    for (const cand of candidates) {
      const speed = vesselUploadSpeeds.value.get(cand)
      if (typeof speed === 'number') return speed
    }
    return null
  }

  async function requestVesselStream(
    vesselOrId: any,
    cameraId: string | number,
    quality: 'sd' | 'hd' = 'sd'
  ): Promise<{ streamId: string; streamUrl: string }> {
    let shipName = ''
    if (typeof vesselOrId === 'object' && vesselOrId !== null) {
      shipName = vesselOrId.name || vesselOrId.shipId || String(vesselOrId.vesselId || vesselOrId.id)
    } else {
      shipName = String(vesselOrId)
    }

    const cams = getVesselCameras(vesselOrId)
    const matchedCam = cams.find((c) => c.id === String(cameraId))
    const cleanCam = matchedCam ? matchedCam.id : String(cameraId)

    // Emit stream request if socket is open
    if (socketInstance.value && isSocketConnected.value) {
      socketInstance.value.emit('request-stream', {
        shipId: shipName,
        cameraId: [cleanCam],
        tenantId: getActiveTenant(),
        quality,
      })
    }

    // Generate stream URL following the Camera AI architecture:
    // e.g. LOWLANDSHOPE-steering_gear_room or LOWLANDSHOPE-forward_mast_FA
    const vesselSlug = shipName.replace(/^(VESSEL-)/i, '').replace(/[\s\-_]+/g, '').toUpperCase()
    const cameraSlug = cleanCam.replace(/\s+/g, '_')
    const deterministicStreamId = `${vesselSlug}-${cameraSlug}`
    const streamKey = `${shipName}-${cleanCam}`

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
    lastStreamError,
    latestStartedStream,
  }
}

