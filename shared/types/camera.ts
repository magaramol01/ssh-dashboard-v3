export interface CameraInfo {
  id: string
  name: string
  status: 'ONLINE' | 'OFFLINE'
  lastUpdatedAt?: number
}

export interface VesselCameraData {
  vesselId: number | string
  shipName?: string
  cameras: CameraInfo[]
  uploadSpeed?: number
  lastUpdatedAt?: number
  online?: boolean
}

export interface StreamStartedPayload {
  streamId: string
  shipId?: string | number
}

export interface StreamRequestPayload {
  shipId: string | number
  cameraId: (string | number)[]
  tenantId: string
  quality?: 'sd' | 'hd'
}
