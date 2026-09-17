/**
 * Realtime Marine CCTV Canvas Renderer
 * Provides lightweight, 60fps/20fps-throttled canvas rendering of a live marine
 * CCTV bridge/bow feed with real-time UTC timestamp, wave dynamics, vessel bow,
 * scanlines, and tactical HUD elements inspired by God's Eye View.
 */

export interface MarineCctvOptions {
  vesselName?: string
  cameraName?: string
  sog?: number
  heading?: string
  isDark?: boolean
}

// Deterministic seed helper so each ship has consistent star/sea signatures
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function paintMarineCctv(
  canvas: HTMLCanvasElement,
  timestamp: number,
  options: MarineCctvOptions = {}
) {
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) return

  const w = canvas.width || 272
  const h = canvas.height || 140
  const vesselName = options.vesselName || 'VESSEL'
  const cameraName = options.cameraName || 'FWD MAST'
  const sog = options.sog !== undefined ? options.sog : 12.4
  const heading = options.heading || 'NE'
  const seed = hashString(vesselName)

  // 1. Sky & Nautical Atmosphere
  const skyGradient = ctx.createLinearGradient(0, 0, 0, h * 0.52)
  skyGradient.addColorStop(0, '#040b14')
  skyGradient.addColorStop(0.65, '#0a1a2f')
  skyGradient.addColorStop(1, '#163554')
  ctx.fillStyle = skyGradient
  ctx.fillRect(0, 0, w, h * 0.52)

  // 2. Stars in the upper sky (subtle nautical navigation sky)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)'
  for (let i = 0; i < 14; i++) {
    const sx = ((seed * (i + 1) * 31) % (w - 20)) + 10
    const sy = ((seed * (i + 1) * 17) % (h * 0.38)) + 6
    const twinkle = 0.4 + 0.5 * Math.sin(timestamp * 0.003 + i * 1.5)
    ctx.globalAlpha = twinkle
    ctx.fillRect(sx, sy, 1.2, 1.2)
  }
  ctx.globalAlpha = 1.0

  // Horizon haze line
  ctx.fillStyle = 'rgba(56, 189, 248, 0.15)'
  ctx.fillRect(0, h * 0.515, w, 1.5)

  // 3. Dynamic Ocean Water with Sine Wave Layers
  const oceanGradient = ctx.createLinearGradient(0, h * 0.52, 0, h)
  oceanGradient.addColorStop(0, '#082640')
  oceanGradient.addColorStop(0.5, '#041628')
  oceanGradient.addColorStop(1, '#020b14')
  ctx.fillStyle = oceanGradient
  ctx.fillRect(0, h * 0.52, w, h * 0.48)

  const speedMultiplier = Math.max(0.4, Math.min(2.0, sog / 8))
  const t = timestamp * 0.0018 * speedMultiplier

  // Distant subtle wave layer
  ctx.beginPath()
  ctx.moveTo(0, h * 0.56)
  for (let x = 0; x <= w; x += 8) {
    const waveY = h * 0.56 + Math.sin(x * 0.04 + t + seed) * 1.8
    ctx.lineTo(x, waveY)
  }
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.closePath()
  ctx.fillStyle = 'rgba(10, 42, 70, 0.4)'
  ctx.fill()

  // Mid-ground ocean swell
  ctx.beginPath()
  ctx.moveTo(0, h * 0.68)
  for (let x = 0; x <= w; x += 6) {
    const waveY =
      h * 0.68 +
      Math.sin(x * 0.025 - t * 1.2 + seed * 0.5) * 3.2 +
      Math.cos(x * 0.05 + t) * 1.2
    ctx.lineTo(x, waveY)
  }
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.closePath()
  ctx.fillStyle = 'rgba(8, 32, 54, 0.7)'
  ctx.fill()

  // Foreground rolling sea with crest highlights
  ctx.beginPath()
  ctx.moveTo(0, h * 0.82)
  for (let x = 0; x <= w; x += 4) {
    const waveY =
      h * 0.82 +
      Math.sin(x * 0.022 + t * 1.5) * 4.5 +
      Math.sin(x * 0.06 - t * 0.8) * 1.5
    ctx.lineTo(x, waveY)
  }
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.closePath()
  ctx.fillStyle = '#031220'
  ctx.fill()

  // Wave crest white foam highlights
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  for (let x = 0; x <= w; x += 6) {
    const crestY =
      h * 0.82 +
      Math.sin(x * 0.022 + t * 1.5) * 4.5 +
      Math.sin(x * 0.06 - t * 0.8) * 1.5
    if (Math.sin(x * 0.022 + t * 1.5) > 0.3) {
      ctx.moveTo(x, crestY)
      ctx.lineTo(x + 4, crestY)
    }
  }
  ctx.stroke()

  // 4. Vessel Forecastle / Bow Geometry (Looking Forward)
  const bowX = w * 0.5
  const bowTopY = h * 0.64
  const bowBaseW = w * 0.32

  ctx.beginPath()
  ctx.moveTo(bowX, bowTopY)
  ctx.lineTo(bowX + bowBaseW * 0.5, h)
  ctx.lineTo(bowX - bowBaseW * 0.5, h)
  ctx.closePath()

  const bowGradient = ctx.createLinearGradient(bowX, bowTopY, bowX, h)
  bowGradient.addColorStop(0, '#334155')
  bowGradient.addColorStop(0.3, '#1e293b')
  bowGradient.addColorStop(1, '#0f172a')
  ctx.fillStyle = bowGradient
  ctx.fill()

  // Prow center spine highlight
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(bowX, bowTopY)
  ctx.lineTo(bowX, h)
  ctx.stroke()

  // Jackstaff / forward mast pole
  ctx.strokeStyle = 'rgba(203, 213, 225, 0.6)'
  ctx.lineWidth = 1.0
  ctx.beginPath()
  ctx.moveTo(bowX, bowTopY)
  ctx.lineTo(bowX, bowTopY - 18)
  ctx.stroke()

  // Mast tip navigation light (blinking green/amber)
  const navLightGlow = 0.5 + 0.5 * Math.sin(timestamp * 0.005)
  ctx.fillStyle = `rgba(16, 185, 129, ${navLightGlow})`
  ctx.beginPath()
  ctx.arc(bowX, bowTopY - 18, 1.8, 0, Math.PI * 2)
  ctx.fill()

  // Bow wave foam spray (parting water)
  if (sog > 0.5) {
    ctx.fillStyle = 'rgba(240, 249, 255, 0.45)'
    const sprayW = 6 + Math.min(16, sog * 1.2)
    ctx.beginPath()
    ctx.ellipse(bowX - 18, h * 0.94, sprayW, 4, -0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(bowX + 18, h * 0.94, sprayW, 4, 0.3, 0, Math.PI * 2)
    ctx.fill()
  }

  // 5. Tactical HUD & Sensor Telemetry Overlay
  ctx.save()

  // Center crosshair
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)'
  ctx.lineWidth = 1
  const cx = w * 0.5
  const cy = h * 0.5
  ctx.beginPath()
  // Horiz line with center gap
  ctx.moveTo(cx - 18, cy)
  ctx.lineTo(cx - 5, cy)
  ctx.moveTo(cx + 5, cy)
  ctx.lineTo(cx + 18, cy)
  // Vert line with center gap
  ctx.moveTo(cx, cy - 14)
  ctx.lineTo(cx, cy - 4)
  ctx.moveTo(cx, cy + 4)
  ctx.lineTo(cx, cy + 14)
  ctx.stroke()

  // Horizon pitch indicator notches
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)'
  ctx.beginPath()
  ctx.moveTo(cx - 36, cy)
  ctx.lineTo(cx - 30, cy)
  ctx.moveTo(cx + 30, cy)
  ctx.lineTo(cx + 36, cy)
  ctx.stroke()

  // Real-time UTC Timestamp (Updates continuously)
  const now = new Date()
  const utcString =
    now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'

  ctx.font = '700 9px monospace'
  ctx.fillStyle = '#10b981'
  ctx.fillText(`CAM-01 [${cameraName.toUpperCase()}]`, 8, 14)

  ctx.font = '600 8.5px monospace'
  ctx.fillStyle = 'rgba(226, 232, 240, 0.85)'
  ctx.fillText(utcString, 8, h - 8)

  // Right telemetry: SOG & HDG
  ctx.textAlign = 'right'
  ctx.fillStyle = '#38bdf8'
  ctx.fillText(`${sog.toFixed(1)} KTS // HDG ${heading}`, w - 8, h - 8)
  ctx.textAlign = 'left'

  // Scanline overlay drawn onto canvas
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'
  for (let y = 0; y < h; y += 3) {
    ctx.fillRect(0, y, w, 1)
  }

  ctx.restore()
}

/**
 * Shared Animation Loop Manager
 * Uses a single requestAnimationFrame loop throttled to ~22fps to paint all
 * visible God's Eye CCTV canvases with zero perceptible CPU overhead.
 */
let animFrameId: number | null = null
let lastTick = 0
const TARGET_FRAME_MS = 1000 / 22 // 22 fps throttle

export function startCctvAnimationLoop(containerEl?: HTMLElement | null) {
  if (animFrameId) cancelAnimationFrame(animFrameId)

  function loop(timestamp: number) {
    if (timestamp - lastTick >= TARGET_FRAME_MS) {
      lastTick = timestamp
      const root = containerEl || (typeof document !== 'undefined' ? document : null)
      if (root) {
        const canvases = root.querySelectorAll<HTMLCanvasElement>('.lm-gods-eye-canvas')
        canvases.forEach((canvas) => {
          const vesselName = canvas.getAttribute('data-vessel-name') || 'VESSEL'
          const cameraName = canvas.getAttribute('data-camera-name') || 'FWD MAST'
          const sog = parseFloat(canvas.getAttribute('data-sog') || '0')
          const heading = canvas.getAttribute('data-hdg') || 'N'
          paintMarineCctv(canvas, timestamp, { vesselName, cameraName, sog, heading })
        })
      }
    }
    animFrameId = requestAnimationFrame(loop)
  }

  animFrameId = requestAnimationFrame(loop)
}

export function stopCctvAnimationLoop() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId)
    animFrameId = null
  }
}
