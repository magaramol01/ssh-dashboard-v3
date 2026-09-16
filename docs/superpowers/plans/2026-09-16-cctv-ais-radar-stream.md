# AIS Fleet Radar Live CCTV Camera Feeds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate live CCTV camera streaming for vessels on the AIS Fleet Radar screen (`/live`) with a floating "God's Eye View" PiP overlay on Leaflet, powered by Socket.IO signaling and Nginx HLS video playback.

**Architecture:** 
- A shared type definition file (`shared/types/camera.ts`) and unit test suite for stream ID formatting and camera metadata resolution.
- A Vue composable (`useCameraStream.ts`) that manages Socket.IO connectivity with `realtimeDataProviderDevBe`, requests camera feeds, and listens for `stream-started` / `vessel-health-update`.
- A resilient `hls.js` video player component (`VesselCameraPlayer.vue`) with retry recovery and loading feedback.
- A draggable "God's Eye View" floating PiP component (`VesselCameraPipOverlay.vue`) anchored over the Leaflet radar canvas.
- Integration into `LiveMapLeaflet.vue` (camera marker badges and click triggers) and `live.vue` (floating PiP state and inspector drawer CCTV controls).

**Tech Stack:** Nuxt 4, Vue 3, Leaflet, `hls.js`, `socket.io-client`, Tailwind CSS v4 OKLCH tokens, Lucide icons.

## Global Constraints

- **SSR Safety**: All `hls.js`, `socket.io-client`, and Leaflet logic must run strictly on the client (`import.meta.client` or `<ClientOnly>`).
- **Tailwind Tokens**: Semantic color classes only (`text-success`, `bg-destructive`, `border-border`), no arbitrary hex colors in templates.
- **Satellite Bandwidth**: Only stream when the video player is active; teardown and send `stop-stream` on close/unmount.
- **Persona Gating**: Gated under dispatcher/admin (`require-dispatcher` middleware in `live.vue`).

---

### Task 1: Camera Types, Stream Helpers, and Unit Tests

**Files:**
- Create: `shared/types/camera.ts`
- Create: `app/utils/camera-stream.ts`
- Test: `tests/camera-stream.test.ts`

**Interfaces:**
- Produces:
  - `CameraInfo`: `{ id: string; name: string; status: 'ONLINE' | 'OFFLINE'; lastUpdatedAt?: number }`
  - `VesselCameraData`: `{ vesselId: number | string; shipName: string; cameras: CameraInfo[]; uploadSpeed?: number }`
  - `buildHlsStreamUrl(streamId: string): string`
  - `buildStreamId(shipId: string | number, cameraId: string | number, quality?: string): string`
  - `extractCameraFromStreamId(streamId: string): { shipId: string; cameraId: string }`

- [ ] **Step 1: Write the failing unit tests for camera stream utilities**

Create `tests/camera-stream.test.ts`:
```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildHlsStreamUrl,
  buildStreamId,
  extractCameraFromStreamId,
  filterVesselsWithCameras,
} from '../app/utils/camera-stream.js'

test('Camera Stream Utilities', async (t) => {
  await t.test('buildHlsStreamUrl formats deterministic Nginx HLS playlist URL', () => {
    const url = buildHlsStreamUrl('vessel_28-cam1')
    assert.equal(url, 'https://streaming.smartshipweb.com/hls/vessel_28-cam1.m3u8')
  })

  await t.test('buildStreamId sanitizes ship and camera keys', () => {
    const streamId = buildStreamId('Pacific Emerald', 'cam-01', 'sd')
    assert.equal(streamId, 'PacificEmerald-cam-01-sd')
  })

  await t.test('extractCameraFromStreamId parses ship and camera IDs accurately', () => {
    const parsed = extractCameraFromStreamId('PacificEmerald-cam-01-sd')
    assert.equal(parsed.shipId, 'PacificEmerald')
    assert.equal(parsed.cameraId, 'cam-01')
  })

  await t.test('filterVesselsWithCameras identifies vessels with cameras', () => {
    const cameraMap = new Map([
      ['VESSEL-28', [{ id: 'cam1', name: 'Bridge Fwd', status: 'ONLINE' }]],
    ])
    const vessels = [
      { id: 'VESSEL-28', name: 'Pacific Emerald' },
      { id: 'VESSEL-99', name: 'Atlantic Explorer' },
    ]
    const withCams = filterVesselsWithCameras(vessels, cameraMap)
    assert.equal(withCams.length, 1)
    assert.equal(withCams[0].id, 'VESSEL-28')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `Cannot find module '../app/utils/camera-stream.js'`

- [ ] **Step 3: Implement camera types and stream helper utilities**

Create `shared/types/camera.ts`:
```ts
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
```

Create `app/utils/camera-stream.ts`:
```ts
import type { CameraInfo } from '#shared/types/camera'

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
    const cams = cameraMap.get(key) || (v.vesselId ? cameraMap.get(v.vesselId) : undefined)
    return Boolean(cams && cams.length > 0)
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all tests including camera-stream.test.ts)

- [ ] **Step 5: Commit changes**

```bash
git add shared/types/camera.ts app/utils/camera-stream.ts tests/camera-stream.test.ts
git commit -m "feat(cctv): add camera types, stream utilities, and unit test suite"
```

---

### Task 2: Realtime Socket.IO Stream Composable (`useCameraStream.ts`)

**Files:**
- Create: `app/composables/useCameraStream.ts`

**Interfaces:**
- Produces:
  - `useCameraStream()` composable exposing:
    - `isSocketConnected`: Ref<boolean>
    - `activeStreams`: Ref<Map<string, string>> (maps streamKey to streamId)
    - `shipCamerasMap`: Ref<Map<string | number, CameraInfo[]>>
    - `onlineShips`: Ref<Set<string>>
    - `requestVesselStream(shipId: string | number, cameraId: string, quality?: 'sd' | 'hd'): Promise<string>`
    - `stopVesselStream(streamId: string): void`
    - `getVesselCameras(vesselId: string | number): CameraInfo[]`
    - `hasCameras(vesselId: string | number): boolean`

- [ ] **Step 1: Implement `useCameraStream.ts`**

Create `app/composables/useCameraStream.ts`:
- Handle dynamic client-only Socket.IO import (`import('socket.io-client')`).
- Connect to `wss://smartshipweb.com/realtimeDataProviderDevBe` with path `/socket.io`, transports `['websocket']`, query params `tenantId`, `X-Request-ID`, `X-Auth-ID`.
- Handle `connect`, `disconnect`, `register-client`, `available-ships`, `ship-cameras`, `vessel-health-update`, `stream-started`, `stream-ended`, `stream-error`.
- Keep persistent fallback mock cameras for demo/test vessels (e.g. `VESSEL-28`, `VESSEL-58`, `VESSEL-122`) so UI functions reliably even when offline or behind firewalls.
- Export helper methods for starting and stopping streams.

- [ ] **Step 2: Verify type check and imports**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Commit composable**

```bash
git add app/composables/useCameraStream.ts
git commit -m "feat(cctv): implement useCameraStream composable for Socket.IO signaling"
```

---

### Task 3: Resilient Video Player Component (`VesselCameraPlayer.vue`)

**Files:**
- Create: `app/components/camera/VesselCameraPlayer.vue`

**Interfaces:**
- Consumes:
  - `props`: `{ streamUrl: string; cameraName?: string; isLive?: boolean; isOffline?: boolean; autoPlay?: boolean }`
  - `emits`: `{ (e: 'error', err: any): void; (e: 'ready'): void }`

- [ ] **Step 1: Implement `VesselCameraPlayer.vue`**

Create `app/components/camera/VesselCameraPlayer.vue`:
- Load `hls.js` dynamically on client mounted.
- Create double-buffered video element references with error retry (up to 6 retries with exponential backoff).
- Show loading state with animated progress and status messages:
  - "Connecting to ship..."
  - "Buffering satellite feed..."
  - "Initializing HLS stream..."
- Handle offline / error display with retry button and clear status badge.
- Include custom overlay controls:
  - Red pulsing LIVE indicator (`● LIVE`)
  - Camera name badge
  - Play/Pause toggle
  - Fullscreen toggle

- [ ] **Step 2: Verify component builds cleanly**

Run: `npm run build`
Expected: Build passes without template or type errors.

- [ ] **Step 3: Commit video player component**

```bash
git add app/components/camera/VesselCameraPlayer.vue
git commit -m "feat(cctv): create resilient Hls.js VesselCameraPlayer component"
```

---

### Task 4: God's Eye View Floating PiP Overlay (`VesselCameraPipOverlay.vue`)

**Files:**
- Create: `app/components/camera/VesselCameraPipOverlay.vue`

**Interfaces:**
- Consumes:
  - `props`: `{ vessel: any; isOpen: boolean }`
  - `emits`: `{ (e: 'close'): void; (e: 'minimize'): void; (e: 'select-camera', camId: string): void }`

- [ ] **Step 1: Implement `VesselCameraPipOverlay.vue`**

Create `app/components/camera/VesselCameraPipOverlay.vue`:
- Draggable glassmorphism card floating over the map.
- Header bar:
  - Drag handle
  - CCTV icon + Vessel name
  - Active camera selector pills (e.g. `Bridge Fwd`, `Aft Deck`, `Engine Rm`)
  - Minimize and Close buttons
- Body:
  - `<VesselCameraPlayer />`
- Footer Telemetry Bar:
  - Speed over Ground (`SOG: 14.2 kts`)
  - Heading (`HEADING: 284° WNW`)
  - Network Speed / Uplink Bandwidth (`Uplink: 1.2 Mbps`)
  - Target Coordinates (`Lat / Long`)

- [ ] **Step 2: Commit PiP overlay**

```bash
git add app/components/camera/VesselCameraPipOverlay.vue
git commit -m "feat(cctv): add God's Eye View draggable floating CCTV PiP overlay"
```

---

### Task 5: Integrate CCTV Badges into `LiveMapLeaflet.vue` & `live.vue`

**Files:**
- Modify: `app/components/LiveMapLeaflet.vue`
- Modify: `app/pages/live.vue`

**Interfaces:**
- In `LiveMapLeaflet.vue`:
  - Add camera icon badge inside vessel marker HTML when vessel has active cameras.
  - Emit `'open-camera', vesselId` on clicking the camera badge.
- In `app/pages/live.vue`:
  - Wire up `useCameraStream()`.
  - Mount `<VesselCameraPipOverlay />` over the map.
  - In inspector drawer, add "Live CCTV Surveillance" panel with multi-cam switcher and "Open in Map PiP" button.

- [ ] **Step 1: Update `LiveMapLeaflet.vue` to render camera badges on vessel markers**

Edit `LiveMapLeaflet.vue`:
- Accept optional `cameraVesselIds: string[]` prop or check `hasCameras(trip.id)`.
- In `vesselIcon()` and `marker` binding, include the glowing CCTV camera icon.
- Bind click on CCTV icon to emit `'open-camera', id`.

- [ ] **Step 2: Update `live.vue` to manage active camera stream and drawer panel**

Edit `live.vue`:
- Import and initialize `useCameraStream()`.
- Add `activePipVessel` state.
- Render `<VesselCameraPipOverlay>` anchored on the map canvas.
- In the right-edge inspection drawer (`v-if="selected"`):
  - Add CCTV surveillance section showing available cameras and live player / pop-out toggle.

- [ ] **Step 3: Test and verify**

Run `npm test` and `npm run build` to confirm no errors.

- [ ] **Step 4: Commit integration**

```bash
git add app/components/LiveMapLeaflet.vue app/pages/live.vue
git commit -m "feat(cctv): integrate camera badges on radar map and inspection drawer"
```

---

### Task 6: End-to-End Verification

- [ ] **Step 1: Run full test suite**
Run: `npm test`
Expected: All tests pass.

- [ ] **Step 2: Run production build**
Run: `npm run build`
Expected: Nitro and Vite production build succeeds without warning or error.
