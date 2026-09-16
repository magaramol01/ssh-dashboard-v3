import { ref, computed, shallowRef } from 'vue'
import type { Socket } from 'socket.io-client'
import type { CameraInfo } from '#shared/types/camera'
import { buildHlsStreamUrl, buildStreamId } from '~/utils/camera-stream'

// Known baseline cameras for vessels with CCTV installed
const DEFAULT_VESSEL_CAMERAS: Record<string, CameraInfo[]> = {
  'LOWLANDS HOPE': [
    { id: 'forward_mast_FA', name: 'Forward Mast FA', status: 'ONLINE' },
    { id: 'forward_mast_FF', name: 'Forward Mast FF', status: 'ONLINE' },
    { id: 'steering_gear_room', name: 'Steering Gear Room', status: 'ONLINE' },
    { id: 'oil_distribution_room', name: 'Oil Distribution Room', status: 'ONLINE' },
  ],
  'LOWLANDS DAWN': [
    { id: 'forward_mast_FF', name: 'Forward Mast FF', status: 'ONLINE' },
    { id: 'Forward_Mast_STBD_Side', name: 'Forward Mast STBD Side', status: 'ONLINE' },
  ],
  'LOWLANDS FUTURE': [
    { id: 'Forward_Mast_STBD_Side', name: 'Forward Mast STBD Side', status: 'ONLINE' },
    { id: 'forward_mast_FA', name: 'Forward Mast FA', status: 'ONLINE' },
  ],
  'LOWLANDS OBERLIN': [
    { id: 'forward_mast_FA', name: 'Forward Mast FA', status: 'ONLINE' },
    { id: 'forward_mast_FF', name: 'Forward Mast FF', status: 'ONLINE' },
    { id: 'steering_gear_rudder_angle', name: 'Steering Gear Rudder Angle', status: 'ONLINE' },
    { id: 'oil_distribution_room', name: 'Oil Distribution Room', status: 'ONLINE' },
  ],
  'LOWLANDS AMBER': [
    { id: 'Forward_Mast_STBD_Side', name: 'Forward Mast STBD Side', status: 'ONLINE' },
  ],
  'ASIA UNITY': [
    { id: 'Oil_Distribution', name: 'Oil Distribution', status: 'ONLINE' },
    { id: 'Auxiliary_Engine_(AE)_Platform', name: 'Auxiliary Engine (AE) Platform', status: 'ONLINE' },
    { id: 'Main_Engine_TC', name: 'Main Engine TC', status: 'ONLINE' },
    { id: 'me_bottom_platform', name: 'ME Bottom Platform', status: 'ONLINE' },
    { id: 'Steering_Gear_Room', name: 'Steering Gear Room', status: 'ONLINE' },
    { id: 'Forecastle', name: 'Forecastle', status: 'ONLINE' },
  ],
  '10': [
    { id: 'forward_mast_FA', name: 'Forward Mast FA', status: 'ONLINE' },
    { id: 'forward_mast_FF', name: 'Forward Mast FF', status: 'ONLINE' },
    { id: 'steering_gear_room', name: 'Steering Gear Room', status: 'ONLINE' },
    { id: 'oil_distribution_room', name: 'Oil Distribution Room', status: 'ONLINE' },
  ],
  '11': [
    { id: 'Forward_Mast_STBD_Side', name: 'Forward Mast STBD Side', status: 'ONLINE' },
  ],
  '14': [
    { id: 'forward_mast_FF', name: 'Forward Mast FF', status: 'ONLINE' },
  ],
  '15': [
    { id: 'Forward_Mast_STBD_Side', name: 'Forward Mast STBD Side', status: 'ONLINE' },
  ],
  '16': [
    { id: 'forward_mast_FA', name: 'Forward Mast FA', status: 'ONLINE' },
    { id: 'forward_mast_FF', name: 'Forward Mast FF', status: 'ONLINE' },
  ],
  '28': [
    { id: 'Oil_Distribution', name: 'Oil Distribution', status: 'ONLINE' },
    { id: 'Steering_Gear_Room', name: 'Steering Gear Room', status: 'ONLINE' },
  ],
  '58': [
    { id: 'forward_mast_FA', name: 'Forward Mast FA', status: 'ONLINE' },
    { id: 'steering_gear_room', name: 'Steering Gear Room', status: 'ONLINE' },
  ],
  'VESSEL-10': [
    { id: 'forward_mast_FA', name: 'Forward Mast FA', status: 'ONLINE' },
    { id: 'forward_mast_FF', name: 'Forward Mast FF', status: 'ONLINE' },
    { id: 'steering_gear_room', name: 'Steering Gear Room', status: 'ONLINE' },
    { id: 'oil_distribution_room', name: 'Oil Distribution Room', status: 'ONLINE' },
  ],
  'VESSEL-11': [
    { id: 'Forward_Mast_STBD_Side', name: 'Forward Mast STBD Side', status: 'ONLINE' },
  ],
  'VESSEL-14': [
    { id: 'forward_mast_FF', name: 'Forward Mast FF', status: 'ONLINE' },
  ],
  'VESSEL-15': [
    { id: 'Forward_Mast_STBD_Side', name: 'Forward Mast STBD Side', status: 'ONLINE' },
  ],
  'VESSEL-16': [
    { id: 'forward_mast_FA', name: 'Forward Mast FA', status: 'ONLINE' },
  ],
  'VESSEL-28': [
    { id: 'Oil_Distribution', name: 'Oil Distribution', status: 'ONLINE' },
    { id: 'Steering_Gear_Room', name: 'Steering Gear Room', status: 'ONLINE' },
  ],
}

// Known vessel name to ID mapping for cross-referencing
const VESSEL_NAME_TO_ID: Record<string, string> = {
  'LOWLANDS HOPE': '10',
  'LOWLANDS AMBER': '11',
  'LOWLANDS DAWN': '14',
  'LOWLANDS FUTURE': '15',
  'LOWLANDS OBERLIN': '16',
  'ASIA UNITY': '28',
}

function normalizeKey(str: string | number): string {
  return String(str).trim().toUpperCase().replace(/[\s\-_]+/g, '')
}

// Global singleton state so all components (Map, PiP, Drawer) share stream status
const isSocketConnected = ref(false)
const shipCamerasMap = ref<Map<string, CameraInfo[]>>(new Map())
const onlineShips = ref<Set<string>>(new Set())
const activeStreams = ref<Map<string, string>>(new Map()) // key: shipId-cameraId -> streamId
const vesselUploadSpeeds = ref<Map<string, number>>(new Map())
const socketInstance = shallowRef<Socket | null>(null)
let isInitialized = false

function indexCameras(key: string, cams: CameraInfo[]) {
  if (!key || !Array.isArray(cams)) return
  const raw = key.trim()
  const norm = normalizeKey(raw)
  shipCamerasMap.value.set(raw, cams)
  shipCamerasMap.value.set(norm, cams)
  shipCamerasMap.value.set(raw.toLowerCase(), cams)

  // Map known vessel IDs
  const vId = VESSEL_NAME_TO_ID[raw] || VESSEL_NAME_TO_ID[raw.toUpperCase()]
  if (vId) {
    shipCamerasMap.value.set(vId, cams)
    shipCamerasMap.value.set(`VESSEL-${vId}`, cams)
  }
  if (/^\d+$/.test(raw)) {
    shipCamerasMap.value.set(`VESSEL-${raw}`, cams)
  }
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
          vesselUploadSpeeds.value.set(shipKey, Number(speed))
          vesselUploadSpeeds.value.set(normalizeKey(shipKey), Number(speed))
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
          vesselUploadSpeeds.value.set(vKey, Number(speed))
          vesselUploadSpeeds.value.set(normalizeKey(vKey), Number(speed))
        }
      })

      socket.on('stream-started', ({ streamId, shipId }: { streamId: string; shipId?: string }) => {
        if (!streamId) return
        const cleanStreamId = streamId.replace(/-(sd|hd)$/, '')
        activeStreams.value.set(cleanStreamId, streamId)
        if (shipId) {
          activeStreams.value.set(`${shipId}`, streamId)
        }
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

  function getVesselCameras(vesselOrId: any): CameraInfo[] {
    if (!vesselOrId) return []

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
  }
}
