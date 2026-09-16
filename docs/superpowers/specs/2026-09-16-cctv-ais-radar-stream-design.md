# AIS Fleet Radar Live CCTV Camera Feeds Design Specification

## 1. Overview & Goals
Provide a live CCTV video streaming overlay for camera-equipped vessels on the AIS Fleet Radar screen (`/live`), inspired by the [God's Eye View](https://github.com/bilawalsidhu/gods-eye-view/blob/main/docs/media/05-traffic-to-cctv.gif) spatial telemetry visualization.

The operator can inspect active vessels on the radar map, see which vessels have live CCTV cameras installed, and open a floating, draggable Picture-in-Picture (PiP) video stream powered by Socket.IO signaling and Nginx HLS playback.

---

## 2. Architecture & Data Flow

### 2.1 Signaling & Stream Lifecycle (Socket.IO)
1. **Connection**:
   - Establish a Socket.IO client connection to the realtime data provider (default: `wss://smartshipweb.com/realtimeDataProviderDevBe` with path `/socket.io`, websocket-only transport).
   - Connection query parameters include:
     - `tenantId`: active tenant (e.g. `aesm` or user's active tenant)
     - `X-Request-ID`: UUID generated per session
     - `X-Auth-ID`: active authentication token
2. **Registration & Health Discovery**:
   - On connect, client emits `register-client`.
   - Server emits:
     - `available-ships`: list of currently online ship identifiers.
     - `ship-cameras` / `vessel-health-update`: payloads containing vessel cameras (`{ cameraId, cameraName, status, lastUpdatedTime }`) and uplink speed.
3. **Stream Initiation**:
   - When a vessel camera is opened:
     ```js
     socket.emit("request-stream", {
       shipId,
       cameraId: [cameraId],
       tenantId,
       quality: "sd"
     })
     ```
   - Server responds with `stream-started` event:
     ```js
     { streamId: "..." }
     ```
4. **HLS Playback**:
   - Video URL constructed deterministically:
     `https://streaming.smartshipweb.com/hls/${streamId}.m3u8`
   - Rendered using `hls.js` with automated retry, low latency, and sliding window buffer.
5. **Stream Teardown**:
   - When closing the PiP player or switching vessels:
     ```js
     socket.emit("stop-stream", { streamId, tenantId })
     ```
   - Destroy `hls.js` instance to conserve ship-to-shore satellite bandwidth.

---

## 3. UI/UX & Components

### 3.1 `LiveMapLeaflet.vue` (Map Integration)
- **Vessel Marker Badge**: Vessels with cameras display a camera icon badge (with a pulsing green/amber live dot depending on online state).
- **Map Interaction**:
  - Clicking the camera icon opens the floating God's Eye View PiP overlay anchored over the ship's current position.

### 3.2 `VesselCameraPipOverlay.vue` (God's Eye View PiP Overlay)
- Floating over the Leaflet map with a dark glassmorphism aesthetic.
- Features:
  - Header: Vessel name, active camera badge, live status pill (`● LIVE`), minimize and close buttons.
  - Video stage: Double-buffered `hls.js` player with loading skeleton, offline fallback, and error recovery.
  - Camera switcher: Dropdown or pill tabs if a vessel has multiple cameras (e.g., *Bridge Forward*, *Engine Room*, *Poop Deck*).
  - Telemetry bar: Vessel SOG, heading, and uplink bandwidth.
  - Draggable across the map canvas.

### 3.3 `live.vue` (Inspector Drawer CCTV Panel)
- When a vessel is selected in the right-edge inspection drawer, a "Live CCTV Feeds" section provides:
  - Video stream player or a button to pop out the floating God's Eye View PiP.
  - Camera online status and camera list.

---

## 4. Error Handling & Edge Cases
- **Satellite Latency / Buffering**: Display clean loader with informative status text ("Connecting to vessel...", "Initializing HLS stream...").
- **Vessel Offline**: Clear warning chip ("Camera currently offline") with retry button.
- **Inactivity & Bandwidth Saver**: Automatically stop stream on modal close or after configurable background timeout.
- **SSR Safety**: `hls.js` and Socket.IO wrapped in client-only checks (`import.meta.client`).
