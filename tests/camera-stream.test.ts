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
})
