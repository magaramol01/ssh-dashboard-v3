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
      ['VESSEL-28', [{ id: 'cam1', name: 'Bridge Fwd', status: 'ONLINE' as const }]],
    ])
    const vessels = [
      { id: 'VESSEL-28', name: 'Pacific Emerald' },
      { id: 'VESSEL-99', name: 'Atlantic Explorer' },
    ]
    const withCams = filterVesselsWithCameras(vessels, cameraMap)
    assert.equal(withCams.length, 1)
    assert.equal(withCams[0].id, 'VESSEL-28')
  })

  await t.test('paintMarineCctv executes cleanly with mocked canvas', async () => {
    const { paintMarineCctv } = await import('../app/utils/cctv-canvas.js')
    const noop = () => {}
    const mockGradient = { addColorStop: noop }
    const mockCtx = {
      createLinearGradient: () => mockGradient,
      fillRect: noop,
      beginPath: noop,
      moveTo: noop,
      lineTo: noop,
      closePath: noop,
      fill: noop,
      stroke: noop,
      arc: noop,
      ellipse: noop,
      save: noop,
      restore: noop,
      fillText: noop,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
      font: '',
      textAlign: '',
    }
    const mockCanvas = {
      getContext: () => mockCtx,
      width: 272,
      height: 140,
    } as any

    assert.doesNotThrow(() => {
      paintMarineCctv(mockCanvas, 1000, {
        vesselName: 'LOWLANDS HOPE',
        cameraName: 'Forward Mast FA',
        sog: 12.5,
        heading: 'NW',
      })
    })
  })

  await t.test('getNextCamera cycles sequentially across vessel cameras for failover', async () => {
    const { getNextCamera } = await import('../app/utils/camera-stream.js')

    const mockCameras = [
      { id: '1', name: 'Forward Mast FA', status: 'ONLINE' as const },
      { id: '2', name: 'Bridge Wing STBD', status: 'ONLINE' as const },
      { id: '3', name: 'Aft Cargo Deck', status: 'ONLINE' as const },
    ]

    // From Camera 1 -> should failover to Camera 2
    const nextFrom1 = getNextCamera(mockCameras, '1')
    assert.equal(nextFrom1?.id, '2')
    assert.equal(nextFrom1?.name, 'Bridge Wing STBD')

    // From Camera 2 -> should failover to Camera 3
    const nextFrom2 = getNextCamera(mockCameras, '2')
    assert.equal(nextFrom2?.id, '3')
    assert.equal(nextFrom2?.name, 'Aft Cargo Deck')

    // From Camera 3 (last camera) -> should return null indicating all cameras exhausted
    const nextFrom3 = getNextCamera(mockCameras, '3')
    assert.equal(nextFrom3, null)

    // Single camera or empty returns null
    assert.equal(getNextCamera([], '1'), null)
    assert.equal(getNextCamera([{ id: '1', name: 'Solo Cam', status: 'ONLINE' as const }], '1'), null)
  })
})

