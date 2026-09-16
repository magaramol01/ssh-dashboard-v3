export interface CameraInfo {
  id: string
  name: string
  status: 'ONLINE' | 'OFFLINE'
  lastUpdatedAt?: number
}

export const HLS_BASE_URL = 'https://streaming.smartshipweb.com/hls/'

export function buildHlsStreamUrl(streamId: string): string {
  const cleanId = streamId.trim()
  return `${HLS_BASE_URL}${cleanId}.m3u8`
}

export function buildStreamId(shipId: string | number, cameraId: string | number, quality = 'sd'): string {
  const cleanShip = String(shipId).replace(/\s+/g, '')
  const cleanCam = String(cameraId).replace(/\s+/g, '')
  return `${cleanShip}-${cleanCam}-${quality}`
}

export function extractCameraFromStreamId(streamId: string): { shipId: string; cameraId: string } {
  const cleaned = streamId.replace(/-(sd|hd)$/, '')
  const parts = cleaned.split('-')
  if (parts.length >= 2) {
    return {
      shipId: parts[0] || '',
      cameraId: parts.slice(1).join('-'),
    }
  }
  return { shipId: streamId, cameraId: '' }
}

export function filterVesselsWithCameras<T extends { id: string | number; vesselId?: number }>(
  vessels: T[],
  cameraMap: Map<string | number, CameraInfo[]>
): T[] {
  return vessels.filter((v) => {
    const key = v.id || v.vesselId
    const cams = (key ? cameraMap.get(key) : undefined) || (v.vesselId ? cameraMap.get(v.vesselId) : undefined)
    return Boolean(cams && cams.length > 0)
  })
}
